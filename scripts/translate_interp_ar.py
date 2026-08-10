# -*- coding: utf-8 -*-
"""
Render the Hebrew verse-commentary (verses.interpretation) into professional
Arabic in verses.interpretation_ar, via the Message Batches API.

This is a TRANSLATION step, never a second act of interpretation: the Arabic
must say exactly what the Hebrew says. The commentary is the distillation of
Samaritan sources and its claims are attributed by name, so a translator who
"improves" a sentence silently rewrites what a named authority is said to have
held. Hence the deliberately strict system prompt below.

Batched per CHAPTER (not per verse) so the translator sees the whole chapter's
commentary at once and keeps terminology consistent across its verses.

Flow — each step resumable, nothing is ever paid for twice:
  submit  -> one request per chapter that still needs Arabic
  poll    -> progress counts
  collect -> write the Arabic straight into verses.interpretation_ar

Usage:
  py -3 scripts/translate_interp_ar.py submit [--limit N] [--dry-run] [--books 1,2,3,4]
  py -3 scripts/translate_interp_ar.py poll
  py -3 scripts/translate_interp_ar.py collect [--apply]
"""
import os
import sys
import json
import sqlite3
import argparse

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import regen_interpretation as R          # MODEL, DB_PATH, _load_dotenv

_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STATE_PATH = os.path.join(_ROOT, 'data', 'interp_ar_batch_state.json')

SYSTEM = (
    "أنت مترجم محترف من العبرية إلى العربية، متخصّص في النصوص الدينية "
    "والتفسيرية السامرية. مهمّتك ترجمة تفسير الآيات المرفق ترجمةً أمينةً "
    "ودقيقة إلى العربية الفصحى.\n\n"
    "قواعد ملزمة:\n"
    "1. لا تُغيّر المعنى إطلاقًا: لا تَزِد فكرةً غير موجودة، ولا تحذف فكرةً "
    "موجودة، ولا تُلطّف رأيًا ولا تُقوِّه. النصّ العربي يجب أن يقول ما يقوله "
    "النصّ العبري، لا أكثر ولا أقل.\n"
    "2. نسبة الأقوال إلى أصحابها مقدّسة. إذا نُسِب قولٌ إلى شخص أو مصدر، "
    "احتفظ بالنسبة كما هي بالضبط. استعمل الأسماء بصيغتها العربية المعروفة عند "
    "الطائفة السامرية: صدقة الحكيم، مرقة، تيبات مرقة (تِيبات مَرقَة)، يعقوب بن "
    "هارون الكاهن، سرّ القلوب، فنحاس بن إبراهيم الكاهن، ألعازار بن صدقة. "
    "ولا تنسب شيئًا إلى أحد لم يُذكَر في النصّ العبري.\n"
    "3. الاقتباسات من نصّ التوراة أو من الترجوم الآرامي التي ترد بين علامتَي "
    "تنصيص: اتركها بحروفها العبرية كما هي داخل علامات التنصيص، ثم — إن لزم "
    "الفهم — أضِف معناها بالعربية بعدها مباشرة. لا تستبدل الاقتباس بترجمته.\n"
    "4. المصطلحات الدينية بمقابلها العربي المتعارف عليه عند السامريين "
    "(جبل جريزيم، الكاهن الأكبر، التوراة، الترجوم).\n"
    "5. اكتب نثرًا عربيًا سليمًا ومترابطًا بلا عناوين ولا تنسيق Markdown ولا "
    "نجوم ولا قوائم مرقّمة — بالضبط كما هو شكل النصّ العبري.\n"
    "6. أعِد ترجمةً لكلّ آية وردت في المُدخَل، بنفس رقم الآية تمامًا."
)

TOOL = {
    'name': 'submit_arabic_translation',
    'description': 'Submit the Arabic translation of this chapter\'s verse commentary.',
    'input_schema': {
        'type': 'object',
        'properties': {
            'verses': {
                'type': 'array',
                'items': {
                    'type': 'object',
                    'properties': {
                        'number': {'type': 'string', 'description': 'verse number, exactly as given in the input'},
                        'arabic': {'type': 'string', 'description': 'the Arabic translation of that verse\'s commentary'},
                    },
                    'required': ['number', 'arabic'],
                },
            },
        },
        'required': ['verses'],
    },
}


def _client():
    import anthropic
    R._load_dotenv()
    key = os.environ.get('ANTHROPIC_API_KEY')
    if not key:
        sys.exit('ANTHROPIC_API_KEY not set (checked .env and environment)')
    return anthropic.Anthropic(api_key=key, timeout=600.0, max_retries=5)


def _pending(books, redo=False):
    """Chapters holding Hebrew commentary whose Arabic column is still empty."""
    conn = sqlite3.connect(R.DB_PATH)
    cur = conn.cursor()
    names = dict(cur.execute('SELECT id, name FROM books').fetchall())
    qmarks = ','.join('?' * len(books))
    rows = cur.execute(
        f'SELECT id, book_id, number FROM sam_chapters WHERE book_id IN ({qmarks}) '
        'ORDER BY book_id, CAST(number AS INTEGER)', books).fetchall()
    q = conn.cursor()
    out = []
    for cid, bid, num in rows:
        vs = q.execute(
            'SELECT number, interpretation, interpretation_ar FROM verses WHERE sam_ch_id=? '
            'AND interpretation IS NOT NULL AND TRIM(interpretation)<>"" '
            'ORDER BY CAST(number AS INTEGER)', (cid,)).fetchall()
        if not vs:
            continue
        todo = vs if redo else [v for v in vs if not (v[2] or '').strip()]
        if not todo:
            continue
        body = '\n\n'.join('[%s] %s' % (n, (he or '').strip()) for n, he, _ in todo)
        out.append({'ch_id': cid,
                    'prompt': 'تفسير الآيات من %s، الإصحاح السامري %s.\n'
                              'ترجم تفسير كلّ آية إلى العربية، محافظًا على رقم الآية:\n\n%s'
                              % (names[bid], num, body)})
    conn.close()
    return out


def cmd_submit(args):
    books = [int(b) for b in args.books.split(',')]
    pend = _pending(books, args.redo)
    if args.limit:
        pend = pend[:args.limit]
    print(f'chapters still needing Arabic: {len(pend)}')
    if not pend:
        print('nothing to do.')
        return
    print(f'total prompt size: {sum(len(p["prompt"]) for p in pend):,} chars')
    if args.dry_run:
        print('DRY RUN — no batch created.')
        return

    requests = [{
        'custom_id': f'ar{p["ch_id"]}',
        'params': {
            'model': R.MODEL,
            'max_tokens': 8192,
            'system': SYSTEM,
            'tools': [TOOL],
            'tool_choice': {'type': 'tool', 'name': 'submit_arabic_translation'},
            'messages': [{'role': 'user', 'content': p['prompt']}],
        },
    } for p in pend]

    client = _client()
    prior = json.load(open(STATE_PATH, encoding='utf-8'))['batches'] if os.path.exists(STATE_PATH) else []
    batches = list(prior)
    for i in range(0, len(requests), args.chunk):
        part = requests[i:i + args.chunk]
        b = client.messages.batches.create(requests=part)
        batches.append({'batch_id': b.id, 'n': len(part)})
        json.dump({'batches': batches}, open(STATE_PATH, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
        print(f'  batch {len(batches)}: {b.id}  ({len(part)} requests)')
    print(f'submitted {len(requests)} requests; state -> {STATE_PATH}')


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
    conn = sqlite3.connect(R.DB_PATH)
    cur = conn.cursor()
    vq = conn.cursor()
    written = errored = unmatched = 0
    for rec in _state()['batches']:
        b = client.messages.batches.retrieve(rec['batch_id'])
        if b.processing_status != 'ended':
            print(f'  skipping {b.id} — still {b.processing_status}')
            continue
        for res in client.messages.batches.results(rec['batch_id']):
            ch_id = int(res.custom_id[2:])          # strip the "ar" prefix
            if res.result.type != 'succeeded':
                errored += 1
                continue
            payload = next((blk.input for blk in res.result.message.content if blk.type == 'tool_use'), None)
            if payload is None:
                errored += 1
                continue
            n2i = {str(n): i for i, n in
                   vq.execute('SELECT id, number FROM verses WHERE sam_ch_id=?', (ch_id,)).fetchall()}
            for item in (payload.get('verses') or []):
                if not isinstance(item, dict):
                    continue
                vid = n2i.get(str(item.get('number', '')).strip())
                txt = (item.get('arabic') or '').strip()
                if vid is None:
                    unmatched += 1
                    continue
                if not txt:
                    continue
                written += 1
                if args.apply:
                    cur.execute('UPDATE verses SET interpretation_ar=? WHERE id=?', (txt, vid))
    if args.apply:
        conn.commit()
    conn.close()
    print(f'  translations {"written" if args.apply else "ready (DRY RUN)"}: {written}'
          f' | failed requests {errored} | unmatched verse numbers {unmatched}')
    if not args.apply:
        print('  re-run with --apply to write into verses.interpretation_ar')


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest='cmd', required=True)
    s = sub.add_parser('submit')
    s.add_argument('--limit', type=int)
    s.add_argument('--dry-run', action='store_true')
    s.add_argument('--chunk', type=int, default=100)
    s.add_argument('--books', default='1,2,3,4,5')
    s.add_argument('--redo', action='store_true', help='retranslate even where Arabic already exists')
    sub.add_parser('poll')
    cl = sub.add_parser('collect')
    cl.add_argument('--apply', action='store_true')
    a = ap.parse_args()
    {'submit': cmd_submit, 'poll': cmd_poll, 'collect': cmd_collect}[a.cmd](a)
