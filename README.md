# Folio

## Remote citation server

For source control and deployments, use the [Git workflow](REMOTE-SETUP.md#git-workflow). Edit and test on your Mac, push to GitHub, then run `bash deploy/update.sh` in the VPS Git checkout. GitHub Actions runs the tests on pushes and pull requests to `main`.

For temporary access before choosing a domain, see [TUNNEL-SETUP.md](TUNNEL-SETUP.md). It includes a saved SSH connection and loopback-only Docker deployment.

See [REMOTE-SETUP.md](REMOTE-SETUP.md) for the new password-protected Node/SQLite server and Docker Compose deployment. Each account’s citations and reading data are available across its devices; paper links open the original source. Remote mode has invitation-only accounts with private libraries. The owner creates invitations and manages account access. See the [multi-user upgrade guide](REMOTE-SETUP.md#multi-user-upgrade-and-invitations) to preserve an existing library. The static and Windows modes described below still use browser storage.

A personal paper reading and citation app. Buildless HTML, CSS, and JavaScript; no build step or third-party JavaScript packages. Remote mode requires Node 24. The Windows host starts a localhost-only Node.js service for IACR ePrint citation lookup.

## Run locally

```sh
node server/preview.mjs
```

Open http://127.0.0.1:4173. This loopback-only preview serves the browser-storage UI and publisher citation lookup. Accounts and invitations run in the Node/SQLite server (`server/app.mjs`), not this static preview. Use Node 24; opening HTML directly or a plain static server does not provide publisher lookup.

## Windows local-network and VPN hosting

See [WINDOWS-SETUP.md](WINDOWS-SETUP.md) for private HTTPS hosting on a Windows laptop, including an institute network with FortiClient remote access. The `windows/` scripts generate Caddy configuration, start or stop the server, and configure a narrowly scoped firewall rule. Restart the server after signing in following a reboot. This serves the existing browser-storage app; it does not add shared server storage.

## Features

- A dedicated phone layout at viewport widths up to 600 px: bottom navigation, a compact reading overview, collection chips, collapsible filters, and touch-friendly dialogs. Wider screens retain the desktop library.

- Paper URLs, IACR ePrint metadata lookup (including PDF and ia.cr links), arXiv preprint metadata lookup, DOI lookup through Crossref, manual citations, and editable source links.
- Search, collections, read/unread/reading status, three importance levels, notes, grid and list views. The desktop library lists all collection/tag filters with counts and combines tag selection with search, status, and importance filters.
- An unread reading queue with priority-aware and random selection.
- On-demand scholarly discovery through Crossref, excluding saved papers by DOI and title.
- BibTeX, RIS, and plain-text citation export.
- Venue metric fields with source URL and metric year. Metrics without recorded evidence are left empty.
- Local JSON export/import; newer edits take precedence during a merge.

## Storage and limitations

Remote mode stores each account’s citations in SQLite. The static preview stores citations in localStorage for the current origin; clearing browser data can erase that preview library. JSON exports contain citation information, links, tags, and notes. Public scholarly API access depends on network availability and provider limits. Paste an arXiv or IACR ePrint URL, or a DOI in Add paper, click Look up metadata, review the filled details, and save. Arbitrary URLs can still be saved with manual metadata. Publisher HTML lookup requires the Node server/preview API; a static-only host supports DOI lookup and manual citations. ePrint lookup uses the archive’s citation year and venue, even when the page mentions a later conference publication. The app starts with a removable sample cryptography library.

Conference rank and journal impact factor values require a recorded source and year. There is no licensed Journal Citation Reports integration. Recommendations are topic searches derived from important paper tags, rather than a trained recommendation model.

## Validation

```sh
node --check dist/app.js
node tests/data.test.mjs
node tests/metadata.test.mjs
```
# folio

Folio stores citation metadata and links only. PDF uploads, attachments, and Google Drive integration are removed.


Collections can be layered using paths such as `PQC/ML-DSA` and `PQC/ML-KEM`; parent filters include their descendants. Optional [abstract-based automatic tagging](REMOTE-SETUP.md#abstract-based-automatic-collections) reuses or creates collection paths. It requires a server-side OpenAI API key and per-user opt-in. Abstracts are saved as citation metadata; PDF storage remains disabled.

Automatic citation lookup accepts DOI identifiers, doi.org links, arXiv links, and IACR ePrint links. Springer, IEEE Xplore, ACM Digital Library, and TCHES pages can be saved as source links with manual citation details; copy their DOI for automatic lookup. Existing publisher citations and URLs are preserved.

arXiv lookup accepts abstract, HTML, and external PDF links, including versioned and older archive identifiers. It reads citation metadata and the abstract using the [official arXiv API](https://info.arxiv.org/help/api/user-manual.html), even when no DOI is present. No PDF is downloaded or saved. Different versions of the same arXiv paper are treated as one library entry. Uncached arXiv requests are spaced at least three seconds apart; repeat lookups use the metadata cache.

Use **Manage collections → Move** to choose a different parent for an existing collection, or select **Top level** to promote it. Child collections and paper tags move together. A move into an existing collection requires merge confirmation; moving a collection into its own descendants is blocked.

Collection filters support multiple selections on desktop and mobile. **Match any** includes papers in any selected branch; **Match all** requires a match in every selected branch. Search text, reading status, and importance continue to apply. **Clear collections** resets just the collection selection. Filter selections and their match mode are included in the URL; existing single-collection links still work.
