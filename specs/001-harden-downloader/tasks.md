# Tasks: Harden Bulk Downloader for Reliability and Distribution Readiness

**Input**: Design documents from `/specs/001-harden-downloader/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/, quickstart.md

**Tests**: The examples below include test tasks. Tests are OPTIONAL - only include them if explicitly requested in the feature specification.
**Note**: Per spec.md, research.md, and quickstart.md, this increment uses *manual browser-based validation* via the scenarios in quickstart.md + "Test instructions" doc for CWS reviewers (US5). No automated unit/integration/contract tests are requested or generated in this plan. Focus is on implementation + manual verification + docs.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Chrome MV3 extension (this project)**: Flat at repository root per plan.md Structure Decision (no src/ layering for this small codebase).
  - `manifest.json`
  - `content.js`
  - `background.js` (new)
  - `icons/icon16.png`, `icons/icon48.png`, `icons/icon128.png`
  - `README.md`, `PRIVACY.md`, `CONTRIBUTING.md`, `CHANGELOG.md`
  - `scripts/package-extension.sh` (new packaging script)
  - `.github/` templates (new)
  - Root-level for simple extension.
- Specs/docs live in `specs/001-harden-downloader/` (excluded from releases per constitution packaging hygiene).
- Adapt all examples to this flat root + icons/ + scripts/ layout.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure for the MV3 extension harden

- [ ] T001 Review and align with current constitution v1.1 (in .specify/memory/constitution.md) and plan.md Constitution Check gates
- [ ] T002 [P] Create `scripts/` directory if needed and initialize basic packaging script skeleton `scripts/package-extension.sh`
- [ ] T003 [P] Update `.gitignore` to ensure release zips exclude `specs/`, `.specify/`, `.git/`, dev scripts, and source maps (per constitution Additional Constraints and FR-012)
- [ ] T004 [P] Create placeholder `PRIVACY.md` (simple "no data collection" statement per CWS requirements and US5)
- [ ] T005 [P] Create basic `CONTRIBUTING.md` and `CHANGELOG.md` skeletons (per US5 hygiene)
- [ ] T006 Create `.github/` directory with basic issue/PR templates (bug_report.md, feature_request.md, PULL_REQUEST_TEMPLATE.md) per US5

**Checkpoint**: Basic repo hygiene and packaging skeleton ready

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented (especially P1 subfolder downloads which require background worker)

**⚠️ CRITICAL**: No user story work can begin until this phase is complete. Background service worker + manifest changes for MV3 downloads are blocking per constitution (MV3 purity, NFRs) and plan.md.

- [ ] T007 Update `manifest.json`: declare `"background": { "service_worker": "background.js" }`, add proper `"icons"` section (16/48/128), shorten description to ≤132 chars, add `"minimum_chrome_version": "88"` (per plan Technical Context, FR-011, FR-013, SC-006, constitution)
- [ ] T008 Create `background.js` skeleton: service worker with `chrome.runtime.onMessage` listener, basic message handling for `START_DOWNLOADS`, queue setup stub, `chrome.downloads` integration points, error/lastError handling (per contracts/messaging.md and research "MV3 Background Service Worker")
- [ ] T009 [P] Refactor `content.js` entry point: ensure `addBulkDownloadButton` and observer remain; prepare messaging stubs (`chrome.runtime.sendMessage` for downloads) and UI update hooks (per research decisions and plan Summary)
- [ ] T010 Implement basic filename sanitization helper (cross-platform reserved names, length cap, unicode safety, extension guarantee) in a new or shared util location (e.g. inline in content.js or small helper; satisfies NFR-003 and research)
- [ ] T011 Add structured error objects and pagination helper functions for metadata fetches (conversations, nodes) - prepare for use in content (per US2, research "Pagination for metadata", data-model MetadataArchive validation)
- [ ] T012 Update `content.js` collection logic skeleton to support hybrid (API imageNodes + DOM) and stabilization detection (replace fixed 25-iter brute force) - prepare functions (per US3, research "Prefer API-derived image lists")
- [ ] T013 **Checkpoint validation**: Manually load unpacked extension, confirm background.js registers (chrome://extensions), no new permissions in manifest, basic message passing works (use console or devtools). Foundation must support subfolder downloads.

**Checkpoint**: Foundation ready - user story implementation can now begin (P1 stories can proceed in parallel if capacity allows)

---

## Phase 3: User Story 1 - Reliable organized downloads matching documented behavior (Priority: P1) 🎯 MVP

**Goal**: Deliver images + metadata JSON to documented `chatgpt-images/` subfolder (or clear fallback) using platform mechanisms, with concurrency, progress, and no blocking UI. Makes the core advertised "organized subfolder" behavior real.

**Independent Test**: Load a supported library folder or gallery page with 10-30 images, activate the bulk action once, and verify that files (images plus the accompanying metadata file) are delivered to the documented organized location under Downloads (with clear indication if the preferred subfolder could not be used). Repeat for the other surface type. Verifiable via the browser's download history view and the local filesystem; delivers value independently. (From spec US1)

### Implementation for User Story 1

- [ ] T014 [P] [US1] Complete `background.js`: implement `START_DOWNLOADS` handler, simple bounded queue (3-5 concurrent), use `chrome.downloads.download` with `filename: \`chatgpt-images/${name}\``, attach `onChanged`/`onErased` listeners for progress, send `DOWNLOAD_PROGRESS` and `DOWNLOAD_COMPLETE` messages back (per contracts/messaging.md, research "Bounded concurrency + progress via message passing")
- [ ] T015 [US1] Wire `content.js` onclick to send `START_DOWNLOADS` message with session data + sanitized items list (instead of direct chrome.downloads or setTimeout fire-and-forget); handle incoming progress/complete messages to update button text live (per plan Summary, US1 AS3, NFR-001)
- [ ] T016 [US1] Implement fallback in content.js for when background/worker not available or errors (use blob <a download> path with clear user message about location) (per US1 AS2, FR-002)
- [ ] T017 [US1] Integrate basic concurrency/progress feedback and "browser does not appear frozen" behavior for large sets (per US1 AS3 and performance goals in plan)
- [ ] T018 [US1] Ensure metadata JSON trigger (early in flow) still works and lands in same location when possible; coordinate with background if extending later
- [ ] T019 [US1] Manual validation per quickstart.md Scenario 1: subfolder used, numbering on collisions, no alert(), button returns to ready state, basic stats in JSON

**Checkpoint**: At this point, User Story 1 should be fully functional and testable independently (P1 MVP deliverable). Stop and validate before US2/US3 if desired.

---

## Phase 4: User Story 2 - Complete and trustworthy metadata export (Priority: P1)

**Goal**: Metadata JSON always produced with complete/partial context (folder structure, image nodes, conversations with timings), using same authenticated endpoints, with structured errors and scope documentation. Even on image collection failure.

**Independent Test**: Trigger the bulk action on a library folder or gallery page; inspect the produced metadata file and confirm it contains the folder/gallery context, associated directory and image details (when applicable), recent conversation or upload timing information, and base operation details. Separately trigger in a way that would cause partial data retrieval and confirm that any issues are recorded in the metadata file while the file itself is still produced and usable. (From spec US2)

### Implementation for User Story 2

- [ ] T020 [P] [US2] Implement full pagination for conversations (loop offset until no more or has_more) and nodes (if server supports cursors) in content.js metadata fetch block (per research "Pagination for metadata", US2 AS3, spec FR-003)
- [ ] T021 [US2] Ensure all metadata API responses (directoryPath, nodes, imageNodes, conversations, recentUploadedImages) are captured with `{error: status}` or full data; merge into meta before JSON stringify (per US2 AS2, data-model MetadataArchive rules, current code swallows in catch(() => ({})))
- [ ] T022 [US2] Add `downloadStats` and `errors` arrays to the produced metadata (populated from worker feedback where relevant) so JSON self-describes completeness (per spec FR-007, NFR-002, US2)
- [ ] T023 [US2] Update filename logic and early JSON trigger to always succeed even if later image collection fails (coordinate with US1)
- [ ] T024 [US2] Handle >100 conversations scope note in JSON + docs (per US2 AS3)
- [ ] T025 [US2] Manual validation per quickstart.md Scenario 2 and spec edges: partial errors visible in JSON, file always written, pagination works on large history

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently (both P1). Metadata is now the "key new feature" reliably.

---

## Phase 5: User Story 3 - Robust image discovery on lazy/virtualized and evolving ChatGPT views (Priority: P2)

**Goal**: Collect logical images from lazy/virtualized grids using best signals (API-derived + DOM fallback) without requiring manual pre-scroll. Names preserve originals where possible.

**Independent Test**: On a supported view containing a moderate number of images (some not immediately visible on first load), activate the bulk action without manually preparing or scrolling the page in advance; verify that a high percentage of the logical images for that view are collected and given usable names (preferring originals or cues present in the view when available). Repeatable on different views; success can be measured by comparing the output count and naming quality against a careful manual preparation of the same view followed by individual saves. (From spec US3)

### Implementation for User Story 3

- [ ] T026 [P] [US3] Implement hybrid collection in content.js: after metadata fetch, use `imageNodes` (library) or `recentUploadedImages` (gallery) for URLs/names/sizes when available; fall back to DOM query (per research "Prefer API-derived...", US3 AS3, data-model ImageReference origin)
- [ ] T027 [US3] Replace fixed 25-iter 350ms scroll loop with observable strategy: repeated scroll + MutationObserver on grid containers + IntersectionObserver + "no new qualifying images after N consecutive checks" + early exit (per US3 AS1, research "stabilization for DOM fallback", NFR-001)
- [ ] T028 [US3] Improve name extraction: walk for filenames/size badges/promptish; prefer API-provided names when hybrid; always sanitize (reserved/unicode/length) + ensure ext + intra-session unique (integrates with T010) (per US3 AS2, NFR-003)
- [ ] T029 [US3] Final dedup by canonical URL (strip query if needed); integrate with US1 download list (per spec photoImgs + final filter)
- [ ] T030 [US3] Manual validation per quickstart.md Scenario 3 and spec: collection succeeds without pre-scroll on virtualized view, names usable, % captured close to manual baseline

**Checkpoint**: Image discovery is now robust (P2).

---

## Phase 6: User Story 4 - Clear, non-blocking user experience and accurate documentation (Priority: P2)

**Goal**: Live non-blocking progress/status (button + in-page), no alert() dialogs, button always recovers, and all public docs (README etc.) exactly match implemented behavior (with qualifications for best-effort/partials/CF).

**Independent Test**: Trigger a bulk action that finds zero (or very few) images after the loading steps; verify a non-modal notice with guidance appears and the primary activation control returns to its ready state. Separately, compare the public documentation (especially usage steps, feature descriptions, metadata details, download locations, name behavior, Cloudflare notes, and limitations) against the actual observed behavior of the tool and confirm every claim is accurate or clearly qualified with any best-effort or partial-result semantics. (From spec US4)

### Implementation for User Story 4

- [ ] T031 [P] [US4] Remove all `alert()` calls; replace with non-blocking in-page status (e.g. temporary div or enhanced button text + optional lightweight toast) for errors, zero results, CF guidance, partials (per FR-008, SC-004, US4 AS2)
- [ ] T032 [US4] Ensure button text phases + final summary always include output location and counts (success/partial/failed); button re-enabled on *all* paths (per US4 AS1/AS2, plan performance goals)
- [ ] T033 [US4] Add live progress details from worker messages (e.g. "Downloading 47/312...") and partial metadata notes (per US1/US2 integration)
- [ ] T034 [US4] Update README.md: fix all claims (subfolder behavior, name extraction examples, metadata fields/scope, CF note, usage steps, locations, privacy) to match reality + add qualifications for limits/best-effort (per FR-010, SC-005, US4 AS3, constitution IV)
- [ ] T035 [US4] Add/update "Test instructions" section or separate doc for CWS reviewers (per US5 and quickstart)
- [ ] T036 [US4] Manual validation per quickstart.md Scenario 5 and spec edges: no modals, accurate docs post-change, CF/zero-result guidance works

**Checkpoint**: UX is polished and docs truthful (P2).

---

## Phase 7: User Story 5 - Distribution and maintenance readiness (Priority: P3)

**Goal**: Clean package with real icons + compliant manifest, packaging hygiene excluding dev artifacts, basic open-source files (PRIVACY, CONTRIBUTING, CHANGELOG, .github), and hooks for roadmap (options, ZIP) as additive per FR-015. Enables CWS/GitHub release path.

**Independent Test**: Using the documented packaging process, produce a clean distributable package from the project. Load or install it in the target browser's extension environment and confirm that icons are present and correct, the description meets store limits, and the core functionality activates on supported pages. Separately verify that required supporting files exist (icons at the sizes needed for the platform, a privacy statement, contribution and change documentation, issue templates if applicable, and any store listing assets). (From spec US5)

### Implementation for User Story 5

- [ ] T037 [P] [US5] Add real compliant icon PNGs (16x16, 48x48, 128x128 with proper artwork/padding per CWS guidelines) to `icons/`; remove or update `icons/README.txt`; declare in manifest (per FR-011, SC-006, research "Real icons", US5)
- [ ] T038 [US5] Implement full `scripts/package-extension.sh` (or equivalent): produces clean zip with manifest at root, only runtime files, excludes `specs/`, `.specify/`, `.git/`, etc.; update README "Building a .zip" section (per FR-012, plan packaging, constitution)
- [ ] T039 [US5] Flesh out `PRIVACY.md`, `CONTRIBUTING.md`, `CHANGELOG.md`, `.github/` templates with real content (per US5 AS3, hygiene)
- [ ] T040 [US5] Update manifest description ≤132 chars, ensure icons show in chrome://extensions after load of packaged artifact (per SC-006, US5 AS1)
- [ ] T041 [US5] Add "Test instructions" doc or section (manual steps from quickstart.md) for CWS dashboard (per research and US5)
- [ ] T042 [US5] Add hooks/placeholders in code/docs for future additive roadmap (options page via chrome.storage + options_ui in manifest; ZIP bundling) without implementing (per FR-015, US5)
- [ ] T043 [US5] Manual validation per quickstart.md Scenario 4: clean package loads with icons, no dev dirs inside, core functionality works, supporting files present

**Checkpoint**: All user stories should now be independently functional. Distribution path ready (P3).

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories + final constitution/quality gates + validation

- [ ] T044 [P] Run full quickstart.md validation scenarios (all 5) on real chatgpt.com pages; fix any deviations (per quickstart and research)
- [ ] T045 Re-evaluate Constitution Check in plan.md post-implementation (all gates still PASS? document any new justifications in Complexity Tracking)
- [ ] T046 [P] Update AGENTS.md / agent context if needed (via script); ensure .specify/feature.json and all design docs reference latest
- [ ] T047 Code review sweep: remove any remaining magic numbers (25, 350, 80, etc.) or hardcodes into constants/config per constitution V; add comments referencing research decisions
- [ ] T048 [P] Final README + docs polish for any last claims alignment (per US4/constitution IV)
- [ ] T049 [P] Verify packaging script produces artifact that passes manual "load unpacked" + icon + functionality check in clean profile
- [ ] T050 Run any pre-commit / codacy-preflight style checks if configured; prepare suggested commit message for the feature

---

## Dependencies & Execution Order

### Phase Dependencies
- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - **BLOCKS all user stories** (background + manifest required for P1 subfolder)
- **User Stories (Phase 3+)**: All depend on Foundational phase completion
  - US1 (P1) and US2 (P1) can proceed in parallel once foundational done (different files: background vs content metadata paths)
  - US3 (P2), US4 (P2), US5 (P3) follow or parallel as capacity allows
- **Polish (Final Phase)**: Depends on desired user stories being complete + quickstart validation

### User Story Dependencies
- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories (core subfolder MVP)
- **User Story 2 (P1)**: Can start after Foundational (Phase 2) - Integrates with US1 (shared JSON trigger + stats) but independently testable
- **User Story 3 (P2)**: Can start after Foundational (Phase 2) - Builds on collection improvements usable by US1/US2
- **User Story 4 (P2)**: Can start after Foundational (Phase 2) - Cross-cuts UX for all prior stories + docs
- **User Story 5 (P3)**: Can start after Foundational (Phase 2) - Packaging/hygiene applies to whole; icons/manifest overlap foundational

### Within Each User Story
- Core logic (background/content changes) before integration/polish
- Manual validation (quickstart scenarios) at end of story
- Story complete before moving to next priority (but P1s can overlap)

### Parallel Opportunities
- All Setup tasks marked [P] can run in parallel
- All Foundational tasks marked [P] can run in parallel (within Phase 2)
- Once Foundational phase completes, US1 and US2 (both P1) can start in parallel (different primary files: background.js vs content.js metadata/ pagination paths)
- Models/entities (data-model) are runtime JS objects - implement as part of collection/download logic in relevant stories
- Contract implementation (messaging) splits across background (T014) and content (T015)
- Different user stories can be worked on in parallel by different "team members" (or sequentially by one)
- Polish tasks many [P] (validation, doc sweeps)

---

## Parallel Example: User Stories 1 and 2 (after Foundational)

```bash
# After Phase 2 complete:
# Parallel for P1 stories (US1 + US2):
Task for US1: "Complete background.js queue + downloads + progress messages" (background.js)
Task for US1: "Wire content onclick + progress handlers for subfolder" (content.js)
Task for US2: "Implement pagination + structured errors in metadata fetch" (content.js - different functions)
Task for US2: "Add stats/errors to JSON output" (content.js + background feedback)
# Then per-story manual checkpoints via quickstart
```

---

## Implementation Strategy

### MVP First (User Story 1 + 2 since both P1)
1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (**CRITICAL** - blocks subfolder P1)
3. Complete Phase 3 (US1) + Phase 4 (US2) in parallel where possible
4. **STOP and VALIDATE**: Run quickstart Scenarios 1+2 independently. Deploy/demo if ready (makes advertised subfolder + metadata real)
5. Then add P2 stories (US3/US4) for robustness + UX/docs
6. Finally US5 (P3) for release readiness

### Incremental Delivery
1. Setup + Foundational → Background + manifest ready for downloads
2. Add US1 (subfolder) → Test independently → Demo (core P1 value)
3. Add US2 (metadata) → Test independently → Demo (key new feature reliable)
4. Add US3 (discovery) → Test independently
5. Add US4 (UX + docs) → Test independently + full docs audit
6. Add US5 (distribution) → Clean package + hygiene → Release path open
7. Each story adds value without breaking previous; constitution gates re-checked at polish

### Parallel Team Strategy
With multiple developers:
1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: US1 (background + content download wiring)
   - Developer B: US2 (metadata pagination + errors)
   - Developer C: US3 + US4 (collection hardening + UX/docs)
3. US5 can be picked up by anyone or in parallel on packaging/icons
4. Stories complete and integrate independently; final polish + validation together

---

## Notes
- All tasks use exact file paths adapted to flat root MV3 extension (manifest.json, content.js, background.js, icons/, scripts/, README.md, etc.)
- No automated tests generated (per spec/research/quickstart explicit choice for this increment; manual quickstart + test instructions doc instead)
- Each user story phase ends with quickstart validation checkpoint
- Tasks are specific enough for direct implementation (LLM or human)
- Constitution v1.1 (NFRs, Dependencies, MV3 purity, packaging hygiene, resilience, docs accuracy, minimalism) is referenced throughout and must be satisfied
- Follow plan.md research decisions exactly (hybrid collection, background messaging, pagination, etc.)
- Commit after logical groups; use quickstart.md for validation at story checkpoints

**Total tasks (estimated in this generation)**: ~50 (adjust during implementation; many [P] for parallel)

**Suggested MVP scope**: US1 + US2 (P1 stories) after Setup + Foundational. This delivers the two headline "advertised but broken" behaviors reliably.