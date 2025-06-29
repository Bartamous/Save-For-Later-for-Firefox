// Listen for messages from background script
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'getPageMetadata') {
    const metadata = {
      title: document.title,
      description: getMetaDescription(),
      ogImage: getOpenGraphImage(),
      siteName: getSiteName()
    };
    sendResponse(metadata);
  }
});

function getMetaDescription() {
  const metaDesc = document.querySelector('meta[name="description"]');
  const ogDesc = document.querySelector('meta[property="og:description"]');
  return (ogDesc && ogDesc.content) || (metaDesc && metaDesc.content) || '';
}

function getOpenGraphImage() {
  const ogImage = document.querySelector('meta[property="og:image"]');
  return ogImage ? ogImage.content : null;
}

function getSiteName() {
  const ogSiteName = document.querySelector('meta[property="og:site_name"]');
  return ogSiteName ? ogSiteName.content : window.location.hostname;
}