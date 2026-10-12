# Remote hosting

Folio now includes a personal server mode: one password-protected library, accessible from any device over HTTPS. Citation metadata, notes, tags, reading flags, importance, venue metrics, settings, and Google Drive PDF file IDs persist in SQLite. PDFs upload directly from the browser to Google Drive. The server never receives their contents. Google Drive is optional for citations, and required for PDF uploads in this mode.

This is a single-owner app, not a service with separate accounts for multiple people. Anyone given the library password can access and edit the same library. Use the same Google account and OAuth client on each device to open its PDFs. Refresh the library to see changes from other devices. Saves use revision checks so a stale tab cannot overwrite a newer edit; a conflict loads the latest library and asks you to review and retry.

## VPS preparation

Use an Ubuntu VPS in Tokyo, with at least 1 GB RAM. You need an SSH account and a domain/subdomain you control. A Sakura VPS or AWS Lightsail instance can run this deployment. No VPS has been purchased or configured by this code change.

1. Install Docker Engine and the Compose plugin using [Docker's Ubuntu instructions](https://docs.docker.com/engine/install/ubuntu/).
2. Point your domain's DNS A record to the VPS public IPv4 address. Add an AAAA record only if IPv6 is configured and working.
3. Permit TCP 80 and 443 in the provider firewall; restrict SSH to your own address or VPN. Do not expose port 3000 or database files.
4. Copy the `folio` directory to your VPS, without `.env`, local databases, or `.git` credentials. Run the following commands from that directory.

## Password and HTTPS

For an interactive setup on your VPS, run `bash deploy/enable-https.sh YOUR-DOMAIN` from `~/folio` after DNS and ports 80/443 are ready. It asks for your Ubuntu sudo password and, if needed, a new Folio library password. It preserves unrelated environment settings, backs up `.env` privately, keeps existing database volumes, starts the domain deployment, and checks HTTPS. The script workflow was tested with mocked Docker; live Docker and certificate provisioning are verified on your VPS. The following manual steps are an alternative.

```sh
cp .env.example .env
chmod 600 .env
```

Generate a password hash with a password of at least 16 characters. In **Bash**, this reads a hidden password without putting it in shell history or command arguments:

```bash
read -r -s -p 'Library password: ' folio_password
printf '\n'
printf '%s' "$folio_password" | docker run --rm -i -v "$PWD:/app:ro" -w /app node:24-bookworm-slim node server/password.mjs
unset folio_password
```

Copy the resulting `salt:hash` into `FOLIO_PASSWORD_HASH` in `.env` and set `FOLIO_DOMAIN` to your real domain, for example `papers.your-domain.com`. Do not include `https://` or a path in the domain field. No default password is provided.

```sh
docker compose up -d --build
docker compose logs --tail=50
```

Visit `https://YOUR-DOMAIN`, sign in, and add a citation. Open the same address on another device and sign in to confirm it appears. Caddy obtains and renews the HTTPS certificate automatically once DNS and ports are ready. See [Caddy's HTTPS prerequisites](https://caddyserver.com/docs/automatic-https).

The app has no Node package dependencies. It uses Node 24's built-in SQLite support. The Compose volume `folio_data` persists across container restarts and rebuilds. Never run `docker compose down -v` unless you intend to delete the database and HTTPS certificate volumes.

## Google Drive setup in Settings

1. Create a Google Cloud project and enable the Google Drive API.
2. Configure the OAuth consent screen; add your Google account as a test user if the app is in testing mode.
3. Create a Web application OAuth client. Set the exact HTTPS app origin, such as `https://papers.your-domain.com`, as an Authorized JavaScript origin.
4. Paste the **public client ID** in Folio Settings and connect Google Drive. No client secret or redirect URI is needed for this browser token flow.
5. Upload a PDF through Add paper, or use Attach PDF on an existing paper. Only a successful Drive upload followed by a successful server save is reported as completed.

The browser requests the limited [`drive.file` scope](https://developers.google.com/workspace/drive/api/guides/api-specific-auth), not access to every file in your Drive. Tokens remain in browser memory, following [Google's token model](https://developers.google.com/identity/oauth2/web/guides/use-token-model); reconnect after expiration or a page reload to open or upload PDFs. Server login lasts up to seven days and is independent of Google authorization. Signing out clears the browser's Drive token.

Citation-only use works without connecting Drive. Folio does not automatically download PDFs from paper URLs. Upload PDFs you want stored in Drive. Deleting a citation keeps its Drive PDF. Replacing an attachment also keeps the old PDF. If Drive upload succeeds but the server save fails, the uploaded file remains in the Folio Library folder; retry attachment after resolving the save error and remove any duplicate manually in Drive.

## Migration and backups

Export library JSON from your previous browser-based Folio, then import it in the remote app's Settings. Sample papers are not seeded on the server. Local IndexedDB PDFs are not in JSON; download them from the original app and attach them to the corresponding server citations. Existing Drive references work when you connect the same account and OAuth client that created those files.

Use Settings → Export library JSON for a portable citation backup. Store backups outside the VPS. PDFs remain in Google Drive and use that account's storage quota. For a full SQLite backup, stop the Folio container while copying the volume, then restart it:

```sh
mkdir -p backups
chmod 700 backups
docker compose stop folio
docker compose run --rm --no-deps -v "$PWD/backups:/backup" folio node -e "require('node:fs').copyFileSync('/data/folio.sqlite','/backup/folio.sqlite')"
docker compose start folio
```

The `backups` directory must be writable by container UID 1000; if your SSH user has another UID, configure that directory's ownership before running the backup command. Restrict the copied database to your account and keep an encrypted off-server copy. The database includes library settings and active session records; treat it as private. To restore, stop Folio, copy the backed-up SQLite file into its data volume, remove stale `folio.sqlite-wal` and `folio.sqlite-shm` files while stopped, and start it again. Keep the same OAuth client for Drive file access. Changing the password should also revoke sessions: with Folio stopped, run a one-off container to delete all rows from the `sessions` table before restarting.

To update code, copy the updated source and run `docker compose up -d --build`. Keep `.env` and the persistent volume. VPS rental, domain registration, and any additional Google Drive storage are billed by their providers; nothing here activates a paid service.

## Local server development

Install Node 24, generate a hash with `node server/password.mjs` using stdin, and put these in an ignored `.env.local` file:

```dotenv
APP_ORIGIN=http://127.0.0.1:3000
ALLOW_LOCAL_HTTP=1
FOLIO_PASSWORD_HASH=YOUR_GENERATED_HASH
```

Run `node --env-file=.env.local server/app.mjs` and open `http://127.0.0.1:3000`. SQLite defaults to `.runtime/folio.sqlite`. Local HTTP is accepted only for loopback development. Remote deployment requires HTTPS. The older static and Windows preview paths still use browser storage; use this Node server and Compose deployment for shared server storage.

## Validation

```sh
npm test
```

Tests cover login, session cookies, origin/CSRF checks, durable storage across restarts, stale-save rejection, API input validation, private file routing, browser server-mode behavior, and mock Drive upload/read flows. The local test suite and Caddy configuration were verified. Docker is unavailable in the development workspace, so the container build has not been run here. Live Google OAuth and an actual VPS deployment require your own configuration and must be verified after setup.

## Git workflow

The current Mac checkout is `/Users/taketo-44/Dev/asita/folio`, with `origin` pointing to `https://github.com/taketo-44/folio.git` and branch `main`. GitHub holds the source; the VPS runs a checkout of that source. Source edits happen on the Mac. The VPS only pulls and deploys.

Commit HTML/CSS/JavaScript, server code, tests, Docker/Compose files, deployment scripts, and documentation. `.gitignore` excludes environment files (including `.env` backups), databases, PDFs, SSH/private-key files, and generated archives. `.env.example` stays tracked as a template. Google Drive PDFs and citation database backups are separate from Git. Ignore rules do not remove files that were previously committed; the tracked-file check performed during setup found no runtime secret/database/PDF files.

### Mac: initial commit and normal updates

Use Node.js 24 on your Mac. `.nvmrc` records this version; if you use nvm, run `nvm use`. Otherwise install Node 24 from [Node.js](https://nodejs.org/en/download). Then:

```sh
cd /Users/taketo-44/Dev/asita/folio
npm test
git status --short
git add .
git diff --cached --stat
git commit -m "Add server storage, responsive UI, ePrint lookup and Git deployment"
git push origin main
```

Review the staged files before committing. The initial command includes the app changes prepared in this session as well as the new Git workflow. For later changes use a message that describes that change. `npm run preview` opens the local Node preview at `http://127.0.0.1:4173`; keep your already-running preview instead of starting a second one on the same port.

For larger changes, create a branch with `git switch -c feature/NAME`, push it with `git push -u origin HEAD`, and open a pull request. Merge after the tests pass, then return the Mac checkout to `main` with `git switch main` and `git pull --ff-only origin main`.

### GitHub: repository and checks

Use the existing `taketo-44/folio` repository. The workflow `.github/workflows/test.yml` runs `npm test` using Node 24 for pushes and pull requests to `main`. Check the Actions tab before deploying. There are no VPS passwords or deployment credentials in the workflow; deployment remains an explicit command on the server.

Give the VPS a **read-only deploy key** for this repository, following [GitHub's deploy-key instructions](https://docs.github.com/en/authentication/connecting-to-github-with-ssh/managing-deploy-keys). This is separate from the Mac's SSH key used to log into Sakura.

### VPS: one-time Git setup

In your VPS SSH terminal, create a dedicated key:

```sh
ssh-keygen -t ed25519 -f ~/.ssh/folio_github -C "folio-vps-github"
cat ~/.ssh/folio_github.pub
```

Choose a passphrase if you want one; Git will ask for it when using this key. Copy the **public** key into GitHub → `taketo-44/folio` → Settings → Deploy keys → Add deploy key. Use the title `Sakura Folio VPS`; leave **Allow write access** unchecked. Keep the private key on the VPS.

Edit the **VPS's** `~/.ssh/config` (preserve its existing entries) and add:

```sshconfig
Host github-folio
    HostName github.com
    User git
    IdentityFile ~/.ssh/folio_github
    IdentitiesOnly yes
```

```sh
chmod 600 ~/.ssh/config ~/.ssh/folio_github
ssh -T github-folio
```

On the first connection, verify the displayed host fingerprint against [GitHub's official fingerprints](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/githubs-ssh-key-fingerprints). GitHub's successful test says you authenticated but that it does not provide shell access; it exits with code 1 even on success.

After pushing the prepared code from your Mac, clone into a **new directory**, leaving the current unpacked deployment in place:

```sh
git clone git@github-folio:taketo-44/folio.git ~/folio-git
cp -p ~/folio/.env ~/folio-git/.env
chmod 600 ~/folio-git/.env
cd ~/folio-git
bash deploy/update.sh
```

Both old and new deployment commands use Compose project `folio`, so the existing `folio_folio_data` volume is retained. Do not use the new directory name as the Compose project name. Existing citation data, sessions, and settings remain in SQLite; PDF files remain in Google Drive. Keep `~/folio` until you have verified the Git deployment works.

### VPS: each subsequent deployment

After pushing or merging on the Mac and checking GitHub Actions:

```sh
cd ~/folio-git
bash deploy/update.sh
```

The script requires a clean checkout on `main`, pulls with `--ff-only`, validates Compose, and rebuilds/restarts the app with the same database volume. It asks for your Ubuntu sudo password. Edit server configuration only in the ignored `.env`. If the script reports source changes on the VPS, preserve and review them rather than forcing a reset or deleting files.

After deployment, refresh `https://folio.take10-44.site` and check a citation and its PDF. Git tracks source versions; continue backing up SQLite separately. To undo a faulty source change, revert it on the Mac, push the revert, and deploy that new commit through the same workflow.
