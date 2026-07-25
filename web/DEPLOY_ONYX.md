# פריסת onyx-study.com על שרת Contabo

מדריך מלא להעלאת **מאמן אבני שהם** (אנגלית / עברית / חשבון) לדומיין
`onyx-study.com`, כולל מעקב הורים וקוד אימות. אפליקציה אחת (`web/onyx_app.py`)
מגישה גם את המאמן וגם את השרת (חשבונות, תוצאות, פורטל הורים) — הכול תחת אותו
דומיין, בלי CORS ובלי תת־דומיין נוסף.

מה מקבלים בסוף:
- `https://onyx-study.com/`            → המאמן (בורר מקצוע: אנגלית/עברית/חשבון)
- `https://onyx-study.com/exam`        → אותו דבר
- `https://onyx-study.com/parent`      → פורטל מעקב הורים
- `https://onyx-study.com/api/*`       → ה-API (הרשמה, אימות, סנכרון תוצאות)

---

## 0. DNS — הפניית הדומיין לשרת
אצל רשם הדומיין של `onyx-study.com`, הוסף שתי רשומות A אל כתובת ה-IP של שרת
ה-Contabo שלך:

| Type | Host  | Value            |
|------|-------|------------------|
| A    | `@`   | `<CONTABO_IP>`   |
| A    | `www` | `<CONTABO_IP>`   |

(אם `onyx-study.com` כבר מנוהל אצל אותו רשם כמו `tasks.onyx-study.com`, פשוט
הוסף שם את שתי הרשומות. שינוי DNS יכול לקחת עד כמה שעות.)

---

## 1. התקנת תלויות על השרת (Ubuntu/Debian)
```bash
sudo apt update
sudo apt install -y python3-venv python3-pip nginx git git-lfs certbot python3-certbot-nginx
```

## 2. הבאת הקוד
```bash
sudo mkdir -p /var/www/onyx-study
sudo chown -R $USER:$USER /var/www/onyx-study
git clone https://github.com/oshersa-sudo/samaritan-torah_web.git /var/www/onyx-study
cd /var/www/onyx-study
git checkout claude/language-test-51-questions-lafgyx   # או main לאחר מיזוג
git lfs install && git lfs pull    # מביא את assets/data ואת שאר הקבצים
mkdir -p data                      # כאן יישמר learn.db
```

## 3. סביבת פייתון
```bash
cd /var/www/onyx-study
python3 -m venv venv
./venv/bin/pip install --upgrade pip
./venv/bin/pip install flask gunicorn
```

## 4. הרצת בדיקה מהירה (לפני nginx)
```bash
cd /var/www/onyx-study
LEARN_DEV=1 ./venv/bin/python web/onyx_app.py
# בטרמינל אחר:  curl -s localhost:8000/health   → {"ok": true, ...}
# Ctrl-C לעצירה
```

## 5. שירות systemd (מריץ את האפליקציה תמידית)
```bash
sudo cp web/deploy/onyx-study.service /etc/systemd/system/
sudo nano /etc/systemd/system/onyx-study.service   # ← מלא SMTP (סעיף 8)
sudo systemctl daemon-reload
sudo systemctl enable --now onyx-study
sudo systemctl status onyx-study        # אמור להיות active (running)
sudo chown -R www-data:www-data /var/www/onyx-study/data
```

## 6. Nginx
```bash
sudo cp web/deploy/onyx-study.conf /etc/nginx/sites-available/onyx-study
sudo ln -s /etc/nginx/sites-available/onyx-study /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```
כעת `http://onyx-study.com` אמור לעבוד (עדיין ללא HTTPS).

## 7. HTTPS (חינם, Let's Encrypt)
```bash
sudo certbot --nginx -d onyx-study.com -d www.onyx-study.com
```
certbot יערוך את קובץ ה-nginx ויוסיף הפניה ל-443. חידוש מתבצע אוטומטית.

## 8. שליחת קוד האימות במייל (SMTP)
בברירת מחדל `LEARN_DEV=0` — קוד האימות **לא** מוחזר ב-API, אלא נשלח במייל.
ערוך את `/etc/systemd/system/onyx-study.service` ומלא את פרטי ה-SMTP שלך
(אותו ספק ששולח מייל עבור `tasks.onyx-study.com` יתאים), למשל:
```
Environment=SMTP_HOST=smtp.your-provider.com
Environment=SMTP_PORT=587
Environment=SMTP_USER=no-reply@onyx-study.com
Environment=SMTP_PASS=********
Environment=SMTP_FROM=no-reply@onyx-study.com
```
ואז:
```bash
sudo systemctl daemon-reload && sudo systemctl restart onyx-study
```
> רוצה SMS במקום מייל? הקוד ב-`send_code()` (web/learn_backend.py) בנוי להרחבה —
> אפשר לחבר ספק SMS (Twilio / 019 / מסרון) בפונקציה אחת.

## 9. עדכון גרסה בעתיד
```bash
cd /var/www/onyx-study
git pull && git lfs pull
sudo systemctl restart onyx-study
```

---

## מבנה הנתונים
`data/learn.db` (SQLite) מכיל שלוש טבלאות: `students` (תלמידים + קוד הורה),
`results` (כל מבחן שהושלם), `links` (קישור הורה↔תלמיד). גיבוי = פשוט להעתיק
את הקובץ הזה.

## פרטיות (חשוב — נתוני קטינים)
- קוד האימות מונע הרשמה עם טלפון של מישהו אחר.
- הורה רואה תלמיד רק אחרי הזנת **קוד ההורה** שהתלמיד קיבל בהרשמה.
- מומלץ להוסיף מדיניות פרטיות קצרה בעמוד, ולהחזיק את `LEARN_DEV=0` בפרודקשן.
