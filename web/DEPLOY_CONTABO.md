# פריסת שרת הלמידה על Contabo (מעקב הורים + קוד אימות)

השרת `web/learn_backend.py` הוא אפליקציית Flask עצמאית עם בסיס נתונים SQLite.
הוא אחראי על: הרשמת תלמידים עם **קוד אימות**, סנכרון תוצאות, ו**מעקב הורים**
מרחוק דרך הדף `/parent`. הוא רץ בנפרד מאפליקציית התורה.

## 1. התקנה על השרת (Ubuntu/Debian)

```bash
sudo apt update && sudo apt install -y python3-venv nginx
sudo useradd -m -s /bin/bash learn || true
sudo -u learn -H bash -lc '
  mkdir -p ~/app && cd ~/app
  git clone <REPO_URL> repo || (cd repo && git pull)
  python3 -m venv venv
  ./venv/bin/pip install flask gunicorn
'
```

## 2. משתני סביבה

צרו `/home/learn/app/env`:

```bash
LEARN_DB=/home/learn/app/learn.db
LEARN_PORT=8000
LEARN_DEV=0                      # 0 בפרודקשן — הקוד לא יוחזר ב-API
# אימות במייל (אופציונלי, חינם עם ספק SMTP):
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=you@gmail.com
SMTP_PASS=app-password
SMTP_FROM=you@gmail.com
```

> ללא SMTP, קוד האימות נכתב ל-log של השרת (שימושי לבדיקות). לשליחת **SMS**
> אפשר להוסיף ספק (Twilio/019/וכו') בפונקציה `send_code` — כרגע מוגדר מייל.

## 3. שירות systemd

`/etc/systemd/system/learn.service`:

```ini
[Unit]
Description=Samaritan Learn backend
After=network.target

[Service]
User=learn
WorkingDirectory=/home/learn/app/repo
EnvironmentFile=/home/learn/app/env
ExecStart=/home/learn/app/venv/bin/gunicorn -w 3 -b 127.0.0.1:8000 web.learn_backend:app
Restart=always

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload && sudo systemctl enable --now learn
curl -s http://127.0.0.1:8000/health      # → {"ok":true,...}
```

## 4. Nginx + HTTPS

```nginx
server {
    server_name learn.yourdomain.com;
    location / { proxy_pass http://127.0.0.1:8000; proxy_set_header Host $host; }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/learn /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d learn.yourdomain.com
```

## 5. חיבור האפליקציה לשרת

בשרת שמריץ את דף המבחן (`web/server.py`), הגדירו:

```bash
export LEARN_BACKEND=https://learn.yourdomain.com
```

הדף `/exam` יזריק את הכתובת ל-`window.LEARN_BACKEND`, ואז:

* בכניסה — התלמיד נרשם אוטומטית ומקבל **קוד להורים** (מוצג בתפריט).
* בסיום מבחן — התוצאה נשלחת לשרת.
* הורה נכנס ל-`https://learn.yourdomain.com/parent`, מזין את הטלפון שלו,
  ומקשר תלמיד עם **טלפון התלמיד + קוד ההורה**. משם רואה התקדמות בכל המקצועות.

אם `LEARN_BACKEND` ריק — האפליקציה עובדת לגמרי מקומית (localStorage) ללא שרת.

## 6. גיבוי

```bash
sqlite3 /home/learn/app/learn.db ".backup '/home/learn/backups/learn-$(date +%F).db'"
```

## נקודות אבטחה
* הגישה של הורה לתלמיד מוגנת ב**קוד הורה** ייחודי (סוד משותף) + טלפון התלמיד.
* הקוד לאימות תקף לשעה. מומלץ `LEARN_DEV=0` בפרודקשן.
* מומלץ להוסיף הגבלת-קצב (rate limit) ב-Nginx על `/api/register` ו-`/api/verify`.
