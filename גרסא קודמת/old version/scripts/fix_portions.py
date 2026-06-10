"""
Add mode column to portions, re-insert both Samaritan and Jewish portions.
Run from project root: py -3.12 scripts/fix_portions.py
"""
import re, sys, sqlite3, os, openpyxl
sys.stdout.reconfigure(encoding='utf-8')

DATA_DIR   = os.path.join(os.path.dirname(__file__), '..', 'data')
DB_PATH    = os.path.join(DATA_DIR, 'torah.db')
SAM_XLS    = os.path.join(DATA_DIR, 'portions of the week.xlsx')
JEW_XLS    = os.path.join(DATA_DIR, 'Jewish_Portions of the week.xlsx')

BOOK_ENG_MAP = {
    'genesis':     'בראשית',
    'exodus':      'שמות',
    'leviticus':   'ויקרא',
    'numbers':     'במדבר',
    'deuteronomy': 'דברים',
}
BOOK_HEB_MAP = {v: k for k, v in BOOK_ENG_MAP.items()}


def parse_range(r):
    r = r.strip().replace('\xa0', '').replace(' ', '')
    m = re.match(r'^(\d+)(?::(\d+))?-(\d+)(?::(\d+))?$', r)
    if not m:
        raise ValueError(f'Cannot parse range: {r!r}')
    sc = int(m.group(1)); sv = int(m.group(2)) if m.group(2) else 1
    ec = int(m.group(3)); ev = int(m.group(4)) if m.group(4) else 9999
    return sc, sv, ec, ev


def load_samaritan(book_ids):
    wb = openpyxl.load_workbook(SAM_XLS)
    ws = wb['parasha']
    out = []
    for row in ws.iter_rows(min_row=2, values_only=True):
        heb_name, book_cell, ch_range = row[1], row[3], row[4]
        if not heb_name or '***' in str(heb_name):
            continue
        if not book_cell or not ch_range:
            continue
        # find book key from English-like cell (e.g. "Genesis -בראשית ")
        book_str = str(book_cell).strip().lower()
        bid = None
        for eng, heb in BOOK_ENG_MAP.items():
            if eng in book_str:
                bid = book_ids.get(heb)
                break
        if bid is None:
            print(f'  WARNING: unknown book cell {book_cell!r}')
            continue
        try:
            sc, sv, ec, ev = parse_range(str(ch_range))
        except ValueError as e:
            print(f'  WARNING: {e}')
            continue
        out.append((bid, str(heb_name).strip(), sc, sv, ec, ev))
    return out


def load_jewish(book_ids):
    wb = openpyxl.load_workbook(JEW_XLS)
    ws = wb.active
    out = []
    for row in ws.iter_rows(min_row=2, values_only=True):
        heb_book, heb_name, start_str, end_str = row[0], row[1], row[2], row[3]
        if not heb_book or not heb_name or not start_str or not end_str:
            continue
        bid = book_ids.get(str(heb_book).strip())
        if bid is None:
            print(f'  WARNING: unknown book {heb_book!r}')
            continue
        sc, sv = [int(x) for x in str(start_str).strip().split(':')]
        ec, ev = [int(x) for x in str(end_str).strip().split(':')]
        out.append((bid, str(heb_name).strip(), sc, sv, ec, ev))
    return out


def main():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row

    # Add mode column if missing
    cols = [r[1] for r in conn.execute('PRAGMA table_info(portions)').fetchall()]
    if 'mode' not in cols:
        conn.execute("ALTER TABLE portions ADD COLUMN mode TEXT NOT NULL DEFAULT 'samaritan'")
        conn.commit()
        print('Added mode column.')

    # Build book_id lookup
    book_ids = {r['name']: r['id'] for r in conn.execute('SELECT id, name FROM books').fetchall()}

    conn.execute('DELETE FROM portions')

    sam_portions = load_samaritan(book_ids)
    order = {}
    for bid, name, sc, sv, ec, ev in sam_portions:
        order[bid] = order.get(bid, 0) + 1
        conn.execute(
            "INSERT INTO portions (book_id,name,order_n,start_ch,start_v,end_ch,end_v,mode) "
            "VALUES (?,?,?,?,?,?,?,'samaritan')",
            (bid, name, order[bid], sc, sv, ec, ev)
        )
    print(f'Inserted {len(sam_portions)} Samaritan portions.')

    jew_portions = load_jewish(book_ids)
    order = {}
    for bid, name, sc, sv, ec, ev in jew_portions:
        order[bid] = order.get(bid, 0) + 1
        conn.execute(
            "INSERT INTO portions (book_id,name,order_n,start_ch,start_v,end_ch,end_v,mode) "
            "VALUES (?,?,?,?,?,?,?,'jewish')",
            (bid, name, order[bid], sc, sv, ec, ev)
        )
    print(f'Inserted {len(jew_portions)} Jewish portions.')

    conn.commit()
    conn.close()
    print('Done.')


if __name__ == '__main__':
    main()
