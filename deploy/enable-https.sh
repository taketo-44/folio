#!/usr/bin/env bash
# Run as ubuntu from an interactive SSH terminal. Existing database volumes are retained.
set -euo pipefail
umask 077
cd "$(dirname "${BASH_SOURCE[0]}")/.."

folio_domain="${1:-folio.take10-44.site}"
if [[ ! "$folio_domain" =~ ^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$ || "$folio_domain" != *.* ]]; then
  printf 'Use a domain name without https://, a port, or a path.\n' >&2
  exit 1
fi
if [[ -L .env ]]; then
  printf 'The environment file must be a regular file, not a symlink.\n' >&2
  exit 1
fi
command -v python3 >/dev/null
command -v docker >/dev/null
printf 'Preparing Folio HTTPS for %s.\n' "$folio_domain"
printf 'Authenticate sudo with your Ubuntu password when prompted.\n'
sudo -v

if [[ -f .env ]]; then
  chmod 600 .env
  cp -p .env ".env.before-https.$(date +%Y%m%d-%H%M%S)"
fi
folio_hash=$(python3 -c 'from pathlib import Path; import re
p=Path(".env"); text=p.read_text() if p.exists() else ""
lines=[line.split("=",1)[1].strip().strip("\"\x27") for line in text.splitlines() if line.startswith("FOLIO_PASSWORD_HASH=")]
value=lines[-1] if lines else ""
print(value if re.fullmatch(r"[a-f0-9]{32}:[a-f0-9]{128}",value) else "")')

if [[ -z "$folio_hash" ]]; then
  printf '\nChoose a separate Folio library password with at least 16 characters.\n'
  read -r -s -p 'New Folio library password: ' folio_password
  printf '\n'
  read -r -s -p 'Confirm Folio library password: ' folio_confirm
  printf '\n'
  if [[ "$folio_password" != "$folio_confirm" || ${#folio_password} -lt 16 || "$folio_password" =~ [[:space:]]$ ]]; then
    unset folio_password folio_confirm
    printf 'Passwords must match, contain at least 16 characters, and have no trailing whitespace. Run the script again.\n' >&2
    exit 1
  fi
  sudo -n docker pull node:24-bookworm-slim
  folio_hash=$(printf '%s' "$folio_password" | sudo -n docker run --rm -i \
    -v "$PWD:/app:ro" -w /app node:24-bookworm-slim node server/password.mjs)
  unset folio_password folio_confirm
  if [[ ! "$folio_hash" =~ ^[a-f0-9]{32}:[a-f0-9]{128}$ ]]; then
    printf 'Password hash generation failed; the app was not started.\n' >&2
    exit 1
  fi
else
  printf 'Keeping the existing Folio library password.\n'
fi

# Pass the hash through stdin, never arguments; preserve unrelated environment settings.
printf '%s' "$folio_hash" | python3 -c 'from pathlib import Path; import os,sys
p=Path(".env"); lines=p.read_text().splitlines() if p.exists() else []
values={"FOLIO_DOMAIN":sys.argv[1],"FOLIO_PASSWORD_HASH":sys.stdin.read()}
lines=[line for line in lines if not any(line.startswith(key+"=") for key in values)]
lines.extend(key+"="+value for key,value in values.items())
temp=Path(".env.https-tmp")
with temp.open("x") as file: file.write("\n".join(lines)+"\n")
os.chmod(temp,0o600);os.replace(temp,p)' "$folio_domain"
unset folio_hash

sudo -n docker compose -p folio -f compose.yaml config --quiet
if [[ -f compose.tunnel.yaml ]]; then
  sudo -n docker compose -p folio -f compose.tunnel.yaml down
fi
printf '\nBuilding and starting Folio and Caddy.\n'
sudo -n docker compose -p folio -f compose.yaml up -d --build
sudo -n docker compose -p folio -f compose.yaml ps

printf '\nWaiting for HTTPS certificate provisioning (up to about two minutes).\n'
for folio_attempt in {1..12}; do
  if curl --silent --fail --head --connect-timeout 3 --max-time 6 "https://$folio_domain/" >/dev/null; then
    printf '\nHTTPS verified. Open https://%s and sign in with your Folio library password.\n' "$folio_domain"
    exit 0
  fi
  sleep 5
done
printf '\nHTTPS is not ready yet. Check DNS and Sakura Web ports 80/443. Recent logs:\n' >&2
sudo -n docker compose -p folio -f compose.yaml logs --tail=30 caddy folio
exit 1
