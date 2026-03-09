/* ============================================
   HELPERS.JS - Utility Functions
   ============================================ */

// Generate unique ID for notes
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// Format date for display
function formatDate(date) {
  const now = new Date();
  const noteDate = new Date(date);
  const diffMs = now - noteDate;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} min ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  
  return noteDate.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric',
    year: noteDate.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
  });
}

// Debounce function for auto-save
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Strip HTML tags for preview
function stripHtml(html) {
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || '';
}

// Truncate text
function truncate(text, length = 100) {
  if (text.length <= length) return text;
  return text.substr(0, length) + '...';
}

// Format bytes for display
function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

// Show toast notification
function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <strong>${type === 'success' ? '✓' : type === 'error' ? '✗' : 'ℹ'}</strong>
    <span>${message}</span>
  `;
  
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.style.animation = 'fadeOut 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// Get text from contenteditable
function getTextContent(element) {
  return element.innerText || element.textContent || '';
}

// Insert text at cursor in contenteditable
function insertTextAtCursor(text) {
  const selection = window.getSelection();
  if (selection.rangeCount > 0) {
    const range = selection.getRangeAt(0);
    range.deleteContents();
    range.insertNode(document.createTextNode(text));
    range.collapse(false);
  }
}

// Copy to clipboard
async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    showToast('Copied to clipboard!');
    return true;
  } catch (err) {
    console.error('Failed to copy:', err);
    showToast('Failed to copy', 'error');
    return false;
  }
}

// Check if browser supports required features
function checkBrowserSupport() {
  const required = {
    localStorage: typeof(Storage) !== "undefined",
    serviceWorker: 'serviceWorker' in navigator,
    notifications: 'Notification' in window
  };
  
  return required;
}

// Safe JSON parse
function safeJsonParse(str, fallback = null) {
  try {
    return JSON.parse(str);
  } catch (e) {
    console.error('JSON parse error:', e);
    return fallback;
  }
}

// Console log with emoji (for debugging)
function log(message, type = 'info') {
  const emoji = {
    info: 'ℹ️',
    success: '✅',
    warning: '⚠️',
    error: '❌',
    privacy: '🔒'
  };
  console.log(`${emoji[type] || 'ℹ️'} ${message}`);
}

console.log('✅ Helpers loaded');