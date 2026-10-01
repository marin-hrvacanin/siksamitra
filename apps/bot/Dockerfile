# The śikṣāmitra bot — built on the server from a checkout of this repository
# (/srv/apps/siksamitra-bot/src), by `docker compose build`; see docs/BOT.md.
#
# Nothing secret is in the image: the key and the token come from the
# server's .env at run time, and .dockerignore keeps any local .env out.
FROM node:24-bookworm-slim

# What a headless Chromium needs to print the PDFs. No fonts: every page
# carries its own, embedded.
RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates unzip libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 libxkbcommon0 \
      libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libgbm1 libasound2 libpango-1.0-0 libcairo2 \
      libx11-6 libx11-xcb1 libxcb1 libxext6 libexpat1 libglib2.0-0 libdbus-1-3 libfontconfig1 \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY . .
# The browser is pinned by puppeteer's own installer, so a system update
# cannot change what prints the PDFs.
RUN npm ci --no-audit --no-fund --ignore-scripts \
 && npx --yes @puppeteer/browsers install chrome-headless-shell@stable --path /opt/browsers \
 && ln -s "$(find /opt/browsers -type f -name chrome-headless-shell | head -1)" /usr/local/bin/chrome-headless-shell \
 && npm cache clean --force

ENV NODE_ENV=production CHROME=/usr/local/bin/chrome-headless-shell BOT_DATA_DIR=/data HOME=/tmp
USER node
CMD ["node_modules/.bin/tsx", "--tsconfig", "tools/export/tsconfig.render.json", "--import", "./tools/export/no-css.mjs", "apps/bot/src/telegram.ts"]
