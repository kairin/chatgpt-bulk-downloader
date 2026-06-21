# ChatGPT Bulk Downloader

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-blue)](https://developer.chrome.com/docs/extensions/mv3/)

One-click Chrome extension to **bulk download images** from any ChatGPT Library folder or the dedicated `/images/` gallery, **plus a rich metadata JSON** containing conversation dates, update times, and the full folder/directory structure.

No more clicking individual "Download" buttons or selecting in batches. Everything stays in your browser using your existing ChatGPT session.

## Features

- **Bulk image download** from:
  - Library folders (`/library/d/...`)
  - Images gallery (`/images/`)
- **Metadata JSON export** (the key new feature):
  - Conversation `create_time` / `update_time`
  - Folder & directory structure (via the same `files/library` APIs the site uses)
  - Image nodes with their metadata
  - Full recent conversations list
- Downloads go into `~/Downloads/chatgpt-images/` (organized subfolder, just like popular exporter tools)
- Smart name extraction (preserves original filenames like `vlcsnap-...png`, `image(1289).png` when available; falls back gracefully on the gallery)
- Handles lazy-loaded / virtualized grids with aggressive scrolling
- Client-side only — no servers, no data exfiltration
- Works with both the native `chrome.downloads` API (subfolders) and fallback

## Installation

### As Unpacked Extension (recommended for now)

1. Clone this repo or download the source ZIP.
2. Open Chrome and go to `chrome://extensions/`
3. Enable **Developer mode** (top right)
4. Click **Load unpacked**
5. Select the `chatgpt-bulk-downloader` folder
6. Pin the extension if desired (it shows no toolbar icon — it only injects on `chatgpt.com`)

### Future

We plan to publish to the Chrome Web Store once we have a few more users and polish.

## Usage

1. Go to a ChatGPT Library folder, for example:
   - `https://chatgpt.com/library/d/6a37b386ee388191bc2b11881e014622?tab=images`
   - Or simply `https://chatgpt.com/images/`
2. If you see the Cloudflare "Just a moment..." challenge, move your mouse, scroll naturally, or click around in the tab until the real content appears (this is normal for automation detection).
3. (Optional but recommended) Scroll down the grid to load more images.
4. Click the green floating button in the bottom-right:
   - `⬇️ Bulk Download Folder (+JSON)` on library pages
   - `⬇️ Bulk Download Images (+JSON)` on the gallery
5. The extension will:
   - Scroll aggressively to load lazy/virtualized images
   - Collect all qualifying images from the OpenAI CDN
   - Download a `*-metadata.json` file with full folder + conversation timing data
   - Trigger the image downloads (staggered to be browser-friendly)
6. Allow the "multiple downloads" prompt if Chrome shows it.
7. Everything lands in `~/Downloads/chatgpt-images/`

You can repeat the process on different folders — files with the same name will get `(1)`, `(2)`, etc.

## The Metadata JSON

This is the main reason many people wanted this tool.

When you trigger a bulk download on a library folder, you also get a file like:

- `chatgpt-folder-6a37b386-metadata.json`

It contains (raw from ChatGPT's own APIs):

- `directoryPath` — info about the current folder
- `nodes` — the full file/folder tree under that directory
- `imageNodes` — just the images (with sizes, original names, timestamps if available)
- `conversations` — recent conversations with `create_time`, `update_time`, titles, etc.
- `recentUploadedImages` (on the `/images/` gallery)
- Context (URL, timestamp, folder ID)

This lets you reconstruct exactly when conversations happened and how the folders are organized — perfect for archiving, searching, or building your own tools on top of the data.

## Privacy & Security

- **Everything runs in your browser** on `chatgpt.com` pages only.
- We only use the exact same authenticated API endpoints that the ChatGPT web UI already calls (`/backend-api/files/library/...`, `/backend-api/conversations`, etc.).
- No external servers. No telemetry. No analytics.
- Your images and metadata never leave your machine except for the normal download to your local `Downloads` folder.
- Source code is fully open — audit it yourself.

## Development

```bash
git clone https://github.com/your-username/chatgpt-bulk-downloader.git
cd chatgpt-bulk-downloader
# Edit manifest.json + content.js
# Then Load unpacked in chrome://extensions/
```

### Updating the extension after changes

Just edit the files and click the **reload** icon on the extension card in `chrome://extensions/`.

### Building a .zip for distribution

You can manually zip the folder (excluding `.git`, `node_modules`, etc.) or use any Chrome extension packager.

## Roadmap / Ideas

- [ ] Publish to Chrome Web Store
- [ ] Add a small options page (choose target folder name, include full conversation text, etc.)
- [ ] Optional ZIP export of a whole folder + metadata
- [ ] Better icon set + store listing assets
- [ ] Support for more ChatGPT "projects" / custom folders

Pull requests and issues are very welcome!

## License

MIT — see [LICENSE](LICENSE).

## Credits

Built iteratively with the help of AI tooling while solving real user pain around bulk-exporting ChatGPT libraries and generated images.

If you find it useful, star the repo and share it! 

---

**Note**: This is an unofficial tool and is not affiliated with OpenAI. Use at your own risk. ChatGPT's UI and APIs can change at any time (we try to stay resilient by using the same endpoints the site uses).