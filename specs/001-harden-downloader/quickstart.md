# Quickstart Validation Guide: Harden Bulk Downloader

**Purpose**: End-to-end manual validation scenarios that prove the hardened feature works as specified (P1 subfolder + metadata, reliable collection, UX, docs alignment, packaging). These are the minimal runnable checks before considering the increment complete.

**Prerequisites**:
- Chrome (recent, MV3 capable).
- This repo checked out.
- A real logged-in chatgpt.com account with at least one Library folder containing images (and the /images/ gallery).
- Ability to handle Cloudflare "Just a moment..." (move mouse, scroll naturally).

**Note**: Do *not* run against production accounts with irreplaceable data until comfortable. All output goes to your local `~/Downloads/chatgpt-images/`.

## Scenario 1: Basic P1 Subfolder + Metadata (Library Folder)
1. Load the extension unpacked:
   - `chrome://extensions/` → Developer mode → Load unpacked → select the repo root.
   - Pin or note that it only activates on matching pages (no toolbar icon).
2. Navigate to a Library folder with images, e.g. `https://chatgpt.com/library/d/<id>?tab=images`.
3. If Cloudflare challenge appears, interact with the page until real content loads.
4. (Optional but recommended for testing lazy load) Scroll the grid a bit manually.
5. Click the floating green button `⬇️ Bulk Download Folder (+JSON)`.
6. **Expected**:
   - Button text updates through phases ("Loading images + metadata...", "⬇️ Downloading N images...").
   - No `alert()` dialogs.
   - A `chatgpt-images/` subfolder is created under Downloads (or clear message if fallback used).
   - Inside: several image files with good names (originals preserved where possible, sanitized, unique, with extensions).
   - One `chatgpt-folder-<shortid>-metadata.json`.
   - Open the JSON: contains `directoryPath`, `nodes`, `imageNodes`, `conversations` (with create/update times), `scrapedAt`, context, and `downloadStats` / errors if any.
   - Button ends with success summary including location and returns to ready state.
7. Repeat on a different folder. Verify collision handling ( (1), (2) etc. from browser).

**Pass criteria**: Subfolder used when possible (FR-002, SC-002), metadata always written with required fields even on partials (FR-003, SC-001), no blocking UX (FR-008, SC-004).

## Scenario 2: Gallery + Partial / Error Visibility
1. Go to `https://chatgpt.com/images/`.
2. Activate the button `⬇️ Bulk Download Images (+JSON)`.
3. **Expected**:
   - `recentUploadedImages` appears in the metadata JSON.
   - If some images fail (e.g. simulate by revoking a URL or network), `downloadStats` and `errors` sections reflect it.
   - Metadata file is still produced with whatever succeeded.
   - Clear non-modal feedback.

**Pass criteria**: Partial results visible and non-fatal (US2, FR-007).

## Scenario 3: Large / Lazy View + Non-Blocking
1. Find or create a view with 100+ images (virtualized grid).
2. Activate without manually scrolling to bottom first.
3. **Expected**:
   - Tool performs loading steps internally.
   - UI (button + page) stays responsive (you can scroll/click elsewhere while it works).
   - High % of logical images captured vs. what a careful manual prep + save would get (SC-003 target ~80%+).
   - Progress visible (counts in button text).

**Pass criteria**: Handles virtualization (FR-004, US3), non-blocking (NFR-001).

## Scenario 4: Packaging & Icons / Distribution Hygiene
1. Follow the documented packaging step (to be added to README during implementation: e.g. `./package.sh` or `npm run package` that produces a clean zip).
2. The resulting zip must:
   - Have `manifest.json` at root.
   - Contain real `icons/icon*.png` (16/48/128) that show correctly when the zip is loaded unpacked.
   - Manifest description ≤132 chars.
   - Exclude `specs/`, `.specify/`, `.git/`, any dev scripts.
3. Load the packaged/unpacked result in a clean Chrome profile and verify icons appear in `chrome://extensions/` and the button still works.

**Pass criteria**: FR-011, FR-012, SC-006, packaging hygiene constraint.

## Scenario 5: Docs Accuracy (Post-Change Audit)
1. After implementation, perform the side-by-side check described in US4 / SC-005:
   - Every claim in README (features, usage steps, metadata contents, download locations/fallbacks, name extraction examples, Cloudflare note, privacy) must match actual behavior or be explicitly qualified.
2. New docs (PRIVACY.md, updated Development section, quickstart.md) exist and are accurate.

**Pass criteria**: IV. Documentation Accuracy (constitution) + FR-010 + SC-005.

## How to Use This Guide
- Run these scenarios on real chatgpt.com pages (the only way to validate the integration with the live service).
- Record any deviations as bugs against the spec.
- These scenarios (plus the edge cases listed in spec.md) must all pass before the feature is considered implemented.
- Implementation tasks (in the later tasks.md) must produce code that makes these checks pass.

**References**:
- Full acceptance criteria: spec.md (User Stories 1-5 + FRs + SCs + Edges)
- Data model: data-model.md
- Messaging contract between content and background: contracts/messaging.md
- Constitution gates: plan.md Constitution Check section

Do not implement full test automation in this increment (see research.md). Manual execution of this quickstart + visual inspection of artifacts is the validation method.