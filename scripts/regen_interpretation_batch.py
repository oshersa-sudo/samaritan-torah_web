# -*- coding: utf-8 -*-
"""
Batch-API version of regen_interpretation.py — same prompts, same model, same
Samaritan-only sourcing rules (it imports SYSTEM/TOOL/gather_chapter/build_prompt
straight from that script, so the two can never drift apart), but submitted
through the Message Batches API at roughly half the per-token price instead of
560 synchronous calls.

Flow (each step is resumable — nothing is ever paid for twice):
  submit  -> build a request per not-yet-done chapter, create ONE batch,
             save its id to data/interp_batch_state.json
  poll    -> report the batch's progress counts
  collect -> download results, merge into data/interp_regen_output.json
             (the same checkpoint the sync script and load_interpretations.py use)

Usage:
  py -3 scripts/regen_interpretation_batch.py submit  [--limit N] [--dry-run]
  py -3 scripts/regen_interpretation_batch.py poll
  py -3 scripts/regen_interpretation_batch.py collect
"""
import os
import sys
import json
import time
import sqlite3
import argparse

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import regen_interpretation as R   # SYSTEM, TOOL, MODEL, gather_chapter, build_prompt, DB_PATH, OUT_PATH

_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STATE_PATH = os.path.join(_ROOT, 'data', 'interp_batch_state.json')


def _client():
    import anthropic
    R._load_dotenv()
    key = os.environ.get('ANTHROPIC_API_KEY')
    if not key:
        sys.exit('ANTHROPIC_API_KEY not set (checked .env and environment)')
    # A single all-560 POST is a >2MB upload and died on the SDK's default
    # timeout, so allow plenty of time (and let the SDK retry transient errors).
    return anthropic.Anthropic(api_key=key, timeout=600.0, max_retries=5)


def _checkpoint():
    if os.path.exists(R.OUT_PATH):
        return json.load(open(R.OUT_PATH, encoding='utf-8'))
    return {}


def _pending_chapters():
    """Every in-scope Samaritan chapter with no commentary in the checkpoint yet."""
    conn = sqlite3.connect(R.DB_PATH)
    cur = conn.cursor()
    book_names = dict(cur.execute('SELECT id, name FROM books').fetchall())
    rows = cur.execute(
        'SELECT id, book_id, number FROM sam_chapters WHERE book_id IN (1,2,3,4) '
        'ORDER BY book_id, number').fetchall()
    done = set(str(k) for k in _checkpoint().keys())
    q = conn.cursor()
    out = []
    for cid, bid, num in rows:
        if str(cid) in done:
            continue
        verses, sources = R.gather_chapter(q, cid, book_names[bid])
        if not verses:
            continue
        out.append({'ch_id': cid, 'book': book_names[bid], 'number': num,
                    'prompt': R.build_prompt(book_names[bid], num, verses, sources)})
    conn.close()
    return out


def cmd_submit(args):
    pend = _pending_chapters()
    if args.limit:
        pend = pend[:args.limit]
    print(f'chapters still needing commentary: {len(pend)}')
    if not pend:
        print('nothing to do — every in-scope chapter is already in the checkpoint.')
        return
    total_chars = sum(len(p['prompt']) for p in pend)
    print(f'total prompt size: {total_chars:,} chars')
    if args.dry_run:
        print('DRY RUN — no batch created.')
        return

    requests = [{
        'custom_id': f'ch{p["ch_id"]}',
        'params': {
            'model': R.MODEL,
            'max_tokens': 4096,
            'system': R.SYSTEM,
            'tools': [R.TOOL],
            'tool_choice': {'type': 'tool', 'name': 'submit_chapter_commentary'},
            'messages': [{'role': 'user', 'content': p['prompt']}],
        },
    } for p in pend]

    # Submitted in chunks rather than one huge POST: keeps each upload small
    # enough to be reliable, and a mid-way failure leaves the already-created
    # batches recorded in the state file instead of losing everything.
    client = _client()
    prior = json.load(open(STATE_PATH, encoding='utf-8'))['batches'] if os.path.exists(STATE_PATH) else []
    batches = list(prior)
    size = args.chunk
    for i in range(0, len(requests), size):
        part = requests[i:i + size]
        b = client.messages.batches.create(requests=part)
        batches.append({'batch_id': b.id, 'n': len(part)})
        json.dump({'batches': batches}, open(STATE_PATH, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
        print(f'  batch {len(batches)}: {b.id}  ({len(part)} requests)')
    print(f'submitted {len(requests)} requests across {len(batches) - len(prior)} batch(es)')
    print(f'state saved to {STATE_PATH}')
    print('next: py -3 scripts/regen_interpretation_batch.py poll')


def _state():
    if not os.path.exists(STATE_PATH):
        sys.exit('no batch state found — run "submit" first.')
    return json.load(open(STATE_PATH, encoding='utf-8'))


def cmd_poll(args):
    client = _client()
    tot = {'processing': 0, 'succeeded': 0, 'errored': 0, 'canceled': 0, 'expired': 0}
    all_ended = True
    for rec in _state()['batches']:
        b = client.messages.batches.retrieve(rec['batch_id'])
        c = b.request_counts
        for k in tot:
            tot[k] += getattr(c, k)
        if b.processing_status != 'ended':
            all_ended = False
        print(f"  {b.id}  {b.processing_status:12s} proc {c.processing:4d} ok {c.succeeded:4d} err {c.errored:3d}")
    print(f"TOTAL: processing {tot['processing']} | succeeded {tot['succeeded']} | errored {tot['errored']} "
          f"| canceled {tot['canceled']} | expired {tot['expired']}")
    print('ALL ENDED — run collect' if all_ended else 'still running')


def cmd_collect(args):
    client = _client()
    ckpt = _checkpoint()
    added = errored = skipped = 0
    err_samples = []
    for rec in _state()['batches']:
        b = client.messages.batches.retrieve(rec['batch_id'])
        if b.processing_status != 'ended':
            print(f'  skipping {b.id} — still {b.processing_status}')
            continue
        for res in client.messages.batches.results(rec['batch_id']):
            ch_id = res.custom_id[2:]           # strip the "ch" prefix
            if res.result.type != 'succeeded':
                errored += 1
                if len(err_samples) < 5:
                    err_samples.append((res.custom_id, res.result.type))
                continue
            payload = None
            for block in res.result.message.content:
                if block.type == 'tool_use':
                    payload = block.input
                    break
            if payload is None:
                errored += 1
                continue
            if ch_id in ckpt:
                skipped += 1
                continue
            ckpt[ch_id] = payload
            added += 1

    json.dump(ckpt, open(R.OUT_PATH, 'w', encoding='utf-8'), ensure_ascii=False)
    print(f'merged into {R.OUT_PATH}')
    print(f'  added {added} | already present {skipped} | failed {errored}')
    if err_samples:
        print('  first failures:', err_samples)
    print(f'  checkpoint now holds {len(ckpt)} chapters')
    print('next: review, then py -3 scripts/load_interpretations.py --apply')


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest='cmd', required=True)
    s = sub.add_parser('submit'); s.add_argument('--limit', type=int); s.add_argument('--dry-run', action='store_true')
    s.add_argument('--chunk', type=int, default=100, help='requests per batch POST')
    sub.add_parser('poll')
    sub.add_parser('collect')
    a = ap.parse_args()
    {'submit': cmd_submit, 'poll': cmd_poll, 'collect': cmd_collect}[a.cmd](a)
