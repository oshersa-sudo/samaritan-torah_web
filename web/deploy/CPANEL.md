# Deploying on shared hosting (cPanel "Setup Python App")

cPanel has no SSH/systemd/nginx for you to configure — instead it runs Python
apps through **Passenger** via the **"Setup Python App"** tool. The entry point
`passenger_wsgi.py` (in the project root) is already prepared.

> **Make-or-break check first:** in cPanel, under the **Software** section, is
> there **"Setup Python App"** (a.k.a. *Python Selector*)? If it's missing, the
> plan does not support Python web apps and a small VPS is the reliable route.
> Also note the Python versions it offers (3.9+ is ideal).

> **Two limitations to expect on shared hosting:**
> 1. **Outbound internet may be blocked.** If so, the live "פרשנים נוספים
>    (ספריא)" and the online Hebrew dictionary won't work — but everything else
>    (browse, search, compare, Tal dictionary, Tibåt Mårqe, …) runs fully from
>    the local DB.
> 2. **Disk/quota** must allow the 44 MB `data/torah.db`.

---

## 1. Create the sub-domain
cPanel → **Domains / Subdomains** → create `torah.the-samaritans.net`.

## 2. Upload the files
Zip these on your PC and upload via **File Manager** (or SFTP) into a new folder,
e.g. `~/torahweb`, then extract:
- `app/`  ·  `web/`  ·  `data/torah.db`  ·  `passenger_wsgi.py`

(You don't need `main.py`, `buildozer.spec`, `assets/`, the root
`requirements.txt`, `.env`, `.git`, scripts or research files — those are for the
phone app / local work.)

## 3. Setup Python App
cPanel → **Setup Python App** → **Create Application**:
- **Python version:** highest available (3.9+)
- **Application root:** `torahweb` (the folder you uploaded to)
- **Application URL:** select `torah.the-samaritans.net`
- **Application startup file:** `passenger_wsgi.py`
- **Application Entry point:** `application`
- Create.

## 4. Install Flask
On the application's page set the **requirements file** to **`web/requirements.txt`**
(it lists only Flask — no Kivy) and click **Run Pip Install**. (If there's no
requirements-file field, use the "execute" / pip box and run `pip install flask`.)

## 5. Restart & open
Click **Restart**, then open **https://torah.the-samaritans.net** — you should see
the book list. cPanel usually provisions HTTPS automatically (AutoSSL); if not,
enable AutoSSL for the sub-domain.

---

## Updating later
Re-upload the changed files (or just `web/`) via File Manager/SFTP and click
**Restart** on the Python App page.

## If "Setup Python App" is missing or it won't run
The app needs a real Python runtime + outbound internet. The dependable
alternative is a small VPS (Hetzner/DigitalOcean/Linode, ~$4–6/mo) — then the
`gunicorn + nginx` guide in `DEPLOY.md` applies and everything (incl. Sefaria and
the online dictionary) works.
