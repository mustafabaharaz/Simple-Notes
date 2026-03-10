/* ============================================
   APP.JS - Main Application Logic
   Privacy-First AI Notes App
   ============================================ */

class NotesApp {
  constructor() {
    this.currentNote = null;
    this.activeTagFilter = null;
    this.autoSaveTimeout = null;
    this.init();
  }

  // Initialize app
  init() {
    this.loadTheme();

    // Hide loading screen
    setTimeout(() => {
    log('Initializing Simple Notes App...', 'info');

      document.getElementById('loading-screen').style.display = 'none';
      document.getElementById('app').style.display = 'flex';
      log('App loaded successfully!', 'success');
    }, 1000);

    // Setup event listeners
    this.setupEventListeners();

    // Load and render notes
    this.renderNotes();
    this.updateNotesCount();

    // Show welcome screen if no notes
    if (storage.getNotes().length === 0) {
      this.showWelcomeScreen();
    }

    log('App initialized successfully!', 'success');
  }

  // Setup all event listeners
  setupEventListeners() {
    // New note button
    document.getElementById('new-note-btn')?.addEventListener('click', () => {
      this.createNewNote();
    });

    // Get started button
    document.getElementById('get-started-btn')?.addEventListener('click', () => {
      this.createNewNote();
    });

    // Privacy dashboard button
    document.getElementById('privacy-dashboard-btn')?.addEventListener('click', () => {
      privacyMonitor.showDashboard();
    });

    // Close privacy dashboard
    document.getElementById('close-privacy-dashboard')?.addEventListener('click', () => {
      privacyMonitor.hideDashboard();
    });

    // Click outside modal to close
    document.getElementById('privacy-dashboard')?.addEventListener('click', (e) => {
      if (e.target.id === 'privacy-dashboard') {
        privacyMonitor.hideDashboard();
      }
    });

    // Tag functionality
    document.getElementById('ai-suggest-tags-btn')?.addEventListener('click', () => {
      this.suggestAITags();
    });

    document.getElementById('add-tag-btn')?.addEventListener('click', () => {
      this.addTagManually();
    });

    document.getElementById('tag-input')?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.addTagManually();
      }
    });    

    // Note title input
    const titleInput = document.getElementById('note-title');
    if (titleInput) {
      titleInput.addEventListener('input', debounce(() => {
        this.autoSaveNote();
      }, 500));
    }

    // Note content editor
    const contentEditor = document.getElementById('note-content');
    if (contentEditor) {
      contentEditor.addEventListener('input', debounce(() => {
        this.autoSaveNote();
      }, 1000));

      // Track bytes processed locally
      contentEditor.addEventListener('input', () => {
        const bytes = new Blob([contentEditor.innerHTML]).size;
        privacyMonitor.trackLocalProcessing(bytes);
      });
    }

    // Delete note button
    document.getElementById('delete-note-btn')?.addEventListener('click', () => {
      this.deleteCurrentNote();
    });

    // Toolbar buttons
    this.setupToolbar();

    // Encryption buttons
    document.getElementById('encrypt-note-btn')?.addEventListener('click', () => {
      this.encryptCurrentNote();
    });

    document.getElementById('decrypt-note-btn')?.addEventListener('click', () => {
      this.decryptCurrentNote();
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      // Ctrl/Cmd + N: New note
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        this.createNewNote();
      }

      // Ctrl/Cmd + S: Save note
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        this.saveNote();
        showToast('Note saved!');
      }

      // Ctrl/Cmd + D: Delete note
      if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
        e.preventDefault();
        this.deleteCurrentNote();
      }
    });

    log('Event listeners setup complete', 'info');

    // Theme toggle
      const themeToggle = document.getElementById('theme-toggle');
  if (themeToggle) {
    const self = this;
    themeToggle.addEventListener('click', function() {
      self.toggleTheme();
    });
  }
  }

  // Setup toolbar buttons
  setupToolbar() {
    const toolbar = document.querySelectorAll('.toolbar-btn[data-action]');
    
    toolbar.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const action = btn.dataset.action;
        this.executeToolbarAction(action);
      });
    });

    // AI auto-tag button (placeholder for future)
    document.getElementById('ai-tag-btn')?.addEventListener('click', () => {
      showToast('AI Auto-Tag coming soon! 🤖', 'info');
      privacyMonitor.trackAIOperation('auto-tag-preview', 0);
    });
  }

  // Execute toolbar actions
  executeToolbarAction(action) {
    const contentEditor = document.getElementById('note-content');
    if (!contentEditor) return;

    contentEditor.focus();

    switch(action) {
      case 'bold':
        document.execCommand('bold');
        break;
      case 'italic':
        document.execCommand('italic');
        break;
      case 'underline':
        document.execCommand('underline');
        break;
      case 'bullet-list':
        document.execCommand('insertUnorderedList');
        break;
      case 'date':
        const today = new Date().toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });
        insertTextAtCursor(today);
        break;
    }

    this.autoSaveNote();
  }

// Create new note
createNewNote() {
  const note = storage.createNote('Untitled Note', '');
  privacyMonitor.trackNoteCreated();  // ✅ This line should be here
  
  this.renderNotes();
  this.updateNotesCount();
  this.openNote(note.id);
  
  showToast('New note created!');
  
  // Focus on title
  setTimeout(() => {
    const titleInput = document.getElementById('note-title');
    if (titleInput) {
      titleInput.focus();
      titleInput.select();
    }
  }, 100);
}
// Open note (updated for encryption support)
  openNote(noteId) {
    const note = storage.getNote(noteId);
    if (!note) return;

    this.currentNote = note;

    // Hide welcome, show editor
    document.getElementById('welcome-screen').style.display = 'none';
    document.getElementById('note-editor-screen').style.display = 'flex';

    // Show/hide encryption buttons based on state
    const encryptBtn = document.getElementById('encrypt-note-btn');
    const decryptBtn = document.getElementById('decrypt-note-btn');

    if (note.encrypted) {
      // Note is encrypted - show decrypt button, hide encrypt
      encryptBtn.style.display = 'none';
      decryptBtn.style.display = 'inline-flex';

      // Show encrypted placeholder
      document.getElementById('note-title').value = '🔒 Encrypted Note';
      document.getElementById('note-title').disabled = true;
      
      document.getElementById('note-content').innerHTML = `
        <div style="text-align: center; padding: 60px 20px; color: var(--color-text-light);">
          <div style="font-size: 64px; margin-bottom: 20px;">🔒</div>
          <h3>This note is encrypted</h3>
          <p>Click "🔓 Decrypt Note" above to view the contents</p>
          <small style="display: block; margin-top: 10px;">Encrypted on: ${new Date(note.encryptedAt || note.modified).toLocaleString()}</small>
        </div>
      `;
      document.getElementById('note-content').contentEditable = false;

    } else {
      // Note is not encrypted - show encrypt button, hide decrypt
      encryptBtn.style.display = 'inline-flex';
      decryptBtn.style.display = 'none';

      // Load note content normally
      document.getElementById('note-title').value = note.title;
      document.getElementById('note-title').disabled = false;
      document.getElementById('note-content').innerHTML = note.content;
      document.getElementById('note-content').contentEditable = true;
    }

    // Update active state in list
    document.querySelectorAll('.note-item').forEach(item => {
      item.classList.remove('active');
    });
    document.querySelector(`[data-note-id="${noteId}"]`)?.classList.add('active');

    log(`Opened note: ${noteId}${note.encrypted ? ' (encrypted)' : ''}`, 'info');

    // Show tags section and render tags
    document.getElementById('tags-section').style.display = 'block';
    this.renderNoteTags();
  }

  // Auto-save note
  autoSaveNote() {
    if (!this.currentNote) return;

    clearTimeout(this.autoSaveTimeout);
    
    this.autoSaveTimeout = setTimeout(() => {
      this.saveNote();
    }, 500);
  }

  // Save note
  saveNote() {
    if (!this.currentNote) return;

    const title = document.getElementById('note-title')?.value || 'Untitled Note';
    const content = document.getElementById('note-content')?.innerHTML || '';

    storage.updateNote(this.currentNote.id, {
      title: title.trim(),
      content: content
    });

    // Update in list
    this.renderNotes();

    // Show save status
    const saveStatus = document.getElementById('save-status');
    if (saveStatus) {
      saveStatus.textContent = '✓ Saved';
      saveStatus.style.color = 'var(--color-success)';
    }

    // Track local processing
    const bytes = new Blob([JSON.stringify({ title, content })]).size;
    privacyMonitor.trackLocalProcessing(bytes);
  }

  // Delete current note
  deleteCurrentNote() {
    if (!this.currentNote) return;

    if (confirm('Delete this note? This cannot be undone.')) {
      storage.deleteNote(this.currentNote.id);
      this.currentNote = null;

      this.renderNotes();
      this.updateNotesCount();
      this.showWelcomeScreen();
    }
  }

  // Render notes list
  renderNotes() {
    const notesList = document.getElementById('notes-list');
    if (!notesList) return;

    const notes = storage.getNotes();

    if (notes.length === 0) {
      notesList.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📝</div>
          <div class="empty-state-text">No notes yet</div>
        </div>
      `;
      return;
    }

    notesList.innerHTML = notes.map(note => {
      const preview = truncate(stripHtml(note.content), 60);
      const isActive = this.currentNote?.id === note.id;

      return `
        <div class="note-item ${isActive ? 'active' : ''}" data-note-id="${note.id}">
          <div class="note-item-title">${note.title}</div>
          <div class="note-item-preview">${preview || 'No content'}</div>
          <div class="note-item-meta">
            <span>📅 ${formatDate(note.modified)}</span>
            ${note.encrypted ? '<span class="tag tag-encrypted">🔒 Encrypted</span>' : ''}
          </div>
        </div>
      `;
    }).join('');

    // Add click listeners to notes
    notesList.querySelectorAll('.note-item').forEach(item => {
      item.addEventListener('click', () => {
        const noteId = item.dataset.noteId;
        this.openNote(noteId);
      });
    });
  }

  // Update notes count
  updateNotesCount() {
    const countBadge = document.getElementById('notes-count');
    if (countBadge) {
      countBadge.textContent = storage.getNotes().length;
    }
  }

  // Show welcome screen
  showWelcomeScreen() {
    document.getElementById('welcome-screen').style.display = 'flex';
    document.getElementById('note-editor-screen').style.display = 'none';
    this.currentNote = null;
  }
}

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.app = new NotesApp();
  });
} else {
  window.app = new NotesApp();
}

// Attach encryption-related methods to the NotesApp prototype (they belong to the class instance)
NotesApp.prototype.encryptCurrentNote = function() {
  if (!this.currentNote) {
    showToast('No note selected', 'warning');
    return;
  }

  if (this.currentNote.encrypted) {
    showToast('Note is already encrypted', 'warning');
    return;
  }

  this.showPasswordModal('encrypt');
};

NotesApp.prototype.decryptCurrentNote = function() {
  if (!this.currentNote) {
    showToast('No note selected', 'warning');
    return;
  }

  if (!this.currentNote.encrypted) {
    showToast('Note is not encrypted', 'warning');
    return;
  }

  this.showPasswordModal('decrypt');
};

NotesApp.prototype.showPasswordModal = function(action) {
  const modal = document.createElement('div');
  modal.className = 'password-modal';
  modal.innerHTML = `
    <div class="password-modal-content">
      <h3>${action === 'encrypt' ? '🔒 Encrypt Note' : '🔓 Decrypt Note'}</h3>
      <p>${action === 'encrypt' ? 'Enter a password to encrypt this note:' : 'Enter password to decrypt this note:'}</p>
      
      <input type="password" id="encryption-password-input" class="password-input" 
             placeholder="Enter password" autocomplete="off">
      
      ${action === 'encrypt' ? `
        <div class="password-strength-indicator">
          <div id="password-strength-bar" class="password-strength-bar"></div>
        </div>
        <small id="password-feedback" style="color: var(--color-text-light); display: block; margin-bottom: 10px;">
          Use a strong password with letters, numbers, and symbols
        </small>
      ` : ''}
      
      <div class="password-buttons">
        <button class="btn btn-secondary" id="cancel-password-btn">Cancel</button>
        <button class="btn btn-primary" id="confirm-password-btn">
          ${action === 'encrypt' ? 'Encrypt' : 'Decrypt'}
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const passwordInput = document.getElementById('encryption-password-input');
  const confirmBtn = document.getElementById('confirm-password-btn');
  const cancelBtn = document.getElementById('cancel-password-btn');

  setTimeout(() => passwordInput.focus(), 100);

  if (action === 'encrypt') {
    passwordInput.addEventListener('input', () => {
      const strength = checkPasswordStrength(passwordInput.value);
      const strengthBar = document.getElementById('password-strength-bar');
      const feedback = document.getElementById('password-feedback');

      strengthBar.className = `password-strength-bar password-strength-${strength.level}`;
      
      if (strength.feedback.length > 0) {
        feedback.textContent = strength.feedback.join(', ');
        feedback.style.color = 'var(--color-danger)';
      } else {
        feedback.textContent = '✓ Strong password!';
        feedback.style.color = 'var(--color-success)';
      }
    });
  }

  confirmBtn.addEventListener('click', () => {
    const password = passwordInput.value;
    
    if (!password) {
      showToast('Please enter a password', 'warning');
      return;
    }

    if (action === 'encrypt') {
      this.performEncryption(password);
    } else {
      this.performDecryption(password);
    }

    modal.remove();
  });

  cancelBtn.addEventListener('click', () => {
    modal.remove();
  });

  passwordInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      confirmBtn.click();
    }
  });

  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.remove();
    }
  });
};

NotesApp.prototype.performEncryption = function(password) {
  if (!this.currentNote) return;

  try {
    const title = document.getElementById('note-title')?.value || '';
    const content = document.getElementById('note-content')?.innerHTML || '';

    const encryptedTitle = advancedEncrypt(title, password);
    const encryptedContent = advancedEncrypt(content, password);

    storage.updateNote(this.currentNote.id, {
      title: encryptedTitle,
      content: encryptedContent,
      encrypted: true,
      encryptedAt: new Date().toISOString()
    });

    privacyMonitor.trackEncryption();

    this.openNote(this.currentNote.id);
    this.renderNotes();

    showToast('🔒 Note encrypted successfully!', 'success');
    log('Note encrypted', 'privacy');

  } catch (error) {
    console.error('Encryption failed:', error);
    showToast('Encryption failed. Please try again.', 'error');
  }
};

NotesApp.prototype.performDecryption = function(password) {
  if (!this.currentNote || !this.currentNote.encrypted) return;

  try {
    const decryptedTitle = advancedDecrypt(this.currentNote.title, password);
    const decryptedContent = advancedDecrypt(this.currentNote.content, password);

    if (!decryptedTitle && !decryptedContent) {
      showToast('❌ Wrong password!', 'error');
      return;
    }

    storage.updateNote(this.currentNote.id, {
      title: decryptedTitle,
      content: decryptedContent,
      encrypted: false
    });

    this.openNote(this.currentNote.id);
    this.renderNotes();

    showToast('🔓 Note decrypted successfully!', 'success');
    log('Note decrypted', 'info');

  } catch (error) {
    console.error('Decryption failed:', error);
    showToast('❌ Wrong password or decryption failed', 'error');
  }
};

// AI Suggest Tags
NotesApp.prototype.suggestAITags = function() {
  if (!this.currentNote) {
    showToast('No note selected', 'warning');
    return;
  }

  const title = document.getElementById('note-title')?.value || '';
  const content = stripHtml(document.getElementById('note-content')?.innerHTML || '');

  // Use AI to generate tags
  const suggestedTags = aiTagging.generateTags(title, content, 5);

  if (suggestedTags.length === 0) {
    showToast('Not enough content to suggest tags. Write more!', 'info');
    return;
  }

  // Track AI operation
  privacyMonitor.trackAIOperation('auto-tag', new Blob([title + content]).size);

  // Display suggested tags
  const container = document.getElementById('suggested-tags-container');
  if (container) {
    container.style.display = 'block';
    container.innerHTML = `
      <div style="font-size: 11px; color: #7b1fa2; margin-bottom: 8px; font-weight: 600;">
        🤖 AI Suggested Tags (click to add):
      </div>
      <div style="display: flex; flex-wrap: wrap; gap: 6px;">
        ${suggestedTags.map(tag => `
          <span class="suggested-tag" data-tag="${tag}">${tag}</span>
        `).join('')}
      </div>
    `;

    // Add click listeners to suggested tags
    container.querySelectorAll('.suggested-tag').forEach(tagEl => {
      tagEl.addEventListener('click', () => {
        const tag = tagEl.dataset.tag;
        this.addTag(tag);
        tagEl.remove();

        // Hide container if no more suggestions
        if (container.querySelectorAll('.suggested-tag').length === 0) {
          container.style.display = 'none';
        }
      });
    });
  }

  showToast('🤖 AI suggested tags!', 'success');
};

// Add tag manually from input
NotesApp.prototype.addTagManually = function() {
  const input = document.getElementById('tag-input');
  const tag = input?.value.trim().toLowerCase();

  if (!tag) return;

  if (tag.length < 2) {
    showToast('Tag must be at least 2 characters', 'warning');
    return;
  }

  this.addTag(tag);
  input.value = '';
};

// Add tag to current note
NotesApp.prototype.addTag = function(tag) {
  if (!this.currentNote) return;

  if (!this.currentNote.tags) {
    this.currentNote.tags = [];
  }

  if (this.currentNote.tags.includes(tag)) {
    showToast('Tag already added', 'warning');
    return;
  }

  this.currentNote.tags.push(tag);

  storage.updateNote(this.currentNote.id, {
    tags: this.currentNote.tags
  });

  this.renderNoteTags();
  this.renderNotes();

  showToast(`Added tag: ${tag}`);
};

// Remove tag from current note
NotesApp.prototype.removeTag = function(tag) {
  if (!this.currentNote || !this.currentNote.tags) return;

  this.currentNote.tags = this.currentNote.tags.filter(t => t !== tag);

  storage.updateNote(this.currentNote.id, {
    tags: this.currentNote.tags
  });

  this.renderNoteTags();
  this.renderNotes();

  showToast(`Removed tag: ${tag}`);
};

// Render tags in note editor
NotesApp.prototype.renderNoteTags = function() {
  if (!this.currentNote) return;

  const container = document.getElementById('note-tags-container');
  if (!container) return;

  const tags = this.currentNote.tags || [];

  if (tags.length === 0) {
    container.innerHTML = '<small style="color: var(--color-text-lighter);">No tags yet</small>';
    return;
  }

  container.innerHTML = tags.map(tag => `
    <span class="tag-chip">
      🏷️ ${tag}
      <span class="tag-chip-remove" data-tag="${tag}">×</span>
    </span>
  `).join('');

  // Add remove listeners
  container.querySelectorAll('.tag-chip-remove').forEach(removeBtn => {
    removeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.removeTag(removeBtn.dataset.tag);
    });
  });
};

// ========================================
// THEME MANAGEMENT
// ========================================

// Toggle between light and dark theme
NotesApp.prototype.toggleTheme = function() {
  const currentTheme = document.documentElement.getAttribute('data-theme');
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
  
  this.setTheme(newTheme);
};

// Set theme
NotesApp.prototype.setTheme = function(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('theme', theme);
  
  // Update icon
  const icon = document.getElementById('theme-icon');
  if (icon) {
    icon.textContent = theme === 'dark' ? '☀️' : '🌙';
  }
  
  console.log('🎨 Theme changed to: ' + theme);
  showToast(theme === 'dark' ? '🌙 Dark mode enabled' : '☀️ Light mode enabled');
};

// Load saved theme on init
NotesApp.prototype.loadTheme = function() {
  const savedTheme = localStorage.getItem('theme') || 'light';
  this.setTheme(savedTheme);
};

console.log('✅ Simple Notes App ready!');