"""
Scrape https://polite-mushroom-0a5ba400f.4.azurestaticapps.net/
Downloads all chapters of the Samaritan Torah with Hebrew, Aramaic, simple Hebrew, and English.
Saves to data/samaritan_site.json
"""
import urllib.request
import re
import json
import sys
import time
import os

sys.stdout.reconfigure(encoding='utf-8')

BASE_URL = 'https://polite-mushroom-0a5ba400f.4.azurestaticapps.net'

BOOKS = [
    ('genesis',     'בראשית', 50),
    ('exodus',      'שמות',   40),
    ('leviticus',   'ויקרא',  27),
    ('numbers',     'במדבר',  36),
    ('deuteronomy', 'דברים',  34),
]

OUTPUT = os.path.join(os.path.dirname(__file__), '..', 'data', 'samaritan_site.json')


def fetch_chapter(book_slug, chapter_num):
    url = f'{BASE_URL}/{book_slug}/{chapter_num}'
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    html = urllib.request.urlopen(req, timeout=30).read().decode('utf-8')

    # Data is embedded as escaped JSON: {\"verses\":{\"1\":{...}}}
    marker = '\\"verses\\":{'
    idx = html.find(marker)
    if idx == -1:
        return None

    # Go back to the opening { of the parent object
    start = html.rfind('{', 0, idx)
    if start == -1:
        return None

    # Find matching closing }
    depth = 0
    i = start
    end = start
    while i < len(html):
        c = html[i]
        if c == '{':
            depth += 1
        elif c == '}':
            depth -= 1
            if depth == 0:
                end = i + 1
                break
        i += 1

    chunk = html[start:end]
    unescaped = chunk.replace('\\"', '"').replace('\\\\', '\\')
    try:
        data = json.loads(unescaped)
        return data.get('verses')
    except json.JSONDecodeError:
        return None


def main():
    all_data = {}

    for book_slug, book_name, num_chapters in BOOKS:
        print(f'\n{book_name} ({book_slug}), {num_chapters} chapters')
        all_data[book_slug] = {'name': book_name, 'chapters': {}}

        for ch in range(1, num_chapters + 1):
            try:
                verses = fetch_chapter(book_slug, ch)
                if verses:
                    all_data[book_slug]['chapters'][str(ch)] = verses
                    print(f'  Chapter {ch}: {len(verses)} verses', end='\r')
                else:
                    print(f'  Chapter {ch}: no data')
            except Exception as e:
                print(f'  Chapter {ch}: ERROR {e}')
            time.sleep(0.3)  # polite delay

        total = sum(len(c) for c in all_data[book_slug]['chapters'].values())
        print(f'  Done: {len(all_data[book_slug]["chapters"])} chapters, {total} verses')

    with open(OUTPUT, 'w', encoding='utf-8') as f:
        json.dump(all_data, f, ensure_ascii=False, indent=2)

    total_verses = sum(
        len(ch)
        for book in all_data.values()
        for ch in book['chapters'].values()
    )
    print(f'\nSaved to {OUTPUT}')
    print(f'Total verses: {total_verses}')


if __name__ == '__main__':
    main()
