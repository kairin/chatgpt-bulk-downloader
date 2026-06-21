/**
 * ChatGPT Bulk Downloader
 *
 * Pure client-side Manifest V3 Chrome extension.
 * Adds a floating button on https://chatgpt.com/library/* and /images/*.
 *
 * - Bulk downloads images from Library folders and the /images/ gallery
 * - Also downloads a metadata JSON with:
 *     • conversation create_time / update_time
 *     • folder & directory structure (files/library/nodes + directories/path)
 *     • conversations list
 * - Requires explicit user choice of subfolder via a modal "folder location chooser" before downloading. The chosen name (e.g. chatgpt-images or my-exports/2024) is used under the browser's default Downloads directory. A "Show my Downloads folder" button helps the user verify the location.
 *
 * Everything uses only your existing session + the official APIs the ChatGPT web UI already calls.
 * No external servers, no tracking.
 */

/**
 * Safe wrapper for chrome.runtime.sendMessage.
 * In normal content script execution this is always available, but some automation
 * / synthetic event / cross-world invokes (e.g. during testing) can cause the handler
 * closure to see an undefined chrome. This prevents uncaught errors, leaves the UI
 * (button state) consistent, and lets the modal still appear with a default value.
 */
/** Extract OpenAI file id from estuary/download URLs (used for dedup + full-res lookup). */
function extractFileId(url) {
  const m = String(url || '').match(/file_([a-f0-9]+)/i);
  return m ? m[1] : null;
}

function isThumbnailEstuaryUrl(url) {
  return /%23thumbnail|#thumbnail/i.test(String(url || ''));
}

/**
 * ChatGPT /images/ caches full-resolution signed PNG URLs in localStorage.
 * Grid <img> tags only expose 512px WebP thumbnails — same URLs the native Save
 * button does NOT use. Prefer these entries for original-quality downloads.
 */
function collectRecentImagesFromStorage() {
  try {
    const raw = localStorage.getItem('oai/apps/recentImages');
    if (!raw) return [];
    const data = JSON.parse(raw);
    const items = Array.isArray(data.items) ? data.items : [];
    return items.map((item, idx) => {
      const url = item.url || '';
      if (!url.startsWith('http') || !url.includes('/estuary/content') || !url.includes('sig=')) return null;
      if (isThumbnailEstuaryUrl(url)) return null;
      let name = (item.title || item.prompt || `chatgpt-img-${String(idx + 1).padStart(4, '0')}`)
        .replace(/[^a-z0-9._-]/gi, '_').replace(/_{2,}/g, '_').substring(0, 80);
      name = name.replace(/\.[^.]+$/, '') + '.png';
      return {
        url,
        name,
        originalSrc: item.thumbnail || item.encodings?.thumbnail?.path || url,
        fileId: extractFileId(url),
        origin: 'recentImages-storage'
      };
    }).filter(Boolean);
  } catch (e) {
    console.warn('[ChatGPT Bulk] recentImages localStorage parse failed:', e);
    return [];
  }
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error('FileReader failed'));
    reader.readAsDataURL(blob);
  });
}

function safeSendMessage(msg, callback) {
  try {
    if (typeof chrome !== 'undefined' && chrome.runtime && typeof chrome.runtime.sendMessage === 'function') {
      chrome.runtime.sendMessage(msg, callback);
    } else {
      console.warn('[ChatGPT Bulk] chrome.runtime.sendMessage unavailable in current execution context (may be synthetic/test trigger).');
      if (typeof callback === 'function') setTimeout(() => callback(null), 0);
    }
  } catch (e) {
    console.warn('[ChatGPT Bulk] sendMessage threw:', e);
    if (typeof callback === 'function') setTimeout(() => callback(null), 0);
  }
}

function addBulkDownloadButton() {
  if (document.getElementById('cgpt-bulk-btn')) return; // idempotent guard: prevents repeated remove/create churn from SPA mutations (the cause of load/reload browser crashes)

  const btn = document.createElement('button');
  btn.id = 'cgpt-bulk-btn';
  const pageLabel = location.pathname.includes('/images') ? 'Images' : 'Folder';
  btn.textContent = `⬇️ Bulk Download ${pageLabel} (+JSON)`;
  btn.style.cssText = `
    position: fixed; 
    bottom: 24px; 
    right: 24px; 
    z-index: 999999;
    background: #10a37f; 
    color: white; 
    border: none; 
    padding: 12px 18px;
    border-radius: 9999px; 
    font-size: 14px; 
    font-weight: 600;
    box-shadow: 0 4px 12px rgba(0,0,0,0.25); 
    cursor: pointer;
    font-family: system-ui, -apple-system, sans-serif;
  `;

  btn.onclick = async () => {
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = '📁 Choose download location...';

    try {
      // === MUST REQUIRE USER TO CHOOSE LOCATION ===
      // This launches the folder location chooser modal.
      // The user explicitly confirms the subfolder before any downloads start.
      const chosenFolder = await chooseDownloadLocation();

      if (!chosenFolder) {
        // User canceled the location picker
        btn.textContent = originalText;
        btn.disabled = false;
        return;
      }

      // Use the user-chosen folder for this run (overrides any default)
      const DOWNLOAD_FOLDER = chosenFolder;

      btn.textContent = '⏳ Loading images + metadata...';

    const main = document.querySelector('main') || document.body;
    const isImagesPage = location.pathname.startsWith('/images');

    // Download metadata JSON for conversation dates/times and folder structure.
    // Uses the same backend APIs the ChatGPT web UI calls (files/library/* for directories/folders + conversations list).
    // When the page context is authenticated, these calls succeed and the JSON is saved next to the images.
    let meta = {
      scrapedAt: new Date().toISOString(),
      url: location.href,
      folderId: null,
      isImagesPage: isImagesPage,
      title: document.title
    };
    try {
      const folderIdMatch = location.pathname.match(/\/d\/([a-f0-9-]+)/i);
      meta.folderId = folderIdMatch ? folderIdMatch[1] : null;

      const apiCalls = [];
      const folderId = meta.folderId;
      if (folderId) {
        apiCalls.push(
          fetch(`/backend-api/files/library/directories/path?directory_id=${folderId}`, {credentials: 'include'})
            .then(r => r.ok ? r.json() : {error: r.status}).then(d => ({ directoryPath: d })).catch(() => ({}))
        );
        apiCalls.push(
          fetch(`/backend-api/files/library/nodes?parent_directory_id=${folderId}`, {credentials: 'include'})
            .then(r => r.ok ? r.json() : {error: r.status}).then(d => ({ nodes: d })).catch(() => ({}))
        );
        apiCalls.push(
          fetch(`/backend-api/files/library/nodes?parent_directory_id=${folderId}&categories=image`, {credentials: 'include'})
            .then(r => r.ok ? r.json() : {error: r.status}).then(d => ({ imageNodes: d })).catch(() => ({}))
        );
      }
      // General conversations list (gives create_time / update_time for folders/conversations)
      apiCalls.push(
        fetch('/backend-api/conversations?offset=0&limit=100&order=updated&is_archived=false&hide_snorlax=true', {credentials: 'include'})
          .then(r => r.ok ? r.json() : {error: r.status}).then(d => ({ conversations: d })).catch(() => ({}))
      );
      // Recent images on /images/ page too -- use image_gen endpoint which provides the full signed original asset URLs (estuary/content with sig) for PNG originals
      if (isImagesPage) {
        apiCalls.push(
          fetch('/backend-api/my/recent/image_gen?limit=100', {credentials: 'include'})
            .then(r => r.ok ? r.json() : {error: r.status}).then(d => ({ recentImageGen: d })).catch(() => ({}))
        );
        // keep the old one as fallback (may 401)
        apiCalls.push(
          fetch('/backend-api/my/recent/uploaded_images?limit=50&images_app_only=true', {credentials: 'include'})
            .then(r => r.ok ? r.json() : {error: r.status}).then(d => ({ recentUploadedImages: d })).catch(() => ({}))
        );
      }

      const apiResults = await Promise.all(apiCalls);
      apiResults.forEach(res => Object.assign(meta, res));

      // Trigger JSON download (use chrome.downloads for subfolder if possible, else blob)
      const jsonStr = JSON.stringify(meta, null, 2);
      const jsonFilename = folderId 
        ? `chatgpt-folder-${folderId.substring(0,8)}-metadata.json` 
        : `chatgpt-${isImagesPage ? 'images' : 'library'}-metadata.json`;

      // Send JSON download to background worker (better path handling + consistent with images)
      safeSendMessage({
        action: 'performDownloads',
        items: [{ url: 'data:application/json;charset=utf-8,' + encodeURIComponent(jsonStr), name: jsonFilename }],
        folder: DOWNLOAD_FOLDER
      });
      console.log('[ChatGPT Bulk] Metadata JSON requested via background for', jsonFilename);
    } catch (e) {
      console.warn('[ChatGPT Bulk] Metadata JSON fetch failed (will still do images):', e);
    }

    // Scroll to load lazy images - more passes + try common scroll containers for grids on /images/ and library
    for (let i = 0; i < 25; i++) {
      main.scrollTop = main.scrollHeight;
      await new Promise(r => setTimeout(r, 350));
      // Try several possible scrollables (masonry/grid virtual lists often use these)
      document.querySelectorAll('[class*="overflow-auto"], [class*="overflow-y"], [class*="scroll"], [style*="overflow"]').forEach(el => {
        if (el.scrollHeight > el.clientHeight) el.scrollTop = el.scrollHeight;
      });
      // Also the images page often has a specific scroller
      const gridScroller = document.querySelector('[class*="images"] [class*="overflow"], main > div > div');
      if (gridScroller) gridScroller.scrollTop = gridScroller.scrollHeight || 0;
    }

    // Find photos: large <img> from OpenAI CDN (works for both library folders and the /images gallery)
    const allImgs = Array.from(main.querySelectorAll('img[src]'));
    const photoImgs = allImgs.filter(img => {
      const src = img.src || '';
      const w = img.naturalWidth || img.width || img.clientWidth || 0;
      const h = img.naturalHeight || img.height || img.clientHeight || 0;
      const isLarge = (w > 80 || h > 80);
      const isOaiImg = src.startsWith('http') &&
             (src.includes('oaiusercontent') || 
              src.includes('files.oaiusercontent') || 
              src.includes('cdn.openai') ||
              src.includes('chatgpt.com/backend-api/estuary') ||  // seen in some renders
              src.includes('chatgpt'));
      return isOaiImg && isLarge;
    });

    // Dedup + extract names from nearby text (filenames like "vlcsnap-...png" in library; on /images/ often prompts or no ext, so fallback gracefully)
    const seen = new Set();
    const downloads = [];
    photoImgs.forEach((img, i) => {
      if (seen.has(img.src)) return;
      seen.add(img.src);
      let name = `chatgpt-${isImagesPage ? 'img' : 'image'}-${String(i+1).padStart(4, '0')}`;
      let el = img;
      for (let p = 0; p < 8 && el; p++) {
        const txt = (el.textContent || '').trim();
        // filename with ext
        let match = txt.match(/([^\s"'\\/]+\.(?:png|jpg|jpeg|webp|gif))/i);
        if (match) {
          name = match[1].replace(/[^a-z0-9._-]/gi, '_');
          break;
        }
        // size badges in library UI
        const sizeMatch = txt.match(/([A-Z]+)\s*•\s*([\d.]+)\s*(KB|MB)/i);
        if (sizeMatch) {
          name = `${sizeMatch[1]}_${String(i+1).padStart(3,'0')}`.replace(/[^a-z0-9._-]/gi, '_');
          break;
        }
        // On /images/ try to grab a short prompt-like phrase as name base (first 40 chars alphanum)
        if (isImagesPage && txt.length > 8 && txt.length < 200) {
          const promptish = txt.replace(/[^a-z0-9 ]/gi, ' ').trim().replace(/\s+/g, '_').substring(0, 50);
          if (promptish.length > 5) {
            name = `img_${promptish}`;
            break;
          }
        }
        el = el.parentElement;
      }
      let downloadUrl = img.src;
      // Only override to our old /files/download construction if we don't already have a good signed estuary URL from API.
      // The signed /estuary/content ones (with sig=) directly serve the original PNG.
      const isAlreadySigned = downloadUrl.includes('/estuary/content') && downloadUrl.includes('sig=');
      if (!isAlreadySigned) {
        const fileIdMatch = downloadUrl.match(/file_([a-f0-9]+)/i);
        if (fileIdMatch) {
          downloadUrl = `https://chatgpt.com/backend-api/files/download/file_${fileIdMatch[1]}`;
        } else if (downloadUrl.includes('#thumbnail')) {
          // Fallback de-thumbnail
          downloadUrl = downloadUrl.replace(/#thumbnail[^#]*/, '');
        }
      }
      if (!/\.(png|jpg|jpeg|webp|gif)$/i.test(name)) {
        const extMatch = downloadUrl.match(/\.(\w+)(?:\?|$)/);
        // Default to png for "original" assets (many uploads are PNG; WebP is often the compressed display version)
        name += '.' + (extMatch ? extMatch[1] : 'png');
      }
      // Ensure unique
      if (downloads.some(d => d.name === name)) {
        const ext = name.match(/\.[^.]+$/) || ['.png'];
        name = name.replace(/\.[^.]+$/, '') + `-${i+1}` + ext;
      }
      // Force .png name for full quality original photo delivery (conversion in bg if needed)
      name = name.replace(/\.[^.]+$/, '') + '.png';
      downloads.push({ url: downloadUrl, name, originalSrc: img.src, fileId: extractFileId(downloadUrl) || extractFileId(img.src) });
    });

    // Prefer structured data from the metadata fetches (imageNodes for folders, recentUploadedImages for /images/).
    // This makes collection work even on virtualized views where not all <img> are in DOM yet.
    // Falls back to (or supplements) the DOM walk above. Matches research + plan decisions.
    const apiImageCandidates = [];
    const tryAddFrom = (list, defaultPrefix) => {
      if (!list) return;
      const arr = Array.isArray(list) ? list : (list.data || list.nodes || list.items || []);
      (Array.isArray(arr) ? arr : []).forEach((item, idx) => {
        // Common shapes seen in OpenAI file/library responses
        const url = item.url || item.file_url || item.src || item.download_url ||
                    (item.asset && (item.asset.url || item.asset.src)) ||
                    (item.image && (item.image.url || item.image.src)) || '';
        if (!url || !url.startsWith('http')) return;
        // Strict origin allowlist (fixes loose substring that Codacy-style scanners flag).
        // Only accept known OpenAI/ChatGPT CDN + estuary paths from the site's own responses.
        let allowed = false;
        try {
          const u = new URL(url);
          const host = u.hostname.toLowerCase();
          const path = u.pathname || '';
          if (host.endsWith('.oaiusercontent.com') ||
              host === 'cdn.openai.com' ||
              host.endsWith('.openai.com') ||
              (host === 'chatgpt.com' && path.includes('/backend-api/estuary')) ||
              host.endsWith('.chatgpt.com')) {
            allowed = true;
          }
        } catch (e) {}
        if (!allowed) return;
        let downloadUrl = url;
        // Only override if we don't have a good signed estuary URL (from recentImageGen etc).
        // Those already point to the original full-quality asset (usually PNG).
        const isAlreadySigned = downloadUrl.includes('/estuary/content') && downloadUrl.includes('sig=');
        if (!isAlreadySigned) {
          const fileIdMatch = downloadUrl.match(/file_([a-f0-9]+)/i) || (item.id && item.id.match(/file_([a-f0-9]+)/i));
          if (fileIdMatch) {
            downloadUrl = `https://chatgpt.com/backend-api/files/download/file_${fileIdMatch[1] || item.id}`;
          } else if (downloadUrl.includes('#thumbnail')) {
            // Fallback de-thumbnail
            downloadUrl = downloadUrl.replace(/#thumbnail[^#]*/, '');
          }
        }
        let name = item.name || item.filename || item.title || item.prompt || item.alt ||
                   (item.asset && item.asset.name) || `${defaultPrefix}-${String(idx+1).padStart(4,'0')}`;
        // quick sanitize
        name = name.replace(/[^a-z0-9._-]/gi, '_').replace(/_{2,}/g, '_');
        if (!/\.(png|jpg|jpeg|webp|gif)$/i.test(name)) {
          const m = downloadUrl.match(/\.(\w+)(?:\?|$)/);
          // Default to png for "original" assets (many uploads are PNG; WebP is often the compressed display version)
          name += '.' + (m ? m[1] : 'png');
        }
        // Force .png name for full quality original photo delivery (conversion in bg if needed)
        name = name.replace(/\.[^.]+$/, '') + '.png';
        apiImageCandidates.push({ url: downloadUrl, name, origin: 'api', originalSrc: url });
      });
    };
    if (meta.imageNodes) tryAddFrom(meta.imageNodes, 'api-image');
    if (meta.recentImageGen) tryAddFrom(meta.recentImageGen, 'api-gen');
    if (meta.recentUploadedImages) tryAddFrom(meta.recentUploadedImages, 'api-upload');

    // /images/: full-res signed PNG URLs live in localStorage (what the native Save button uses).
    const storageImages = isImagesPage ? collectRecentImagesFromStorage() : [];

    // Merge by file id: storage (full PNG) > API > DOM thumbnails.
    const byFileId = new Map();
    const addCandidate = (entry, priority) => {
      const fileId = entry.fileId || extractFileId(entry.url) || entry.url;
      const existing = byFileId.get(fileId);
      if (!existing || priority > existing.priority) {
        byFileId.set(fileId, { ...entry, fileId, priority });
      }
    };
    downloads.forEach(d => addCandidate({ ...d, fileId: extractFileId(d.url) }, 1));
    apiImageCandidates.forEach(d => addCandidate({ ...d, fileId: extractFileId(d.url) }, 2));
    storageImages.forEach(d => addCandidate(d, 3));

    const final = [...byFileId.values()]
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
      .map(({ priority, ...d }) => d);

    if (final.length === 0) {
      // Non-blocking guidance (per US4 / harden spec). Metadata JSON was still attempted.
      btn.textContent = `⚠️ No images found. Scroll grid fully + interact (CF?) then retry. JSON may still be in ${DOWNLOAD_FOLDER}/ .`;
      console.warn(`[ChatGPT Bulk] 0 images after collection. Check console + page state. Metadata JSON may have saved to ${DOWNLOAD_FOLDER}/ .`);
      setTimeout(() => {
        btn.textContent = originalText;
        btn.disabled = false;
      }, 6000);
      return;
    }

    btn.textContent = `⬇️ Downloading ${final.length} images to ${DOWNLOAD_FOLDER}/ (allow multi-dl prompt if shown)`;

    // Process images in content script (where fetch with credentials works for auth):
    // fetch the (raw full) url, convert webp to png if needed for "original png" format and lossless,
    // create object url, send *immediately* to bg (one or few at a time).
    // This avoids holding *all* blobs/objectUrls in memory for the whole set (prevents OOM/crashes on 100+ image libraries)
    // while still converting for PNG delivery. Bg staggers the actual chrome.downloads.
    let sentCount = 0;
    const total = final.length;
    for (let d of final) {
      sentCount++;
      btn.textContent = `⬇️ Downloading ${sentCount}/${total} to ${DOWNLOAD_FOLDER}/ ...`;
      try {
        let fetchUrl = d.url;
        let resp = await fetch(fetchUrl, {credentials: 'include'});
        if (!resp.ok) {
          // The constructed raw /download/file_xxx often returns 403 for /images/ gallery assets
          // (even with credentials). Fallback to the original displayed <img src> (which the browser
          // was able to load), then still force .png name + conversion for the desired "png" output.
          if (d.originalSrc && d.originalSrc !== fetchUrl) {
            fetchUrl = d.originalSrc;
            resp = await fetch(fetchUrl, {credentials: 'include'});
          }
        }
        if (!resp.ok) throw new Error('fetch ' + resp.status + ' for ' + fetchUrl);
        let blob = await resp.blob();
        let finalName = d.name;
        if (blob.type === 'image/webp' || finalName.toLowerCase().endsWith('.webp')) {
          const bitmap = await createImageBitmap(blob);
          const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
          const ctx = canvas.getContext('2d');
          ctx.drawImage(bitmap, 0, 0);
          blob = await canvas.convertToBlob({type: 'image/png'});
          finalName = finalName.replace(/\.webp$/i, '.png');
        }
        // Data URLs survive the content-script → background hop (blob: URLs often do not).
        const dataUrl = await blobToDataUrl(blob);
        safeSendMessage({
          action: 'performDownloads',
          items: [{ url: dataUrl, name: finalName }],
          folder: DOWNLOAD_FOLDER
        });
      } catch (e) {
        console.warn('[ChatGPT Bulk] fetch/convert failed for', d.name, e);
        // Fallback to signed estuary URL the page can load (never the 403-prone /files/download/ shortcut).
        const fallbackUrl = (d.originalSrc && d.originalSrc.startsWith('http')) ? d.originalSrc : d.url;
        if (fallbackUrl.startsWith('http') && !fallbackUrl.includes('/files/download/')) {
          safeSendMessage({
            action: 'performDownloads',
            items: [{ url: fallbackUrl, name: d.name }],
            folder: DOWNLOAD_FOLDER
          });
        }
      }
    }

    // The success message + re-enable is still done locally after we "fire" the batch (non-blocking)
    setTimeout(() => {
      btn.textContent = `✅ ${final.length} imgs + JSON → ~/Downloads/${DOWNLOAD_FOLDER}/ (check subfolder)`;
      console.log(`[ChatGPT Bulk] ${final.length} downloads + JSON requested via background into ${DOWNLOAD_FOLDER}/ . Allow any Chrome multi-downloads prompt; check inside your Downloads/${DOWNLOAD_FOLDER}/ folder.`);
      setTimeout(() => {
        btn.textContent = originalText;
        btn.disabled = false;
      }, 5000);
    }, 1200);

    console.log(`[ChatGPT Bulk] Sent ${sentCount}/${final.length} image downloads + JSON to background for folder ${DOWNLOAD_FOLDER}/ (storage: ${storageImages.length}, API: ${apiImageCandidates.length})`);
    } catch (e) {
      console.error('[ChatGPT Bulk] Error during bulk flow (button will be restored):', e);
      // Best effort restore so button isn't left stuck in loading/choose state
      if (btn) {
        btn.textContent = originalText;
        btn.disabled = false;
      }
    }
  };

  document.body.appendChild(btn);
}

/**
 * Shows a modal that forces the user to confirm / change the download subfolder.
 * This is the "folder location chooser".
 * Returns the chosen (sanitized) folder name, or null if canceled.
 */
async function chooseDownloadLocation() {
  return new Promise((resolve) => {
    try {
      const modal = document.createElement('div');
      modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.65);z-index:99999999;display:flex;align-items:center;justify-content:center;font-family:system-ui,-apple-system,sans-serif;';
      
      modal.innerHTML = `
        <div style="background:#fff;padding:20px 24px;border-radius:10px;max-width:420px;width:92%;box-shadow:0 10px 40px rgba(0,0,0,.25);">
          <div style="font-size:15px;font-weight:600;margin-bottom:8px;">Where should the files be downloaded?</div>
          <div style="font-size:12.5px;color:#555;margin-bottom:14px;line-height:1.35;">
            All images and the metadata JSON will go into a subfolder inside your browser's default Downloads directory.<br>
            You can change the name below (use / for nested folders).
          </div>

          <label style="display:block;font-size:12px;margin-bottom:3px;color:#333;">Subfolder path</label>
          <input type="text" id="bulk-dl-folder" style="width:100%;padding:9px 10px;font-size:14px;border:1px solid #bbb;border-radius:6px;box-sizing:border-box;" />

          <div style="margin-top:10px;display:flex;gap:8px;">
            <button id="bulk-dl-show" style="flex:1;padding:8px 10px;background:#f4f4f4;border:1px solid #ccc;border-radius:6px;font-size:12.5px;cursor:pointer;">Show my default Downloads folder</button>
          </div>

          <div style="margin-top:14px;display:flex;gap:8px;justify-content:flex-end;">
            <button id="bulk-dl-cancel" style="padding:8px 14px;background:#fff;border:1px solid #ccc;border-radius:6px;font-size:13px;cursor:pointer;">Cancel</button>
            <button id="bulk-dl-ok" style="padding:8px 16px;background:#10a37f;color:#fff;border:none;border-radius:6px;font-size:13px;font-weight:600;cursor:pointer;">Use this location &amp; start download</button>
          </div>

          <div style="margin-top:10px;font-size:11px;color:#777;">
            Tip: The extension will create the folder if it doesn't exist.
          </div>
        </div>
      `;

      document.body.appendChild(modal);

      const input = modal.querySelector('#bulk-dl-folder');
      const showBtn = modal.querySelector('#bulk-dl-show');
      const cancelBtn = modal.querySelector('#bulk-dl-cancel');
      const okBtn = modal.querySelector('#bulk-dl-ok');

      // pre-fill from storage (via background)
      safeSendMessage({ action: 'getDownloadFolder' }, (resp) => {
        input.value = resp && resp.folder ? resp.folder : 'chatgpt-images';
        input.focus();
        input.select();
      });

      showBtn.onclick = () => {
        safeSendMessage({ action: 'showDefaultDownloadsFolder' });
      };

      const finish = (val) => {
        modal.remove();
        resolve(val || null);
      };

      cancelBtn.onclick = () => finish(null);

      okBtn.onclick = () => {
        let val = (input.value || 'chatgpt-images').trim();
        // basic sanitization for filesystem safety
        val = val.replace(/[\\/:*?"<>|]/g, '_').replace(/\.+$/g, '').replace(/^\/+|\/+$/g, '');
        if (!val) val = 'chatgpt-images';
        // persist
        safeSendMessage({ action: 'setDownloadFolder', folder: val }, () => {
          finish(val);
        });
      };

      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') okBtn.click();
        if (e.key === 'Escape') cancelBtn.click();
      });

      modal.addEventListener('click', (e) => {
        if (e.target === modal) cancelBtn.click();
      });
    } catch (e) {
      console.warn('[ChatGPT Bulk] chooseDownloadLocation failed to build modal:', e);
      resolve(null);
    }
  });
}

// Robust entry point (guarded against unusual timing at document_idle + extension reloads).
// The previous unconditional observer + always-replace was crashing the browser on load/reload
// due to mutation churn in ChatGPT's heavy SPA.
(function initBulkButton() {
  // Stale cleanup (extension reload case)
  const stale = document.getElementById('cgpt-bulk-btn');
  if (stale) stale.remove();

  addBulkDownloadButton();

  const target = document.body || document.documentElement;
  const mo = new MutationObserver(() => {
    if (!document.getElementById('cgpt-bulk-btn')) {
      addBulkDownloadButton();
    }
  });
  if (target) {
    mo.observe(target, { childList: true, subtree: true });
  } else {
    // Extremely defensive: if no target yet, defer
    window.addEventListener('load', () => {
      const t = document.body || document.documentElement;
      if (t) {
        const o = new MutationObserver(() => {
          if (!document.getElementById('cgpt-bulk-btn')) addBulkDownloadButton();
        });
        o.observe(t, { childList: true, subtree: true });
        if (!document.getElementById('cgpt-bulk-btn')) addBulkDownloadButton();
      }
    }, { once: true });
  }

  console.log('%c[ChatGPT Bulk Downloader] Ready. Now requires explicit user-chosen download subfolder (via modal + folder checker) before any bulk action. Downloads routed through background worker for better path control.', 'color:#10a37f');
})();
