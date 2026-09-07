# Repository Guidelines

## Project Structure & Module Organization
- Root page: `index.html` is the Ibaraki-only train status view (`kinki` / `kyoto,kobesanyo,hokurikubiwako,ako,kosei,takarazuka` / `茨木`).
- Archived full-flow pages live in `old/`: `old/index.html` for area/line selection and `old/TID.html` for the generic train status view.
- JavaScript lives in `assets/js/`. Main entry points are `main.js` for the archived selector flow and `tid.js` for the runtime view; `tid-*.js` files split alarms, categories, rules, and background behavior by feature.
- CSS is organized under `assets/css/` with `main.css` as the entry and shared layers such as `variables.css`, `layout.css`, and `components.css`.
- Reusable fragments are in `components/`. Static assets live under `assets/img/`, `assets/sound/`, and text maps in `assets/`.
- Legacy browser bundles are generated into `assets/js/legacy-*.js` and loaded through `assets/js/runtime-loader.js`.

## Build, Test, and Development Commands
- `python dev_proxy.py`
  Starts a local server at `http://localhost:8000` and proxies `/api/v3/*` to the JR-West API.
- `python dev_proxy.py 9000 .`
  Runs the same proxy server on a custom port.
- `python -m http.server 8000`
  Serves static files only. API-backed screens will fail without a proxy.
- `pwsh ./build-legacy.ps1`
  Rebuilds the legacy JS bundle after changing browser-facing scripts.
  Runs `node scripts/version-assets.mjs` first, stamping `?ver=<hash>` over `public/`.

## Coding Style & Naming Conventions
- Use ES modules and keep logic split into focused files in `assets/js/`.
- Follow the existing style: 2-space indentation, semicolons, and `camelCase` for variables and functions.
- Keep naming aligned with the current pattern, for example `tid-alarm.js` or `tid-rules.js`.
- Use absolute asset paths from the site root, such as `/assets/js/tid.js?v=39`.
- Add comments only where behavior is non-obvious.

## Testing Guidelines
- No automated test framework is configured. Validate changes with manual smoke tests.
- Check `index.html` refresh behavior, fixed station filtering for `茨木`, and alarm/audio unlock handling.
- When validating the archived flow, open `old/index.html` and navigate into `old/TID.html`.
- For API-dependent changes, test through `dev_proxy.py` rather than direct browser calls.
- For UI updates, verify both desktop and mobile layouts.

## Commit & Pull Request Guidelines
- Use Conventional Commits: `feat: ...`, `fix: ...`, `refactor: ...`.
- Keep each commit scoped to one logical change.
- PRs should include purpose, user-visible impact, manual test steps/results, and screenshots or recordings for UI work.

## Security & Configuration Tips
- Do not call the JR-West API directly from browser code. Always use `/api/v3/` through the local or deployed proxy.
- Do not commit secrets, credentials, or environment-specific configuration.
