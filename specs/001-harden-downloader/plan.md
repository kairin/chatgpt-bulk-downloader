# Implementation Plan: Harden Bulk Downloader for Reliability and Distribution Readiness

**Branch**: `001-harden-downloader` | **Date**: 2026-06-22 | **Spec**: [specs/001-harden-downloader/spec.md](../spec.md)

**Input**: Feature specification from `/specs/001-harden-downloader/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Primary requirement: Harden the existing ChatGPT Bulk Downloader Chrome MV3 extension so that all advertised behaviors (organized `chatgpt-images/` subfolder downloads via platform APIs, complete and trustworthy metadata JSON with folder structure + conversation timings + error visibility, reliable image discovery on lazy/virtualized views) actually work reliably for users, while improving UX (no blocking alerts, live progress), aligning all documentation, adding proper icons + clean packaging for distribution (CWS + GitHub), and laying groundwork for roadmap items (options, ZIP) as additive layers. All while strictly preserving client-only privacy, narrow permissions, and resilience to ChatGPT UI/API changes per the constitution.

Technical approach (from research): 
- Introduce a minimal MV3 background service worker (background.js) to handle chrome.downloads API calls (required because content scripts cannot directly use downloads for subfolder paths).
- Refactor content.js to use chrome.runtime.sendMessage for batch download requests and receive progress/error feedback.
- Harden image collection: prefer structured data from the already-fetched library `imageNodes` / recentUploadedImages where available, fall back to improved DOM heuristics + stabilization detection instead of fixed 25-iter brute force.
- Add full pagination support for metadata fetches (conversations, nodes) and structured error reporting in the JSON.
- Implement non-blocking UI updates, better filename sanitization (with reserved name/unicode/long name handling), bounded concurrency, and visible partial failure reporting.
- Add real 16/48/128 icons, shorten manifest description, implement a clean packaging script (or npm script) that excludes .specify/, .git/, etc.
- Update README for accuracy, add PRIVACY.md stub, basic .github/ templates, CONTRIBUTING/CHANGELOG.
- No new broad permissions; options/ZIP deferred to future additive work.
- All changes keep the extension small, auditable, and aligned with constitution principles (especially II Resilience, III SDD, IV Docs Accuracy, V Minimalism, MV3 purity, NFRs for non-blocking + resilience, and explicit Dependencies on browser APIs + CWS rules).

This delivers P1 user stories (subfolder + metadata) as independent viable MVPs, with P2/P3 following.

## Technical Context

**Language/Version**: Vanilla JavaScript (ES2020+ features supported in modern Chrome; no build step or transpiler for the core extension).

**Primary Dependencies**: None (pure browser extension using only `chrome.*` APIs, DOM, and Fetch; no npm packages, no bundlers). Future options may optionally use chrome.storage.

**Storage**: N/A for core functionality (downloads go to user-chosen local filesystem via browser Downloads API; no extension-managed persistent DB or files). chrome.storage.sync may be introduced later for options (target folder name etc.) but is out of scope for this harden increment.

**Testing**: Primarily manual browser-based testing (load unpacked extension in Chrome, exercise on real chatgpt.com Library /images/ pages including Cloudflare interstitials, verify downloads + metadata JSON, button states, error paths). No automated unit tests in current project (DOM + browser API heavy); future may add simple integration notes or Puppeteer harness as part of distribution hygiene, but not required for this plan.

**Target Platform**: Chrome browser (Manifest V3, minimum Chrome 88+ as declared in manifest). Runs on Windows, macOS, Linux via Chrome (or Chromium-based). Not targeting Firefox/Edge/Safari in this increment (different extension models).

**Project Type**: Chrome browser extension (MV3). Single "package" at repository root (manifest.json + content script + background worker + assets). No server, no build pipeline beyond manual zip for releases.

**Performance Goals**: 
- Non-blocking user experience: button updates and page remain responsive during aggressive loading of 100-500+ images and metadata fetches.
- Bounded operations: reasonable concurrency for downloads (e.g. 3-5 simultaneous) and scroll passes; avoid memory bloat on large metadata responses or thousands of setTimeout.
- Fast feedback: visible progress within seconds of activation; full run for moderate folders (50-200 images) completes in reasonable wall time without freezing Chrome UI.

**Constraints**:
- Must remain pure client-side with existing narrow permissions (host_permissions only chatgpt.com/*, "downloads").
- chrome.downloads API for subfolder organization is only available in background/service worker context — content script calls always fall back (this harden must fix the advertised behavior).
- No new broad permissions or remote code.
- Must tolerate Cloudflare "Just a moment..." challenges (user must interact; code should detect or gracefully handle).
- Filename sanitization must produce cross-platform safe names (no reserved, control chars, length limits, unicode).
- Must not break existing happy-path for small folders.
- All changes must keep the implementation small and auditable per constitution.

**Scale/Scope**:
- Support typical user Library folders and /images/ galleries (dozens to low thousands of images per activation).
- Metadata JSON size: reasonable (hundreds of conversations/nodes); handle gracefully if very large.
- Single extension codebase (~few hundred LOC today); changes localized to manifest, content.js, new background.js, icons/, packaging, and docs.
- Out of scope for this plan: full automated test suite, options page implementation (only hooks), ZIP export, expanded project support, store submission itself.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Gates are derived directly from the current `.specify/memory/constitution.md` (core principles I–V on privacy, resilience to external churn, SDD with measurable gates, documentation accuracy, and minimalism/observability; plus Additional Constraints on MV3 purity/packaging/icons/unofficial status, explicit NFRs for non-blocking/resilience/name-safety, and Dependencies/External Factors for service APIs, browser platform rules, and distribution channel requirements).

**Evaluation (pre-research):**

- **I. Client-Only Privacy & Least Privilege**: PASS. This plan adds no new permissions, no telemetry, no external calls beyond the site's own authenticated endpoints already used today. Background worker is for local chrome.downloads only (no network in worker for this feature). All data stays in user Downloads.
- **II. Resilience to External UI/API Churn (NON-NEGOTIABLE)**: PASS (core driver). The harden explicitly adds fallback strategies (API imageNodes + DOM), pagination, structured errors/partials in JSON, stabilization instead of fixed loops, and clear scope documentation. Degradation paths (metadata always produced) are required.
- **III. Spec-Driven Development with Measurable Quality Gates**: PASS. This plan is the output of the SDD process after spec; stories/FRs/NFRs/SCs from spec are directly mapped. Constitution Check is here and will be re-evaluated post-design.
- **IV. Documentation Accuracy as a First-Class Deliverable**: PASS. Major user story + FR-010 + SC-005 require full alignment of README + new docs (PRIVACY.md etc.) with delivered behavior. Changes to claims must be in same increment.
- **V. Minimalism, Observability, and Small Surface Area**: PASS with justification. Adding a small background.js is *required* by MV3 for the subfolder feature (content scripts cannot use downloads for paths) and explicitly called out in constitution constraints. Keeps overall surface small (no new files beyond necessary, no frameworks).
- **MV3 purity / packaging / icons / unofficial**: PASS. Plan includes background for correct API usage, clean packaging script excluding .specify/ etc., real icons meeting CWS rules, and retention of disclaimer.
- **NFRs (non-blocking, resilience/retry+validation, name safety)**: PASS. Explicitly called out in Technical Context constraints + will be designed in research/design (bounded concurrency, retries on transients, sanitization rules).
- **Dependencies/External Factors**: PASS. Plan treats browser downloads API + messaging, CWS asset/icon rules, and ChatGPT endpoint best-effort nature as explicit inputs (documented in research and design).

**No unjustified violations.** The only "complexity" (background service worker + messaging) is mandated by the platform to achieve the P1 subfolder behavior that the constitution + spec require. Simpler alternatives (staying content-only) were rejected because they make the documented/ advertised feature impossible.

Re-check required after Phase 1 design.

## Project Structure

### Documentation (this feature)

```text
specs/[###-feature]/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)
<!--
  ACTION REQUIRED: Replace the placeholder tree below with the concrete layout
  for this feature. Delete unused options and expand the chosen structure with
  real paths (e.g., apps/admin, packages/something). The delivered plan must
  not include Option labels.
-->

```text
# [REMOVE IF UNUSED] Option 1: Single project (DEFAULT)
src/
├── models/
├── services/
├── cli/
└── lib/

tests/
├── contract/
├── integration/
└── unit/

# [REMOVE IF UNUSED] Option 2: Web application (when "frontend" + "backend" detected)
backend/
├── src/
│   ├── models/
│   ├── services/
│   └── api/
└── tests/

frontend/
├── src/
│   ├── components/
│   ├── pages/
│   └── services/
└── tests/

# [REMOVE IF UNUSED] Option 3: Mobile + API (when "iOS/Android" detected)
api/
└── [same as backend above]

ios/ or android/
└── [platform-specific structure: feature modules, UI flows, platform tests]
```

**Structure Decision**: Single flat Chrome extension at repository root (Option 1 style, no src/ layering needed for this small codebase). Real layout:

- Root: manifest.json, content.js (main injection + logic), background.js (new, for downloads API + messaging), .gitignore, LICENSE, README.md, AGENTS.md
- icons/: icon16.png, icon48.png, icon128.png (real assets to be added), README.txt (to be removed/updated)
- (future optional) options.html/js if options added later
- specs/ (this feature's design docs — excluded from release packages)
- .specify/ (speckit tooling — excluded from release packages)
- No tests/ dir today (manual verification); no backend/frontend split.

This matches the current project (simple MV3 content script extension) and keeps changes minimal per constitution V.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No violations requiring justification. The introduction of `background.js` (for correct use of `chrome.downloads` to deliver the P1 subfolder behavior) is explicitly required by the constitution's MV3 purity constraint and Additional Constraints, and by Chrome's MV3 model. It is the *simplest* compliant way to make the advertised functionality work. No over-engineering (no new frameworks, no unnecessary files, no broad permissions).

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| (none) | - | - |
