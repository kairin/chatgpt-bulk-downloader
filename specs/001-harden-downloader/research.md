# Research: Harden Bulk Downloader for Reliability and Distribution Readiness

**Feature**: 001-harden-downloader
**Date**: 2026-06-22
**Input**: Technical Context unknowns + constitution gates + spec requirements from spec.md

## Decisions & Rationale

### Decision: Use MV3 Background Service Worker + chrome.runtime messaging for downloads
**Rationale**: Chrome's MV3 model (and explicit constitution constraint "Manifest V3 purity" + "Direct `chrome.downloads` calls from content scripts are not permitted") requires that `chrome.downloads.download` (especially with `filename` containing subdirectories like `chatgpt-images/...`) be called from a background/service worker context. Content scripts have restricted access; direct calls from content.js always hit the fallback path (root Downloads only). Standard pattern is content script collects data + triggers via `sendMessage`, worker performs the privileged download(s) and can report back via `onMessage` + `chrome.downloads.onChanged` listeners for real progress.

**Alternatives considered**:
- Stay purely in content script (rejected — violates constitution and makes P1 subfolder feature impossible as documented).
- Use `chrome.downloads` only for images, blob fallback for JSON (rejected — inconsistent experience, still doesn't solve subfolder for the main advertised behavior).
- DeclarativeNetRequest or other (overkill, not applicable for downloads).

**Research sources**: Chrome MV3 migration docs, extension samples (downloads), community patterns for content <-> sw messaging for privileged APIs.

### Decision: Bounded concurrency + progress via message passing + onChanged listeners (instead of fire-and-forget setTimeout)
**Rationale**: Current code uses `setTimeout(..., i*50)` from content (fragile, no feedback, no error propagation for large batches). Worker can use a simple queue (e.g. 3-5 concurrent), listen to `chrome.downloads.onCreated` / `onChanged` / `onErased` to send real status back to content script for button updates. Prevents overwhelming the browser download manager or hitting implicit rate limits.

**Alternatives considered**: Pure fire-and-forget (current) — rejected for UX and reliability. Web Workers (not for chrome.* APIs). 

### Decision: Prefer API-derived image lists (`imageNodes`, `recentUploadedImages`) + stabilization for DOM fallback
**Rationale**: The spec already fetches rich `imageNodes` (from `/backend-api/files/library/nodes?...&categories=image`) and `recentUploadedImages` for the metadata JSON. Using them for actual download list (URLs + original names/sizes when present) is higher fidelity and more resilient to UI changes than pure DOM heuristics (class* selectors, 8-parent textContent walks, naturalWidth >80, broad CDN src matching). DOM remains as fallback + for cases where API list is not authoritative (e.g. some gallery renders). Replace fixed 25-iter 350ms loop with repeated scroll + MutationObserver/IntersectionObserver + "no new images after N stabilization checks" + early exit.

**Alternatives considered**: Only DOM (current, brittle per agent findings) — rejected. Only API (may miss some rendered images or future gallery changes) — rejected; hybrid is best.

### Decision: Pagination for metadata + structured {error, ...} in JSON
**Rationale**: Current hardcodes `offset=0&limit=100` for conversations and direct calls for nodes (no has_more handling). Users with >100 conversations or large folders get incomplete data silently. Loop with increasing offset until no more results (or server `has_more` / total). Merge errors as objects in the meta (e.g. `{ conversations: { error: 429, ... }, ... }`) so JSON always tells the truth about completeness. Matches FR-007, US2, NFR-002.

**Alternatives considered**: Increase limit to 1000 (may hit server limits or perf) — rejected in favor of proper pagination.

### Decision: Non-blocking UI + in-page status (button text + optional lightweight overlay/toast)
**Rationale**: `alert()` is bad UX and forbidden by FR-008 / SC-004. Use existing button text updates + DOM-inserted status element (styled to match the green button, dismissible). Worker messages drive live counts ("Downloading 47/312...", "Metadata partial: 3/5 calls succeeded"). Button always returns to enabled state.

**Alternatives considered**: Console only (current for errors) — rejected. Browser notifications (overkill, permission needed).

### Decision: Real icons (16/48/128 PNG) + manifest update + packaging script that excludes dev dirs
**Rationale**: Current manifest has no "icons", only placeholder README.txt (intentionally stripped previously to avoid vision-tool issues in reviews). CWS and chrome://extensions require proper sized icons with transparency/padding. Packaging must produce clean ZIP with manifest at root and exclude `.specify/`, `specs/`, `.git/`, `node_modules/` (if any), etc. A simple shell script (or package.json "package" script) + update to .gitignore + README "Building a .zip" section.

**Research**: Official Chrome Web Store image guidelines (128x128 icon with 96x96 artwork + padding, 440x280 promo, screenshots 1280x800 or 640x400). Description ≤132 chars.

### Decision: Filename sanitization + cross-run safety
**Rationale**: Current regex + replace(/[^a-z0-9._-]/gi, '_') + ext fix + intra-run dedup. Improve with:
- OS reserved name list (CON, PRN, AUX, NUL, COM1-9, LPT1-9, etc.) + trailing dots/spaces.
- Length cap (e.g. 200 chars before ext).
- Unicode normalization or safe transliteration where needed.
- Timestamp or short hash prefix option for cross-run collisions (beyond browser (1) numbering).
- Always ensure extension.

Matches NFR-003 and edges in spec.

### Decision: No automated tests in this increment; manual + validation quickstart
**Rationale**: Extension is heavily DOM + browser-privileged-API dependent. Current project has zero tests. Plan adds "quickstart.md" with exact manual steps + expected outcomes for validation (as required by Phase 1). Future distribution hygiene can add Puppeteer or similar, but not blocking P1/P2.

### Other resolved (from Technical Context / constitution)
- **Performance/Scale**: Use async/await + small queues; warn or chunk for >500 items if needed (edge in spec).
- **Cloudflare**: Keep as "user must interact" per current README + spec; add detection for common challenge titles/DOM and surface guidance without auto-bypass (to avoid ToS/automation flags).
- **Unofficial disclaimer**: Retain/enhance in README and any new docs.

All decisions keep the extension small (one new ~50-100 LOC background.js + refactors in content.js) and auditable.

## Alternatives Considered (high level)
- Heavy framework (React for options later) — rejected for V Minimalism.
- Server component for ZIP/metadata processing — rejected for I Privacy (client-only).
- Ignoring subfolder and claiming "best effort" — rejected because it violates IV Docs Accuracy and the P1 user story.

**Next**: These findings directly inform the design in data-model.md, the messaging contract, quickstart validation scenarios, and the concrete changes in tasks.md (implementation phase).