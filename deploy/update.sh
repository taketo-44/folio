#!/usr/bin/env bash
# VPS only: pull main and rebuild the existing Folio deployment.
set -euo pipefail

main() {
  cd "$(dirname "${BASH_SOURCE[0]}")/.."
  if [[ ! -d .git ]]; then
    printf 'This folder is not a Git checkout. Follow the Git deployment setup in REMOTE-SETUP.md.\n' >&2
    return 1
  fi
  if [[ "$(git branch --show-current)" != main ]]; then
    printf 'Deploy from the main branch.\n' >&2
    return 1
  fi
  if [[ -n "$(git status --porcelain)" ]]; then
    printf 'The VPS checkout has local changes. Preserve and resolve them before deploying:\n' >&2
    git status --short >&2
    return 1
  fi
  if [[ ! -f .env ]]; then
    printf 'Copy your existing server .env into this checkout first.\n' >&2
    return 1
  fi
  sudo -v
  git pull --ff-only origin main
  # All deployment directories use project "folio", retaining the same data volume.
  sudo -n docker compose -p folio -f compose.yaml config --quiet
  sudo -n docker compose -p folio -f compose.yaml up -d --build
  sudo -n docker compose -p folio -f compose.yaml ps
  printf '\nStarted Folio from commit %s.\n' "$(git rev-parse --short HEAD)"
  printf 'Open https://folio.take10-44.site and refresh your browser.\n'
}
main "$@"
