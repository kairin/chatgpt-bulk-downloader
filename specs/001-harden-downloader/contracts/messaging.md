# Messaging Contract: Content Script <-> Background Service Worker

**Context**: This harden introduces a background service worker (`background.js`) solely to perform privileged `chrome.downloads` operations that content scripts cannot do reliably for subfolder paths. All privileged work is triggered by messages from `content.js`.

**Principles** (from constitution):
- Minimal surface (only the messages needed for P1 subfolder + feedback).
- No new permissions.
- Observable errors.
- Resilience (timeouts, lastError handling).

## Message Types (from content.js to background)

All messages are sent via `chrome.runtime.sendMessage({ type: "...", payload: ... })`.

### `START_DOWNLOADS`
**Purpose**: Trigger a batch of image downloads (plus the metadata JSON is handled in content, but worker can also be used for it in future).

**Payload**:
```ts
{
  sessionId: string,
  folder: string,           // e.g. "chatgpt-images"
  items: Array<{
    url: string,
    name: string,           // already sanitized + unique within session
  }>,
  // Optional future: metadataJsonUrl or data for worker to also write JSON
}
```

**Response** (immediate ack):
```ts
{ ok: true, queued: number }
```

Background must:
- Validate payload (no external URLs outside expected CDNs if possible, safe names).
- Enqueue with bounded concurrency (recommend 3-5).
- Report progress via reverse messages (see below).

### (Future) `CANCEL_SESSION` (optional for this plan)
For long-running operations.

## Messages from background to content (via chrome.runtime.onMessage or port if needed)

Use `chrome.runtime.sendMessage` from worker (content listens with `chrome.runtime.onMessage`).

### `DOWNLOAD_PROGRESS`
```ts
{
  type: 'DOWNLOAD_PROGRESS',
  payload: {
    sessionId: string,
    completed: number,
    total: number,
    lastName?: string,
    errors?: number
  }
}
```

Sent periodically or on each completion/error.

### `DOWNLOAD_COMPLETE`
```ts
{
  type: 'DOWNLOAD_COMPLETE',
  payload: {
    sessionId: string,
    stats: { succeeded: number, failed: number },
    finalLocation: string   // the subfolder or note about fallback
  }
}
```

## Error Handling
- Worker must always catch `chrome.runtime.lastError` and `chrome.downloads` errors.
- Report structured errors back (never silent).
- Content must handle worker not present (fallback to old blob path, with warning in UI/JSON).
- Timeouts: worker should have per-item or overall timeout for very slow CDN items.

## Security / Privacy
- Messages contain only public CDN URLs and user-chosen safe names.
- No session tokens or page content passed to worker (worker only needs the download URLs).
- Worker performs no network fetches itself in this design.

## Versioning
Add `contractVersion: 1` in payloads. Increment on breaking changes (rare for this internal contract).

This contract is intentionally tiny. Full implementation (queue logic, listeners) goes in `background.js` (tasks phase). Content side changes in `content.js`.

If options or ZIP are added later, this contract will be extended (additive, per spec FR-015).