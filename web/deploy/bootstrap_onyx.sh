#!/usr/bin/env bash
# =============================================================================
# ⚠️ DEDICATED-SERVER ONLY. Do NOT run this on the shared onyx-study VPS that
#    already hosts onyx/tasks/media/foodorder — it configures nginx as the
#    default site and could disturb them. For that server follow
#    web/DEPLOY_ONYX_SERVER.md (additive: new folder, pm2 name, port, subdomain).
# =============================================================================
# bootstrap_onyx.sh — one-shot, idempotent setup for onyx-study.com on a VPS.
# Installs deps, fetches the code, configures systemd + nginx, and (if DNS is
# ready) enables HTTPS. Safe to re-run: it just updates and restarts.
#
# Run on the server (as root):
#   curl -fsSL https://raw.githubusercontent.com/oshersa-sudo/samaritan-torah_web/claude/language-test-51-questions-lafgyx/web/deploy/bootstrap_onyx.sh | bash
#
# Override defaults with env vars, e.g.:
#   DOMAIN=onyx-study.com BRANCH=main EMAIL=you@example.com bash bootstrap_onyx.sh
# =============================================================================
set -euo pipefail

DOMAIN="${DOMAIN:-onyx-study.com}"
BRANCH="${BRANCH:-claude/language-test-51-questions-lafgyx}"
EMAIL="${EMAIL:-oshersa@gmail.com}"
REPO="${REPO:-https://github.com/oshersa-sudo/samaritan-torah_web.git}"
APPDIR="${APPDIR:-/var/www/onyx-study}"

echo "==> onyx-study bootstrap | domain=$DOMAIN branch=$BRANCH dir=$APPDIR"
export DEBIAN_FRONTEND=noninteractive

echo "==> [1/6] installing packages…"
apt-get update -qq
apt-get install -y -qq python3-venv python3-pip nginx git git-lfs \
                      certbot python3-certbot-nginx curl >/dev/null

echo "==> [2/6] fetching code…"
if [ -d "$APPDIR/.git" ]; then
  git -C "$APPDIR" fetch -q --all
  git -C "$APPDIR" checkout -q "$BRANCH"
  git -C "$APPDIR" reset -q --hard "origin/$BRANCH"
else
  git clone -q "$REPO" "$APPDIR"
  git -C "$APPDIR" checkout -q "$BRANCH"
fi
cd "$APPDIR"
git lfs install >/dev/null 2>&1 || true
git lfs pull    >/dev/null 2>&1 || true
mkdir -p "$APPDIR/data"

echo "==> [3/6] python venv…"
[ -d venv ] || python3 -m venv venv
./venv/bin/pip install -q --upgrade pip
# flask + gunicorn to serve; pywebpush powers the parent/child push reminders
./venv/bin/pip install -q flask gunicorn pywebpush

echo "==> [4/6] systemd service…"
cp web/deploy/onyx-study.service /etc/systemd/system/onyx-study.service
# daily "hasn't practised" reminder (push to phone, e-mail fallback). A random
# CRON_KEY is generated once and shared between the app and the timer so the
# guarded endpoint can only be hit locally.
CRON_KEY_FILE="$APPDIR/data/cron_key"
[ -s "$CRON_KEY_FILE" ] || (umask 077; head -c 24 /dev/urandom | base64 | tr -d '/+=' > "$CRON_KEY_FILE")
CRON_KEY="$(cat "$CRON_KEY_FILE")"
mkdir -p /etc/systemd/system/onyx-study.service.d
printf '[Service]\nEnvironment=CRON_KEY=%s\n' "$CRON_KEY" > /etc/systemd/system/onyx-study.service.d/cron.conf
if [ -f web/deploy/onyx-inactivity.service ]; then
  sed "s/change-me-to-a-long-random-string/$CRON_KEY/" web/deploy/onyx-inactivity.service > /etc/systemd/system/onyx-inactivity.service
  cp web/deploy/onyx-inactivity.timer /etc/systemd/system/onyx-inactivity.timer
fi
systemctl daemon-reload
systemctl enable -q onyx-study >/dev/null 2>&1 || true
systemctl restart onyx-study
systemctl enable -q --now onyx-inactivity.timer >/dev/null 2>&1 || true
chown -R www-data:www-data "$APPDIR/data"

echo "==> [5/6] nginx…"
cp web/deploy/onyx-study.conf /etc/nginx/sites-available/onyx-study
ln -sf /etc/nginx/sites-available/onyx-study /etc/nginx/sites-enabled/onyx-study
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

sleep 2
if curl -fsS http://127.0.0.1:8000/health >/dev/null; then
  echo "    app is healthy on :8000"
else
  echo "    WARNING: app did not answer on :8000 — check: journalctl -u onyx-study -n 50"
fi

echo "==> [6/6] HTTPS…"
SERVER_IP="$(curl -fsS ifconfig.me || true)"
DOMAIN_IP="$(getent hosts "$DOMAIN" | awk '{print $1}' | head -1 || true)"
if [ -n "$DOMAIN_IP" ] && [ "$DOMAIN_IP" = "$SERVER_IP" ]; then
  certbot --nginx -d "$DOMAIN" -d "www.$DOMAIN" \
          --non-interactive --agree-tos -m "$EMAIL" --redirect \
    && echo "    HTTPS enabled" \
    || echo "    certbot failed — re-run this script after DNS/other fixes"
else
  echo "    SKIPPED: DNS for $DOMAIN (=$DOMAIN_IP) is not yet pointing at this server (=$SERVER_IP)."
  echo "    Add A records @ and www -> $SERVER_IP, then re-run this script to get HTTPS."
fi

echo ""
echo "======================================================================"
echo " DONE.  http://$DOMAIN/exam        (the trainer)"
echo "        http://$DOMAIN/parent      (parent portal)"
echo " Manage: systemctl status onyx-study | journalctl -u onyx-study -f"
echo "======================================================================"
