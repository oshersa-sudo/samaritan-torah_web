# -*- coding: utf-8 -*-
"""
Free, key-less Hebrew-Hebrew word lookups from public web sources.

Queries free MediaWiki APIs (Hebrew Wiktionary for the lexical definition,
Hebrew Wikipedia for an encyclopedic gloss) and merges them into one short
summary tied to the looked-up word. No API key, no registration, no cost —
suitable for the runtime app (unlike the build-time Anthropic scripts, the
shipped APK must stay key-less).

The Wiktionary definition is parsed from raw wikitext, where a single "#"
marks a real definition and "#:" / "#*" mark example sentences and citations.
Parsing the structure (rather than the flattened text) lets us keep only the
definitions, so example sentences no longer leak in and distort the result.

lookup(word) -> (summary_text, [(source_name, site), ...]) or None
"""
import re
import ssl
import json
import time
import socket
import difflib
import urllib.request
import urllib.parse
import urllib.error

_UA    = {'User-Agent': 'Mozilla/5.0 (SamaritanTorahApp)'}
_MAX   = 550          # max chars of the merged summary (concise, not terse)
_cache = {}           # cleaned word -> (summary, sources)

_NIKUD  = re.compile(u'[֑-ׇ]')          # niqqud + cantillation
_NONHEB = re.compile(u'[^א-ת ]')        # keep Hebrew letters + space
_SENT   = re.compile(u'(?<=[.!?׃])\\s+')
_DEF_RE = re.compile(r'^#+(?![:*])')     # wikitext definition item (not #: / #*)
# Wiktionary editorial boilerplate that is not part of the definition.
_JUNK   = (u'אין משפט מדגים', u'מוזמנים לתרום', u'רשימה של ערכים',
           u'משפטים מדגימים')

# Wikimedia's TLS chain is rejected by stale CA stores ("certificate has
# expired"). For these read-only public dictionaries we fall back to an
# unverified context so the feature still works where the bundled CA store is
# out of date (older Android builds, etc.). Once a cert failure is seen we keep
# using the unverified context for the rest of the session.
_UNVERIFIED = ssl._create_unverified_context()
_ctx        = None                       # None = default (verified) context
_RETRYABLE  = {429, 500, 502, 503, 504}  # transient HTTP statuses worth a retry


def _urlopen(url, timeout=12, retries=2):
    """Open a URL with retry/backoff for transient failures (rate-limits,
    timeouts) and a one-time fallback to an unverified TLS context."""
    global _ctx
    req = urllib.request.Request(url, headers=_UA)
    for attempt in range(retries + 1):
        try:
            return urllib.request.urlopen(req, timeout=timeout, context=_ctx)
        except urllib.error.HTTPError as e:
            if e.code in _RETRYABLE and attempt < retries:
                time.sleep(0.5 * (attempt + 1))
                continue
            raise
        except urllib.error.URLError as e:
            if _ctx is None and isinstance(getattr(e, 'reason', None), ssl.SSLError):
                _ctx = _UNVERIFIED       # stale CA store -> switch for the session
                continue                 # retry immediately with the new context
            if attempt < retries:
                time.sleep(0.5 * (attempt + 1))
                continue
            raise


def _clean_word(word):
    """Strip niqqud/te'amim and punctuation, leaving bare Hebrew letters."""
    w = _NIKUD.sub('', word or '')
    w = _NONHEB.sub(' ', w)
    return re.sub(r'\s+', ' ', w).strip()


def _dot(text):
    text = text.strip()
    return text if text and text[-1] in '.!?׃' else text + '.'


def _api(host, params):
    url = 'https://%s/w/api.php?%s' % (host, urllib.parse.urlencode(params))
    return json.loads(_urlopen(url).read().decode('utf-8'))


def _pages(d):
    for pid, page in ((d.get('query') or {}).get('pages') or {}).items():
        if str(pid) != '-1':            # skip missing pages
            yield page


def _strip_wiki(s):
    """Reduce a wikitext fragment to plain readable Hebrew."""
    s = re.sub(r'<ref[^>]*>.*?</ref>', '', s, flags=re.S)
    s = re.sub(r'<ref[^>]*/>', '', s)
    s = re.sub(r'<[^>]+>', '', s)
    # links: [[target|label]] -> label, [[target]] -> target
    s = re.sub(r'\[\[(?:[^\]|]*\|)?([^\]]+)\]\]', r'\1', s)
    # templates {{...}} (drop, resolving nesting inside-out)
    while True:
        new = re.sub(r'\{\{[^{}]*\}\}', '', s)
        if new == s:
            break
        s = new
    s = s.replace("'''", '').replace("''", '').replace('[[', '').replace(']]', '')
    return re.sub(r'[ \t]+', ' ', s).strip(' #*:')


_W_WIKT  = ('ויקימילון', 'he.wiktionary.org')
_W_WIKIP = ('ויקיפדיה',  'he.wikipedia.org')


def _chunks(seq, n):
    seq = list(seq)
    for i in range(0, len(seq), n):
        yield seq[i:i + n]


def _alias_map(query):
    """Map each result title back to the input title we asked for, following
    MediaWiki's normalization and redirect chains."""
    alias = {}
    for n in query.get('normalized') or []:
        alias[n['to']] = n['from']
    for r in query.get('redirects') or []:
        alias[r['to']] = alias.get(r['from'], r['from'])
    return alias


def _parse_wiktext(content):
    """Head-word + definition senses from one Wiktionary page's wikitext.
    Only real definitions (#) are kept; example sentences and citations
    (#:, #*) are excluded, so examples no longer leak in and distort the
    result. Stops at the first sub-section and at a second homograph."""
    headword, senses, sections = None, [], 0
    for raw in content.split('\n'):
        s = raw.strip()
        if s.startswith('=='):
            if s.startswith('==='):              # sub-section
                if senses:                       # past the senses -> stop
                    break
                continue
            sections += 1                        # level-2 head-word section
            if sections == 1:
                headword = _strip_wiki(s.strip('= '))
                continue
            break                                # a second homograph -> stop
        if not _DEF_RE.match(s):
            continue
        d = _strip_wiki(re.sub(r'^#+\s*', '', s))
        if not d or any(j in d for j in _JUNK):
            continue
        senses.append(d)
    if not senses:
        return None
    if len(senses) > 1:
        body = ' '.join('(%d) %s' % (i + 1, _dot(t)) for i, t in enumerate(senses))
    else:
        body = _dot(senses[0])
    return ('%s – %s' % (headword, body)) if headword else body


def _bulk_wiktionary(titles):
    """{title: definition_text} for the given titles, in as few requests as
    MediaWiki allows (up to 50 titles per query)."""
    out = {}
    for chunk in _chunks(titles, 50):
        d = _api('he.wiktionary.org', {
            'action': 'query', 'prop': 'revisions', 'rvprop': 'content',
            'rvslots': 'main', 'redirects': 1, 'format': 'json',
            'titles': '|'.join(chunk)})
        q = d.get('query') or {}
        alias = _alias_map(q)
        for page in (q.get('pages') or {}).values():
            revs = page.get('revisions') or []
            if not revs:
                continue
            slot = (revs[0].get('slots') or {}).get('main') or {}
            content = slot.get('content') or slot.get('*') or revs[0].get('*')
            text = _parse_wiktext(content) if content else None
            if text:
                out[alias.get(page.get('title'), page.get('title'))] = text
    return out


def _bulk_wikipedia(titles):
    """{title: encyclopedic_gloss} for the given titles (up to 20 extracts per
    query). Disambiguation pages are skipped."""
    out = {}
    for chunk in _chunks(titles, 20):
        d = _api('he.wikipedia.org', {
            'action': 'query', 'prop': 'extracts|pageprops', 'exintro': 1,
            'explaintext': 1, 'exlimit': 'max', 'redirects': 1,
            'format': 'json', 'titles': '|'.join(chunk)})
        q = d.get('query') or {}
        alias = _alias_map(q)
        for page in (q.get('pages') or {}).values():
            if 'disambiguation' in (page.get('pageprops') or {}):
                continue
            txt = (page.get('extract') or '').strip()
            if not txt or 'התכוונתם' in txt:
                continue
            sents = _SENT.split(txt.replace('\n', ' '))
            val = ' '.join(sents[:2]).strip()
            if val:
                out[alias.get(page.get('title'), page.get('title'))] = val
    return out


def _similar(a, b):
    return difflib.SequenceMatcher(None, a, b).ratio() > 0.8


def _summarize(parts):
    """Merge texts from several sources into one summary, skipping near-duplicate
    sentences and capping the total length (cuts only on sentence boundaries)."""
    out, seen, total = [], [], 0
    for part in parts:
        for sent in _SENT.split(part):
            sent = sent.strip()
            if not sent:
                continue
            norm = _clean_word(sent)
            if any(_similar(norm, s) for s in seen):
                continue
            seen.append(norm)
            if out and total + len(sent) > _MAX:
                return ' '.join(out)
            out.append(sent)
            total += len(sent) + 1
    return ' '.join(out)


def has_internet(timeout=4):
    try:
        with socket.create_connection(('he.wiktionary.org', 443), timeout=timeout):
            return True
    except OSError:
        return False


def lookup_many(words):
    """Look up many words at once and return {word: (summary, sources)} for the
    ones found. Fetches in bulk (a couple of MediaWiki requests for the whole
    set instead of one per word), which keeps us well under rate limits. Results
    are cached per process; misses are cached too, but only when the bulk fetch
    actually succeeded — a transient network failure leaves them uncached so the
    next pass retries."""
    raw_clean = {}
    for w in words:
        c = _clean_word(w)
        if c:
            raw_clean[w] = c

    need = sorted({c for c in raw_clean.values() if c not in _cache})
    if need:
        try:
            wikt = _bulk_wiktionary(need)
            # Wikipedia is supplementary only: query it just for words that have
            # a real dictionary entry. This keeps results in the lexical context
            # of the word and avoids an inflected form matching an unrelated
            # article (e.g. "כבודו" -> a TV series), which would distort it.
            have = [c for c in need if wikt.get(c)]
            wikip = _bulk_wikipedia(have) if have else {}
        except Exception:
            wikt = None
        if wikt is not None:                 # fetch succeeded -> record results
            for c in need:
                parts, sources = [], []
                if wikt.get(c):
                    parts.append(wikt[c]);  sources.append(_W_WIKT)
                    if wikip.get(c):
                        parts.append(wikip[c]); sources.append(_W_WIKIP)
                _cache[c] = (_summarize(parts), sources) if parts else None

    return {w: _cache[c] for w, c in raw_clean.items() if _cache.get(c)}


def lookup(word):
    """Convenience wrapper around lookup_many for a single word.
    Returns (summary_text, [(source_name, site), ...]) or None."""
    return lookup_many([word]).get(word)
