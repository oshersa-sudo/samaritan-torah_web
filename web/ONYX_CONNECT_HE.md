# Onyx – לימודי · חיבור לשרת ופריסה (עדכון האפליקציה)

מסמך זה מרכז את **כל מה שצריך** כדי להתחבר לשרת ולעדכן את אפליקציית הלמידה.

---

## פרטי השרת

| פרט | ערך |
|---|---|
| ספק | Contabo (Cloud VPS 10 SSD) |
| שם שרת | onyx-study |
| **IP (ל-SSH ולכל דבר)** | **`194.163.130.39`** |
| משתמש | `root` |
| מפתח SSH פרטי | `~/.ssh/onyx_hetzner`  (ב-Windows: `C:\Users\osher\.ssh\onyx_hetzner`) |
| מערכת הפעלה | Ubuntu 24.04 |
| כתובת האתר | https://learn.onyx-study.com |
| תיקיית האפליקציה בשרת | `/root/onyx-trainer`  (הקוד ב-`/root/onyx-trainer/web`) |
| שם התהליך ב-pm2 | `onyx-trainer`  (פורט 3001) |
| ענף Git נוכחי | `claude/language-test-51-questions-lafgyx` |

> ⚠️ הכתובת `185.237.253.160:63222` שמופיעה בלוח של Contabo היא **VNC בלבד** (קונסולת חירום גרפית) — **לא ל-SSH**. תמיד להשתמש ב-`194.163.130.39`.

---

## עיקרון חשוב: שני שלבים

1. **קודם מתחברים לשרת** — פקודת `ssh` אחת.
2. **רק אחרי** שרואים את השורה `root@...:~#` — מריצים שם את פקודות העדכון (`git`, `pm2`).

הפקודות `pm2`, `git pull`, וסקריפט ה-`.sh` **לא רצות על המחשב שלך** — הן רצות על השרת, אחרי החיבור.

---

## שלב 1 — התחברות (מ-CMD במחשב Windows)

```
ssh -i %USERPROFILE%\.ssh\onyx_hetzner root@194.163.130.39
```

- אם מופיע `Are you sure you want to continue connecting?` → הקלד `yes`.
- אם מופיע `Permission denied (publickey)` → ה-SSH לא מצא/השתמש במפתח. ודא שהקובץ קיים:
  ```
  dir %USERPROFILE%\.ssh
  ```
  צריך להופיע קובץ בשם `onyx_hetzner`. אם הוא לא שם — למחשב הזה אין גישה (ראה "גישה חלופית" בהמשך).

---

## שלב 2 — עדכון האפליקציה (אחרי שהתחברת, על השרת)

שורה אחת:

```
cd /root/onyx-trainer && git pull origin claude/language-test-51-questions-lafgyx && pm2 restart onyx-trainer --update-env
```

או, אם כבר עשית `git pull` פעם אחת, אפשר להריץ את סקריפט הפריסה הבטוח שבריפו:

```
cd /root/onyx-trainer && ./web/deploy/deploy-onyx-trainer.sh
```

---

## שלב 3 — בדיקה שהכול תקין (על השרת)

```
pm2 status
```
`onyx-trainer` צריך להיות `online`.

```
curl -s -o /dev/null -w "%{http_code}\n" https://learn.onyx-study.com/exam
```
`200` = תקין.

אם משהו נכשל:
```
pm2 logs onyx-trainer --lines 40
```

---

## ⛔ אסור בהחלט (שרת פרודקשן משותף!)

בשרת רצות עוד אפליקציות חיות. כשמעדכנים את האפליקציה שלנו:

- ✅ מפעילים מחדש **רק** את שלנו: `pm2 restart onyx-trainer`
- ❌ **לעולם לא**: `pm2 restart all` · `pm2 delete all` · `pm2 kill` · `pm2 stop all`
- ❌ לא נוגעים ב-nginx, בתעודות SSL, או במסדי נתונים של אפליקציות אחרות
- ❌ לא מריצים `rm -rf` מחוץ ל-`/root/onyx-trainer`

---

## גישה חלופית דרך הדפדפן (אם אין מפתח SSH במחשב)

בלוח הבקרה של Contabo → ליד השרת לחץ **Manage ▾** → **VNC / Console**.
נפתח מסוף בדפדפן. שם צריך את **סיסמת ה-root** של השרת (לא את המפתח).
לאחר הכניסה — אותן פקודות של שלב 2 ו-3.

---

## תזכורת: יצירת מפתח חדש (רק אם צריך גישה ממחשב חדש)

אם אין מפתח במחשב הזה ורוצים להוסיף גישה:
1. במחשב: `ssh-keygen -t ed25519 -f %USERPROFILE%\.ssh\onyx_hetzner`
2. יש להוסיף את התוכן של `onyx_hetzner.pub` אל `/root/.ssh/authorized_keys` בשרת
   (מתבצע דרך גישה קיימת — VNC או מחשב אחר שכבר יש לו גישה).
