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
    try {
      const folderIdMatch = location.pathname.match(/\/d\/([a-f0-9-]+)/i);
      const folderId = folderIdMatch ? folderIdMatch[1] : null;
      const meta = {
        scrapedAt: new Date().toISOString(),
        url: location.href,
        folderId: folderId,
        isImagesPage: isImagesPage,
        title: document.title
      };

      const apiCalls = [];
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

    // Dedup final
    const final = downloads.filter((d, idx, self) => 
      self.findIndex(x => x.url === d.url) === idx
    );

    if (final.length === 0) {
      alert('No images found. Scroll/load the grid fully, ensure real content (interact if "Just a moment..."), try again. (Metadata JSON may still have been saved.)');
      btn.disabled = false;
      btn.textContent = originalText;
      return;
    }

    btn.textContent = `⬇️ Downloading ${final.length} images...`;

    // Use chrome.downloads for subfolder (like timestamped exporters). Falls back to <a> if no perm.
    // Target the folder the user referenced: ~/Downloads/chatgpt-images (all bulk runs accumulate here; browser will (1), (2) etc on name conflicts).
    const folder = 'chatgpt-images';
    const useDownloadsAPI = chrome && chrome.downloads && chrome.downloads.download;

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
            btn.textContent = `✅ ${final.length} images + metadata.json to ${folder}/`;
            setTimeout(() => {
              btn.textContent = originalText;
              btn.disabled = false;
            }, 4000);
          }, 1500);
        }
      }, i * 50);
    });

    function fallbackDownload(d) {
      const a = document.createElement('a');
      a.href = d.url;
      a.download = d.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }

    console.log(`[ChatGPT Bulk] Triggered ${final.length} image downloads + metadata JSON to ${folder}/ subfolder (or root if no perm).`);
  };

  document.body.appendChild(btn);
}

// Run + re-inject on SPA nav
addBulkDownloadButton();
const observer = new MutationObserver(() => addBulkDownloadButton());
observer.observe(document.body, { childList: true, subtree: true });

console.log('%c[ChatGPT Bulk Downloader] Ready. Uses chrome.downloads for organized folders like the exporters.', 'color:#10a37f');
