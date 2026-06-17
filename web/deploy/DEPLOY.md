# Deploying the Samaritan Torah web app on your own server

Target: a Linux server (Ubuntu/Debian assumed) running **gunicorn** behind
**nginx**, on a sub-domain such as `torah.the-samaritans.net`, with free HTTPS.

The app is **read-only** (only `SELECT`s run against `data/torah.db`), needs only
**Flask + gunicorn**, and makes outbound calls to Sefaria/Wiktionary — so the
server needs normal outbound internet. There are **no secrets** to configure.

> Replace `torah.the-samaritans.net`, `/var/www/samaritan-torah` and the `User`
> with your own values throughout (and in the two config files in this folder).

---

## 1. Put the files on the server

The web app needs `app/`, `web/` and `data/torah.db` (the whole repo is fine).

**The deployed app is public; your source and DB do NOT have to be.** Visitors
reach the app at the URL but cannot see the code or download `torah.db`. Pick a
transfer method that keeps the source private:

**Option A — rsync from your PC (recommended; nothing is published anywhere):**
```bash
rsync -avz --exclude '.git' --exclude '.buildozer' --exclude 'bin' \
      --exclude '.env' --exclude '__pycache__' --exclude '*.bak*' \
      ./ youruser@your-server:/var/www/samaritan-torah/
```
The files go straight to your server — no GitHub, nothing exposed.

**Option B — a PRIVATE git repo** (lets you `git pull` to update, still private):
create a new **private** repo (not the public APK one), then on the server:
```bash
sudo git clone https://<token>@github.com/<you>/<private-repo>.git /var/www/samaritan-torah
```
(Make sure `data/torah.db` and `web/` are committed. Never commit `.env`.)

```bash
sudo chown -R www-data:www-data /var/www/samaritan-torah
```

## 2. Python environment

```bash
cd /var/www/samaritan-torah
sudo apt update && sudo apt install -y python3-venv nginx
python3 -m venv venv
./venv/bin/pip install -r web/requirements-prod.txt
```

## 3. Smoke-test it

```bash
./venv/bin/gunicorn web.server:app --bind 127.0.0.1:8000 &
curl -s localhost:8000/api/books?mode=samaritan | head -c 80   # should print JSON
kill %1
```

## 4. Run it as a service (systemd)

```bash
sudo cp web/deploy/samaritan-torah.service /etc/systemd/system/
# edit the file if your path/user differ:
sudo nano /etc/systemd/system/samaritan-torah.service
sudo systemctl daemon-reload
sudo systemctl enable --now samaritan-torah
sudo systemctl status samaritan-torah          # should be "active (running)"
```

## 5. nginx reverse proxy

```bash
sudo cp web/deploy/nginx-torah.conf /etc/nginx/sites-available/torah
sudo nano /etc/nginx/sites-available/torah       # set your server_name + paths
sudo ln -s /etc/nginx/sites-available/torah /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

## 6. DNS

Add an **A record** for the sub-domain pointing at the server's IP:
```
torah.the-samaritans.net.   A   <your-server-ip>
```
(If the-samaritans.net is on Cloudflare, add it there; you may set the proxy to
"DNS only" first while issuing the certificate, then turn the proxy back on.)

## 7. HTTPS (free, Let's Encrypt)

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d torah.the-samaritans.net
```
certbot edits the nginx file to add SSL and a HTTP→HTTPS redirect. Done — the app
is now public at **https://torah.the-samaritans.net**.

---

## Updating later

```bash
cd /var/www/samaritan-torah
git pull            # or rsync again
./venv/bin/pip install -r web/requirements-prod.txt   # only if deps changed
sudo systemctl restart samaritan-torah
```
The service worker is network-first and self-updates, so visitors get the new
version on their next refresh.

## Notes

- **The 44 MB DB ships with the code.** It's read-only at runtime; nothing writes
  to it. Make sure `data/torah.db` is present on the server.
- **Outbound internet** must be allowed (Sefaria commentaries + online Hebrew
  dictionary). Nothing else is needed — no API keys, no database server.
- **Contact form** sends via the visitor's own mail client (`mailto:`), so there
  is no SMTP to configure. (If you later want server-side auto-send, that's a
  separate addition.)
- If `web/` or `data/torah.db` are not yet committed and you want the git route,
  commit them first (`git add web data/torah.db && git commit`). Pushing to a
  public repo publishes the code — do that only if you intend it to be public.
