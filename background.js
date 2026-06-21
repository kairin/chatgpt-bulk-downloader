/**
 * Background service worker for ChatGPT Bulk Downloader.
 *
 * Handles all chrome.downloads calls (required in MV3 for reliable subfolder paths).
 * Also handles showing the default Downloads folder and storing user-chosen folder name.
 */

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === 'performDownloads') {
    const { items = [], folder = 'chatgpt-images' } = msg;
    if (items.length === 0) {
      sendResponse({ status: 'nothing-to-do' });
      return;
    }

    let done = 0;
    const total = items.length;

    items.forEach((item, idx) => {
      setTimeout(() => {
        chrome.downloads.download({
          url: item.url,
          filename: `${folder}/${item.name}`
        }, (downloadId) => {
          if (chrome.runtime.lastError) {
            console.warn('[BulkDL BG] download error for', item.name, chrome.runtime.lastError);
          }
          done++;
          if (done === total) console.log(`[BulkDL BG] Completed ${total} downloads into ${folder}/`);
        });
      }, Math.min(idx * 25, 800));
    });

    sendResponse({ status: 'started', count: total, folder });
    return true;
  }

  if (msg.action === 'showDefaultDownloadsFolder') {
    chrome.downloads.showDefaultFolder();
    sendResponse({ status: 'shown' });
    return;
  }

  if (msg.action === 'getDownloadFolder') {
    chrome.storage.local.get(['downloadFolder'], (res) => {
      sendResponse({ folder: res.downloadFolder || 'chatgpt-images' });
    });
    return true;
  }

  if (msg.action === 'setDownloadFolder') {
    const newFolder = (msg.folder || 'chatgpt-images').trim().replace(/[\\/:*?"<>|]/g, '_').replace(/^\.+|\.+$/g, '');
    if (!newFolder) {
      sendResponse({ status: 'invalid' });
      return;
    }
    chrome.storage.local.set({ downloadFolder: newFolder }, () => {
      sendResponse({ status: 'saved', folder: newFolder });
    });
    return true;
  }

  // Unknown message
  sendResponse({ status: 'unknown' });
});

// Make sure the worker stays alive for a bit if needed on install
chrome.runtime.onInstalled.addListener(() => {
  console.log('[BulkDL BG] Service worker installed/updated');
});
