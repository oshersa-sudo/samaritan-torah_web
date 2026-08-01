# פרסום Onyx לימודי ל-Google Play (אפליקציה אחת: מתאמן + מעקב הורים)

האפליקציה היא PWA שנארזת לחנות כ-**TWA** (Trusted Web Activity) — עטיפה דקה
שמריצה את `https://learn.onyx-study.com` במסך מלא, בלי שורת דפדפן.

## מה כבר מוכן בקוד (הכל נעשה)
- `learn.webmanifest` מלא: שם, תיאור, `id`, `categories`, אייקונים רגילים
  ו-**maskable** (192/512), `shortcuts` (תרגול + מעקב הורים), ו-3 **screenshots**.
- אייקוני maskable: `static/img/onyx_learn_icon-maskable-{192,512}.png`.
- צילומי מסך לרשימת החנות: `static/img/shot-hub.png`, `shot-exercise.png`,
  `shot-parent.png` (900×1840).
- Route אימות בעלות: `/.well-known/assetlinks.json` (ממתין לטביעת האצבע).
- תבנית build: `web/deploy/twa-manifest.json`.

## מה שנשאר לך (דורש חשבון + כלים)

### 0. דרישות מקדימות
- חשבון **Google Play Developer** — תשלום חד-פעמי **$25** (play.google.com/console).
- **Node.js** (יש) + **JDK 17**. הכלי: Bubblewrap.
  ```bash
  npm i -g @bubblewrap/cli
  ```
  (חלופה בלי CLI: אתר **pwabuilder.com** → הזן את הכתובת → הורד חבילת Android.)

### 1. יצירת פרויקט ה-TWA
```bash
bubblewrap init --manifest https://learn.onyx-study.com/static/learn.webmanifest
# packageId: com.onyxstudy.learn   (כברירת מחדל; אפשר להשאיר)
# ברוב השאלות אפשר ללחוץ Enter — הערכים נלקחים מהמניפסט.
```
או השתמש בתבנית המוכנה: העתק את `web/deploy/twa-manifest.json` לתיקיית העבודה
ואז `bubblewrap update`.

### 2. בנייה + מפתח חתימה
```bash
bubblewrap build
```
- נוצר `app-release-bundle.aab` (זה מה שמעלים לחנות) + `app-release-signed.apk`.
- בפעם הראשונה Bubblewrap ייצור **keystore** (`android.keystore`) וסיסמה —
  **שמור אותם בגיבוי בטוח!** בלעדיהם אי אפשר לעדכן את האפליקציה בעתיד.

### 3. אימות הבעלות על הדומיין (assetlinks) — קריטי
בלי זה האפליקציה תציג שורת כתובת של דפדפן.
1. קבל את טביעת האצבע SHA-256:
   ```bash
   keytool -list -v -keystore android.keystore -alias android | grep SHA256
   ```
   **חשוב:** אם תשתמש ב-"App signing by Google Play" (מומלץ, ברירת מחדל בהעלאה),
   טביעת האצבע ה**אמיתית** מופיעה ב-Play Console → *Setup → App signing*. השתמש בה.
2. הגדר בשרת (ב-env של pm2, כמו שעשינו ל-CRON_KEY) והפעל מחדש:
   ```bash
   TWA_PACKAGE="com.onyxstudy.learn" \
   TWA_FINGERPRINT="AA:BB:CC:...:FF" \
   pm2 restart onyx-trainer --update-env && pm2 save
   ```
   (אפשר כמה טביעות אצבע מופרדות בפסיק — למשל upload + Google signing.)
3. אמת:
   ```bash
   curl -s https://learn.onyx-study.com/.well-known/assetlinks.json
   ```
   צריך להראות את ה-package ואת טביעת האצבע.

### 4. העלאה ל-Play Console
1. Create app → שם "Onyx לימודי", שפה עברית, קטגוריה **Education**.
2. Production → Create release → העלה את ה-`.aab`.
3. Store listing:
   - תיאור קצר/מלא (יש טקסט מוכן ב-`description` שבמניפסט).
   - **צילומי מסך**: העלה את השלושה מ-`static/img/shot-*.png`.
   - אייקון: `onyx_learn_icon-512.png`; Feature graphic 1024×500 (צריך להכין).
4. מדיניות: מכיוון שהאפליקציה לילדים ואוספת טלפון/שם — צריך **מדיניות פרטיות**
   (URL) ולמלא את שאלון *Data safety* + *Families/Target audience*.
   - **Privacy policy URL:** `https://learn.onyx-study.com/privacy` (דף מוכן;
     ודא שכתובת יצירת הקשר בו — support@onyx-study.com — תקינה או עדכן אותה).
   - **Feature graphic (1024×500):** `static/img/feature-graphic.png` — מוכן.
5. שלח לביקורת. אישור ראשון בדרך כלל תוך מספר ימים.

## עדכונים עתידיים
כל שינוי בקוד ה-web מתעדכן באפליקציה **אוטומטית** (זו רק עטיפה של האתר). צריך
build+העלאה חדשים רק כדי לשנות אייקון/שם/הרשאות או להעלות `appVersionCode`.

## הערה על iOS (App Store)
iOS לא תומך ב-TWA. שם צריך עטיפת Capacitor/WKWebView, חשבון Apple ($99/שנה),
Mac+Xcode, ולרוב push נייטיב. מסמך נפרד כשנגיע לזה.
