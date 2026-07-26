#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Safe one-command deploy for the Onyx learning trainer ("onyx-trainer").
#
# This runs on a SHARED production VPS that hosts several live apps. By design
# this script touches ONLY this one app: it never runs `pm2 restart all`,
# `pm2 kill`, `rm -rf`, or anything outside /root/onyx-trainer.
#
# Usage — from your laptop (deploys over SSH, no need to log in first):
#     web/deploy/deploy-onyx-trainer.sh
#
# Usage — while already logged into the server:
#     ~/onyx-trainer/web/deploy/deploy-onyx-trainer.sh   (auto-detects, runs locally)
#
# Deploy a different branch (e.g. once merged to main):
#     web/deploy/deploy-onyx-trainer.sh main
#
# Override SSH target if needed:
#     ONYX_SSH_KEY=~/.ssh/onyx_hetzner ONYX_SSH_HOST=root@194.163.130.39 ./deploy-onyx-trainer.sh
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

APP="onyx-trainer"
APP_DIR="/root/onyx-trainer"
BRANCH="${1:-claude/language-test-51-questions-lafgyx}"
HEALTH_URL="https://learn.onyx-study.com/exam"
SSH_KEY="${ONYX_SSH_KEY:-$HOME/.ssh/onyx_hetzner}"
SSH_HOST="${ONYX_SSH_HOST:-root@194.163.130.39}"

# The exact commands that run ON the server. Kept in one place so local and
# remote modes are identical. `--ff-only` refuses to clobber server-side edits;
# it fails loudly instead of forcing, which is what we want on production.
remote_cmds() {
  cat <<EOS
set -euo pipefail
cd "$APP_DIR"
echo "→ app dir : \$(pwd)"
echo "→ before  : \$(git rev-parse --short HEAD) (\$(git rev-parse --abbrev-ref HEAD))"
git fetch --quiet origin "$BRANCH"
git checkout --quiet "$BRANCH"
git pull --ff-only origin "$BRANCH"
echo "→ after   : \$(git rev-parse --short HEAD)"
# restart ONLY this app — never 'all'
pm2 restart "$APP" --update-env
sleep 2
pm2 describe "$APP" | grep -E "^\s*│?\s*(name|status|pid|uptime)" || pm2 list | grep "$APP"
EOS
}

echo "=================================================="
echo " Deploying '$APP'  ·  branch: $BRANCH"
echo "=================================================="

if [ -d "$APP_DIR/.git" ]; then
  echo "• Mode: LOCAL (already on $(hostname))"
  bash -c "$(remote_cmds)"
else
  echo "• Mode: REMOTE via $SSH_HOST"
  if [ ! -f "$SSH_KEY" ]; then
    echo "✗ SSH key not found: $SSH_KEY"
    echo "  (it must exist on this machine — that's what grants access)"
    exit 1
  fi
  remote_cmds | ssh -i "$SSH_KEY" -o ConnectTimeout=15 "$SSH_HOST" 'bash -s'
fi

echo "--------------------------------------------------"
echo "• Health check: $HEALTH_URL"
code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 "$HEALTH_URL" || echo 000)"
if [ "$code" = "200" ]; then
  echo "✅ $code — deploy OK, site is live."
else
  echo "⚠️  Got HTTP $code (expected 200)."
  echo "    Check logs (this app only):  pm2 logs $APP --lines 40"
  exit 1
fi
