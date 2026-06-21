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
 * - Saves images + JSON under ~/Downloads/chatgpt-images/
 *
 * Everything uses only your existing session + the official APIs the ChatGPT web UI already calls.
 * No external servers, no tracking.
 */

function addBulkDownloadButton() {
  if (document.getElementById('cgpt-bulk-btn')) return;

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
      // Recent images on /images/ page too
      if (isImagesPage) {
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

      const useDL = chrome && chrome.downloads && chrome.downloads.download;
      if (useDL) {
        chrome.downloads.download({ url: 'data:application/json;charset=utf-8,' + encodeURIComponent(jsonStr), filename: `chatgpt-images/${jsonFilename}` });
      } else {
        const blob = new Blob([jsonStr], {type: 'application/json'});
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = jsonFilename;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      }
      console.log('[ChatGPT Bulk] Metadata JSON triggered for', jsonFilename);
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
      if (!/\.(png|jpg|jpeg|webp|gif)$/i.test(name)) {
        const extMatch = img.src.match(/\.(\w+)(?:\?|$)/);
        name += '.' + (extMatch ? extMatch[1] : 'png');
      }
      // Ensure unique
      if (downloads.some(d => d.name === name)) {
        const ext = name.match(/\.[^.]+$/) || ['.png'];
        name = name.replace(/\.[^.]+$/, '') + `-${i+1}` + ext;
      }
      downloads.push({ url: img.src, name });
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
        let name = item.name || item.filename || item.title || item.prompt || item.alt ||
                   (item.asset && item.asset.name) || `${defaultPrefix}-${String(idx+1).padStart(4,'0')}`;
        // quick sanitize
        name = name.replace(/[^a-z0-9._-]/gi, '_').replace(/_{2,}/g, '_');
        if (!/\.(png|jpg|jpeg|webp|gif)$/i.test(name)) {
          const m = url.match(/\.(\w+)(?:\?|$)/);
          name += '.' + (m ? m[1] : 'png');
        }
        apiImageCandidates.push({ url, name, origin: 'api' });
      });
    };
    if (meta.imageNodes) tryAddFrom(meta.imageNodes, 'api-image');
    if (meta.recentUploadedImages) tryAddFrom(meta.recentUploadedImages, 'api-upload');

    // Merge: prefer API entries (better names + complete list), add any extra from DOM that weren't covered.
    // (Note: on URL overlap we currently keep the DOM-extracted name; API is appended only for new ones.)
    apiImageCandidates.forEach(d => {
      if (!downloads.some(x => x.url === d.url)) downloads.push({ url: d.url, name: d.name });
    });
    // keep any pure-DOM ones that API didn't have
    // (already in downloads array)

    // Dedup final
    const final = downloads.filter((d, idx, self) => 
      self.findIndex(x => x.url === d.url) === idx
    );

    if (final.length === 0) {
      // Non-blocking guidance (per US4 / harden spec). Metadata JSON was still attempted.
      btn.textContent = '⚠️ No images found. Scroll grid fully + interact (CF?) then retry. JSON may still be in chatgpt-images/.';
      console.warn('[ChatGPT Bulk] 0 images after collection. Check console + page state. Metadata JSON may have saved to chatgpt-images/.');
      setTimeout(() => {
        btn.textContent = originalText;
        btn.disabled = false;
      }, 6000);
      return;
    }

    btn.textContent = `⬇️ Downloading ${final.length} images to chatgpt-images/ (allow multi-dl prompt if shown)`;

    // Use chrome.downloads for subfolder (like timestamped exporters). Falls back to <a> if no perm.
    // Target the folder the user referenced: ~/Downloads/chatgpt-images (all bulk runs accumulate here; browser will (1), (2) etc on name conflicts).
    const folder = 'chatgpt-images';
    const useDownloadsAPI = chrome && chrome.downloads && chrome.downloads.download;

    function fallbackDownload(d) {
      const a = document.createElement('a');
      a.href = d.url;
      a.download = d.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }

    final.forEach((d, i) => {
      setTimeout(() => {
        if (useDownloadsAPI) {
          chrome.downloads.download({
            url: d.url,
            filename: `${folder}/${d.name}`
          }, () => {
            if (chrome.runtime.lastError) {
              console.warn('downloads API error, fallback', chrome.runtime.lastError);
              fallbackDownload(d);
            }
          });
        } else {
          fallbackDownload(d);
        }

        if (i === final.length - 1) {
          setTimeout(() => {
            btn.textContent = `✅ ${final.length} imgs + JSON → ~/Downloads/${folder}/ (check subfolder)`;
            console.log(`[ChatGPT Bulk] ${final.length} downloads + JSON to ${folder}/ subfolder. Allow Chrome multi-downloads prompt if shown; check inside Downloads/${folder}/ .`);
            setTimeout(() => {
              btn.textContent = originalText;
              btn.disabled = false;
            }, 5000);
          }, 1500);
        }
      }, i * 50);
    });

    console.log(`[ChatGPT Bulk] Triggered ${final.length} + JSON to ${folder}/ (API:${apiImageCandidates.length} DOM-fb:${downloads.length - apiImageCandidates.length}). Allow multi-dl prompt; files in ~/Downloads/${folder}/`);
  };

  document.body.appendChild(btn);
}

// Run + re-inject on SPA nav
addBulkDownloadButton();
const observer = new MutationObserver(() => addBulkDownloadButton());
observer.observe(document.body, { childList: true, subtree: true });

console.log('%c[ChatGPT Bulk Downloader] Ready. Uses chrome.downloads for organized folders like the exporters.', 'color:#10a37f');
