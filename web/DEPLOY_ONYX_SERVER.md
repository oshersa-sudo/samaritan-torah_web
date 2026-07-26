# הוספת המאמן לשרת onyx-study VPS (בטוח, תוספתי בלבד)

מדריך זה מוסיף את **מאמן אבני שהם** (אנגלית / עברית / חשבון + מעקב הורים)
לשרת המשותף `194.163.130.39`, לצד האפליקציות הקיימות, **בלי לגעת באף אחת מהן**,
לפי `SERVER-ADD-APP-GUIDE.md`.

בידוד מלא: תיקייה משלו `/root/onyx-trainer`, שם pm2 משלו `onyx-trainer`,
פורט משלו **3001**, מסד נתונים SQLite משלו, subdomain משלו `learn.onyx-study.com`.
לא Postgres ולא תוכנת-שרת חדשה — רק Python venv.

> כל הפקודות רצות **על השרת** אחרי התחברות:
> `ssh -i ~/.ssh/onyx_hetzner root@194.163.130.39`
> (ב-Windows: `ssh -i C:\Users\osher\.ssh\onyx_hetzner root@194.163.130.39`)

---

## 0. ודא שהפורט 3001 פנוי
```bash
ss -tlnp | grep :3001 || echo "PORT 3001 FREE"
```
אם תפוס — בחר פורט אחר (למשל 3002) ותקן אותו ב-ecosystem וב-nginx בהמשך.

## 1. הבא את הקוד לתיקייה חדשה ונפרדת
(דילוג על git-lfs כדי לא למשוך את torah.db — המאמן לא צריך אותו.)
```bash
GIT_LFS_SKIP_SMUDGE=1 git clone --depth 1 \
  -b claude/language-test-51-questions-lafgyx \
  https://github.com/oshersa-sudo/samaritan-torah_web.git /root/onyx-trainer
mkdir -p /root/onyx-trainer/data
```

## 2. סביבת Python + gunicorn (בתוך התיקייה בלבד)
```bash
cd /root/onyx-trainer
python3 -m venv venv          # אם נכשל: apt install -y python3-venv  (אישור אושר)
./venv/bin/pip install -q --upgrade pip
./venv/bin/pip install -q flask gunicorn
```

## 3. הפעל תחת pm2 (שם + פורט ייחודיים)
```bash
cd /root/onyx-trainer
pm2 start web/deploy/onyx-trainer.ecosystem.config.js
pm2 save
```
בדיקה מקומית שהאפליקציה עונה על 3001:
```bash
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3001/health   # אמור 200
```

## 4. הוסף site חדש ל-nginx (קובץ חדש — לא לגעת בקיימים)
```bash
cp /root/onyx-trainer/web/deploy/onyx-trainer.nginx.conf \
   /etc/nginx/sites-available/onyx-trainer
ln -s /etc/nginx/sites-available/onyx-trainer /etc/nginx/sites-enabled/onyx-trainer
nginx -t && systemctl reload nginx          # reload, לא restart
```
> אם `nginx -t` נכשל — **אל תעשה reload**. תקן רק את הקובץ החדש שלך.

## 5. DNS (אושר עושה זאת אצל ספק הדומיין — myhost)
הוסף רשומת **A**: `learn` → `194.163.130.39`.
המתן שתתפרסם:
```bash
dig +short learn.onyx-study.com     # אמור להחזיר 194.163.130.39
```

## 6. SSL בחינם — רק לדומיין החדש
```bash
certbot --nginx -d learn.onyx-study.com
```
> `-d` רק עם הדומיין החדש. אל תיגע בתעודות קיימות.

## 7. בדיקת בריאות — והאפליקציות הקיימות עדיין חיות
```bash
pm2 list                                                     # כולן online?
curl -s -o /dev/null -w "%{http_code}\n" https://learn.onyx-study.com/exam    # החדשה
curl -s -o /dev/null -w "%{http_code}\n" https://onyx-study.com/login         # onyx עדיין 200
```

מוכן: `https://learn.onyx-study.com/exam` (המאמן) · `/parent` (מעקב הורים).

---

## עדכון גרסה בעתיד
```bash
cd /root/onyx-trainer && git pull
pm2 restart onyx-trainer        # רק את האפליקציה הזאת
```

## אם משהו השתבש — לגעת רק בחדש
```bash
pm2 delete onyx-trainer
rm -f /etc/nginx/sites-enabled/onyx-trainer
systemctl reload nginx
```

## מעבר לפרודקשן (אחרי שהכול עובד)
- להחליף `LEARN_DEV` ל-`0` ב-ecosystem ולהגדיר SMTP (משתני `SMTP_*`), ואז
  `pm2 restart onyx-trainer` — כדי שקוד האימות יישלח במייל ולא יוחזר ב-API.
