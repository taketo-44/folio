# Folio

A personal paper reading and citation app. Buildless HTML, CSS, and JavaScript; no dependencies or build step.

## Run locally

```sh
cd dist
python3 -m http.server 4173 --bind 127.0.0.1
```

Open http://127.0.0.1:4173. Use an HTTP server rather than opening the HTML directly.

## Features

- Paper URLs, DOI lookup through Crossref, manual citations, and PDF uploads up to 50 MB.
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

The library lives in localStorage and PDFs in IndexedDB for the current origin. Browser data removal can erase local data. JSON exports include metadata and notes only; Drive backups include PDFs. Google authorization requires a configured client ID and has not been verified without one. Public scholarly API access depends on network availability and provider limits. Arbitrary paper URLs are saved with manually entered metadata; DOI lookup is automatic. The app starts with a removable sample cryptography library.

Conference rank and journal impact factor values require a recorded source and year. There is no licensed Journal Citation Reports integration. Recommendations are topic searches derived from important paper tags, rather than a trained recommendation model.

## Validation

```sh
node --check dist/app.js
node tests/data.test.mjs
```
