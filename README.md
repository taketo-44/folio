# Folio

## Remote server + Google Drive

For source control and deployments, use the [Git workflow](REMOTE-SETUP.md#git-workflow). Edit and test on your Mac, push to GitHub, then run `bash deploy/update.sh` in the VPS Git checkout. GitHub Actions runs the tests on pushes and pull requests to `main`.

For temporary access before choosing a domain, see [TUNNEL-SETUP.md](TUNNEL-SETUP.md). It includes a saved SSH connection and loopback-only Docker deployment.

See [REMOTE-SETUP.md](REMOTE-SETUP.md) for the new password-protected Node/SQLite server and Docker Compose deployment. Citations and reading data are shared across devices; optional uploaded PDFs go directly to Google Drive. This is a personal, single-library deployment. The static and Windows modes described below still use browser storage.

A personal paper reading and citation app. Buildless HTML, CSS, and JavaScript; no build step or third-party JavaScript packages. Remote mode requires Node 24. The Windows host starts a localhost-only Node.js service for TCHES citation lookup.

## Run locally

```sh
node server/preview.mjs
```

Open http://127.0.0.1:4173. This loopback-only preview serves the UI and publisher citation lookup. Use Node 24; opening HTML directly or a plain static server does not provide publisher lookup.

## Windows local-network and VPN hosting

See [WINDOWS-SETUP.md](WINDOWS-SETUP.md) for private HTTPS hosting on a Windows laptop, including an institute network with FortiClient remote access. The `windows/` scripts generate Caddy configuration, start or stop the server, and configure a narrowly scoped firewall rule. Restart the server after signing in following a reboot. This serves the existing browser-storage app; it does not add shared server storage.

## Features

- A dedicated phone layout at viewport widths up to 600 px: bottom navigation, a compact reading overview, collection chips, collapsible filters, and touch-friendly dialogs. Wider screens retain the desktop library.

- Paper URLs, IACR ePrint metadata lookup (including PDF and ia.cr links), Springer chapter and DOI lookup through Crossref, TCHES article metadata lookup, manual citations, and PDF uploads up to 50 MB.
- Search, collections, read/unread/reading status, three importance levels, notes, grid and list views. The desktop library lists all collection/tag filters with counts and combines tag selection with search, status, and importance filters.
- An unread reading queue with priority-aware and random selection.
- On-demand scholarly discovery through Crossref, excluding saved papers by DOI and title.
- BibTeX, RIS, and plain-text citation export.
- Venue metric fields with source URL and metric year. Metrics without recorded evidence are left empty.
- Google Drive authorization with the limited `drive.file` scope, resumable PDF uploads, JSON backup, and merge restore.
- Local JSON export/import; newer edits take precedence during a merge.

## Google Drive

Create a Google Cloud project, enable the Drive API, configure OAuth consent, and create a Web application OAuth client. Set the deployed app origin (or http://127.0.0.1:4173 for development) as an Authorized JavaScript origin. Paste the public client ID into Settings. No client secret is required or stored. Add your account as a test user if the Google app is in testing mode.

Connection, backup, and restore are explicit user actions. Tokens stay in memory and expire. A `Folio Library` folder contains `library.json` and PDF files named by paper ID. Restore preserves newer local edits and downloads PDFs lazily on opening. Backup writes the current local library snapshot; simultaneous editing from multiple devices should be coordinated with restore before backup.

## Storage and limitations

The library lives in localStorage and PDFs in IndexedDB for the current origin. Browser data removal can erase local data. JSON exports include metadata and notes only; Drive backups include PDFs. Google authorization requires a configured client ID and has not been verified without one. Public scholarly API access depends on network availability and provider limits. Paste an IACR ePrint URL, Springer chapter URL, TCHES article URL, or DOI in Add paper, click Look up metadata, review the filled details, and save. Arbitrary URLs can still be saved with manual metadata. Publisher HTML lookup requires the Node server/preview API; a static-only host supports Springer/DOI lookup and manual citations. ePrint lookup uses the archive’s citation year and venue, even when the page mentions a later conference publication. The app starts with a removable sample cryptography library.

Conference rank and journal impact factor values require a recorded source and year. There is no licensed Journal Citation Reports integration. Recommendations are topic searches derived from important paper tags, rather than a trained recommendation model.

## Validation

```sh
node --check dist/app.js
node tests/data.test.mjs
node tests/metadata.test.mjs
```
# folio
