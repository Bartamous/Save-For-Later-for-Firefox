// Import page JavaScript functionality

// Wait for DOM to be loaded
document.addEventListener('DOMContentLoaded', () => {
  const fileInput = document.getElementById('fileInput');
  const importBtn = document.getElementById('importBtn');
  const cancelBtn = document.getElementById('cancelBtn');
  const status = document.getElementById('status');
  const debugLog = document.getElementById('debugLog');

  // Debug logging function
  function log(message) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}`;
    console.log(logMessage);
    
    const logDiv = document.createElement('div');
    logDiv.textContent = logMessage;
    debugLog.appendChild(logDiv);
    debugLog.style.display = 'block';
    debugLog.scrollTop = debugLog.scrollHeight;
  }

  function showStatus(message, isError = false) {
    status.textContent = message;
    status.className = `status ${isError ? 'error' : 'success'}`;
    status.style.display = 'block';
  }

  log('Import page loaded');

  fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    importBtn.disabled = !file;
    if (file) {
      log(`File selected: ${file.name} (${file.size} bytes, type: ${file.type})`);
    }
  });

  importBtn.addEventListener('click', async () => {
    const file = fileInput.files[0];
    if (!file) {
      log('ERROR: No file selected');
      showStatus('Please select a file first.', true);
      return;
    }

    log(`Starting import process for file: ${file.name}`);
    importBtn.disabled = true;
    showStatus('Reading file...');

    try {
      log('Reading file content...');
      const text = await file.text();
      log(`File read successfully. Content length: ${text.length} characters`);
      log(`Content preview: ${text.substring(0, 200)}...`);

      showStatus('Sending data to background script...');
      log('Sending import message to background script');

      const response = await browser.runtime.sendMessage({
        action: 'processImportData',
        data: text,
        filename: file.name
      });

      log(`Background script response: ${JSON.stringify(response)}`);

      if (response.success) {
        log(`Import successful: ${response.count} pages imported`);
        showStatus(`Successfully imported ${response.count} pages!`);
        
        // Notify popup (if still open) about completion
        browser.runtime.sendMessage({
          action: 'importComplete',
          success: true,
          count: response.count
        });

        // Close this tab after a short delay
        setTimeout(() => {
          log('Closing import tab...');
          window.close();
        }, 2000);
      } else {
        log(`Import failed: ${response.error}`);
        showStatus(`Import failed: ${response.error}`, true);
        importBtn.disabled = false;
      }
    } catch (error) {
      log(`ERROR during import: ${error.message}`);
      log(`Error stack: ${error.stack}`);
      showStatus(`Error: ${error.message}`, true);
      importBtn.disabled = false;
    }
  });

  cancelBtn.addEventListener('click', () => {
    log('Import cancelled by user');
    browser.runtime.sendMessage({
      action: 'importComplete',
      success: false,
      error: 'Import cancelled by user'
    });
    window.close();
  });

  // Auto-focus the file input
  fileInput.focus();
}); 