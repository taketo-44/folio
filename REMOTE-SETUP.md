# Remote hosting

Folio includes an invitation-only multi-user server, accessible from any device over HTTPS. Each account has a private library. Citation metadata, paper links, notes, tags, reading flags, importance, venue metrics, and collection settings persist in SQLite. Folio opens papers at their saved source links.

The owner creates reusable invitations and can disable member accounts. Each user signs in with their own username and password. Refresh to see changes made on another device. Saves use per-user revision checks so a stale tab cannot overwrite a newer edit; a conflict loads only that account’s latest library for review. For existing deployments, follow the [multi-user upgrade guide](#multi-user-upgrade-and-invitations) before deploying.

## VPS preparation

Use an Ubuntu VPS with at least 1 GB RAM. Your existing Sakura Ishikari VPS can run this deployment. You need an SSH account and a domain/subdomain you control. A Sakura VPS or AWS Lightsail instance can run this deployment. No VPS has been purchased or configured by this code change.

1. Install Docker Engine and the Compose plugin using [Docker's Ubuntu instructions](https://docs.docker.com/engine/install/ubuntu/).
2. Point your domain's DNS A record to the VPS public IPv4 address. Add an AAAA record only if IPv6 is configured and working.
3. Permit TCP 80 and 443 in the provider firewall; restrict SSH to your own address or VPN. Do not expose port 3000 or database files.
4. Copy the `folio` directory to your VPS, without `.env`, local databases, or `.git` credentials. Run the following commands from that directory.

## Password and HTTPS

For an interactive setup on your VPS, run `bash deploy/enable-https.sh YOUR-DOMAIN` from `~/folio` after DNS and ports 80/443 are ready. It asks for your Ubuntu sudo password and, if needed, a new Folio library password. It preserves unrelated environment settings, backs up `.env` privately, keeps existing database volumes, starts the domain deployment, and checks HTTPS. The script workflow was tested with mocked Docker; verify live Docker and certificate provisioning on your VPS. The following manual steps are an alternative.

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

Copy the resulting `salt:hash` into `FOLIO_PASSWORD_HASH` in `.env` and set `FOLIO_DOMAIN` to your real domain, for example `papers.your-domain.com`. Do not include `https://` or a path in the domain field. No default password is provided. On first startup, the owner username is `owner` (or `FOLIO_OWNER_USERNAME` if set). Sign in with that username and the password you hashed.

```sh
docker compose up -d --build
docker compose logs --tail=50
```

Visit `https://YOUR-DOMAIN`, sign in, and add a citation. Open the same address on another device and sign in to confirm it appears. Caddy obtains and renews the HTTPS certificate automatically once DNS and ports are ready. See [Caddy's HTTPS prerequisites](https://caddyserver.com/docs/automatic-https).

The app has no Node package dependencies. It uses Node 24's built-in SQLite support. The Compose volume `folio_data` persists across container restarts and rebuilds. Never run `docker compose down -v` unless you intend to delete the database and HTTPS certificate volumes.

## Migration and backups

Export library JSON from your previous browser-based Folio, then import it in the remote app's Settings. Sample papers are not seeded on the server. Imports retain citation data and paper URLs and discard retired attachment fields.

Use Settings → Export library JSON for a portable citation backup. Store backups outside the VPS. For a full SQLite backup, stop the Folio container while copying the volume, then restart it:

```sh
mkdir -p backups
chmod 700 backups
docker compose stop folio
docker compose run --rm --no-deps -v "$PWD/backups:/backup" folio node -e "require('node:fs').copyFileSync('/data/folio.sqlite','/backup/folio.sqlite')"
docker compose start folio
```

The `backups` directory must be writable by container UID 1000; if your SSH user has another UID, configure that directory's ownership before running the backup command. Restrict the copied database to your account and keep an encrypted off-server copy. The database includes library settings and active session records; treat it as private. To restore, stop Folio, copy the backed-up SQLite file into its data volume, remove stale `folio.sqlite-wal` and `folio.sqlite-shm` files while stopped, and start it again. Changing a password through Settings or the recovery command automatically revokes that account’s sessions. In multi-user mode, active sessions are stored in `user_sessions`; the legacy `sessions` table is unused.

To update code, copy the updated source and run `docker compose up -d --build`. Keep `.env` and the persistent volume. VPS rental, domain registration are billed by their providers; nothing here activates a paid service.

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

Tests cover login, session cookies, origin/CSRF checks, durable storage across restarts, stale-save rejection, API input validation, private file routing, browser server-mode behavior, invitation-only accounts, cross-account isolation, and citation-only imports. The local test suite and Caddy configuration were verified. Docker is unavailable in the development workspace, so the container build has not been run here. An actual VPS deployment must be verified after setup.

## Git workflow

The current Mac checkout is `/Users/taketo-44/Dev/asita/folio`, with `origin` pointing to `https://github.com/taketo-44/folio.git` and branch `main`. GitHub holds the source; the VPS runs a checkout of that source. Source edits happen on the Mac. The VPS only pulls and deploys.

Commit HTML/CSS/JavaScript, server code, tests, Docker/Compose files, deployment scripts, and documentation. `.gitignore` excludes environment files (including `.env` backups), databases, PDFs, SSH/private-key files, and generated archives. `.env.example` stays tracked as a template. Citation database backups are separate from Git. Ignore rules do not remove files that were previously committed; the tracked-file check performed during setup found no runtime secret/database/PDF files.

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

Both old and new deployment commands use Compose project `folio`, so the existing `folio_folio_data` volume is retained. Do not use the new directory name as the Compose project name. Existing citation data, sessions, and settings remain in SQLite. Keep `~/folio` until you have verified the Git deployment works.

### VPS: each subsequent deployment

After pushing or merging on the Mac and checking GitHub Actions:

```sh
cd ~/folio-git
bash deploy/update.sh
```

The script requires a clean checkout on `main`, pulls with `--ff-only`, validates Compose, and rebuilds/restarts the app with the same database volume. It asks for your Ubuntu sudo password. Edit server configuration only in the ignored `.env`. If the script reports source changes on the VPS, preserve and review them rather than forcing a reset or deleting files.

After deployment, refresh `https://folio.take10-44.site` and check a citation and its source link. Git tracks source versions; continue backing up SQLite separately. To undo a faulty source change, revert it on the Mac, push the revert, and deploy that new commit through the same workflow.

## Multi-user upgrade and invitations

Folio now has separate accounts. Each account owns its citations, collections, notes, reading flags, revisions, and collection settings. New accounts are invitation-only. There is no shared-library feature or public sign-up.

The first startup of this version migrates your current library to an owner account. Its default username is **owner**, and its password is your existing Folio library password. Optionally set `FOLIO_OWNER_USERNAME` in `.env` **before the first multi-user startup**. Usernames have 3–40 letters, numbers, dots, underscores, or hyphens and are case insensitive. Existing sessions are cleared during migration. Papers, notes, source links and collections are retained. Retired PDF references and Google settings are removed, and the library revision increases if those fields existed.

On your Mac, run `npm test`, commit the changes, and push `main`. Before deploying them, make a database backup in the **VPS terminal**:

```bash
cd ~/folio-git
mkdir -p backups
chmod 700 backups
sudo docker compose -p folio -f compose.yaml stop folio
folio_backup_name="folio-before-multiuser-$(date +%Y%m%d-%H%M%S).tar.gz"
sudo docker run --rm --user 0:0 \
  -v folio_folio_data:/data:ro \
  -v "$PWD/backups:/backup" \
  node:24-bookworm-slim tar -czf "/backup/$folio_backup_name" -C /data .
```

Verify the backup command succeeded. If it fails, restart the existing app with `sudo docker compose -p folio -f compose.yaml start folio` and resolve the backup problem before upgrading. Backups contain every user's private data; keep them outside Git and copy them to a separate secure location.

Then deploy:

```bash
bash deploy/update.sh
```

Open `https://folio.take10-44.site`, refresh, and sign in as **owner** with your existing password. Check that your library is intact. In **Settings → Your account → Manage users & invitations**, create an invitation and copy its link. Share that link privately with the intended people. Folio does not send messages or emails. Each invitation can create multiple member accounts until it expires after seven days or is revoked. Active invitations can be revoked; the link is shown only when created. If you lose it, revoke that invitation and create another.

Invitees choose a username and a password of at least 16 characters. They start with an empty citation library and can save paper URLs, tags, notes, and reading flags. No Google account or OAuth setup is needed.

The owner can disable and re-enable member accounts. Disabling revokes their sessions immediately but keeps their library. The owner cannot disable the owner account. Account management does not provide access to members' libraries. Each user can change their password in Settings, which signs out their other sessions. After migration, `FOLIO_PASSWORD_HASH` is only a bootstrap setting; changing it does not overwrite account passwords in the database.

### Forgotten password recovery

There is no email password reset. A server administrator can reset a user's password in the **VPS Bash terminal**. Replace `owner` with the account username when needed. Passwords are read silently and passed through stdin:

```bash
cd ~/folio-git
sudo -v
read -r -s -p "New account password (at least 16 characters): " folio_new_password
printf '\n'
printf '%s\n' "$folio_new_password" | sudo -n docker compose -p folio -f compose.yaml exec -T folio node server/reset-password.mjs owner
unset folio_new_password
```

This preserves the library and revokes all of that account's sessions. It does not re-enable a disabled account. Do not put a password directly in a command, Git, `.env`, or a message.

### Rolling back

The upgrade keeps a legacy snapshot in SQLite for diagnosis, but the old server does not understand separate accounts. Do not deploy an older server against the migrated database. To roll back, stop Folio, restore the entire pre-upgrade data backup into `folio_folio_data`, and deploy the matching pre-upgrade code before starting Folio. Changes and new accounts created after the backup will not be present in that restored database. Keep the migrated database backed up separately before any rollback.

## Citation-only storage

PDF uploads, attachments, the built-in reader, and Google Drive integration have been removed. Citations retain their DOI, original source URL, tags, notes, flags, and venue metadata. Open paper follows the saved source link. PDF URLs remain valid external links; Folio does not download or save their contents.

Database schema version 3 removes retired PDF-reference fields and Google settings from active libraries without changing account ownership. If an active library had those fields, its revision increases once so stale tabs cannot restore them. Existing Google Drive files and old browser IndexedDB files are not deleted; they are simply no longer accessed by Folio. There is no automatic conversion of a Drive file ID into a public paper URL. If a citation has no source URL, add one when editing the paper. Old JSON backups can still be imported; their attachment fields are ignored.

## Abstract-based automatic collections

Collections support paths such as `PQC/ML-DSA` and `PQC/ML-KEM`. The library shows their parent/child structure. Selecting `PQC` includes both branches. Renaming or removing a parent affects its entire branch; removing tags keeps citation records. Hyphens stay part of a name: use `/` between levels.

Automatic tagging is optional and disabled by default for each user. It runs in the signed-in Node server, not the browser-storage preview. Add these optional values to the **VPS** `.env` with `nano .env`:

```dotenv
OPENAI_API_KEY=YOUR_OPENAI_API_KEY
OPENAI_MODEL=gpt-4.1-mini
AI_DAILY_LIMIT=100
AI_USER_DAILY_LIMIT=20
```

Keep `.env` private (`chmod 600 .env`) and outside Git. Enter the real key in the server terminal, not in chat or a source file. After committing and pushing the app changes, deploy with `bash deploy/update.sh` in `~/folio-git`. Compose supplies the key only to the backend. No API key is stored in users' libraries, JSON exports, or browser storage. The default model can be changed by the server owner to a compatible Responses API model that supports structured output.

In **Settings → Automatic collections**, enable **Automatically tag new papers from their abstracts**. Keep **Create collections when no existing collection fits** selected to allow new paths, or clear it to use existing collections only. Optional classification preferences can describe your taxonomy, for example: “Use PQC as the parent; ML-DSA and ML-KEM are children.” Save these settings.

Add a paper normally. Metadata lookup fills the abstract when supplied by the publisher or Crossref. Otherwise, paste the abstract in the new field. On saving, the classifier selects up to three tags, reuses existing paths where appropriate, creates missing collections, and preserves manually entered tags. Selecting **Suggest collections from abstract** lets you inspect or edit suggestions before saving. Saving an unchanged preview does not issue a second classification request. For an existing paper, open its details, add an abstract if necessary, select the suggestion button, then save changes. Discovery imports also use automatic classification when the result contains an abstract.

Only the title, abstract, collection names, and classification preferences for the signed-in account are sent to OpenAI. Other users' libraries, reading notes, passwords, and keys are not part of the classifier input. The backend uses the [Responses API with structured output](https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses) and requests `store: false`. API usage is billed to the OpenAI project that owns the server key, separately from ChatGPT. No real API request was used for the automated tests; they use an injected transport.

The defaults allow 20 classification attempts per user per UTC day and 100 across the server. Counters persist across restarts. Failed provider attempts count toward the limit; rejected inputs and missing abstracts do not. The server permits at most two concurrent classifications and one per account. These are request-count limits, not a guaranteed monetary spending cap. Configure project billing controls separately if needed.

A missing abstract, unavailable key, provider error, or daily limit does not prevent adding a citation: it saves with your manual tags and reports that automatic tagging was skipped or unavailable. You can retry from the paper details. Classification suggestions are editable, and no existing papers are reclassified automatically in bulk.
