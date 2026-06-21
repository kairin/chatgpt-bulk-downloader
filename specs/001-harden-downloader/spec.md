# Feature Specification: Harden Bulk Downloader for Reliability and Distribution Readiness

**Feature Branch**: `001-harden-downloader`

**Created**: 2026-06-22

**Status**: Draft

**Input**: User description: "Harden the ChatGPT Bulk Downloader so downloads reliably deliver images plus metadata to organized subfolders matching documented behavior, ensure metadata exports are complete and trustworthy even on partial results, make image discovery reliable on all views without requiring manual pre-work by the user, provide clear non-blocking progress and error feedback during operations, bring all public documentation into exact alignment with actual behavior, add required assets and packaging hygiene for distribution, and capture key roadmap items as future work on a solid foundation."

## User Scenarios & Testing *(mandatory)*

<!--
  IMPORTANT: User stories should be PRIORITIZED as user journeys ordered by importance.
  Each user story/journey must be INDEPENDENTLY TESTABLE - meaning if you implement just ONE of them,
  you should still have a viable MVP (Minimum Viable Product) that delivers value.

  Assign priorities (P1, P2, P3, etc.) to each story, where P1 is the most critical.
  Think of each story as a standalone slice of functionality that can be:
  - Developed independently
  - Tested independently
  - Deployed independently
  - Demonstrated to users independently
-->

### User Story 1 - Reliable organized downloads matching documented behavior (Priority: P1)

A user on a ChatGPT Library folder or /images/ gallery page activates the bulk action. All collected images (and the accompanying metadata JSON) are delivered to an organized `chatgpt-images/` subfolder under their browser's default Downloads directory, using the platform's native download mechanisms when available. The experience is consistent whether or not the user has pre-scrolled the grid.

**Why this priority**: Subfolder organization for collected images and metadata is a core advertised value proposition that appears in the documentation. Delivering organized output consistently restores user trust that the product behaves exactly as described and documented.

**Independent Test**: Load a supported library folder or gallery page with 10-30 images, activate the bulk action once, and verify that files (images plus the accompanying metadata file) are delivered to the documented organized location under Downloads (with clear indication if the preferred subfolder could not be used). Repeat for the other surface type. Verifiable via the browser's download history view and the local filesystem; delivers value independently.

**Acceptance Scenarios**:

1. **Given** the user is on a `/library/d/...` page with visible images and the native downloads API is usable by the extension, **When** they click the bulk button, **Then** images are saved under `~/Downloads/chatgpt-images/` (with auto-numbering on collisions) and a metadata JSON is also placed there.
2. **Given** the native downloads API cannot be used (permission or context limitations), **When** the bulk action runs, **Then** files fall back to the default Downloads root but the user receives clear non-blocking indication of the location used.
3. **Given** a large set of images, **When** the bulk action runs, **Then** downloads are queued with reasonable concurrency and progress feedback so the browser does not appear frozen or overwhelmed.

---

### User Story 2 - Complete and trustworthy metadata export (Priority: P1)

When a user triggers a bulk download on a folder, the generated metadata JSON always contains the folder context, directory structure (when applicable), image nodes, and recent conversation timing information drawn from the same authenticated endpoints the ChatGPT web UI uses. The export succeeds and is useful even if some images could not be collected, and the contents accurately reflect what was requested (with clear indication of partial results or limits).

**Why this priority**: The metadata export is repeatedly called out as a key value proposition and the main reason users adopt the tool. Making the rich metadata claim true, complete, and observable (with clear partial-result handling) delivers the promised trustworthiness and usefulness of the archive.

**Independent Test**: Trigger the bulk action on a library folder or gallery page; inspect the produced metadata file and confirm it contains the folder/gallery context, associated directory and image details (when applicable), recent conversation or upload timing information, and base operation details. Separately trigger in a way that would cause partial data retrieval and confirm that any issues are recorded in the metadata file while the file itself is still produced and usable.

**Acceptance Scenarios**:

1. **Given** a valid library folder view, **When** the bulk action is triggered, **Then** the produced metadata file includes the folder context, directory structure details when applicable, image details for the view, recent conversation timing information, and base operation context.
2. **Given** any trigger (folder or gallery), **When** one or more metadata fetches fail or return non-OK, **Then** the JSON still contains the successful portions plus structured error markers for the failed parts, and the file is still written.
3. **Given** a user with more than 100 conversations, **When** bulk runs on a folder, **Then** the conversations section either contains a representative recent set or clearly documents its scope (e.g., "most recent 100"); full history is out of scope for a single activation.

---

### User Story 3 - Robust image discovery on lazy/virtualized and evolving ChatGPT views (Priority: P2)

A user activates the tool on a library images tab or the dedicated /images/ gallery (with or without prior manual scrolling). The extension discovers and collects the images that are logically present in the view, using the best available signals (API-derived lists where exposed + DOM), without requiring the user to manually pre-scroll large grids or fight virtualization.

**Why this priority**: "Handles lazy-loaded / virtualized grids with aggressive scrolling" and "Smart name extraction" are headline features. Reliable discovery without requiring manual user effort is essential for the tool to deliver on its basic promise consistently across real usage and over time.

**Independent Test**: On a supported view containing a moderate number of images (some not immediately visible on first load), activate the bulk action without manually preparing or scrolling the page in advance; verify that a high percentage of the logical images for that view are collected and given usable names (preferring originals or cues present in the view when available). Repeatable on different views; success can be measured by comparing the output count and naming quality against a careful manual preparation of the same view followed by individual saves.

**Acceptance Scenarios**:

1. **Given** a virtualized grid where many images are not yet in the DOM, **When** bulk runs, **Then** the tool performs the necessary loading steps and collects the images without the user having to pre-scroll.
2. **Given** images whose names appear in the UI as filenames or size badges (library) or prompt-like text (gallery), **When** collected, **Then** the saved filenames preserve the original or a close usable form (sanitized for filesystem safety) rather than generic numbered names.
3. **Given** a supported view where structured details about the images (such as from associated directory or upload information) are available alongside the visible content, **When** the bulk action runs, **Then** the collection uses those details for URLs, names, or completeness where possible, falling back to other available signals as needed for higher reliability.

---

### User Story 4 - Clear, non-blocking user experience and accurate documentation (Priority: P2)

Throughout the bulk operation the user sees live progress in the button or an in-page status area. Errors and partial results are reported without blocking the page (no alert() dialogs for normal or recoverable cases). After the work, the user has a clear summary. All public documentation (README usage, features, metadata description, limitations, Cloudflare note, download locations) accurately describes what the extension actually does.

**Why this priority**: Users must be able to trust that the tool works smoothly and that the public documentation accurately describes the experience. Clear, non-blocking feedback during operations (instead of disruptive dialogs) and exact alignment between claims and delivered behavior build confidence for everyday use and for reviewers or new adopters.

**Independent Test**: Trigger a bulk action that finds zero (or very few) images after the loading steps; verify a non-modal notice with guidance appears and the primary activation control returns to its ready state. Separately, compare the public documentation (especially usage steps, feature descriptions, metadata details, download locations, name behavior, Cloudflare notes, and limitations) against the actual observed behavior of the tool and confirm every claim is accurate or clearly qualified with any best-effort or partial-result semantics. Exercise both successful runs and cases with partial or no results.

**Acceptance Scenarios**:

1. **Given** normal operation with images found, **When** the action runs, **Then** the button text updates through phases (loading metadata, scrolling, downloading N images) and ends with a success summary that includes the output location.
2. **Given** a "no images after max load" situation (or Cloudflare interstitial), **When** the action completes, **Then** a non-blocking notice appears with actionable guidance and the button is re-enabled; metadata JSON may still have been produced.
3. **Given** any of the documented flows, **When** a user reads the README after the changes, **Then** the steps, button labels, expected output locations, metadata fields, and limitations match reality (with explicit notes on best-effort limits, fallback locations, and UI drift).

---

### User Story 5 - Distribution and maintenance readiness (Priority: P3)

The project can be packaged cleanly for GitHub releases and Chrome Web Store submission. It ships with proper icons, a compliant manifest, necessary store assets, and basic open-source hygiene (CHANGELOG, CONTRIBUTING, privacy statement, test instructions). The roadmap items for options page, ZIP export, and broader project/folder support are captured as future increments on the hardened foundation.

**Why this priority**: Users and potential adopters benefit from a reliably installable, documented, and supported version of the tool through standard channels. Closing packaging, asset, and hygiene gaps enables distribution and long-term maintenance while keeping the focus on the core reliability improvements.

**Independent Test**: Using the documented packaging process, produce a clean distributable package from the project. Load or install it in the target browser's extension environment and confirm that icons are present and correct, the description meets store limits, and the core functionality activates on supported pages. Separately verify that required supporting files exist (icons at the sizes needed for the platform, a privacy statement, contribution and change documentation, issue templates if applicable, and any store listing assets). Roadmap items such as options and ZIP export must be called out with acceptance criteria so they can be added later without reworking the core.

**Acceptance Scenarios**:

1. **Given** the extension package, **When** inspected in Chrome or the store dashboard, **Then** it declares 16/48/128 icons, a description ≤132 characters, and the required permissions with appropriate justification.
2. **Given** the documented packaging step is followed, **When** the distributable package is produced, **Then** it contains only the files required for the tool to run (entry point manifest, main script, icons, and supporting assets) and excludes development directories, source control, and tooling artifacts.
3. **Given** the project on GitHub, **When** a new user arrives, **Then** CONTRIBUTING.md, issue templates, CHANGELOG, and a simple privacy statement exist so they can understand how to contribute, report issues, and what data handling to expect.

---

### Edge Cases

- What happens when the page shows the Cloudflare "Just a moment..." challenge at activation time?
- How does the system behave on a library view that has no images (empty folder or non-image tab)?
- What happens on authentication errors (logged-out tab, expired session) or 429/5xx from the internal APIs?
- How are very large result sets (>500 images or huge nodes/conversations responses) handled without locking the UI or producing unusable downloads/JSON?
- How does filename sanitization and collision handling behave across multiple runs and mixed gallery + folder usage (reserved names, unicode, very long prompts)?
- What occurs if the ChatGPT UI changes a scroller class, image src domain pattern, or response shape for nodes/conversations?
- How does the extension surface (or avoid surfacing) the "multiple downloads" permission prompt in a user-friendly way?
- What is the behavior on shared links, archived items, or other surfaces that match the host but not the current library/images patterns?
- How are partial metadata + successful images (or vice-versa) summarized for the user and recorded in the JSON?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The extension MUST provide a single primary activation (floating button) on the supported ChatGPT Library folder and /images/ gallery surfaces that initiates collection of images plus metadata in one user gesture.
- **FR-002**: When the platform's standard download mechanisms are available and permitted, the tool MUST deliver the collected images and the accompanying metadata file into the documented organized subfolder under the user's Downloads directory (or a clearly communicated alternative location), using the mechanisms that produce the expected collision handling (such as numbered suffixes).
- **FR-003**: The tool MUST always produce a metadata file containing at minimum: operation timestamp, source location, folder or gallery context, directory structure information when applicable, image details for the requested view, and recent conversation or upload timing information drawn from the same sources that power the main ChatGPT experience. The file must be written even if some collection steps encounter issues.
- **FR-004**: Image collection MUST succeed for the logical contents of the target view (library folder images or gallery) even when not all items are immediately visible on page load; the collection process itself performs the necessary steps to surface the full logical set.
- **FR-005**: Name extraction for downloaded images MUST prefer original filenames or other cues present in the view or associated structured information when available, falling back gracefully while guaranteeing filesystem-safe, unique-within-run names and preserving appropriate extensions.
- **FR-006**: All data retrieval for the operation MUST use only the standard connections already established by the user's session with the ChatGPT service; no unrelated destinations or data sharing outside the user's explicit local downloads is permitted.
- **FR-007**: Metadata fetch failures and image collection shortfalls MUST be captured in the produced JSON with structured error information and must not prevent the JSON (or any successfully collected images) from being written.
- **FR-008**: The user interface during and after the operation MUST provide live non-blocking progress and status feedback and must never use intrusive blocking modal dialogs for normal operation, recoverable errors, or "nothing found" cases.
- **FR-009**: The extension MUST support the documented surfaces (`/library/*` with `/d/` ids and `?tab=images`, `/images/`) and button labeling must correctly reflect the current surface.
- **FR-010**: Documentation (primarily README) MUST accurately describe button behavior, output locations (including fallback), metadata contents and their scope/limitations, name extraction behavior, Cloudflare interaction requirements, and any best-effort or partial-result semantics.
- **FR-011**: The packaged tool MUST include icons at the sizes required by the target platform and distribution channel, properly declared so they are visible and functional in the browser's extension management interface.
- **FR-012**: A clean packaging process MUST exist that produces a distributable package containing only the files needed for the tool to run and excluding development tooling, source control metadata, and project specification artifacts.
- **FR-013**: The tool MUST continue to operate with a minimal, narrowly-scoped set of permissions focused only on the target service and the downloads the user explicitly initiates; any expansion of permissions requires explicit justification and review against the privacy and least-privilege principles.
- **FR-014**: The system MUST tolerate common transient conditions (such as service interstitial challenges that resolve with user interaction, rate limiting, incomplete initial page content, or empty results) and provide actionable guidance rather than silent or broken failure.
- **FR-015**: Future increments (options page for target folder name and metadata toggles, optional ZIP bundling of a folder + metadata, support for additional project/custom folder surfaces) MUST be designed as additive layers on the hardened core so they can be implemented independently after the P1/P2 stories.

*No [NEEDS CLARIFICATION] markers at this time; all major scope decisions have reasonable defaults based on documented intent and user value.*

### Non-Functional Requirements

- **FR-016**: Collection, discovery, and metadata retrieval mechanisms MUST continue to deliver usable (full or partial) results, with clear scope and error information in the metadata file and user feedback, even after changes to the external service's views, loading behavior, or data sources. The design must support adaptation (for example via configurable or versioned signals and fallbacks) without breaking the core guarantee of a usable metadata file.
- **NFR-001**: Collection and data retrieval operations MUST remain responsive and non-blocking for the user even on views with several hundred images or large associated metadata responses; reasonable concurrency limits and progress visibility are required so the browser UI does not appear frozen.
- **NFR-002**: Retrieval steps for metadata and images MUST incorporate basic resilience measures (such as bounded retries with backoff for transient service responses, and validation that expected data shapes or presence indicators are present before trusting results) so that partial or errored conditions are observable rather than silent.
- **NFR-003**: Filename handling and output organization MUST succeed reliably (usable names, no data loss beyond documented collision behavior) across repeated activations, mixed sources (library + gallery), unicode characters, long names, and reserved filesystem names.

### Dependencies and External Factors

- The service's internal data sources for folders, directories, nodes, conversations, and uploads are expected to remain available for authenticated session-based access in the same manner the web experience uses them; changes to response shapes, authentication, rate limits, or availability are treated as best-effort with explicit documentation of scope.
- Browser platform constraints for extension packaging, the downloads API (including when it requires a background context and messaging), permission prompts, and subfolder organization behavior apply and must be accommodated within the narrow permissions model.
- Official guidelines and requirements from the target distribution channel (icon sizes/padding, description length limits, privacy policy expectations, store listing assets such as screenshots and promotional images, review considerations for bulk actions or internal data access) are inputs that the packaging and asset work must satisfy.
- User-visible browser behaviors around multiple concurrent downloads, file collision naming, and extension management interface display of icons and metadata are part of the expected experience.

### Key Entities *(include if feature involves data)*

- **DownloadSession**: Represents one activation of the bulk button. Key attributes: source URL + folder/gallery context, timestamp, collected image references (with final local names and source URLs), produced metadata archive reference, outcome summary (counts, partial flags).
- **Metadata file**: The structured data file emitted alongside the images. Contains the operation context, folder or gallery details, associated directory and image information (when applicable), recent conversation or upload timing data, and any notes about partial or errored retrieval steps. It must be self-describing regarding its completeness and scope.
- **Discovered image**: An image selected for download during the operation. Includes its source location from the view, a preferred local filename (sanitized for safety), and any available cues from the page or associated information used to choose or qualify it.
- **View context**: Information identifying the target scope of the operation (a specific library folder or the gallery surface), used to drive relevant metadata retrieval and to organize or label the output.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Activating the bulk action on a supported library folder or gallery page that contains images always produces a metadata file containing the required context plus at least the recent conversation or upload timing data, even in cases where zero images were collected or some retrieval steps encountered issues.
- **SC-002**: When the platform's standard download organization features are available, 100% of files (images plus the metadata file) from a successful run land inside the documented organized subfolder (or clearly communicated equivalent location); any fallback to a different location is accompanied by explicit user indication of the actual destination used.
- **SC-003**: On typical supported views with a moderate number of images (including items not visible on initial load), a single activation without the user manually preparing the view in advance captures at least 80% of the images that would be obtained by a careful full preparation of the same view followed by individual saves. Verification uses a repeatable procedure defined during planning.
- **SC-004**: No workflow-interrupting modal dialogs are shown to the user for any normal, error, or empty-result outcome of the bulk action; all feedback is delivered via visible, non-blocking status updates in the page or primary control.
- **SC-005**: After the alignment work, every major claim in the public documentation (features list, usage steps, metadata file description and contents, privacy & security section, download locations and fallbacks, name extraction behavior, Cloudflare interaction notes, and limitations) is verifiably accurate when tested against the running tool (with explicit qualifications for any best-effort or partial-result behavior).
- **SC-006**: A clean distributable package can be produced that loads successfully in the target browser extension environment, displays the included icons correctly in the extension management interface, has a store-compliant short description, and contains no development-only directories or artifacts.
- **SC-007**: The tool handles key common transient conditions (such as a service interstitial that resolves after user interaction, or a partial data retrieval) by completing with useful output (including the metadata file where applicable) and clear guidance rather than leaving the primary control in a broken state or providing no user-visible indication.

## Assumptions

- The primary users are logged-in ChatGPT web users who want to bulk-archive generated images + timing/folder metadata from their own Library or gallery without leaving the browser or using third-party services.
- The service's standard data sources for library, folder, and gallery information will remain usable via the user's active session with the service. The tool is best-effort with respect to changes in those sources and will document its scope and any known limitations or drift tolerance.
- "Full history" or complete conversation text is out of scope for the initial metadata export; "recent" (current practical limit around 100) plus folder-specific structure is the scope for a one-click activation.
- The tool will remain a pure browser-based client extension with no external servers or telemetry, storing nothing beyond the local artifacts the user explicitly requests via downloads.
- Any permission warnings presented by the browser at install time, and any review scrutiny for bulk operations or use of internal service data sources on the target domain, are acceptable provided the permissions remain narrowly scoped, the client-only nature is preserved, and clear disclaimers plus a privacy statement are present.
- Icon and store asset creation will follow official guidelines for the target distribution channel (appropriate sizing, padding, and style for visibility on light/dark themes and in management interfaces); the spec does not prescribe the exact visual design.
- Options page, ZIP export, and expanded project/folder support are valuable roadmap items but are additive; the hardened core (P1/P2 stories) must stand alone as a useful, trustworthy release.
- Existing users of the initial version will accept minor behavior changes (such as better visibility of partial results, clearer progress, and more accurate documentation) as improvements; the organized download location behavior will be presented as making the documented experience real.
- No new broad permissions are required for the core scope of this feature; any future options or advanced capabilities that would need additional permissions (such as storage) will be added only with clear justification and adherence to least-privilege principles.

