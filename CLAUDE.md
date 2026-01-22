# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Tiny-TID is a real-time train information display (TID) system for JR West Japan. It's a static HTML/CSS/JS PWA that fetches train position data from JR West's API and displays train status, delays, and operational information.

## Development Commands

### Local Development
```bash
# Simple static server (no API proxy)
python -m http.server 8000

# Development server with API proxy (recommended)
python dev_proxy.py

# Custom port with dev proxy
python dev_proxy.py 9000 .
```

The `dev_proxy.py` server proxies `/api/v3/*` requests to `https://www.train-guide.westjr.co.jp/api/v3/*` to bypass CORS restrictions during local development.

### No Build Step Required
This is a vanilla JS/CSS/HTML project with no build tooling, bundlers, or transpilation. All files are served directly.

## Architecture Overview

### Application Flow

1. **Entry Points**:
   - `index.html` - Area/line selection page
   - `TID.html` - Train information display page

2. **TID Application Bootstrap** (`assets/js/TID/init.js`):
   - Reads query parameters (area, line, direction)
   - Loads HTML components (header/footer)
   - Fetches initial snapshot
   - Sets up polling interval (default 30s)
   - Initializes alert and audio controllers

3. **Data Pipeline**:
   ```
   URL params → fetchSnapshot() → normalizeSnapshot() → renderSnapshot()
   ```

### Key Modules (assets/js/TID/)

**Core Modules:**
- **config.js**: Configuration via window globals (TID_API_BASE, TID_EXTRA_LINES, TID_DESTINATION_FILTERS, etc.)
- **api.js**: Fetches area master data and train position data, supports multiple lines via TID_EXTRA_LINES
- **normalize.js**: Orchestrates snapshot normalization - coordinates trains, traffic, and metadata processing
- **render.js**: DOM rendering - train table, traffic messages, status updates
- **state.js**: Application state management (params, snapshot, poll handle, audio/passing toggles)
- **init.js**: Application bootstrap and lifecycle management

**Domain Logic Modules:**
- **station.js**: Station name cleaning, lookup maps, position description algorithm
- **filters.js**: Train filtering by destination, reference station, and passing logic
- **utils.js**: Shared utilities - date formatting, delay formatting, direction mapping, remark joining

**UI Controllers:**
- **alerts.js**: Modal alert controller for train notifications
- **audio.js**: Manages alarm sound playback with browser autoplay policy handling

**Supporting Modules:**
- **params.js**: Query parameter parsing and validation
- **train-type.js**: Train type classification and badge styling
- **station-stop-types.js**: Decodes which train types stop at each station

### Configuration System

Runtime configuration is done via window globals set before script loading:

```html
<script>
  window.TID_API_BASE = '/api/v3/';
  window.TID_EXTRA_LINES = ['JR-Kyoto', 'JR-Kosei'];  // Additional lines to display
  window.TID_DESTINATION_FILTERS = ['京都', '大阪'];  // Filter by destination text
  window.TID_DESTINATION_CODES = ['0610130'];        // Filter by station codes
  window.TID_REFERENCE_STATION = '0610130';          // Highlight trains stopping here
  window.TID_REFERENCE_STOP_TYPES = ['普通', '快速']; // Override stop types
  window.TID_HIDE_PAST_REFERENCE = true;             // Hide trains past reference
  window.TID_POLL_INTERVAL = 30000;                  // Polling interval in ms
</script>
```

### Component Loading System

HTML components (header/footer) are loaded dynamically via `assets/js/components.js`:
- Fetches from `/components/header.html` and `/components/footer.html`
- Replaces elements with `data-include` attributes
- Handles active navigation state
- Mobile nav toggle functionality

### Train Filtering Logic

The `normalize.js` module implements complex filtering:

1. **Direction filtering**: Filter by up/down/both based on URL param
2. **Destination filtering**: Match against destination text or line codes (TID_DESTINATION_FILTERS)
3. **Destination code filtering**: Match exact station codes (TID_DESTINATION_CODES)
4. **Reference station logic**:
   - Highlights trains that stop at TID_REFERENCE_STATION
   - Optionally hides trains that have passed reference station
   - Auto-detects which train types stop at reference station
   - Toggle to show/hide passing trains
5. **Multi-line support**: Combines trains from multiple lines when TID_EXTRA_LINES is set

### Position Description Algorithm

Train positions are encoded as `CODE1_CODE2` (between two stations). The `describePosition()` function:
- Looks up station names from codes
- Determines direction of travel based on destination station distance
- Formats as "Origin → Target" or single station name
- Handles edge cases (missing stations, identical codes)

## Deployment Notes

### CORS Proxy Requirement

JR West API does not send CORS headers. Production deployment requires:

**Option 1: Cloudflare Workers (Recommended)**
```javascript
// Worker route: example.com/api/v3/*
export default {
  async fetch(request) {
    const url = new URL(request.url);
    const upstream = 'https://www.train-guide.westjr.co.jp' + url.pathname;
    return fetch(upstream);
  }
}
```

**Option 2: Apache mod_proxy**
```apache
RewriteRule ^api/v3/(.*)$ https://www.train-guide.westjr.co.jp/api/v3/$1 [P,L]
```

Frontend code assumes API is available at `/api/v3/` by default.

## CSS Architecture

CSS is loaded in specific order (see `TID.html` or `index.html`):
1. `variables.css` - CSS custom properties
2. `reset.css` - Browser normalization
3. `base.css` - Base typography and links
4. `layout.css` - Header/footer/grid layout
5. `components.css` - UI components (buttons, badges, etc.)
6. `main.css` - Page-specific styles

CSS follows BEM-like naming: `.block__element--modifier`

## File Naming Conventions

- HTML files: Root level (`index.html`, `TID.html`, `ibaraki.html`)
- CSS files: `assets/css/*.css`
- JS modules: `assets/js/TID/*.js` for TID app logic
- Data files: `assets/data/tid/**/*.json`
- Components: `components/header.html`, `components/footer.html`

## Module Architecture (Post-Refactoring)

The TID module follows a layered architecture pattern:

```
┌─────────────────────────────────────────┐
│         init.js (Bootstrap)             │
└──────────────┬──────────────────────────┘
               │
      ┌────────┴─────────┐
      │                  │
┌─────▼─────┐    ┌──────▼──────┐
│  api.js   │    │  render.js  │
│ (Fetch)   │    │   (View)    │
└─────┬─────┘    └──────▲──────┘
      │                 │
      │        ┌────────┴─────────┐
      │        │                  │
      └────────▼────────┐         │
      │  normalize.js   │         │
      │  (Orchestrator) │         │
      └────────┬────────┘         │
               │                  │
      ┌────────┼──────────┐       │
      │        │          │       │
┌─────▼──┐ ┌──▼─────┐ ┌──▼────┐  │
│station │ │filters │ │ utils │  │
│  .js   │ │  .js   │ │  .js  │  │
└────────┘ └────────┘ └───────┘  │
      │        │          │       │
      └────────┴──────────┴───────┘
```

**Separation of Concerns:**
- **station.js** (~115 lines): Station-specific domain logic
- **filters.js** (~112 lines): Train filtering business rules
- **utils.js** (~68 lines): Pure utility functions with no dependencies
- **normalize.js** (~296 lines): High-level orchestration only

This refactoring reduced normalize.js from 589 lines to 296 lines (50% reduction) while improving maintainability through clear module boundaries.

## Common Pitfalls

1. **Don't introduce build tools** - This is intentionally a vanilla JS project
2. **Respect the configuration system** - Use window globals, not hardcoded config
3. **Maintain ES module structure** - All TID JS files are ES modules with explicit imports/exports
4. **API base path** - Never hardcode API URLs, always use `resolveApiUrl()` from config.js
5. **Station code lookups** - Station codes are strings, not numbers (e.g., '0610130')
6. **Direction handling** - Direction is 0=up, 1=down in API; normalized to 'up'/'down'/'both' strings
7. **Train deduplication** - Trains are deduplicated by line+number key in `normalizeTrains()`

## Progressive Web App (PWA)

- `manifest.webmanifest` - PWA manifest
- `service-worker.js` - Minimal service worker for offline capability
- `assets/js/pwa.js` - PWA registration logic

## Version Cache Busting

Asset URLs are automatically versioned via `?v=` query param based on `<meta name="app:version">` content. See `components.js` `withVersion()` function.
