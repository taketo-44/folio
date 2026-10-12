# Temporary access without a domain

Use the VPS public IP for SSH and an SSH tunnel for browser access. The browser opens `http://127.0.0.1:3000` on your Mac; SSH encrypts the connection between your Mac and the VPS. The app's port is bound only to the VPS loopback interface. Keep Sakura's SSH rule enabled; this mode does not require public Web ports.

## Mac SSH configuration

Edit `~/.ssh/config`, preserving existing entries. Add the contents of [deploy/ssh-config.example](deploy/ssh-config.example) near the top, replacing `YOUR_SERVER_IP`. Run `chmod 600 ~/.ssh/config`.

`ssh folio` opens an administrative shell. `ssh -N folio-web` opens the browser tunnel. Keep the latter terminal open while using Folio at **http://127.0.0.1:3000**. Stop it with Control+C. A second tunnel cannot use the same local port while the first is running. On another device, configure its own SSH connection and local forwarding before opening its loopback app address.

## Server deployment

Put `compose.tunnel.yaml` alongside the existing Folio files in `~/folio`. If you have not created a library password hash yet, run in the server's Bash shell:

```bash
cd ~/folio
sudo -v
read -r -s -p 'Choose a Folio library password (at least 16 characters): ' folio_password
printf '\n'
printf '%s' "$folio_password" | sudo -n docker run --rm -i -v "$PWD:/app:ro" -w /app node:24-bookworm-slim node server/password.mjs
unset folio_password
```

Copy the printed `salt:hash` into `.env`, using an editor:

```dotenv
FOLIO_PASSWORD_HASH=YOUR_GENERATED_HASH
```

Preserve any existing environment settings. This is Folio's library password, independent of your Ubuntu password and SSH key passphrase. Then:

```sh
chmod 600 .env
sudo docker compose -p folio -f compose.tunnel.yaml up -d --build
sudo docker compose -p folio -f compose.tunnel.yaml ps
```

Open the tunnel on your Mac, visit the loopback app URL, and sign in. Confirm a saved citation persists after refreshing and after restarting the container. This configuration does not publish port 3000 to the internet. Do not open port 3000 in Sakura's packet filter.

For Google Drive, configure your OAuth client's Authorized JavaScript origin as `http://127.0.0.1:3000`. Google permits HTTP and loopback IPs for localhost development origins; arbitrary public IPs are not permitted. See [Google's origin validation rules](https://developers.google.com/identity/protocols/oauth2/javascript-implicit-flow). Connect Drive through Folio Settings as usual. Database and PDF behavior are the same as the domain deployment.

## Switch to domain hosting later

Set a real `FOLIO_DOMAIN` in `.env` and configure DNS and public Web ports as described in [REMOTE-SETUP.md](REMOTE-SETUP.md). Stop the tunnel deployment without removing its volume, then start the domain deployment with the **same project name**:

```sh
sudo docker compose -p folio -f compose.tunnel.yaml down
sudo docker compose -p folio -f compose.yaml up -d --build
```

Both use `folio_data` under project `folio`, so the SQLite library is retained. Add the new HTTPS origin to the same Google OAuth client to retain access to that app's Drive files. This temporary Compose file has not been run in Docker in the development workspace, where Docker is unavailable; the underlying loopback HTTP server has passed integration tests.
