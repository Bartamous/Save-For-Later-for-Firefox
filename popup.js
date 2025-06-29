// Popup script for Save For Later extension

let savedPages = [];
let collections = ['default'];
let currentFilter = 'all';
let currentSearch = '';
let currentView = 'collections';
let currentCollectionName = '';

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

// Initialize popup
document.addEventListener('DOMContentLoaded', async () => {
  await loadData();
  setupEventListeners();
  renderSavedPages();
  renderCollections();
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


  collectionFilter.addEventListener('change', (e) => {
    currentFilter = e.target.value;
    renderSavedPages();
  });

  searchInput.addEventListener('input', (e) => {
    currentSearch = e.target.value.toLowerCase();
    renderSavedPages();
  });

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

  // Modal events
  setupModalEvents();
  
  // Close dropdowns when clicking outside
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.add-to-collection-btn') && !e.target.closest('.collection-dropdown')) {
      closeAllDropdowns();
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

  // Clear existing content
  collectionPagesList.textContent = '';
  
  // Add page cards
  collectionPages.forEach(page => {
    const cardElement = createPageCardElement(page);
    collectionPagesList.appendChild(cardElement);
  });
  
  setupPageCardEventListeners();
}


function updateCollectionFilter() {
  // Clear existing options
  collectionFilter.textContent = '';
  
  // Add "All Collections" option
  const allOption = document.createElement('option');
  allOption.value = 'all';
  allOption.textContent = 'All Collections';
  collectionFilter.appendChild(allOption);
  
  // Add collection options
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

  // Clear existing content
  savedPagesList.textContent = '';
  
  // Add page cards
  filteredPages.forEach(page => {
    const cardElement = createPageCardElement(page);
    savedPagesList.appendChild(cardElement);
  });
  
  setupPageCardEventListeners();
}


function setupPageCardEventListeners() {
  // Add click listeners to page cards to open pages
  document.querySelectorAll('.page-card').forEach(card => {
    card.addEventListener('click', (e) => {
      // Don't trigger if clicking on buttons or dropdown
      if (e.target.closest('.page-actions') || 
          e.target.closest('.add-to-collection-btn') || 
          e.target.closest('.collection-dropdown')) {
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
    
    // Update current collection indicator
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

// Add page to collection
async function addPageToCollection(url, collection) {
  try {
    const page = savedPages.find(p => p.url === url);
    if (page) {
      page.collection = collection;
      await browser.runtime.sendMessage({ action: 'updatePage', page });
      await loadData();
      renderSavedPages();
      renderCollections();
      
      // If we're viewing a collection, refresh that view too
      if (currentView === 'collection-detail' && currentCollectionName === collection) {
        renderCollectionPages(collection);
      }
      
      closeAllDropdowns();
    }
  } catch (error) {
    console.error('Error adding page to collection:', error);
  }
}

// Get filtered pages based on current filters
function getFilteredPages() {
  let filtered = savedPages;

  if (currentFilter !== 'all') {
    filtered = filtered.filter(page => page.collection === currentFilter);
  }

  if (currentSearch) {
    filtered = filtered.filter(page => 
      page.title.toLowerCase().includes(currentSearch) ||
      page.url.toLowerCase().includes(currentSearch) ||
      page.tags.some(tag => tag.toLowerCase().includes(currentSearch))
    );
  }

  return filtered.sort((a, b) => b.timestamp - a.timestamp);
}


function createPageCardElement(page) {
  const thumbnail = page.thumbnail || page.favicon || 'icons/icon48.png';
  const domain = new URL(page.url).hostname;
  const date = new Date(page.timestamp).toLocaleDateString();
  const currentCollection = page.collection || 'default';

  // Create main card container
  const card = document.createElement('div');
  card.className = 'page-card';
  card.dataset.url = page.url;

  // Create add to collection button
  const addBtn = document.createElement('button');
  addBtn.className = 'add-to-collection-btn';
  addBtn.title = 'Add to collection';
  addBtn.textContent = '+';
  card.appendChild(addBtn);

  // Create collection dropdown
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

  // Create page header
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

  // Create page meta
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

  // Create date
  const dateDiv = document.createElement('div');
  dateDiv.className = 'page-date';
  dateDiv.textContent = date;
  card.appendChild(dateDiv);

  return card;
}


function renderCollections() {
  // Clear existing content
  collectionsList.textContent = '';
  
  collections.forEach(collection => {
    const pageCount = savedPages.filter(page => page.collection === collection).length;
    
    const collectionItem = document.createElement('div');
    collectionItem.className = 'collection-item';
    collectionItem.dataset.collection = collection;
    
    const header = document.createElement('div');
    header.className = 'collection-header';
    
    const name = document.createElement('span');
    name.className = 'collection-name';
    name.textContent = collection;
    header.appendChild(name);
    
    const count = document.createElement('span');
    count.className = 'collection-count';
    count.textContent = `${pageCount} pages`;
    header.appendChild(count);
    
    collectionItem.appendChild(header);
    collectionsList.appendChild(collectionItem);
  });
  
  // Add click listeners to collection items
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
  
  // Update collection select
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
    
    // If viewing a collection refresh that view too
    if (currentView === 'collection-detail') {
      renderCollectionPages(currentCollectionName);
    }
  } catch (error) {
    console.error('Error deleting page:', error);
  }
}


function setupModalEvents() {
  // Edit modal
  const editModal = document.getElementById('editModal');
  const saveEditBtn = document.getElementById('saveEditBtn');
  const cancelEditBtn = document.getElementById('cancelEditBtn');
  const closeEditBtn = editModal.querySelector('.close-btn');

  saveEditBtn.addEventListener('click', savePageEdit);
  cancelEditBtn.addEventListener('click', hideEditModal);
  closeEditBtn.addEventListener('click', hideEditModal);

  // Collection modal
  const collectionModal = document.getElementById('collectionModal');
  const saveCollectionBtn = document.getElementById('saveCollectionBtn');
  const cancelCollectionBtn = document.getElementById('cancelCollectionBtn');
  const closeCollectionBtn = collectionModal.querySelector('.close-btn');

  saveCollectionBtn.addEventListener('click', saveCollection);
  cancelCollectionBtn.addEventListener('click', hideCollectionModal);
  closeCollectionBtn.addEventListener('click', hideCollectionModal);

  // Close modals when clicking outside
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
      
      // If viewing a collection refresh that view too
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
    
    // Refresh the extension to update context menu
    await browser.runtime.sendMessage({ action: 'refreshExtension' });
  } catch (error) {
    console.error('Error saving collection:', error);
  }
}


window.editPage = editPage;
window.deletePage = deletePage; 