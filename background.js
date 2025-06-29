browser.runtime.onInstalled.addListener(() => {
  browser.contextMenus.create({
    id: "saveForLater",
    title: "Save For Later",
    contexts: ["page"]
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
    const savedPages = result.savedPages || [];
    
    const existingIndex = savedPages.findIndex(page => page.url === tab.url);
    if (existingIndex !== -1) {
      savedPages[existingIndex] = { ...savedPages[existingIndex], ...pageData };
    } else {
      savedPages.push(pageData);
    }

    await browser.storage.local.set({ savedPages });
    
    browser.notifications.create({
      type: "basic",
      iconUrl: "icons/icon48.png",
      title: "Save For Later",
      message: `"${tab.title}" has been saved for later!`
    });

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
      sendResponse({ savedPages: result.savedPages || [] });
    });
    return true;
  }
  
  if (message.action === 'deletePage') {
    browser.storage.local.get('savedPages').then(result => {
      const savedPages = result.savedPages || [];
      const filteredPages = savedPages.filter(page => page.url !== message.url);
      browser.storage.local.set({ savedPages: filteredPages });
      sendResponse({ success: true });
    });
    return true;
  }
  
  if (message.action === 'updatePage') {
    browser.storage.local.get('savedPages').then(result => {
      const savedPages = result.savedPages || [];
      const index = savedPages.findIndex(page => page.url === message.page.url);
      if (index !== -1) {
        savedPages[index] = message.page;
        browser.storage.local.set({ savedPages });
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
}); 