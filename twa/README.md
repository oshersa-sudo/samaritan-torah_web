# TWA — אפליקציית אנדרואיד עוטפת לגרסת ה-web

עוטפת את `https://samaritan-torah.onrender.com` ב-APK אמיתי: אייקון משלה במגירת
האפליקציות, בלי שורת כתובת, מסך פתיחה, ומוכנה להעלאה ל-Play Store. הרינדור עצמו
נעשה על ידי Chrome שבמכשיר — זו אריזה נייטיב, לא אפליקציה נייטיב.

חבילה: `net.thesamaritans.torah` — שונה מזו של אפליקציית Kivy
(`net.thesamaritans.samaritantorah`), כך ששתיהן יכולות להיות מותקנות במקביל.

`twa-manifest.json` הוא הקובץ היחיד שצריך לערוך. כל השאר (`app/`, `gradle*`,
ה-keystore וקבצי הפלט) נוצר בזמן הבנייה ולא נכנס ל-git.

הבנייה נעשית ב-[build-twa.yml](../.github/workflows/build-twa.yml) עם
Bubblewrap 1.25, שמייצר פרויקט עם `targetSdkVersion 36` ו-`minSdkVersion 24` —
הרבה מעל הסף ש-Play Protect חוסם.

## הקמה חד-פעמית

### 1. יצירת מפתח החתימה

צריך JDK מקומי. אם אין:

```bash
winget install EclipseAdoptium.Temurin.17.JDK
```

ואז, מתיקיית הפרויקט:

```bash
keytool -genkeypair -v -keystore twa/android.keystore -alias torah -keyalg RSA -keysize 2048 -validity 10000
```

הפקודה תבקש סיסמה. **חייבת להיות ASCII בלבד** — אותיות אנגליות, ספרות וסימנים.
keytool אינו מציג את התווים בזמן ההקלדה, ואם המקלדת בעברית הוא ייצור keystore
שאי אפשר לפתוח אחר כך (`UnrecoverableKeyException: Password is not ASCII`);
במקרה כזה יש למחוק את הקובץ וליצור אותו מחדש.

הסיסמה נשארת אצלך בלבד. **שמור גיבוי של
`twa/android.keystore` ושל הסיסמה**: אם הם הולכים לאיבוד לא ניתן יותר לפרסם
עדכון לאותה אפליקציה, ומשתמשים קיימים לא יוכלו לעדכן. הקובץ מוחרג ב-`.gitignore`
ואסור לו להיכנס ל-git.

### 2. שליפת טביעת האצבע

```bash
keytool -list -v -keystore twa/android.keystore -alias torah
```

מהפלט קח את השורה שמתחילה ב-`SHA256:` — ערך הקסדצימלי מופרד בנקודתיים.

### 3. פרסום טביעת האצבע באתר

בלי זה האפליקציה תיפתח עם שורת כתובת מעל, כמו טאב דפדפן רגיל.

הדרך המהירה — ב-Render, תחת Environment, הוסף:

| משתנה | ערך |
|---|---|
| `TWA_FINGERPRINTS` | טביעת האצבע מסעיף 2 |

אפשר גם לערוך ישירות את [web/assetlinks.json](../web/assetlinks.json) ולדחוף —
המשתנה גובר עליו כשהוא מוגדר. כשמעלים ל-Play Store עם Play App Signing גוגל
חותמת מחדש במפתח משלה, ואז צריך **שתי** טביעות אצבע: זו שלך וזו של גוגל
(מ-Play Console ← Setup ← App signing), מופרדות בפסיק.

לאימות אחרי הפריסה:

```bash
curl https://samaritan-torah.onrender.com/.well-known/assetlinks.json
```

### 4. הגדרת ה-secrets ב-GitHub

תחת Settings ← Secrets and variables ← Actions:

| Secret | ערך |
|---|---|
| `TWA_KEYSTORE_BASE64` | ה-keystore מקודד base64 (ראה למטה) |
| `TWA_KEYSTORE_PASSWORD` | סיסמת ה-keystore מסעיף 1 |
| `TWA_KEY_PASSWORD` | סיסמת ה-alias (בדרך כלל זהה) |

לקידוד ה-keystore ב-PowerShell:

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("twa\android.keystore")) | Set-Clipboard
```

## בנייה

ידנית: Actions ← Build Android TWA ← Run workflow.

או בדחיפת תג:

```bash
git tag twa-v1.0.0 && git push origin twa-v1.0.0
```

הפלט — `app-release-signed.apk` (להתקנה ישירה) ו-`app-release-bundle.aab`
(להעלאה ל-Play Store) — מצורף ל-release ולעמוד ה-Actions.

## עדכון גרסה

ב-`twa-manifest.json`, העלה את שני השדות יחד — `appVersionCode` חייב לגדול בכל
העלאה ל-Play Store:

```json
"appVersion": "1.1.0",
"appVersionCode": 2
```

שינוי בתוכן האתר עצמו לא מצריך בנייה מחדש: ה-TWA טוענת את האתר החי.
בנייה מחדש נחוצה רק לשינוי שם, אייקון, צבעים או גרסה.
