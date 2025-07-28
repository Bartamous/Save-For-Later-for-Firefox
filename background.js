browser.runtime.onInstalled.addListener(() => {
  browser.contextMenus.create({
    id: "saveForLater",
    title: "Save For Later",
    contexts: ["page"]
  });
});

// Handle browser action clicks (extension icon)
browser.browserAction.onClicked.addListener((tab) => {
  browser.tabs.create({
    url: browser.runtime.getURL('main.html'),
    active: true
  });
});

browser.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "saveForLater") {
    await savePageForLater(tab);
  }
});



// Save current page
async function savePageForLater(tab) {
  try {
    const pageData = {
      url: tab.url,
      title: tab.title,
      favicon: tab.favIconUrl || null,
      timestamp: Date.now(),
      tags: [],
      collection: "default"
    };

    // Get thumbnail for video sites
    if (isVideoSite(tab.url)) {
      pageData.thumbnail = await getVideoThumbnail(tab.url);
    }

    // Load existing pages
    const result = await browser.storage.local.get('savedPages');
    
    // Handle the case where savedPages might be stored as a JSON string
    let savedPages;
    if (typeof result.savedPages === 'string') {
      try {
        savedPages = JSON.parse(result.savedPages);
      } catch (e) {
        savedPages = [];
      }
    } else {
      savedPages = result.savedPages || [];
    }
    
    const existingIndex = savedPages.findIndex(page => page.url === tab.url);
    if (existingIndex !== -1) {
      savedPages[existingIndex] = { ...savedPages[existingIndex], ...pageData };
    } else {
      savedPages.push(pageData);
    }

    // Store as JSON string to match the extension storage format
    await browser.storage.local.set({ savedPages: JSON.stringify(savedPages) });
    
    browser.notifications.create({
      type: "basic",
      iconUrl: "icons/icon48.png",
      title: "Save For Later",
      message: `"${tab.title}" has been saved for later!`
    });

    // Notify main page to refresh if it's open
    try {
      browser.runtime.sendMessage({ action: 'pageSaved', page: pageData });
    } catch (error) {
      // Main page might not be open, ignore error
    }

  } catch (error) {
    console.error('Error saving page:', error);
  }
}

// Check if URL is a video site
function isVideoSite(url) {
  const videoDomains = [
    'youtube.com',
    'youtu.be',
    'vimeo.com',
  ];
  
  return videoDomains.some(domain => url.includes(domain));
}

// Get video thumbnail URL
async function getVideoThumbnail(url) {
  try {
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
      const videoId = extractYouTubeVideoId(url);
      if (videoId) {
        return `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
      }
    }
    
    if (url.includes('vimeo.com')) {
      const videoId = extractVimeoVideoId(url);
      if (videoId) {
        try {
          const response = await fetch(`https://vimeo.com/api/v2/video/${videoId}.json`);
          const data = await response.json();
          if (data && data[0] && data[0].thumbnail_large) {
            return data[0].thumbnail_large;
          }
        } catch (error) {
          console.error('Error fetching Vimeo thumbnail:', error);
        }
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error getting video thumbnail:', error);
    return null;
  }
}

// Extract YouTube video ID from URL
function extractYouTubeVideoId(url) {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/,
    /youtube\.com\/embed\/([^&\n?#]+)/,
    /youtube\.com\/v\/([^&\n?#]+)/
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      return match[1];
    }
  }
  return null;
}

// Extract Vimeo video ID from URL
function extractVimeoVideoId(url) {
  const patterns = [
    /vimeo\.com\/(\d+)/,
    /vimeo\.com\/groups\/[^\/]+\/videos\/(\d+)/,
    /vimeo\.com\/channels\/[^\/]+\/(\d+)/
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      return match[1];
    }
  }
  return null;
}

// Handle messages from popup
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'getSavedPages') {
    browser.storage.local.get('savedPages').then(result => {
      let savedPages;
      if (typeof result.savedPages === 'string') {
        try {
          savedPages = JSON.parse(result.savedPages);
        } catch (e) {
          savedPages = [];
        }
      } else {
        savedPages = result.savedPages || [];
      }
      sendResponse({ savedPages: savedPages });
    });
    return true;
  }
  
  if (message.action === 'deletePage') {
    browser.storage.local.get('savedPages').then(result => {
      let savedPages;
      if (typeof result.savedPages === 'string') {
        try {
          savedPages = JSON.parse(result.savedPages);
        } catch (e) {
          savedPages = [];
        }
      } else {
        savedPages = result.savedPages || [];
      }
      const filteredPages = savedPages.filter(page => page.url !== message.url);
      browser.storage.local.set({ savedPages: JSON.stringify(filteredPages) });
      sendResponse({ success: true });
    });
    return true;
  }
  
  if (message.action === 'updatePage') {
    browser.storage.local.get('savedPages').then(result => {
      let savedPages;
      if (typeof result.savedPages === 'string') {
        try {
          savedPages = JSON.parse(result.savedPages);
        } catch (e) {
          savedPages = [];
        }
      } else {
        savedPages = result.savedPages || [];
      }
      const index = savedPages.findIndex(page => page.url === message.page.url);
      if (index !== -1) {
        savedPages[index] = message.page;
        browser.storage.local.set({ savedPages: JSON.stringify(savedPages) });
        sendResponse({ success: true });
      } else {
        sendResponse({ success: false });
      }
    });
    return true;
  }
  
  if (message.action === 'getCollections') {
    browser.storage.local.get('collections').then(result => {
      sendResponse({ collections: result.collections || ['default'] });
    });
    return true;
  }
  
  if (message.action === 'saveCollection') {
    browser.storage.local.get('collections').then(result => {
      const collections = result.collections || ['default'];
      if (!collections.includes(message.collection)) {
        collections.push(message.collection);
        browser.storage.local.set({ collections });
      }
      sendResponse({ success: true });
    });
    return true;
  }
  
  if (message.action === 'refreshExtension') {
    // Reload the extension
    browser.runtime.reload();
    sendResponse({ success: true });
    return true;
  }
  
  if (message.action === 'setSavedPages') {
    const savedPages = message.savedPages || [];
    browser.storage.local.set({ savedPages: JSON.stringify(savedPages) }).then(() => {
      sendResponse({ success: true });
    });
    return true;
  }
  
  if (message.action === 'exportSavedPages') {
    browser.storage.local.get('savedPages').then(result => {
      let savedPages;
      if (typeof result.savedPages === 'string') {
        try {
          savedPages = JSON.parse(result.savedPages);
        } catch (e) {
          savedPages = [];
        }
      } else {
        savedPages = result.savedPages || [];
      }
      
      const dataStr = JSON.stringify(savedPages, null, 2);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      // Create a download using browser.downloads API
      browser.downloads.download({
        url: url,
        filename: 'saved-pages.saves',
        saveAs: true
      }).then(() => {
        URL.revokeObjectURL(url);
        sendResponse({ success: true });
      }).catch(error => {
        console.error('Export error:', error);
        sendResponse({ success: false, error: error.message });
      });
    });
    return true;
  }
  
  if (message.action === 'openImportPage') {
    console.log('Background: openImportPage request received');
    try {
      browser.tabs.create({
        url: browser.runtime.getURL('import.html'),
        active: true
      }).then((tab) => {
        console.log('Background: Import tab created successfully, tab ID:', tab.id);
        sendResponse({ success: true, tabId: tab.id });
      }).catch((error) => {
        console.error('Background: Failed to create import tab:', error);
        sendResponse({ success: false, error: error.message });
      });
    } catch (error) {
      console.error('Background: Error in openImportPage:', error);
      sendResponse({ success: false, error: error.message });
    }
    return true;
  }
  
  if (message.action === 'processImportData') {
    console.log('Background: processImportData request received');
    console.log('Background: Filename:', message.filename);
    console.log('Background: Data length:', message.data ? message.data.length : 'undefined');
    console.log('Background: Data preview:', message.data ? message.data.substring(0, 200) : 'undefined');
    
    try {
      console.log('Background: Parsing JSON data...');
      const importedPages = JSON.parse(message.data);
      console.log('Background: JSON parsed successfully');
      console.log('Background: Parsed data type:', typeof importedPages);
      console.log('Background: Is array:', Array.isArray(importedPages));
      console.log('Background: Array length:', importedPages.length);
      
      if (!Array.isArray(importedPages)) {
        console.log('Background: ERROR - Data is not an array');
        sendResponse({ success: false, error: 'Invalid file format - expected JSON array' });
        return true;
      }
      
      console.log('Background: Validating pages...');
      // Validate pages
      for (let i = 0; i < importedPages.length; i++) {
        const page = importedPages[i];
        console.log(`Background: Validating page ${i + 1}:`, { url: page.url, title: page.title });
        
        if (!page.url || !page.title) {
          console.log(`Background: ERROR - Page ${i + 1} missing required fields:`, page);
          sendResponse({ success: false, error: `Invalid page format at index ${i + 1} - missing required fields (url or title)` });
          return true;
        }
        page.collection = page.collection || 'default';
        page.tags = page.tags || [];
        page.timestamp = page.timestamp || Date.now();
      }
      console.log('Background: All pages validated successfully');
      
      console.log('Background: Loading existing data...');
      // Handle collections and existing data
      Promise.all([
        browser.storage.local.get('collections'),
        browser.storage.local.get('savedPages')
      ]).then(([collectionsResult, savedPagesResult]) => {
        console.log('Background: Existing data loaded');
        console.log('Background: Collections result:', collectionsResult);
        console.log('Background: SavedPages result type:', typeof savedPagesResult.savedPages);
        
        const existingCollections = collectionsResult.collections || ['default'];
        console.log('Background: Existing collections:', existingCollections);
        
        const importedCollections = [...new Set(importedPages.map(p => p.collection).filter(c => c && !existingCollections.includes(c)))];
        console.log('Background: New collections to add:', importedCollections);
        
        // Get existing saved pages
        let savedPages;
        if (typeof savedPagesResult.savedPages === 'string') {
          try {
            console.log('Background: Parsing existing savedPages from string...');
            savedPages = JSON.parse(savedPagesResult.savedPages);
            console.log('Background: Existing pages parsed, count:', savedPages.length);
          } catch (e) {
            console.log('Background: Failed to parse existing savedPages, starting fresh:', e);
            savedPages = [];
          }
        } else {
          savedPages = savedPagesResult.savedPages || [];
          console.log('Background: Using existing pages array, count:', savedPages.length);
        }
        
        console.log('Background: Merging imported pages...');
        let updatedCount = 0;
        let addedCount = 0;
        
        // Merge imported pages
        for (const importedPage of importedPages) {
          const existingIndex = savedPages.findIndex(page => page.url === importedPage.url);
          if (existingIndex !== -1) {
            console.log('Background: Updating existing page:', importedPage.url);
            savedPages[existingIndex] = { ...savedPages[existingIndex], ...importedPage };
            updatedCount++;
          } else {
            console.log('Background: Adding new page:', importedPage.url);
            savedPages.push(importedPage);
            addedCount++;
          }
        }
        
        console.log(`Background: Merge complete - ${addedCount} added, ${updatedCount} updated`);
        console.log('Background: Total pages after merge:', savedPages.length);
        
        // Save updates
        const promises = [
          browser.storage.local.set({ savedPages: JSON.stringify(savedPages) })
        ];
        
        if (importedCollections.length > 0) {
          const updatedCollections = [...existingCollections, ...importedCollections];
          console.log('Background: Updating collections to:', updatedCollections);
          promises.push(browser.storage.local.set({ collections: updatedCollections }));
        }
        
        console.log('Background: Saving data to storage...');
        Promise.all(promises).then(() => {
          console.log('Background: Data saved successfully');
          sendResponse({ success: true, count: importedPages.length });
        }).catch(error => {
          console.error('Background: Error saving data:', error);
          sendResponse({ success: false, error: error.message });
        });
      }).catch(error => {
        console.error('Background: Error loading existing data:', error);
        sendResponse({ success: false, error: 'Failed to load existing data: ' + error.message });
      });
      
    } catch (error) {
      console.error('Background: Error parsing JSON:', error);
      sendResponse({ success: false, error: 'Invalid JSON format: ' + error.message });
    }
    return true;
  }
  
  if (message.action === 'saveCurrentPage') {
    savePageForLater(message.tab);
    sendResponse({ success: true });
    return true;
  }
}); 