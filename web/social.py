# -*- coding: utf-8 -*-
"""The weekly post about the portion of the week, published by the app itself.

Once a week the app builds a post out of what it already holds — the portion the
coming Sabbath reads, its opening in the Samaritan text beside the Masoretic, a
line of the Samaritan commentary, and a poster — and sends it to whichever social
accounts the owner has connected and ARMED. Nothing is sent by a person.

Three rules the mechanism keeps:
  · nothing is published until an account is both connected and armed, and both
    are the owner's own doing, in the admin panel;
  · a post is built and saved BEFORE it is sent, so it can be looked at first
    (that is the whole of "dry" mode, which is the default);
  · a week is published once. The week's key is written down with the result, so
    a restart, a second instance or a rerun cannot post it twice.

Its state lives in the analytics database, not in torah.db: the Torah database is
rebuilt from the repo by "טען DB מהמאגר", and tokens and post history must not be
swept away with it.
"""
import base64, hashlib, hmac, io, json, os, random, sqlite3, string, threading, time
import urllib.parse, urllib.request

_HERE = os.path.dirname(os.path.abspath(__file__))
_ROOT = os.path.dirname(_HERE)
POSTER_DIR = os.environ.get('SOCIAL_POSTER_DIR') or os.path.join(_HERE, 'static', 'social')
SITE_URL = (os.environ.get('SITE_URL') or 'https://samaritan-torah.onrender.com').rstrip('/')

# every network the mechanism can speak to, and what each one needs from the
# owner. The fields are exactly what its own API asks for — nothing here is
# invented, and nothing is stored that a post does not need.
NETWORKS = [
    {'key': 'telegram', 'label': 'טלגרם',
     'fields': [('bot_token', 'טוקן הבוט (מ-BotFather)'), ('chat_id', 'מזהה הערוץ, למשל @my_channel')],
     'note': 'עובד מיד — אין אישור פלטפורמה ואין מכסה.'},
    {'key': 'facebook', 'label': 'פייסבוק (עמוד)',
     'fields': [('page_id', 'מזהה העמוד'), ('page_token', 'טוקן עמוד ארוך-טווח')],
     'note': 'דורש אפליקציית Meta עם ההרשאה pages_manage_posts, מאושרת ב-App Review.'},
    {'key': 'instagram', 'label': 'אינסטגרם',
     'fields': [('ig_user_id', 'מזהה חשבון עסקי'), ('page_token', 'טוקן עמוד ארוך-טווח')],
     'note': 'חשבון עסקי המקושר לעמוד פייסבוק; הפוסטר מוגש מן האתר עצמו כדי שאינסטגרם ימשוך אותו.'},
    {'key': 'x', 'label': 'X (טוויטר)',
     'fields': [('api_key', 'API key'), ('api_secret', 'API secret'),
                ('access_token', 'Access token'), ('access_secret', 'Access token secret')],
     'note': 'חשבון מפתחים; המכסה החינמית מגבילה את מספר הפוסטים בחודש.'},
    {'key': 'tiktok', 'label': 'טיקטוק',
     'fields': [('access_token', 'Access token'), ('open_id', 'Open id')],
     'note': 'דורש אפליקציה מאושרת עם ההרשאה content.publish; מפורסם כפוסט תמונה.'},
]
NET_BY_KEY = {n['key']: n for n in NETWORKS}


# ── the store ────────────────────────────────────────────────────────────────
def _connect():
    import analytics
    conn = sqlite3.connect(analytics.ANALYTICS_DB_PATH)
    conn.execute('''CREATE TABLE IF NOT EXISTS social_accounts (
        network TEXT PRIMARY KEY, config TEXT, armed INTEGER NOT NULL DEFAULT 0,
        updated_at TEXT)''')
    conn.execute('''CREATE TABLE IF NOT EXISTS social_posts (
        week TEXT PRIMARY KEY,          -- the Sabbath's date: one post a week
        portion TEXT, link TEXT, text TEXT, poster TEXT,
        built_at TEXT, sent_at TEXT, results TEXT)''')
    return conn


def accounts():
    conn = _connect()
    try:
        have = {r[0]: (json.loads(r[1] or '{}'), bool(r[2]))
                for r in conn.execute('SELECT network, config, armed FROM social_accounts')}
    finally:
        conn.close()
    out = []
    for n in NETWORKS:
        cfg, armed = have.get(n['key'], ({}, False))
        out.append({'key': n['key'], 'label': n['label'], 'note': n['note'],
                    'fields': [{'name': f, 'label': l, 'filled': bool(cfg.get(f))} for f, l in n['fields']],
                    'connected': all(cfg.get(f) for f, _ in n['fields']),
                    'armed': armed})
    return out


def set_account(network, config, armed):
    if network not in NET_BY_KEY:
        raise ValueError('unknown network')
    conn = _connect()
    try:
        row = conn.execute('SELECT config FROM social_accounts WHERE network=?', (network,)).fetchone()
        cfg = json.loads(row[0]) if row and row[0] else {}
        for f, _ in NET_BY_KEY[network]['fields']:
            v = (config or {}).get(f)
            if v is not None:
                v = str(v).strip()
                if v:
                    cfg[f] = v
                else:
                    cfg.pop(f, None)
        conn.execute('''INSERT INTO social_accounts(network, config, armed, updated_at)
                        VALUES(?,?,?,?) ON CONFLICT(network) DO UPDATE SET
                        config=excluded.config, armed=excluded.armed, updated_at=excluded.updated_at''',
                     (network, json.dumps(cfg, ensure_ascii=False), 1 if armed else 0,
                      time.strftime('%Y-%m-%d %H:%M:%S')))
        conn.commit()
    finally:
        conn.close()
    return accounts()


def _config(network):
    conn = _connect()
    try:
        row = conn.execute('SELECT config, armed FROM social_accounts WHERE network=?', (network,)).fetchone()
    finally:
        conn.close()
    if not row:
        return {}, False
    return json.loads(row[0] or '{}'), bool(row[1])


def post_row(week):
    conn = _connect()
    try:
        r = conn.execute('SELECT week, portion, link, text, poster, built_at, sent_at, results '
                         'FROM social_posts WHERE week=?', (week,)).fetchone()
    finally:
        conn.close()
    if not r:
        return None
    return {'week': r[0], 'portion': r[1], 'link': r[2], 'text': r[3], 'poster': r[4],
            'built_at': r[5], 'sent_at': r[6], 'results': json.loads(r[7] or '{}')}


def recent_posts(limit=8):
    conn = _connect()
    try:
        rows = conn.execute('SELECT week, portion, sent_at, results FROM social_posts '
                            'ORDER BY week DESC LIMIT ?', (limit,)).fetchall()
    finally:
        conn.close()
    return [{'week': w, 'portion': p, 'sent_at': s, 'results': json.loads(r or '{}')}
            for w, p, s, r in rows]


# ── what the coming Sabbath reads ────────────────────────────────────────────
def coming_sabbath(today=None):
    """(date, entry) for the next Sabbath from the baked Samaritan calendar."""
    import datetime
    d = today or datetime.date.today()
    sat = d + datetime.timedelta(days=(5 - d.weekday()) % 7)      # Saturday
    for year in {sat.year, (sat + datetime.timedelta(days=7)).year}:
        path = os.path.join(_HERE, 'static', 'data', 'calendar', '%d.json' % year)
        if not os.path.exists(path):
            continue
        with io.open(path, encoding='utf-8') as f:
            cal = json.load(f)
        hit = cal.get('shabbat', {}).get(sat.isoformat())
        if hit:
            return sat.isoformat(), hit
    return sat.isoformat(), None


def _fold(s):
    """Hebrew letters and single spaces. The Masoretic text carries pointing and
    maqaf where ours carries a stop mark, and none of that is a difference."""
    import re
    # pointing and cantillation are dropped; the maqaf (U+05BE) and the verse
    # marks are NOT \u2014 they stand between words and must leave a gap behind them
    s = re.sub(r'[\u0591-\u05bd\u05bf\u05c1\u05c2\u05c4\u05c5\u05c7]', '', s or '')
    s = re.sub(r'[^\u05d0-\u05ea]+', ' ', s)                   # maqaf, stop marks, punctuation: a gap
    return re.sub(r'\s+', ' ', s).strip()


def _torah_conn():
    import sys
    sys.path.insert(0, _ROOT)
    from app.services import database as db
    return db


def portion_material(portion_id):
    db = _torah_conn()
    conn = db.get_connection()
    try:
        p = conn.execute('SELECT id, book_id, name FROM portions WHERE id=?', (portion_id,)).fetchone()
        if not p:
            return None
        book = conn.execute('SELECT name FROM books WHERE id=?', (p['book_id'],)).fetchone()
        rows = db.get_sam_chapters_in_portion(portion_id)
        chapters = [dict(r) for r in rows]
        first_ch = chapters[0]['id'] if chapters else None
        verses = [dict(r) for r in db.get_verses_by_sam_ch(first_ch)] if first_ch else []
        # A difference is a difference in the CONSONANTS, and what a post shows is
        # the words that differ — not two whole verses that look unlike each other
        # only because one of them is pointed.
        diffs = []
        for v in verses:
            sam, mas = _fold(v.get('text')), _fold(v.get('masoretic_text'))
            if not sam or not mas or sam == mas:
                continue
            a, b = sam.split(), mas.split()
            i = 0
            while i < min(len(a), len(b)) and a[i] == b[i]:
                i += 1
            j = 0
            while j < min(len(a), len(b)) - i and a[len(a) - 1 - j] == b[len(b) - 1 - j]:
                j += 1
            ours, theirs = ' '.join(a[i:len(a) - j]), ' '.join(b[i:len(b) - j])
            if not ours and not theirs:
                continue
            diffs.append({'number': v.get('number'),
                          'sam': ours or '(אין)', 'mas': theirs or '(אין)'})
        note = next((v.get('interpretation') for v in verses if (v.get('interpretation') or '').strip()), '')
        return {
            'portion': p['name'], 'book': book['name'] if book else '',
            'book_id': p['book_id'], 'portion_id': p['id'],
            'chapters': [c['number'] for c in chapters],
            'opening': (verses[0].get('text') if verses else '') or '',
            'diffs': diffs, 'note': (note or '').strip(),
        }
    finally:
        conn.close()


def deep_link(book_id, portion_id):
    """The address of the portion in the app — the same one the reader's own
    browser writes, so the post links to exactly what it is talking about."""
    db = _torah_conn()
    conn = db.get_connection()
    try:
        rows = conn.execute("SELECT id FROM portions WHERE book_id=? AND mode='samaritan' ORDER BY order_n",
                            (book_id,)).fetchall()
    finally:
        conn.close()
    idx = next((i + 1 for i, r in enumerate(rows) if r['id'] == portion_id), None)
    return '%s/t/sam/%d%s' % (SITE_URL, book_id, ('/%d' % idx) if idx else '')


# ── the post itself ──────────────────────────────────────────────────────────
def build(week=None, entry=None):
    """Build (and store) the post for a Sabbath. Called by the preview and by the
    weekly job alike, so what is published is exactly what was looked at."""
    if not week or not entry:
        week, entry = coming_sabbath()
    if not entry or not entry.get('id'):
        return None
    names, mats = [], []
    for part in [entry] + list(entry.get('also') or []):
        m = portion_material(part['id'])
        if m:
            mats.append(m); names.append(m['portion'])
    if not mats:
        return None
    main = mats[0]
    link = deep_link(main['book_id'], main['portion_id'])

    lines = []
    lines.append('פרשת השבוע: %s' % ' · '.join(names))
    lines.append('%s — פרקים שומרוניים %s' % (main['book'], _range(main['chapters'])))
    if main['opening']:
        lines.append('')
        lines.append('«%s»' % _clean(main['opening'], 150))
    diffs = main['diffs'][:2]
    if diffs:
        lines.append('')
        lines.append('מן ההבדלים מול נוסח המסורה:')
        for d in diffs:
            lines.append('  פסוק %s — אצלנו «%s», ובמסורה «%s»'
                         % (d['number'], _clean(d['sam'], 46), _clean(d['mas'], 46)))
    if main['note']:
        lines.append('')
        lines.append('מן הפירוש השומרוני: %s' % _clean(main['note'], 220))
    lines.append('')
    lines.append('הפרשה כולה — הנוסח, ההשוואה למסורה והפירוש לכל פסוק:')
    lines.append(link)
    text = '\n'.join(lines)

    poster = make_poster(week, main, names)
    conn = _connect()
    try:
        conn.execute('''INSERT INTO social_posts(week, portion, link, text, poster, built_at)
                        VALUES(?,?,?,?,?,?) ON CONFLICT(week) DO UPDATE SET
                        portion=excluded.portion, link=excluded.link, text=excluded.text,
                        poster=excluded.poster, built_at=excluded.built_at''',
                     (week, ' · '.join(names), link, text, os.path.basename(poster) if poster else None,
                      time.strftime('%Y-%m-%d %H:%M:%S')))
        conn.commit()
    finally:
        conn.close()
    return post_row(week)


def _clean(s, n):
    s = ' '.join((s or '').split())
    return s if len(s) <= n else s[:n - 1].rstrip() + '…'


def _range(nums):
    if not nums:
        return ''
    return '%s–%s' % (nums[0], nums[-1]) if len(nums) > 1 else str(nums[0])


# ── the poster ───────────────────────────────────────────────────────────────
def make_poster(week, mat, names):
    """A picture the post can carry: the portion's name in both scripts, its
    opening, and the app's own colours. Drawn with the fonts the app ships."""
    try:
        from PIL import Image, ImageDraw, ImageFont
    except ImportError:
        return None
    W, H = 1080, 1350
    PLATE, INK, GOLD, GREEN = (248, 244, 234), (46, 40, 28), (184, 145, 47), (47, 74, 51)
    img = Image.new('RGB', (W, H), PLATE)
    d = ImageDraw.Draw(img)
    fonts = os.path.join(_HERE, 'static', 'fonts')

    def F(name, size):
        try:
            return ImageFont.truetype(os.path.join(fonts, name), size)
        except Exception:
            return ImageFont.load_default()

    heb, sam = 'SBL_Hbrw.ttf', 'Sam_font.ttf'

    def rtl(s):                      # PIL draws logical order; Hebrew needs reversing
        return ''.join(reversed(s or ''))

    def center(y, s, font, fill=INK, font_is_sam=False):
        t = s if font_is_sam else rtl(s)
        w = d.textlength(t, font=font)
        d.text(((W - w) / 2, y), t, font=font, fill=fill)
        return y + (font.size * 1.35)

    d.rectangle([0, 0, W, 14], fill=GOLD)
    d.rectangle([0, H - 14, W, H], fill=GOLD)
    y = 90
    y = center(y, 'אבני שהם · התורה השומרונית הישראלית', F(heb, 40), GOLD)
    y += 30
    y = center(y, 'פרשת השבוע', F(heb, 46), GREEN)
    y += 10
    for nm in names:
        y = center(y, nm, F(heb, 92))
        y = center(y, nm, F(sam, 74), GOLD, font_is_sam=True)
        y += 16
    y += 10
    d.line([(W * 0.18, y), (W * 0.82, y)], fill=GOLD, width=3)
    y += 46
    y = center(y, '%s · פרקים %s' % (mat['book'], _range(mat['chapters'])), F(heb, 40), GREEN)
    y += 30
    # the opening, wrapped by hand — PIL has no line-breaking of its own
    words, line, f = (mat['opening'] or '').split(), '', F(heb, 44)
    for w in words:
        trial = (line + ' ' + w).strip()
        if d.textlength(rtl(trial), font=f) > W * 0.78 and line:
            y = center(y, line, f)
            line = w
        else:
            line = trial
        if y > H - 300:
            break
    if line and y < H - 300:
        y = center(y, line, f)
    y = max(y, H - 250)
    d.line([(W * 0.18, y), (W * 0.82, y)], fill=GOLD, width=2)
    y += 34
    center(y, 'הפרשה כולה, ההשוואה למסורה והפירוש — באפליקציה', F(heb, 34), GREEN)
    center(y + 56, SITE_URL.replace('https://', ''), F(heb, 30), GOLD)

    os.makedirs(POSTER_DIR, exist_ok=True)
    path = os.path.join(POSTER_DIR, 'week-%s.jpg' % week)
    img.save(path, 'JPEG', quality=88, optimize=True)
    return path


def poster_url(week):
    return '%s/static/social/week-%s.jpg' % (SITE_URL, week)


# ── the networks themselves ──────────────────────────────────────────────────
# Each is the smallest honest call its own API asks for. None is reached until
# the owner has filled its fields AND armed it, both in the admin panel.
def _http(url, data=None, headers=None, method=None, timeout=30):
    req = urllib.request.Request(url, data=data, headers=headers or {}, method=method)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        body = r.read().decode('utf-8', 'replace')
    try:
        return json.loads(body)
    except ValueError:
        return {'raw': body[:400]}


def _form(url, fields):
    return _http(url, data=urllib.parse.urlencode(fields).encode('utf-8'),
                 headers={'Content-Type': 'application/x-www-form-urlencoded'})


def _post_telegram(cfg, post):
    """A photo carrying the summary as its caption (Telegram allows 1024)."""
    url = 'https://api.telegram.org/bot%s/sendPhoto' % cfg['bot_token']
    r = _form(url, {'chat_id': cfg['chat_id'], 'photo': poster_url(post['week']),
                    'caption': _clean(post['text'], 1000)})
    if not r.get('ok'):
        raise RuntimeError(r.get('description') or str(r)[:200])
    return {'message_id': (r.get('result') or {}).get('message_id')}


def _post_facebook(cfg, post):
    r = _form('https://graph.facebook.com/v21.0/%s/photos' % cfg['page_id'],
              {'url': poster_url(post['week']), 'caption': post['text'],
               'access_token': cfg['page_token']})
    if r.get('error'):
        raise RuntimeError(r['error'].get('message', 'facebook refused'))
    return {'post_id': r.get('post_id') or r.get('id')}


def _post_instagram(cfg, post):
    made = _form('https://graph.facebook.com/v21.0/%s/media' % cfg['ig_user_id'],
                 {'image_url': poster_url(post['week']), 'caption': post['text'],
                  'access_token': cfg['page_token']})
    if made.get('error'):
        raise RuntimeError(made['error'].get('message', 'instagram refused'))
    out = _form('https://graph.facebook.com/v21.0/%s/media_publish' % cfg['ig_user_id'],
                {'creation_id': made['id'], 'access_token': cfg['page_token']})
    if out.get('error'):
        raise RuntimeError(out['error'].get('message', 'instagram refused'))
    return {'post_id': out.get('id')}


def _oauth1(method, url, cfg, body_params=None):
    """X still signs with OAuth 1.0a — thirty lines, and no dependency."""
    q = lambda s: urllib.parse.quote(str(s), '')
    oauth = {'oauth_consumer_key': cfg['api_key'],
             'oauth_nonce': ''.join(random.choice(string.ascii_letters + string.digits) for _ in range(32)),
             'oauth_signature_method': 'HMAC-SHA1', 'oauth_timestamp': str(int(time.time())),
             'oauth_token': cfg['access_token'], 'oauth_version': '1.0'}
    allp = dict(oauth)
    allp.update(body_params or {})
    norm = '&'.join('%s=%s' % (q(k), q(v)) for k, v in sorted(allp.items()))
    base = '&'.join([method.upper(), q(url), q(norm)])
    key = '%s&%s' % (q(cfg['api_secret']), q(cfg['access_secret']))
    oauth['oauth_signature'] = base64.b64encode(
        hmac.new(key.encode(), base.encode(), hashlib.sha1).digest()).decode()
    return 'OAuth ' + ', '.join('%s="%s"' % (k, q(v)) for k, v in sorted(oauth.items()))


def _post_x(cfg, post):
    media_id = None
    try:                                   # the poster first (v1.1 upload)
        path = os.path.join(POSTER_DIR, 'week-%s.jpg' % post['week'])
        if os.path.exists(path):
            with open(path, 'rb') as f:
                b64 = base64.b64encode(f.read()).decode()
            url = 'https://upload.twitter.com/1.1/media/upload.json'
            auth = _oauth1('POST', url, cfg, {'media_data': b64})
            r = _http(url, data=urllib.parse.urlencode({'media_data': b64}).encode(),
                      headers={'Authorization': auth,
                               'Content-Type': 'application/x-www-form-urlencoded'})
            media_id = r.get('media_id_string')
    except Exception:
        media_id = None                    # a post without its picture is still a post
    url = 'https://api.twitter.com/2/tweets'
    payload = {'text': _clean(post['text'], 250) + '\n' + post['link']}
    if media_id:
        payload['media'] = {'media_ids': [media_id]}
    r = _http(url, data=json.dumps(payload).encode('utf-8'),
              headers={'Authorization': _oauth1('POST', url, cfg),
                       'Content-Type': 'application/json'})
    if r.get('errors') or r.get('detail'):
        raise RuntimeError(str(r.get('detail') or r['errors'])[:200])
    return {'id': (r.get('data') or {}).get('id')}


def _post_tiktok(cfg, post):
    """TikTok publishes a photo post by pulling the picture from a public URL."""
    body = {'post_info': {'title': _clean(post['text'], 90),
                          'description': _clean(post['text'], 900),
                          'privacy_level': 'PUBLIC_TO_EVERYONE'},
            'source_info': {'source': 'PULL_FROM_URL', 'photo_cover_index': 0,
                            'photo_images': [poster_url(post['week'])]},
            'post_mode': 'DIRECT_POST', 'media_type': 'PHOTO'}
    r = _http('https://open.tiktokapis.com/v2/post/publish/content/init/',
              data=json.dumps(body).encode('utf-8'),
              headers={'Authorization': 'Bearer %s' % cfg['access_token'],
                       'Content-Type': 'application/json; charset=UTF-8'})
    code = (r.get('error') or {}).get('code')
    if code and code != 'ok':
        raise RuntimeError((r.get('error') or {}).get('message') or code)
    return {'publish_id': (r.get('data') or {}).get('publish_id')}


SENDERS = {'telegram': _post_telegram, 'facebook': _post_facebook,
           'instagram': _post_instagram, 'x': _post_x, 'tiktok': _post_tiktok}


# ── publishing ───────────────────────────────────────────────────────────────
def publish(week=None, dry=None, force=False):
    """Build the week's post and send it to every armed, connected account.

    dry=True  build and store only — which is what happens while nothing is armed
    force     send again even if this week has already gone out
    """
    if week:
        _, entry = coming_sabbath()
        if post_row(week) is None:
            week, entry = coming_sabbath()
    else:
        week, entry = coming_sabbath()
    post = build(week, entry)
    if not post:
        return {'ok': False, 'error': 'no portion for %s' % week}
    if post.get('sent_at') and not force:
        return {'ok': True, 'skipped': 'already sent', 'week': week,
                'results': post['results'], 'post': post}

    targets = [(a['key'], _config(a['key'])[0]) for a in accounts() if a['armed'] and a['connected']]
    if dry is None:
        dry = not targets
    results = {}
    for key, cfg in targets:
        if dry:
            results[key] = {'ok': True, 'dry': True}
            continue
        try:
            results[key] = {'ok': True, 'result': SENDERS[key](cfg, post)}
        except Exception as e:              # one network failing must not stop the others
            results[key] = {'ok': False, 'error': str(e)[:300]}
    if not dry and targets:
        conn = _connect()
        try:
            conn.execute('UPDATE social_posts SET sent_at=?, results=? WHERE week=?',
                         (time.strftime('%Y-%m-%d %H:%M:%S'),
                          json.dumps(results, ensure_ascii=False), week))
            conn.commit()
        finally:
            conn.close()
    return {'ok': True, 'week': week, 'dry': bool(dry), 'targets': [k for k, _ in targets],
            'results': results, 'post': post_row(week)}


# ── the weekly hand that pulls it ────────────────────────────────────────────
# Wednesday by default, so the post is out before the Sabbath it speaks of. The
# thread wakes every fifteen minutes, does nothing unless it is the day and the
# hour, and the week's own row is what stops it from happening twice.
POST_WEEKDAY = int(os.environ.get('SOCIAL_POST_WEEKDAY', 2))     # 0=Monday … 2=Wednesday
POST_HOUR = int(os.environ.get('SOCIAL_POST_HOUR', 10))
_started = False


def tick(now=None):
    import datetime
    now = now or datetime.datetime.now()
    if now.weekday() != POST_WEEKDAY or now.hour != POST_HOUR:
        return None
    week, entry = coming_sabbath(now.date())
    row = post_row(week)
    if row and row.get('sent_at'):
        return None
    if not any(a['armed'] and a['connected'] for a in accounts()):
        build(week, entry)                  # keep the preview fresh even while disarmed
        return None
    return publish(week=week, dry=False)


def start_scheduler():
    global _started
    if _started or os.environ.get('SOCIAL_SCHEDULER') == 'off':
        return
    _started = True

    def loop():
        while True:
            try:
                tick()
            except Exception:
                pass
            time.sleep(900)

    threading.Thread(target=loop, daemon=True, name='social-weekly').start()
