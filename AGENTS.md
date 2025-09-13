# Repository Guidelines

## Project Structure & Module Organization
- Root HTML: `index.html`, `TID.html`.
- Assets: `assets/css/`, `assets/js/`, `assets/img/`.
- HTML partials: `components/header.html`, `components/footer.html`.
- Dev helper: `dev_proxy.py` for local proxying during development.

## Build, Test, and Development Commands
- Serve locally (simple): `python -m http.server 8000` then open `http://localhost:8000`.
- Dev proxy (if you need CORS/path proxying): `python dev_proxy.py`.
- Quick reload tip: use your editor’s live server extension; no build step required.

## Coding Style & Naming Conventions
- Indentation: 2 spaces for HTML/CSS/JS; UTF‑8; end files with a newline.
- Filenames: lowercase; prefer `kebab-case` for new files (e.g., `site-utils.js`).
- CSS order: load `variables.css` → `reset.css` → `base.css` → `layout.css` → `components.css` → `main.css`.
- CSS naming: BEM‑style selectors (`.block__element--modifier`); avoid deep nesting.
- JS: keep modules small and focused (`assets/js/*.js`); avoid globals; prefer closures or a single namespace.
- HTML: keep partials in `components/`; include via server‑side tooling or copy/paste during development.

## Testing Guidelines
- No test framework is configured. Perform manual checks:
  - Visual: verify layout and interactions in latest Chrome/Firefox.
  - Accessibility: run Lighthouse in DevTools; fix contrast/aria issues.
  - Links: click‑through critical paths from `index.html`.

## Commit & Pull Request Guidelines
- Commits: imperative, concise messages (e.g., "fix: correct header z-index").
- Group related changes; avoid mixing refactors with features.
- PRs: include a clear description, before/after screenshots for UI changes, and a brief test plan. Link related issues.

## Security & Configuration Tips
- Do not commit secrets or API keys; never embed tokens in client JS.
- `dev_proxy.py` is for local use only; do not deploy as-is.
- Serve over HTTPS in production; set proper caching for `assets/`.

## Agent-Specific Instructions
- Keep the stack simple (static HTML/CSS/JS). Do not introduce frameworks without discussion.
- Place new scripts/styles in `assets/` and images in `assets/img/`.
- Preserve file ordering and naming patterns; avoid breaking relative paths.
