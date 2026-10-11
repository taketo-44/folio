# Folio

A personal paper reading and citation app. Buildless HTML, CSS, and JavaScript; no build step or third-party JavaScript packages. The Windows host starts a localhost-only Node.js service for TCHES citation lookup.

## Run locally

```sh
cd dist
python3 -m http.server 4173 --bind 127.0.0.1
```

Open http://127.0.0.1:4173. Use an HTTP server rather than opening the HTML directly.

## Windows local-network and VPN hosting

See [WINDOWS-SETUP.md](WINDOWS-SETUP.md) for private HTTPS hosting on a Windows laptop, including an institute network with FortiClient remote access. The `windows/` scripts generate Caddy configuration, start or stop the server, and configure a narrowly scoped firewall rule. Restart the server after signing in following a reboot. This serves the existing browser-storage app; it does not add shared server storage.

## Features

- Paper URLs, Springer chapter and DOI lookup through Crossref, TCHES article metadata lookup, manual citations, and PDF uploads up to 50 MB.
- Search, collections, read/unread/reading status, three importance levels, notes, grid and list views.
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

The library lives in localStorage and PDFs in IndexedDB for the current origin. Browser data removal can erase local data. JSON exports include metadata and notes only; Drive backups include PDFs. Google authorization requires a configured client ID and has not been verified without one. Public scholarly API access depends on network availability and provider limits. Paste a Springer chapter URL, TCHES article URL, or DOI in Add paper, click Look up metadata, review the filled details, and save. Arbitrary URLs can still be saved with manual metadata. TCHES lookup requires the metadata service included in Windows hosting; a static-only host supports Springer/DOI lookup and manual TCHES entry. The app starts with a removable sample cryptography library.

Conference rank and journal impact factor values require a recorded source and year. There is no licensed Journal Citation Reports integration. Recommendations are topic searches derived from important paper tags, rather than a trained recommendation model.

## Validation

```sh
node --check dist/app.js
node tests/data.test.mjs
node tests/metadata.test.mjs
```
# folio
