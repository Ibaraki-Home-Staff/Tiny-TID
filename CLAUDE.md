# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Tiny-TID is a static web application that displays JR West train positions and delays in a Super-TID style interface. The project is built with plain HTML/CSS/JS with no build tools or frameworks. It features real-time train tracking, approach alarms, TTS announcements, and PWA capabilities.

## Development Commands

### Local Development
```bash
# Simple static server (no API proxy)
python -m http.server 8000
# Then open http://localhost:8000

# Development server with API proxy (recommended)
python dev_proxy.py
# Custom port and directory: python dev_proxy.py 9000 .
```

The dev proxy is required for local development because JR West's API (`https://www.train-guide.westjr.co.jp/api/v3/`) does not return CORS headers. The proxy makes `/api/v3/*` requests appear same-origin.

### No Build/Test/Lint Commands
This project has no build step, test framework, or linter configured. All files are served directly as static assets.

## Architecture & Key Patterns

### API Proxy Requirements
**Critical**: The JR West API blocks browser requests due to CORS. All deployments must proxy `/api/v3/*` to `https://www.train-guide.westjr.co.jp/api/v3/*`:
- Production: Use Cloudflare Workers (recommended) or Apache mod_proxy
- Local dev: Use `dev_proxy.py`
- Frontend code expects API at `/api/v3/` (relative path)
- Override via `window.TID_API_BASE` if needed

### Page Flow & URL Structure
1. **index.html** → Area/line selection page
   - Uses `area.js` to fetch area master data and populate line dropdowns
   - Saves selection to localStorage
   - Navigates to `TID.html?area=X&line=Y&dir=Z`

2. **TID.html** → Train tracking page
   - Uses `tid.js` (the core ~2500 line module)
   - Reads URL params to determine which trains to display
   - Auto-refreshes every 15 seconds when page is visible

### JavaScript Module Organization

The JS is organized as small focused modules loaded via `<script type="module">`:

- **main.js**: Loads shared HTML components (header/footer) into pages via `data-include` attributes
- **area.js**: Area/line selection logic for index.html
- **tid.js**: Core train tracking engine (TID.html)
  - Station name resolution with cross-line transfer support
  - Train position parsing and enhancement
  - Alarm system (approach alerts, delay announcements)
  - Audio unlock flow for mobile browsers
  - Settings persistence in localStorage
  - Background notification support
- **pwa.js**: Service worker registration and Web Push subscription
- **components.js**: Shared UI utilities (if present)
- **tid-rules.js**: Train category and display type mappings

### Data Flow in tid.js

1. **URL Params** → Parse `area`, `line`, `dir` from query string
2. **Station Index Building**:
   - Fetch area master from `/api/v3/area_{area}.json`
   - Build station lookup maps (`globalStationsByCode`, `globalLineOrders`)
   - Cache station data in localStorage with TTL
   - Handle cross-line transfers (e.g., station appears on multiple lines)
3. **Train Fetching**:
   - GET `/api/v3/{area}/{line}.json` every 15s
   - Parse raw train positions (`pos` field format: `atCode:nextCode` or `atCode` if stopped)
   - Enhance trains with station names, delay info, transfer line data
4. **Filtering & Rendering**:
   - Apply station filter (show only trains at/approaching selected station)
   - Apply pass filter (hide/show trains that pass through selected station)
   - Render train cards with type badge, delay highlight, car count highlight
5. **Alarm Logic**:
   - Check if any train matches alarm conditions (station, type, direction)
   - Debounce notifications with `approachAnnouncedAt` timestamps
   - Queue alarm audio/TTS in `alarmPlayQueue` and drain sequentially
6. **Audio System**:
   - Mobile browsers require user gesture to unlock audio
   - Show overlay if audio playback fails, prompt user to tap "音声を有効化"
   - Use Web Audio API beep + SpeechSynthesis TTS for announcements

### CSS Architecture

CSS is loaded in strict order (see TID.html:15 and index.html:15):
1. `variables.css` – CSS custom properties (colors, spacing)
2. `reset.css` – Normalize browser defaults
3. `base.css` – Typography, links, basic elements
4. `layout.css` – Header, footer, container, responsive grid
5. `components.css` – Buttons, badges, form controls, modals
6. `main.css` – Page-specific styles, integration

**BEM naming convention**: `.block__element--modifier` (e.g., `.train-card__badge--delay`)

### LocalStorage Schema

Settings are stored under `tiny-tid:settings:root` with this structure:
```js
{
  area: "kinki",
  line: "JR-West/...",
  dir: "both",
  station: "stationCode",
  pass: "hide",
  ttsVoice: "voiceName",
  delayThreshold: 4,
  carsThreshold: 9,
  alarmUp: { target: "typeCode", stations: ["code1", "code2"], disable: false },
  alarmDown: { ... },
  bgNotify: true,
  wakeLock: false
}
```

Additional keys:
- `tiny-tid:area:{area}:stations` – Cached station data
- `tiny-tid:area:{area}:cross` – Cross-line preferred line selection
- `tiny-tid:approach:{area}:{line}` – Alarm debounce timestamps

### PWA & Service Worker

- **service-worker.js**: Handles Web Push notifications and notification clicks
- **pwa.js**: Registers service worker, requests notification permission, subscribes to push
- **manifest.webmanifest**: PWA metadata (name, icons, theme color)
- Audio unlock overlay appears if browser blocks audio playback (common on iOS/mobile)

### Type Color & TTS Pronunciation Maps

- **assets/color.txt**: Maps train type codes to color names (format: `typeCode colorName`)
  - Loaded via `<meta name="tid:colorUrl">` in TID.html
  - Example: `rapid-A2 orange` → `.badge--orange`
- **assets/yomiage.txt**: Pronunciation corrections for TTS (format: `原文 読み`)
  - Loaded via `<meta name="tid:yomiUrl">` in TID.html
  - Example: `新快速 しんかいそく`

## Common Development Scenarios

### Adding a New Train Type Color
1. Add entry to `assets/color.txt`: `newType colorName`
2. Add corresponding CSS class in `assets/css/components.css`: `.badge--colorName { ... }`
3. No JS changes needed; color is applied dynamically

### Modifying Alarm Logic
Look in tid.js around line 1500-1800 for `handleApproachAlarms()` and related functions. Key functions:
- `handleApproachAlarms(trains, dir)` – Main alarm trigger logic
- `doAlarmBeepAndSpeak(message, meta, key)` – Plays beep + TTS
- `alarmNotified` object – Tracks which trains already triggered alarms

### Adjusting Auto-Refresh Interval
In tid.js, find `startAutoRefresh()` function. Default is 15000ms (15 seconds). Change the `setInterval` delay.

### Adding New Settings
1. Add UI controls in TID.html settings panel
2. Add getter/setter in tid.js (e.g., `newSettingKey()` function)
3. Add to settings migration in `migrateLegacySettings()` if needed
4. Use `getSetting(key, default)` and `setSetting(key, value)` helpers

### Debugging Train Position Parsing
Set `?debug=1` in URL to enable debug mode. Check:
- `dbg(...)` calls in tid.js (only log when `TID_DEBUG=true`)
- `parsePos(train.pos)` function – handles position string parsing
- `enhanceTrain(t)` function – adds station names and metadata

## File Locations Reference

- Entry pages: `index.html`, `TID.html`
- JS modules: `assets/js/*.js`
- CSS: `assets/css/*.css` (load order matters!)
- Components: `components/header.html`, `components/footer.html`
- PWA: `service-worker.js`, `manifest.webmanifest`
- Dev proxy: `dev_proxy.py` (local only, do not deploy)
- Data files: `assets/color.txt`, `assets/yomiage.txt`

## Deployment Notes

- This is a static site; deploy all files as-is
- **Must** set up API proxy at `/api/v3/*` (see Architecture section)
- Use HTTPS in production (required for service worker and geolocation)
- Set long cache headers for `/assets/*` (immutable resources use `?v=N` query strings)
- Service worker scope is `/` (root)

## Code Style

- Indentation: 2 spaces (HTML/CSS/JS)
- Encoding: UTF-8 with newline at EOF
- Filenames: lowercase, kebab-case preferred
- JS: Avoid globals; use closures or single namespace per module
- CSS: BEM naming; avoid deep nesting
- HTML: Use semantic elements; include ARIA labels for accessibility
