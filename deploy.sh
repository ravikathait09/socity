#!/usr/bin/env bash
# Deploy Socity (Next.js) to Apache at socity.katharostechie.in
# App root: /var/www/socity  |  Node (PM2) on 127.0.0.1:3300, Apache reverse-proxies.
#
# First time on server:
#   sudo mkdir -p /var/www/socity
#   sudo git clone <your-repo-url> /var/www/socity
#   sudo cp deploy.sh /var/www/socity/deploy.sh   # or clone includes it
#   sudo chmod +x /var/www/socity/deploy.sh
#   sudo /var/www/socity/deploy.sh
#
# Updates: sudo /var/www/socity/deploy.sh

set -euo pipefail

# --- configuration (override via environment) ---
APP_DIR="${APP_DIR:-/var/www/socity}"
DOMAIN="${DOMAIN:-socity.katharostechie.in}"
APP_PORT="${APP_PORT:-3300}"
SERVICE_NAME="${SERVICE_NAME:-socity}"
NODE_MIN_MAJOR=18
APACHE_SITE="${APACHE_SITE:-socity.katharostechie.in}"
RUN_SEED="${RUN_SEED:-0}"

log() { echo "[deploy] $*"; }
die() { echo "[deploy] ERROR: $*" >&2; exit 1; }

if [[ "$(id -u)" -ne 0 ]]; then
  die "Run as root: sudo $0"
fi

# --- prerequisites ---
command -v node >/dev/null || die "Node.js not found. Install Node ${NODE_MIN_MAJOR}+ (e.g. nodesource setup_20.x)."
command -v npm >/dev/null || die "npm not found."
command -v apache2 >/dev/null || command -v httpd >/dev/null || die "Apache not found (apache2 or httpd)."
APACHECTL="$(command -v apache2ctl 2>/dev/null || command -v apachectl 2>/dev/null || true)"
[[ -n "$APACHECTL" ]] || die "apache2ctl/apachectl not found."

NODE_MAJOR="$(node -p "process.versions.node.split('.')[0]")"
[[ "$NODE_MAJOR" -ge "$NODE_MIN_MAJOR" ]] || die "Node ${NODE_MIN_MAJOR}+ required (found $(node -v))."

[[ -d "$APP_DIR" ]] || mkdir -p "$APP_DIR"
cd "$APP_DIR"

# Keep deploy script at app root
SCRIPT_SRC="$(readlink -f "${BASH_SOURCE[0]}" 2>/dev/null || realpath "${BASH_SOURCE[0]}" 2>/dev/null || echo "${BASH_SOURCE[0]}")"
if [[ "$SCRIPT_SRC" != "$APP_DIR/deploy.sh" ]] && [[ -f "$SCRIPT_SRC" ]]; then
  cp -f "$SCRIPT_SRC" "$APP_DIR/deploy.sh"
  chmod +x "$APP_DIR/deploy.sh"
  log "Updated $APP_DIR/deploy.sh"
fi

# --- environment file ---
ENV_FILE="$APP_DIR/.env.production"
if [[ ! -f "$ENV_FILE" ]]; then
  cat >"$ENV_FILE" <<'ENVEOF'
NODE_ENV=production
PORT=3300
HOSTNAME=127.0.0.1

# REQUIRED: set before going live
MONGODB_URI=mongodb://127.0.0.1:27017/socity
JWT_SECRET=CHANGE_ME_TO_A_LONG_RANDOM_STRING

# Optional: public URL (used by some Next.js features)
# NEXT_PUBLIC_APP_URL=https://socity.katharostechie.in
ENVEOF
  chmod 600 "$ENV_FILE"
  log "Created $ENV_FILE — edit MONGODB_URI and JWT_SECRET, then re-run deploy."
  die "Configure $ENV_FILE and run deploy again."
fi

env_val() { grep -E "^${1}=" "$ENV_FILE" 2>/dev/null | head -1 | cut -d= -f2- | tr -d '\r"' || true; }
JWT_VAL="$(env_val JWT_SECRET)"
MONGO_VAL="$(env_val MONGODB_URI)"
if [[ -z "$JWT_VAL" || "$JWT_VAL" == "CHANGE_ME_TO_A_LONG_RANDOM_STRING" ]]; then
  die "Set a strong JWT_SECRET in $ENV_FILE"
fi
if [[ -z "$MONGO_VAL" ]]; then
  die "Set MONGODB_URI in $ENV_FILE"
fi

# --- build ---
log "Installing dependencies in $APP_DIR"
if [[ -f package-lock.json ]]; then
  npm ci
else
  npm install
fi

log "Building Next.js (standalone)"
export NODE_ENV=production
npm run build

STANDALONE="$APP_DIR/.next/standalone"
[[ -d "$STANDALONE" ]] || die "Standalone build missing. Check next.config output: standalone."

log "Copying static assets into standalone bundle"
mkdir -p "$STANDALONE/.next"
cp -r "$APP_DIR/.next/static" "$STANDALONE/.next/static"
[[ -d "$APP_DIR/public" ]] && cp -r "$APP_DIR/public" "$STANDALONE/public"

# --- optional seed ---
if [[ "$RUN_SEED" == "1" ]]; then
  log "Seeding database (RUN_SEED=1)"
  node --env-file="$ENV_FILE" "$APP_DIR/scripts/seed.mjs" || log "Seed skipped or failed (check MongoDB)"
fi

# --- PM2 process manager ---
command -v pm2 >/dev/null || npm install -g pm2

mkdir -p "$APP_DIR/logs"
chown -R www-data:www-data "$APP_DIR/.next" "$APP_DIR/public" "$APP_DIR/logs" 2>/dev/null || true
chown www-data:www-data "$ENV_FILE"

# Sync PORT in .env.production with APP_PORT
if grep -q '^PORT=' "$ENV_FILE"; then
  sed -i.bak "s/^PORT=.*/PORT=${APP_PORT}/" "$ENV_FILE" && rm -f "${ENV_FILE}.bak"
else
  echo "PORT=${APP_PORT}" >>"$ENV_FILE"
fi

# Disable legacy systemd unit if present
systemctl stop "$SERVICE_NAME" 2>/dev/null || true
systemctl disable "$SERVICE_NAME" 2>/dev/null || true

export APP_DIR APP_PORT
cd "$APP_DIR"
pm2 delete "$SERVICE_NAME" 2>/dev/null || true
pm2 start ecosystem.config.cjs --env production --update-env
pm2 save

sleep 2
pm2 describe "$SERVICE_NAME" | grep -q online || {
  pm2 logs "$SERVICE_NAME" --lines 40 --nostream
  die "PM2 app $SERVICE_NAME is not online"
}
log "PM2: $SERVICE_NAME is running on 127.0.0.1:${APP_PORT}"

if ! systemctl is-enabled pm2-root >/dev/null 2>&1 && ! systemctl is-enabled "pm2-$(whoami)" >/dev/null 2>&1; then
  log "Run once to start PM2 on boot (copy the command PM2 prints):"
  pm2 startup systemd -u root --hp /root 2>/dev/null || pm2 startup 2>/dev/null || true
fi

# --- Apache reverse proxy ---
for mod in proxy proxy_http proxy_wstunnel rewrite headers ssl; do
  a2enmod "$mod" 2>/dev/null || true
done

APACHE_CONF_DIR="/etc/apache2/sites-available"
[[ -d "$APACHE_CONF_DIR" ]] || APACHE_CONF_DIR="/etc/httpd/conf.d"
SITE_CONF="${APACHE_CONF_DIR}/${APACHE_SITE}.conf"

cat >"$SITE_CONF" <<EOF
# Socity — ${DOMAIN}
# Managed by ${APP_DIR}/deploy.sh

<VirtualHost *:80>
    ServerName ${DOMAIN}
    ServerAdmin webmaster@${DOMAIN#*.}

    ProxyPreserveHost On
    RequestHeader set X-Forwarded-Proto "http"
    RequestHeader set X-Forwarded-For "%{REMOTE_ADDR}s"

    ProxyPass / http://127.0.0.1:${APP_PORT}/
    ProxyPassReverse / http://127.0.0.1:${APP_PORT}/

    ErrorLog \${APACHE_LOG_DIR}/${APACHE_SITE}-error.log
    CustomLog \${APACHE_LOG_DIR}/${APACHE_SITE}-access.log combined
</VirtualHost>
EOF

if [[ -d /etc/apache2/sites-available ]]; then
  a2ensite "$APACHE_SITE.conf" 2>/dev/null || ln -sf "$SITE_CONF" "/etc/apache2/sites-enabled/${APACHE_SITE}.conf"
  a2dissite 000-default.conf 2>/dev/null || true
fi

"$APACHECTL" configtest
systemctl reload apache2 2>/dev/null || systemctl reload httpd 2>/dev/null || apache2ctl graceful

log "Apache site enabled: $SITE_CONF"
log "HTTP: http://${DOMAIN}/  (point DNS A record to this server)"
log ""
log "HTTPS (recommended after DNS works):"
log "  certbot --apache -d ${DOMAIN}"
log ""
log "Status: pm2 status ${SERVICE_NAME}"
log "Logs:   pm2 logs ${SERVICE_NAME}"
log "Done."
