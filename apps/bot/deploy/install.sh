#!/usr/bin/env bash
# Install or update the śikṣāmitra bot on a Debian/Ubuntu server. Run as root:
#
#   curl -fsSL https://raw.githubusercontent.com/marin-hrvacanin/siksamitra/<branch>/apps/bot/deploy/install.sh | BRANCH=<branch> bash
#
# or from a checkout: BRANCH=<branch> bash apps/bot/deploy/install.sh
#
# It never asks for, prints or stores a secret. The settings file
# /etc/siksamitra/bot.env is created empty (0640, root:siksamitra) the first
# time; fill it with `sudoedit /etc/siksamitra/bot.env` (see .env.example),
# or send it over SSH without it touching a disk on the way:
#
#   ssh root@SERVER 'install -m 640 -o root -g siksamitra /dev/stdin /etc/siksamitra/bot.env' < bot.env
set -euo pipefail

REPO="${REPO:-https://github.com/marin-hrvacanin/siksamitra.git}"
BRANCH="${BRANCH:-main}"
APP=/opt/siksamitra
DATA=/var/lib/siksamitra
CONF=/etc/siksamitra

[ "$(id -u)" = 0 ] || { echo "run as root" >&2; exit 1; }

apt-get update -qq
apt-get install -y -qq git curl ca-certificates libnss3 libatk-bridge2.0-0 libgbm1 libxkbcommon0 libasound2t64 2>/dev/null \
  || apt-get install -y -qq git curl ca-certificates libnss3 libatk-bridge2.0-0 libgbm1 libxkbcommon0 libasound2

# Node 22 or newer.
if ! command -v node >/dev/null || [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 22 ]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y -qq nodejs
fi

id siksamitra >/dev/null 2>&1 || useradd --system --home "$APP" --shell /usr/sbin/nologin siksamitra

if [ -d "$APP/.git" ]; then
  git -C "$APP" fetch --depth 1 origin "$BRANCH"
  git -C "$APP" checkout -q -B "$BRANCH" FETCH_HEAD
else
  git clone --depth 1 --branch "$BRANCH" "$REPO" "$APP"
fi
chown -R siksamitra:siksamitra "$APP"

# The code's dependencies, and a headless Chromium of its own for the PDFs —
# pinned by puppeteer's installer, so a system update cannot break the print.
sudo -u siksamitra -H bash -c "cd '$APP' && npm ci --no-audit --no-fund --ignore-scripts && \
  npx --yes @puppeteer/browsers install chrome-headless-shell@stable --path '$APP/.browsers' >/dev/null"
SHELL_BIN="$(find "$APP/.browsers" -type f -name chrome-headless-shell | head -1)"
[ -x "$SHELL_BIN" ] || { echo "the headless browser did not install" >&2; exit 1; }

install -d -m 700 -o siksamitra -g siksamitra "$DATA"
install -d -m 750 -o root -g siksamitra "$CONF"
if [ ! -f "$CONF/bot.env" ]; then
  install -m 640 -o root -g siksamitra /dev/null "$CONF/bot.env"
  echo "created $CONF/bot.env — fill it in (sudoedit), then: systemctl restart siksamitra-bot"
fi
# Where the browser is, kept beside the secrets but not one of them.
grep -q '^CHROME=' "$CONF/bot.env" && sed -i "s#^CHROME=.*#CHROME=$SHELL_BIN#" "$CONF/bot.env" || echo "CHROME=$SHELL_BIN" >> "$CONF/bot.env"

install -m 644 "$APP/apps/bot/deploy/siksamitra-bot.service" /etc/systemd/system/siksamitra-bot.service
systemctl daemon-reload
systemctl enable siksamitra-bot >/dev/null
systemctl restart siksamitra-bot
sleep 3
systemctl --no-pager --lines=5 status siksamitra-bot || true
