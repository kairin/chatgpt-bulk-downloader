# Data Model: Harden Bulk Downloader for Reliability and Distribution Readiness

**Feature**: 001-harden-downloader
**Derived from**: spec.md User Stories, FRs, Key Entities, NFRs + research.md

## Entities

### DownloadSession
Represents one user activation of the bulk button.

- **id**: string (e.g. timestamp + folder short id, for logging/correlation)
- **startedAt**: ISO timestamp
- **url**: string (full page URL)
- **folderId**: string | null (from /d/ path)
- **isImagesPage**: boolean
- **title**: string (document.title at start)
- **images**: array of ImageReference (collected for download)
- **metadata**: MetadataArchive (the JSON content that will be written)
- **stats**: {
    imagesAttempted: number,
    imagesSucceeded: number,
    imagesFailed: number,
    metadataFetchErrors: number
  }
- **outcome**: 'success' | 'partial' | 'failed' (high-level for UI/JSON)
- **outputLocation**: string (the subfolder or fallback path reported to user)

**Validation rules** (from spec):
- stats must be populated even on partials.
- metadata file must always be produced if any retrieval started (FR-003, FR-007).
- outcome must reflect presence of errors in metadata.

**State transitions**: created (on button click) → collecting (scroll + fetches) → downloading (worker queue) → complete (UI reset + summary). Never blocks the page.

### ImageReference
A single image selected for download.

- **sourceUrl**: string (absolute CDN URL from img.src or API node)
- **preferredName**: string (extracted or generated, before final sanitization)
- **finalName**: string (after sanitization + uniqueness within session + extension)
- **origin**: 'api' | 'dom' | 'api+dom' (for diagnostics/resilience)
- **sizeHint**: string | null (from UI badge or API if available)
- **status**: 'pending' | 'downloading' | 'succeeded' | 'failed'
- **error**: string | null (lastError or reason if failed)

**Validation**:
- sourceUrl must be http(s) from allowed CDN patterns (or API-provided).
- finalName must be filesystem-safe (no reserved, control, excessive length, proper ext).
- Must dedup by canonical URL within session.

**Relationships**: Belongs to one DownloadSession. Contributes to session.stats.

### MetadataArchive
The JSON document written next to images (the "rich metadata" artifact).

- **scrapedAt**: ISO
- **url**: string
- **folderId**: string | null
- **isImagesPage**: boolean
- **title**: string
- **directoryPath**: object | {error: ...} (from API when folderId present)
- **nodes**: object | {error: ...}
- **imageNodes**: object | {error: ...}
- **conversations**: object | {error: ...} (paginated recent list)
- **recentUploadedImages**: object | {error: ...} (gallery only)
- **downloadStats**: { attempted, succeeded, failed, ... } (populated by worker)
- **errors**: array of structured retrieval issues (phase, status, message)
- **_schemaVersion**: number (for future evolution of the archive format)

**Validation rules** (from FR-003, NFR-002, US2):
- Must be valid JSON.
- Must be written even if image collection yields 0 or partial (self-describing about completeness).
- conversations / nodes must be fully paginated (no hard 100 limit).
- All top-level API results must either contain data or an error object.

**Relationships**: 1:1 with DownloadSession (embedded or written as the metadata file).

### FolderContext / ViewContext (lightweight)
- **type**: 'library-folder' | 'gallery'
- **id**: string | null
- **displayName**: string | null (from title or API path)

Used to decide which API calls to make and how to name the output file (e.g. `chatgpt-folder-xxx-metadata.json`).

## Cross-cutting Rules (from NFRs + constitution)
- All entities must support partial success (errors recorded, not thrown).
- Filename logic (in ImageReference) must implement NFR-003 (reserved names, unicode safety, length, cross-run stability).
- No entity holds raw secrets or session tokens (only uses existing page credentials for fetches).

This model is intentionally simple (plain objects passed via messages + written as JSON) to satisfy constitution V (minimalism, small surface, no unnecessary abstractions for a small extension). Implementation details (exact message shapes, worker queue) belong in contracts/ and tasks.md.