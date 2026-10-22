# Local security review — 2026-10-22

The review used code inspection and controlled HTTP attacks against loopback-only instances with disposable SQLite databases. No production server, real account, private library, or live AI provider was attacked. Severity below is a local assessment, not a formal CVSS rating.

## Findings and fixes

| Finding | Impact and reproduction | Fix |
| --- | --- | --- |
| Session revocation race — high | A library PUT authorized before its body finished uploading still returned 200 after logout. The same authorization pattern affected password changes and account administration, allowing an already-open request to survive recovery or account disabling. | Recheck the session, expiry and enabled account after reading protected request bodies, immediately before protected work. Tests cover logout, password recovery, disabled members, revoked administrators and classification uploads. The reproduced write now returns 401 without changing the library. |
| Global login lock — medium | Keeping one unauthenticated login body incomplete caused another valid login to return 429. | Removed the global lock around body reads. The same concurrent login now returns 200. Request body sizes and HTTP timeouts still apply. |
| Password-guessing limit bypass / shared proxy bucket — medium | Alternating wrong owner passwords with valid member logins permitted more than the configured ten guesses. In the original code, every user behind Caddy also shared one connection-address bucket. | Track independent account and client-IP counters. Successful login to one account does not clear another account's counter. Caddy supplies the real connecting client in an overwritten dedicated header; public forwarding headers remain untrusted by default. |
| Malformed URL crashes local preview — medium for local availability | An HTTP request with an invalid absolute URL terminated the preview process. | Catch URL parsing failures and return 400. A regression test confirms the next normal request still returns 200. |

## Additional hardening

- Hosted and preview pages receive a Content Security Policy restricting scripts to this app, disallowing inline scripts, framing, objects and base-URL changes. Crossref remains available for citation lookup; inline CSS remains permitted for the existing UI.
- HTTPS responses advertise HSTS. Loopback HTTP development remains supported.
- Active sessions are capped at 20 per account; additional sign-ins expire the oldest sessions.
- Malformed JSON shapes return 400. Login throttling storage is bounded.
- Added malicious citation rendering tests for HTML escaping and unsafe URL schemes.

## Validation

Run `npm test` with Node 24. The suite includes the new `tests/security.test.mjs` and `tests/preview-security.test.mjs`, as well as the existing authentication, account isolation, CSRF, metadata lookup, persistence and UI tests.

The tests confirm rejection of cross-account access attempts, forged sessions, cross-origin writes, invalid CSRF tokens, executable URL schemes and requests for private files. Publisher lookups retain fixed upstream hosts, validated identifiers, response bounds and disabled redirects. AI classification tests use an injected transport and do not make paid provider requests.

These results do not prove the absence of all vulnerabilities. The production host, network, TLS termination, container images and browser execution of the CSP were not penetration-tested. Docker and Caddy executables were unavailable locally, so the deployment configuration changes were reviewed but not run in containers.

## Deployment

Commit and push the patch, then deploy from the VPS checkout:

```sh
cd ~/folio-git
bash deploy/update.sh
```

Deploy `server/`, `compose.yaml` and `deploy/Caddyfile` together. The normal Compose deployment sets `TRUST_FOLIO_PROXY=1`; Caddy overwrites `X-Folio-Client-IP` with `{remote_host}`, and the app port remains unpublished. Only enable that setting when all app traffic arrives through that private trusted proxy. Direct and SSH-tunnel deployments leave it disabled. If another proxy is placed in front of Caddy, review the trusted-client-address configuration for that deployment.

After deployment, check sign-in, a citation lookup and a normal save. Existing libraries and account passwords are preserved; no database migration is required. Refresh open browser tabs. The local changes do not protect a remote deployment until it is updated.

## References

- [OWASP authentication guidance](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html) explains account-based throttling and authentication controls.
- [OWASP session management guidance](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html) covers revocation and session lifecycle.
- [Caddy reverse proxy documentation](https://caddyserver.com/docs/caddyfile/directives/reverse_proxy) documents request-header overrides and forwarding-header trust.
