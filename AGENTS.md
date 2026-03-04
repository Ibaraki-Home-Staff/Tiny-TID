# Repository Guidelines

## Project Structure & Module Organization
- Root pages: `index.html` (area/line selector) and `TID.html` (train status view).
- JavaScript modules live in `assets/js/`:
  - `main.js` initializes selector UI.
  - `tid.js` is the main runtime for train data/alarm behavior.
  - `tid-*.js` files split domain logic (alarm, category, rules, background, etc.).
- Styles are split under `assets/css/` with `main.css` as the entry point.
- Reusable HTML fragments are in `components/` (currently `header.html`).
- Static assets: `assets/img/`, `assets/sound/`, and text maps in `assets/` (`color.txt`, `yomiage.txt`).
- Local dev proxy: `dev_proxy.py` (serves files and proxies `/api/v3/*`).

## Build, Test, and Development Commands
- `python dev_proxy.py`
  - Starts local server at `http://localhost:8000` with JR-West API proxy support.
- `python dev_proxy.py 9000 .`
  - Same as above on a custom port.
- `python -m http.server 8000`
  - Static-only server (API calls will fail without proxy/CORS workaround).

## Coding Style & Naming Conventions
- Use ES modules and keep logic split by feature in `assets/js/`.
- Follow existing style: 2-space indentation, semicolons, `camelCase` for variables/functions.
- Keep file naming consistent with current pattern: `tid-<feature>.js`.
- Use absolute asset paths from web root (example: `/assets/js/tid.js?v=39`).
- Prefer small, focused functions; add short comments only for non-obvious behavior.

## Testing Guidelines
- No automated test framework is configured in this repository.
- Validate changes with manual smoke tests:
  - Load `index.html`, select area/line, navigate to `TID.html`.
  - Verify refresh, filtering, and alarm/audio unlock flow.
  - Confirm API-backed behavior through `dev_proxy.py`.
- For UI changes, test desktop and mobile viewport layouts.

## Commit & Pull Request Guidelines
- Follow Conventional Commit style seen in history: `feat: ...`, `fix: ...`, `refactor: ...`.
- Keep commits scoped to one logical change.
- PRs should include:
  - Purpose and user-visible impact.
  - Manual test steps/results.
  - Screenshots or short recordings for UI changes.
  - Linked issue/ticket when applicable.

## Security & Configuration Tips
- Do not call JR-West API directly from browser code; use `/api/v3/` via proxy.
- Do not commit credentials, private keys, or environment-specific secrets.
