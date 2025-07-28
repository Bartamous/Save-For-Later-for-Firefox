// Main page script for Save For Later extension

let savedPages = [];
let collections = ['default'];
let currentFilter = 'all';
let currentSearch = '';
let currentView = 'collections';
let currentCollectionName = '';

// Enhanced filtering variables
let currentDateFilter = 'all';
let currentSort = 'newest';

// Bulk operations
let selectedPages = new Set();
let isMultiSelectMode = false;

// Reading features
let previewTimeout = null;

// DOM elements
const savedPagesList = document.getElementById('savedPagesList');
const noPagesMessage = document.getElementById('noPagesMessage');
const collectionFilter = document.getElementById('collectionFilter');
const searchInput = document.getElementById('searchInput');
const addCollectionBtn = document.getElementById('addCollectionBtn');
const refreshBtn = document.getElementById('refreshBtn');
const editModal = document.getElementById('editModal');
const collectionModal = document.getElementById('collectionModal');
const collectionsList = document.getElementById('collectionsList');
const collectionView = document.getElementById('collectionView');
const backToCollectionsBtn = document.getElementById('backToCollectionsBtn');
const currentCollectionNameEl = document.getElementById('currentCollectionName');
const collectionPagesList = document.getElementById('collectionPagesList');
const noCollectionPagesMessage = document.getElementById('noCollectionPagesMessage');
const settingsBtn = document.getElementById('settingsBtn');
const themeToggleBtn = document.getElementById('themeToggleBtn');
const darkModeToggle = document.getElementById('darkModeToggle');
const exportSavesBtn = document.getElementById('exportSavesBtn');
const importSavesBtn = document.getElementById('importSavesBtn');

// Enhanced filter elements
const dateFilter = document.getElementById('dateFilter');
const sortFilter = document.getElementById('sortFilter');

// Bulk operation elements
const bulkActions = document.getElementById('bulkActions');
const selectedCount = document.getElementById('selectedCount');
const selectAllBtn = document.getElementById('selectAllBtn');
const selectNoneBtn = document.getElementById('selectNoneBtn');
const bulkDeleteBtn = document.getElementById('bulkDeleteBtn');
const bulkMoveBtn = document.getElementById('bulkMoveBtn');
const bulkTagBtn = document.getElementById('bulkTagBtn');
const keyboardShortcuts = document.getElementById('keyboardShortcuts');
const pagePreview = document.getElementById('pagePreview');
const secretPartyBtn = document.getElementById('secretPartyBtn');
const confettiContainer = document.getElementById('confetti-container');

// Initialize page
document.addEventListener('DOMContentLoaded', async () => {
  await loadData();
  setupEventListeners();
  renderSavedPages();
  renderCollections();
  loadTheme();
  
  // Listen for page saves from context menu to auto-update
  browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'pageSaved') {
      console.log('New page saved, refreshing data...');
      loadData().then(() => {
        renderSavedPages();
        renderCollections();
      });
    }
  });
});

// Load saved pages and collections
async function loadData() {
  try {
    const response = await browser.runtime.sendMessage({ action: 'getSavedPages' });
    savedPages = response.savedPages || [];
    
    const collectionsResponse = await browser.runtime.sendMessage({ action: 'getCollections' });
    collections = collectionsResponse.collections || ['default'];
    
    updateCollectionFilter();
  } catch (error) {
    console.error('Error loading data:', error);
  }
}

function setupEventListeners() {
  // Tab switching
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      switchTab(btn.dataset.tab);
    });
  });

  // Filters
  collectionFilter.addEventListener('change', (e) => {
    currentFilter = e.target.value;
    renderSavedPages();
  });

  searchInput.addEventListener('input', (e) => {
    currentSearch = e.target.value.toLowerCase();
    renderSavedPages();
  });

  // Enhanced filter listeners
  dateFilter.addEventListener('change', (e) => {
    currentDateFilter = e.target.value;
    renderSavedPages();
  });

  sortFilter.addEventListener('change', (e) => {
    currentSort = e.target.value;
    renderSavedPages();
  });

  // Secret party button
  secretPartyBtn.addEventListener('click', triggerParty);

  // Buttons
  addCollectionBtn.addEventListener('click', () => {
    showCollectionModal();
  });

  refreshBtn.addEventListener('click', async () => {
    await loadData();
    renderSavedPages();
    renderCollections();
  });

  backToCollectionsBtn.addEventListener('click', () => {
    showCollectionsList();
  });

  // Theme toggle
  if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', () => {
      const isDark = document.body.classList.contains('dark-theme');
      const newTheme = isDark ? 'light' : 'dark';
      localStorage.setItem('sfl-theme', newTheme);
      applyTheme(newTheme);
    });
  }

  if (darkModeToggle) {
    darkModeToggle.addEventListener('change', () => {
      const newTheme = darkModeToggle.checked ? 'dark' : 'light';
      localStorage.setItem('sfl-theme', newTheme);
      applyTheme(newTheme);
    });
  }

  // Export/Import
  if (exportSavesBtn) {
    exportSavesBtn.addEventListener('click', async () => {
      try {
        const response = await browser.runtime.sendMessage({ action: 'exportSavedPages' });
        if (!response.success) {
          alert('Failed to export saved pages.');
        }
      } catch (e) {
        alert('Failed to export saved pages.');
      }
    });
  }

  if (importSavesBtn) {
    importSavesBtn.addEventListener('click', async () => {
      try {
        const response = await browser.runtime.sendMessage({ action: 'openImportPage' });
        if (response.success) {
          // Listen for import completion
          const handleImportComplete = (message) => {
            if (message.action === 'importComplete') {
              browser.runtime.onMessage.removeListener(handleImportComplete);
              if (message.success) {
                alert(`Successfully imported ${message.count} pages!`);
                loadData().then(() => {
                  renderSavedPages();
                  renderCollections();
                });
              } else if (message.error !== 'Import cancelled by user') {
                alert('Failed to import saved pages: ' + message.error);
              }
            }
          };
          browser.runtime.onMessage.addListener(handleImportComplete);
        }
      } catch (e) {
        alert('Failed to open import dialog.');
      }
    });
  }

  // Bulk operation listeners
  selectAllBtn.addEventListener('click', selectAllPages);
  selectNoneBtn.addEventListener('click', selectNonePages);
  bulkDeleteBtn.addEventListener('click', bulkDeletePages);
  bulkMoveBtn.addEventListener('click', showBulkMoveDialog);
  bulkTagBtn.addEventListener('click', showBulkTagDialog);

  // Keyboard shortcuts
  document.addEventListener('keydown', handleKeyboardShortcuts);

  // Modal events
  setupModalEvents();
  
  // Close dropdowns when clicking outside
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.add-to-collection-btn') && !e.target.closest('.collection-dropdown')) {
      closeAllDropdowns();
    }
    
    // Handle bulk selection clicks
    if (e.target.closest('.page-checkbox')) {
      e.stopPropagation();
      const pageCard = e.target.closest('.page-card');
      const url = pageCard.dataset.url;
      togglePageSelection(url);
    }
  });
}

function switchTab(tabName) {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabName);
  });

  document.querySelectorAll('.tab-pane').forEach(pane => {
    pane.classList.toggle('active', pane.id === `${tabName}Tab`);
  });

  // Clear selection when switching tabs
  selectedPages.clear();
  updateBulkActionsVisibility();

  // Reset to collections list when switching to collections tab
  if (tabName === 'collections' && currentView === 'collection-detail') {
    showCollectionsList();
  }
}

function showCollectionsList() {
  currentView = 'collections';
  collectionsList.style.display = 'block';
  collectionView.classList.remove('active');
  collectionView.style.display = 'none';
}

function showCollectionDetail(collectionName) {
  currentView = 'collection-detail';
  currentCollectionName = collectionName;
  
  collectionsList.style.display = 'none';
  collectionView.style.display = 'block';
  collectionView.classList.add('active');
  
  currentCollectionNameEl.textContent = collectionName;
  renderCollectionPages(collectionName);
}

function renderCollectionPages(collectionName) {
  const collectionPages = savedPages.filter(page => page.collection === collectionName);
  
  if (collectionPages.length === 0) {
    collectionPagesList.style.display = 'none';
    noCollectionPagesMessage.style.display = 'block';
    return;
  }

  collectionPagesList.style.display = 'grid';
  noCollectionPagesMessage.style.display = 'none';

  collectionPagesList.textContent = '';
  
  collectionPages.forEach(page => {
    const cardElement = createPageCardElement(page);
    collectionPagesList.appendChild(cardElement);
  });
  
  setupPageCardEventListeners();
  updateBulkActionsVisibility();
}

function updateCollectionFilter() {
  collectionFilter.textContent = '';
  
  const allOption = document.createElement('option');
  allOption.value = 'all';
  allOption.textContent = 'All Collections';
  collectionFilter.appendChild(allOption);
  
  collections.forEach(collection => {
    if (collection !== 'default') {
      const option = document.createElement('option');
      option.value = collection;
      option.textContent = collection;
      collectionFilter.appendChild(option);
    }
  });
}

function renderSavedPages() {
  const filteredPages = getFilteredPages();
  
  if (filteredPages.length === 0) {
    savedPagesList.style.display = 'none';
    noPagesMessage.style.display = 'block';
    return;
  }

  savedPagesList.style.display = 'grid';
  noPagesMessage.style.display = 'none';

  savedPagesList.textContent = '';
  
  filteredPages.forEach(page => {
    const cardElement = createPageCardElement(page);
    savedPagesList.appendChild(cardElement);
  });
  
  setupPageCardEventListeners();
  updateBulkActionsVisibility();
}

function setupPageCardEventListeners() {
  // Add click listeners to page cards to open pages
  document.querySelectorAll('.page-card').forEach(card => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('.page-actions') || 
          e.target.closest('.add-to-collection-btn') || 
          e.target.closest('.collection-dropdown') ||
          e.target.closest('.page-checkbox')) {
        return;
      }
      
      const url = card.dataset.url;
      if (url) {
        browser.tabs.create({ url: url });
      }
    });


  });

  // Click listeners
  document.querySelectorAll('.edit-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const card = btn.closest('.page-card');
      const url = card.dataset.url;
      editPage(url);
    });
  });

  document.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const card = btn.closest('.page-card');
      const url = card.dataset.url;
      deletePage(url);
    });
  });

  document.querySelectorAll('.add-to-collection-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const card = btn.closest('.page-card');
      const url = card.dataset.url;
      toggleCollectionDropdown(card, url);
    });
  });

  document.querySelectorAll('.collection-dropdown-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.stopPropagation();
      const collection = item.dataset.collection;
      const url = item.closest('.page-card').dataset.url;
      addPageToCollection(url, collection);
    });
  });
}

function toggleCollectionDropdown(card, url) {
  const dropdown = card.querySelector('.collection-dropdown');
  const currentCollection = savedPages.find(p => p.url === url)?.collection || 'default';
  
  closeAllDropdowns();
  
  if (dropdown.classList.contains('show')) {
    dropdown.classList.remove('show');
  } else {
    dropdown.classList.add('show');
    
    dropdown.querySelectorAll('.collection-dropdown-item').forEach(item => {
      item.classList.toggle('current', item.dataset.collection === currentCollection);
    });
  }
}

function closeAllDropdowns() {
  document.querySelectorAll('.collection-dropdown').forEach(dropdown => {
    dropdown.classList.remove('show');
  });
}

async function addPageToCollection(url, collection) {
  try {
    const page = savedPages.find(p => p.url === url);
    if (page) {
      page.collection = collection;
      await browser.runtime.sendMessage({ action: 'updatePage', page });
      await loadData();
      renderSavedPages();
      renderCollections();
      
      if (currentView === 'collection-detail' && currentCollectionName === collection) {
        renderCollectionPages(collection);
      }
      
      closeAllDropdowns();
    }
  } catch (error) {
    console.error('Error adding page to collection:', error);
  }
}

function getFilteredPages() {
  let filtered = savedPages;

  // Collection filter
  if (currentFilter !== 'all') {
    filtered = filtered.filter(page => page.collection === currentFilter);
  }

  // Search filter
  if (currentSearch) {
    filtered = filtered.filter(page => 
      page.title.toLowerCase().includes(currentSearch) ||
      page.url.toLowerCase().includes(currentSearch) ||
      page.tags.some(tag => tag.toLowerCase().includes(currentSearch))
    );
  }

  // Date filter
  if (currentDateFilter !== 'all') {
    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;
    const oneWeek = 7 * oneDay;
    const oneMonth = 30 * oneDay;
    const oneYear = 365 * oneDay;

    filtered = filtered.filter(page => {
      const pageAge = now - page.timestamp;
      switch (currentDateFilter) {
        case 'today': return pageAge < oneDay;
        case 'week': return pageAge < oneWeek;
        case 'month': return pageAge < oneMonth;
        case 'year': return pageAge < oneYear;
        default: return true;
      }
    });
  }



  // Sort results
  return applySorting(filtered);
}

function createPageCardElement(page) {
  const thumbnail = page.thumbnail || page.favicon || 'icons/icon48.png';
  const domain = new URL(page.url).hostname;
  const date = new Date(page.timestamp).toLocaleDateString();
  const currentCollection = page.collection || 'default';

  const card = document.createElement('div');
  card.className = 'page-card';
  card.dataset.url = page.url;
  
  // Add selected class if page is selected
  if (selectedPages.has(page.url)) {
    card.classList.add('selected');
  }

  // Create checkbox for bulk selection
  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.className = 'page-checkbox';
  checkbox.checked = selectedPages.has(page.url);
  card.appendChild(checkbox);

  const addBtn = document.createElement('button');
  addBtn.className = 'add-to-collection-btn';
  addBtn.title = 'Add to collection';
  addBtn.textContent = '+';
  card.appendChild(addBtn);

  const dropdown = document.createElement('div');
  dropdown.className = 'collection-dropdown';
  
  collections.forEach(collection => {
    const isCurrent = collection === currentCollection;
    const item = document.createElement('div');
    item.className = `collection-dropdown-item ${isCurrent ? 'current' : ''}`;
    item.dataset.collection = collection;
    item.textContent = collection;
    dropdown.appendChild(item);
  });
  card.appendChild(dropdown);

  const header = document.createElement('div');
  header.className = 'page-header';

  const thumbnailImg = document.createElement('img');
  thumbnailImg.src = thumbnail;
  thumbnailImg.alt = 'Thumbnail';
  thumbnailImg.className = 'page-thumbnail';
  thumbnailImg.onerror = () => { thumbnailImg.src = 'icons/icon48.png'; };
  header.appendChild(thumbnailImg);

  const pageInfo = document.createElement('div');
  pageInfo.className = 'page-info';

  const title = document.createElement('div');
  title.className = 'page-title';
  title.textContent = page.title;
  pageInfo.appendChild(title);

  const urlDiv = document.createElement('div');
  urlDiv.className = 'page-url';
  
  const favicon = document.createElement('img');
  favicon.src = page.favicon || 'icons/icon16.png';
  favicon.alt = 'Favicon';
  favicon.className = 'page-favicon';
  favicon.onerror = () => { favicon.style.display = 'none'; };
  urlDiv.appendChild(favicon);
  
  const domainSpan = document.createElement('span');
  domainSpan.textContent = domain;
  urlDiv.appendChild(domainSpan);
  
  pageInfo.appendChild(urlDiv);
  header.appendChild(pageInfo);
  card.appendChild(header);

  const meta = document.createElement('div');
  meta.className = 'page-meta';

  const tags = document.createElement('div');
  tags.className = 'page-tags';
  page.tags.forEach(tag => {
    const tagSpan = document.createElement('span');
    tagSpan.className = 'page-tag';
    tagSpan.textContent = tag;
    tags.appendChild(tagSpan);
  });
  meta.appendChild(tags);

  const actions = document.createElement('div');
  actions.className = 'page-actions';

  const editBtn = document.createElement('button');
  editBtn.className = 'btn btn-secondary edit-btn';
  editBtn.textContent = 'Edit';
  actions.appendChild(editBtn);

  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'btn btn-danger delete-btn';
  deleteBtn.textContent = 'Delete';
  actions.appendChild(deleteBtn);

  meta.appendChild(actions);
  card.appendChild(meta);

  const dateDiv = document.createElement('div');
  dateDiv.className = 'page-date';
  dateDiv.textContent = date;
  card.appendChild(dateDiv);

  // Add reading time estimate
  const readingTime = document.createElement('div');
  readingTime.className = 'page-reading-time';
  const estimatedTime = estimateReadingTime(page.title, page.description || '');
  readingTime.innerHTML = `
    <svg class="reading-time-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="12" cy="12" r="10"/>
      <polyline points="12,6 12,12 16,14"/>
    </svg>
    ${estimatedTime} min read
  `;
  card.appendChild(readingTime);



  // Add hover preview functionality
  card.addEventListener('mouseenter', (e) => showPreview(e, page));
  card.addEventListener('mouseleave', hidePreview);
  card.addEventListener('mousemove', (e) => updatePreviewPosition(e));

  return card;
}

function renderCollections() {
  collectionsList.textContent = '';
  
  collections.forEach(collection => {
    const pageCount = savedPages.filter(page => page.collection === collection).length;
    
    const collectionItem = document.createElement('div');
    collectionItem.className = 'collection-item';
    collectionItem.dataset.collection = collection;
    
    const header = document.createElement('div');
    header.className = 'collection-header';
    
    const info = document.createElement('div');
    info.className = 'collection-info';
    
    const name = document.createElement('span');
    name.className = 'collection-name';
    name.textContent = collection;
    info.appendChild(name);
    
    const count = document.createElement('span');
    count.className = 'collection-count';
    count.textContent = `${pageCount} pages`;
    info.appendChild(count);
    
    header.appendChild(info);
    
    // Add delete button (only for non-default collections)
    if (collection !== 'Default') {
      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'collection-delete-btn';
      deleteBtn.innerHTML = '🗑️';
      deleteBtn.title = 'Delete Collection';
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteCollection(collection);
      });
      header.appendChild(deleteBtn);
    }
    
    collectionItem.appendChild(header);
    collectionsList.appendChild(collectionItem);
  });
  
  document.querySelectorAll('.collection-item').forEach(item => {
    item.addEventListener('click', () => {
      const collectionName = item.dataset.collection;
      showCollectionDetail(collectionName);
    });
  });
}

function editPage(url) {
  const page = savedPages.find(p => p.url === url);
  if (!page) return;

  document.getElementById('editTitle').value = page.title;
  document.getElementById('editTags').value = page.tags.join(', ');
  
  const editCollection = document.getElementById('editCollection');
  editCollection.textContent = '';
  
  collections.forEach(collection => {
    const option = document.createElement('option');
    option.value = collection;
    option.textContent = collection;
    if (collection === page.collection) {
      option.selected = true;
    }
    editCollection.appendChild(option);
  });

  editModal.dataset.currentUrl = url;
  showEditModal();
}

async function deletePage(url) {
  if (!confirm('Are you sure you want to delete this saved page?')) return;

  try {
    await browser.runtime.sendMessage({ action: 'deletePage', url });
    await loadData();
    renderSavedPages();
    renderCollections();
    
    if (currentView === 'collection-detail') {
      renderCollectionPages(currentCollectionName);
    }
  } catch (error) {
    console.error('Error deleting page:', error);
  }
}

function setupModalEvents() {
  const editModal = document.getElementById('editModal');
  const saveEditBtn = document.getElementById('saveEditBtn');
  const cancelEditBtn = document.getElementById('cancelEditBtn');
  const closeEditBtn = editModal.querySelector('.close-btn');

  saveEditBtn.addEventListener('click', savePageEdit);
  cancelEditBtn.addEventListener('click', hideEditModal);
  closeEditBtn.addEventListener('click', hideEditModal);

  const collectionModal = document.getElementById('collectionModal');
  const saveCollectionBtn = document.getElementById('saveCollectionBtn');
  const cancelCollectionBtn = document.getElementById('cancelCollectionBtn');
  const closeCollectionBtn = collectionModal.querySelector('.close-btn');

  saveCollectionBtn.addEventListener('click', saveCollection);
  cancelCollectionBtn.addEventListener('click', hideCollectionModal);
  closeCollectionBtn.addEventListener('click', hideCollectionModal);

  window.addEventListener('click', (e) => {
    if (e.target === editModal) hideEditModal();
    if (e.target === collectionModal) hideCollectionModal();
  });
}

function showEditModal() {
  editModal.style.display = 'block';
}

function hideEditModal() {
  editModal.style.display = 'none';
}

function showCollectionModal() {
  collectionModal.style.display = 'block';
  document.getElementById('newCollectionName').value = '';
}

function hideCollectionModal() {
  collectionModal.style.display = 'none';
}

async function savePageEdit() {
  const url = editModal.dataset.currentUrl;
  const title = document.getElementById('editTitle').value.trim();
  const collection = document.getElementById('editCollection').value;
  const tags = document.getElementById('editTags').value
    .split(',')
    .map(tag => tag.trim())
    .filter(tag => tag.length > 0);

  if (!title) {
    alert('Please enter a title');
    return;
  }

  try {
    const page = savedPages.find(p => p.url === url);
    if (page) {
      page.title = title;
      page.collection = collection;
      page.tags = tags;

      await browser.runtime.sendMessage({ action: 'updatePage', page });
      await loadData();
      renderSavedPages();
      renderCollections();
      
      if (currentView === 'collection-detail') {
        renderCollectionPages(currentCollectionName);
      }
      
      hideEditModal();
    }
  } catch (error) {
    console.error('Error updating page:', error);
  }
}

async function saveCollection() {
  const name = document.getElementById('newCollectionName').value.trim();
  
  if (!name) {
    alert('Please enter a collection name');
    return;
  }

  if (collections.includes(name)) {
    alert('Collection already exists');
    return;
  }

  try {
    await browser.runtime.sendMessage({ action: 'saveCollection', collection: name });
    await loadData();
    renderCollections();
    hideCollectionModal();
    
    // Note: No need to refresh extension for full-page app
  } catch (error) {
    console.error('Error saving collection:', error);
  }
}

function applyTheme(theme) {
  if (theme === 'dark') {
    document.body.classList.add('dark-theme');
    if (darkModeToggle) darkModeToggle.checked = true;
  } else {
    document.body.classList.remove('dark-theme');
    if (darkModeToggle) darkModeToggle.checked = false;
  }
}

function getSystemTheme() {
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function loadTheme() {
  const savedTheme = localStorage.getItem('sfl-theme');
  if (savedTheme) {
    applyTheme(savedTheme);
  } else {
    applyTheme(getSystemTheme());
  }
}

// Reading experience helper functions
function estimateReadingTime(title, description) {
  const text = title + ' ' + description;
  const wordsPerMinute = 200;
  const words = text.trim().split(/\s+/).length;
  const minutes = Math.max(1, Math.ceil(words / wordsPerMinute));
  return minutes;
}

function showPreview(event, page) {
  clearTimeout(previewTimeout);
  previewTimeout = setTimeout(() => {
    const preview = pagePreview;
    
    // Update preview content
    preview.querySelector('.preview-title').textContent = page.title;
    preview.querySelector('.preview-reading-time').textContent = `${estimateReadingTime(page.title, page.description || '')} min read`;
    
    const description = page.description || `Visit ${new URL(page.url).hostname}`;
    preview.querySelector('.preview-description').textContent = description;
    
    // Update tags
    const tagsContainer = preview.querySelector('.preview-tags');
    tagsContainer.innerHTML = '';
    page.tags.forEach(tag => {
      const tagSpan = document.createElement('span');
      tagSpan.className = 'preview-tag';
      tagSpan.textContent = tag;
      tagsContainer.appendChild(tagSpan);
    });
    
    // Position and show preview
    updatePreviewPosition(event);
    preview.style.display = 'block';
  }, 500); // Show after 500ms hover
}

function hidePreview() {
  clearTimeout(previewTimeout);
  pagePreview.style.display = 'none';
}

function updatePreviewPosition(event) {
  const preview = pagePreview;
  const rect = preview.getBoundingClientRect();
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  
  let x = event.clientX + 15;
  let y = event.clientY + 15;
  
  // Adjust position to keep preview in viewport
  if (x + rect.width > viewportWidth) {
    x = event.clientX - rect.width - 15;
  }
  if (y + rect.height > viewportHeight) {
    y = event.clientY - rect.height - 15;
  }
  
  preview.style.left = x + 'px';
  preview.style.top = y + 'px';
}

// Collection management functions
async function deleteCollection(collectionName) {
  if (!confirm(`Are you sure you want to delete the collection "${collectionName}"?\n\nThis will move all pages in this collection to the Default collection.`)) {
    return;
  }

  try {
    // Move all pages from this collection to Default
    const pagesToMove = savedPages.filter(page => page.collection === collectionName);
    pagesToMove.forEach(page => {
      page.collection = 'Default';
    });

    // Remove the collection from the collections array
    const collectionIndex = collections.indexOf(collectionName);
    if (collectionIndex > -1) {
      collections.splice(collectionIndex, 1);
    }

    // Save updated data
    await browser.storage.local.set({ 
      savedPages: savedPages,
      collections: collections 
    });

    // Refresh UI
    renderSavedPages();
    renderCollections();

    console.log(`Collection "${collectionName}" deleted successfully`);
  } catch (error) {
    console.error('Error deleting collection:', error);
    alert('Failed to delete collection. Please try again.');
  }
}

function applySorting(pages) {
  switch (currentSort) {
    case 'newest':
      return pages.sort((a, b) => b.timestamp - a.timestamp);
    case 'oldest':
      return pages.sort((a, b) => a.timestamp - b.timestamp);
    case 'alphabetical':
      return pages.sort((a, b) => a.title.localeCompare(b.title));
    case 'domain':
      return pages.sort((a, b) => {
        try {
          const domainA = new URL(a.url).hostname;
          const domainB = new URL(b.url).hostname;
          return domainA.localeCompare(domainB);
        } catch (e) {
          return 0;
        }
      });
    default:
      return pages.sort((a, b) => b.timestamp - a.timestamp);
  }
}

// Bulk operations helper functions
function updateBulkActionsVisibility() {
  if (selectedPages.size > 0) {
    bulkActions.style.display = 'flex';
    selectedCount.textContent = selectedPages.size;
  } else {
    bulkActions.style.display = 'none';
  }
}

function togglePageSelection(url) {
  if (selectedPages.has(url)) {
    selectedPages.delete(url);
  } else {
    selectedPages.add(url);
  }
  
  // Update checkbox state and card appearance
  const pageCard = document.querySelector(`[data-url="${url}"]`);
  if (pageCard) {
    const checkbox = pageCard.querySelector('.page-checkbox');
    if (checkbox) {
      checkbox.checked = selectedPages.has(url);
    }
    pageCard.classList.toggle('selected', selectedPages.has(url));
  }
  
  updateBulkActionsVisibility();
}

function selectAllPages() {
  const filteredPages = getFilteredPages();
  filteredPages.forEach(page => {
    selectedPages.add(page.url);
  });
  renderSavedPages();
  updateBulkActionsVisibility();
}

function selectNonePages() {
  selectedPages.clear();
  renderSavedPages();
  updateBulkActionsVisibility();
}

async function bulkDeletePages() {
  if (selectedPages.size === 0) return;
  
  const count = selectedPages.size;
  if (!confirm(`Are you sure you want to delete ${count} selected pages?`)) return;
  
  try {
    for (const url of selectedPages) {
      await browser.runtime.sendMessage({ action: 'deletePage', url });
    }
    
    selectedPages.clear();
    updateBulkActionsVisibility();
    await loadData();
    renderSavedPages();
    renderCollections();
    
    if (currentView === 'collection-detail') {
      renderCollectionPages(currentCollectionName);
    }
  } catch (error) {
    console.error('Error deleting pages:', error);
    alert('Failed to delete some pages.');
  }
}

function showBulkMoveDialog() {
  if (selectedPages.size === 0) return;
  
  const collection = prompt(`Move ${selectedPages.size} pages to collection:`, 'default');
  if (!collection) return;
  
  bulkMoveToCollection(collection);
}

async function bulkMoveToCollection(targetCollection) {
  try {
    for (const url of selectedPages) {
      const page = savedPages.find(p => p.url === url);
      if (page) {
        page.collection = targetCollection;
        await browser.runtime.sendMessage({ action: 'updatePage', page });
      }
    }
    
    selectedPages.clear();
    updateBulkActionsVisibility();
    await loadData();
    renderSavedPages();
    renderCollections();
    
    if (currentView === 'collection-detail') {
      renderCollectionPages(currentCollectionName);
    }
  } catch (error) {
    console.error('Error moving pages:', error);
    alert('Failed to move some pages.');
  }
}

function showBulkTagDialog() {
  if (selectedPages.size === 0) return;
  
  const tags = prompt(`Add tags to ${selectedPages.size} pages (comma-separated):`, '');
  if (!tags) return;
  
  bulkAddTags(tags);
}

async function bulkAddTags(tagsString) {
  const newTags = tagsString.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);
  if (newTags.length === 0) return;
  
  try {
    for (const url of selectedPages) {
      const page = savedPages.find(p => p.url === url);
      if (page) {
        const existingTags = new Set(page.tags);
        newTags.forEach(tag => existingTags.add(tag));
        page.tags = Array.from(existingTags);
        await browser.runtime.sendMessage({ action: 'updatePage', page });
      }
    }
    
    selectedPages.clear();
    updateBulkActionsVisibility();
    await loadData();
    renderSavedPages();
    renderCollections();
    
    if (currentView === 'collection-detail') {
      renderCollectionPages(currentCollectionName);
    }
  } catch (error) {
    console.error('Error adding tags:', error);
    alert('Failed to add tags to some pages.');
  }
}

// Keyboard shortcuts handler
function handleKeyboardShortcuts(e) {
  // Don't trigger shortcuts when typing in input fields
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
    return;
  }
  
  switch (e.key) {
    case '/':
    case 'f':
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        searchInput.focus();
      }
      break;
    case 's':
      if (e.ctrlKey && e.shiftKey) {
        e.preventDefault();
        // Trigger save on current page
        browser.tabs.query({ active: true, currentWindow: true }).then(tabs => {
          if (tabs[0]) {
            browser.runtime.sendMessage({ action: 'saveCurrentPage', tab: tabs[0] });
          }
        });
      }
      break;
    case 'a':
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        selectAllPages();
      }
      break;
    case 'Escape':
      selectNonePages();
      break;
    case '?':
      e.preventDefault();
      toggleKeyboardShortcutsHelp();
      break;
    case '1':
    case '2':
    case '3':
      if (e.altKey) {
        e.preventDefault();
        const tabIndex = parseInt(e.key) - 1;
        const tabs = ['saved', 'collections', 'settings'];
        if (tabs[tabIndex]) {
          switchTab(tabs[tabIndex]);
        }
      }
      break;
  }
}

function toggleKeyboardShortcutsHelp() {
  const shortcuts = keyboardShortcuts;
  const isVisible = shortcuts.classList.contains('show');
  
  if (isVisible) {
    shortcuts.classList.remove('show');
  } else {
    shortcuts.innerHTML = `
      <div><strong>Keyboard Shortcuts:</strong></div>
      <div><strong>Ctrl+F</strong> - Focus search</div>
      <div><strong>Ctrl+A</strong> - Select all pages</div>
      <div><strong>Esc</strong> - Clear selection</div>
      <div><strong>Alt+1/2/3</strong> - Switch tabs</div>
      <div><strong>Shift + ?</strong> - Toggle this help</div>
    `;
    shortcuts.classList.add('show');
    
    // Auto-hide after 5 seconds
         setTimeout(() => {
       shortcuts.classList.remove('show');
     }, 5000);
   }
 }

// Party functionality 🎉
function triggerParty() {
  // Play party sound
  try {
    const audio = new Audio('party.mp3');
    audio.volume = 0.5;
    audio.play().catch(e => console.log('Could not play party sound:', e));
  } catch (error) {
    console.log('Party sound not available:', error);
  }
  
  // Create confetti
  createConfetti();
  
  // Add some excitement to the button
  secretPartyBtn.style.transform = 'scale(1.5) rotate(360deg)';
  setTimeout(() => {
    secretPartyBtn.style.transform = '';
  }, 600);
}

function createConfetti() {
  // Clear any existing confetti
  confettiContainer.innerHTML = '';
  
  // Create 50 confetti pieces
  for (let i = 0; i < 50; i++) {
    const confetti = document.createElement('div');
    confetti.className = 'confetti-piece';
    
    // Random horizontal position
    confetti.style.left = Math.random() * 100 + '%';
    
    // Random animation duration (2-4 seconds)
    const duration = (Math.random() * 2 + 2) + 's';
    confetti.style.animationDuration = duration;
    
    // Random delay to stagger the confetti
    const delay = Math.random() * 0.5 + 's';
    confetti.style.animationDelay = delay;
    
    confettiContainer.appendChild(confetti);
  }
  
  // Clean up confetti after animation
  setTimeout(() => {
    confettiContainer.innerHTML = '';
  }, 5000);
}

 