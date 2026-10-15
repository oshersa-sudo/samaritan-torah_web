# -*- coding: utf-8 -*-
"""מסמך לדפים.

שרת המדיה אינו מגיש PDF לדפדפן — אותם בתים בדיוק, בשם png, מוגשים
היטב — ולכן המסמך נפרט לדפי תמונה. יוצא מזה גם דבר טוב: דף תמונה עולה
מאליו עם השעון, מה שמסמך במציג של הדפדפן אינו יכול.

לכל דף נבחר הפורמט הקטן מבין השניים: כתב שחור על לבן מתכווץ היטב
ב-PNG של גווני אפור, וסריקה אמיתית מתכווצת טוב ממנו ב-JPEG.
"""
import io
import os
import sys

import fitz
from PIL import Image

SRC = r'G:\שומרונים ומסורת- תיקייה חשובה מאד\piyut_text'
OUT = os.environ.get('SHIRA_TEXT_PAGES',
                     os.path.join(os.path.dirname(os.path.abspath(__file__)),
                                  '..', 'data', 'text_pages'))
WIDE = 1400            # רוחב הדף בפיקסלים — די והותר לכתב שומרוני מנוקד

os.makedirs(OUT, exist_ok=True)
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

made = []
for dp, dn, fn in os.walk(SRC):
    for f in sorted(fn):
        if not f.lower().endswith('.pdf'):
            continue
        base = os.path.splitext(f)[0]
        doc = fitz.open(os.path.join(dp, f))
        print('%s — %d עמודים' % (base, doc.page_count))
        for i in range(doc.page_count):
            page = doc[i]
            zoom = WIDE / page.rect.width
            pix = page.get_pixmap(matrix=fitz.Matrix(zoom, zoom), alpha=False)
            im = Image.frombytes('RGB', (pix.width, pix.height), pix.samples)

            # אפור: הכתב שחור על לבן, והצבע אינו נושא כאן דבר
            grey = im.convert('L')
            a = io.BytesIO(); grey.save(a, 'PNG', optimize=True)
            b = io.BytesIO(); grey.save(b, 'JPEG', quality=84, optimize=True,
                                        progressive=True)
            if a.tell() <= b.tell():
                data, ext = a.getvalue(), 'png'
            else:
                data, ext = b.getvalue(), 'jpg'
            name = '%s %d.%s' % (base, i + 1, ext)
            with open(os.path.join(OUT, name), 'wb') as fh:
                fh.write(data)
            made.append((name, len(data)))
            print('   %-40s %s  %6.0f KB' % (name, ext.upper(), len(data) / 1024))
        doc.close()
        src_mb = os.path.getsize(os.path.join(dp, f)) / 1e6
        tot = sum(s for n, s in made if n.startswith(base)) / 1e6
        print('   %.1f MB  →  %.1f MB  (%.0f%%)\n' % (src_mb, tot, 100 * tot / src_mb))

print('סך הכול %d דפים, %.1f MB' % (len(made), sum(s for _, s in made) / 1e6))
