# -*- coding: utf-8 -*-
"""Turn the two translated books (.docx) into section-structured JSON for the library."""
import io, json, os, re, sys, zipfile

sys.stdout.reconfigure(encoding='utf-8')

def paragraphs(path):
    xml = zipfile.ZipFile(path).read('word/document.xml').decode('utf-8')
    for p in re.findall(r'<w:p[ >].*?</w:p>', xml, re.S):
        st = re.search(r'<w:pStyle w:val="([^"]+)"', p)
        st = st.group(1) if st else 'Normal'
        bold = '<w:b/>' in p or '<w:b ' in p
        t = ''.join(re.findall(r'<w:t[^>]*>(.*?)</w:t>', p, re.S))
        t = (t.replace('&amp;', '&').replace('&lt;', '<')
              .replace('&gt;', '>').replace('&quot;', '"').replace('&apos;', "'"))
        yield st, bold, ' '.join(t.split())

def flush(secs, title, level, body):
    body = [b for b in body if b]
    if body or (title and level == 1):   # keep bodyless H1s: they carry the outline
        secs.append({'n': len(secs) + 1, 'level': level, 'title': title, 'body': body})

def cohen(path):
    """Cohen 1899 carries real Word heading styles, so the outline is explicit."""
    secs, title, level, body = [], 'שער המהדורה', 1, []
    for st, bold, t in paragraphs(path):
        if not t:
            continue
        if st in ('Heading1', 'Heading2'):
            flush(secs, title, level, body)
            title, level, body = t, (1 if st == 'Heading1' else 2), []
        elif st == 'SourcePageMarker':
            body.append('§' + t)          # printed-page marker, kept as an anchor
        elif st == 'AnnotationHeading':
            body.append('##' + t)         # the editor's annotation headings
        elif st == 'HebrewQuote':
            body.append('>' + t)
        else:
            body.append(t)
    flush(secs, title, level, body)
    return secs

def wreschner(path):
    """Wreschner 1888 has no heading styles; each printed page opens with a marker."""
    secs, title, body = [], 'שער המהדורה', []
    for st, bold, t in paragraphs(path):
        if not t:
            continue
        if t.startswith('תרגום עברי'):
            flush(secs, title, 1, body)
            title, body = t.split('|')[-1].strip(), []
        elif bold and len(t) < 90:
            body.append('##' + t)         # a bold short line acts as a sub-heading
        else:
            body.append(t)
    flush(secs, title, 1, body)
    return secs

BOOKS = [
    ('cohen1899', 'תרגום_מלא_לעברית_כהן_1899_חוקי_הצרעת.docx', cohen),
    ('wreschner1888', 'מסורות_שומרוניות_ורשנר_1888_תרגום_לעברית.docx', wreschner),
]

if __name__ == '__main__':
    os.makedirs('data/library', exist_ok=True)
    for slug, path, fn in BOOKS:
        secs = fn(path)
        out = 'data/library/%s.json' % slug
        io.open(out, 'w', encoding='utf-8').write(json.dumps(secs, ensure_ascii=False, indent=1))
        chars = sum(len(b) for s in secs for b in s['body'])
        print('%-14s %3d סעיפים  %6d תווים  → %s' % (slug, len(secs), chars, out))
        for s in secs[:6]:
            print('    %d. %s  (%d פסקאות)' % (s['n'], s['title'][:60], len(s['body'])))
