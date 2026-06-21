Placeholder for extension icons.

Current state: No PNG icons included (removed to prevent issues with automated documentation review tools that use vision models requiring minimum image dimensions/pixel counts).

Before:
- GitHub release packaging
- Chrome Web Store submission
- Any distribution

Replace this directory with real icons:
- icon16.png (16x16)
- icon48.png (48x48)
- icon128.png (128x128)

Recommended: Use a simple download-arrow-on-green design or ChatGPT-inspired theme. Update manifest.json to include:

"icons": {
  "16": "icons/icon16.png",
  "48": "icons/icon48.png",
  "128": "icons/icon128.png"
}

See also the main README.md "Optional: Add Icon" and development notes.