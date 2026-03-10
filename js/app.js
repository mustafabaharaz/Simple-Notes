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

    // Tag functionality - AI Tags button
    document.getElementById('ai-suggest-tags-btn-compact')?.addEventListener('click', () => {
      this.suggestAITagsCompact();
    });
    
    // Tag input - Enter key
    document.getElementById('tag-input-compact')?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.addTagFromCompactInput();
      }
    });

    // Paragraph formatting buttons
    document.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const action = btn.dataset.action;
        this.handleFormatAction(action);
      });
    });

    // Update formatting button states on selection/typing
    const noteContent = document.getElementById('note-content');
    if (noteContent) {
      noteContent.addEventListener('mouseup', () => this.updateButtonStates());
      noteContent.addEventListener('keyup', () => this.updateButtonStates());
      noteContent.addEventListener('input', debounce(() => {
        this.autoSaveNote();
      }, 1000));
      noteContent.addEventListener('input', () => {
        const bytes = new Blob([noteContent.innerHTML]).size;
        privacyMonitor.trackLocalProcessing(bytes);
      });
    }

    // Line spacing
    document.getElementById('line-spacing')?.addEventListener('change', (e) => {
      this.setLineSpacing(e.target.value);
    });

    // Note title input
    const titleInput = document.getElementById('note-title');
    if (titleInput) {
      titleInput.addEventListener('input', debounce(() => {
        this.autoSaveNote();
      }, 500));
    }

    // Delete note button
    document.getElementById('delete-note-btn')?.addEventListener('click', () => {
      this.deleteCurrentNote();
    });

    // Encryption buttons
    document.getElementById('encrypt-note-btn')?.addEventListener('click', () => {
      this.encryptCurrentNote();
    });

    document.getElementById('decrypt-note-btn')?.addEventListener('click', () => {
      this.decryptCurrentNote();
    });

    // Theme toggle
    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
      themeToggle.addEventListener('click', () => {
        this.toggleTheme();
      });
    }

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        this.createNewNote();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        this.saveNote();
        showToast('Note saved!');
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
        e.preventDefault();
        this.deleteCurrentNote();
      }
    });

    log('Event listeners setup complete', 'info');
  }

  // Handle formatting actions
  handleFormatAction(action) {
    const editor = document.getElementById('note-content');
    if (!editor) return;

    editor.focus();

    switch(action) {
      case 'bold':
        document.execCommand('bold', false, null);
        break;
      case 'italic':
        document.execCommand('italic', false, null);
        break;
      case 'underline':
        document.execCommand('underline', false, null);
        break;
      case 'bullet-list':
        document.execCommand('insertUnorderedList', false, null);
        break;
      case 'numbered-list':
        document.execCommand('insertOrderedList', false, null);
        break;
      case 'align-left':
        document.execCommand('justifyLeft', false, null);
        break;
      case 'align-center':
        document.execCommand('justifyCenter', false, null);
        break;
      case 'align-right':
        document.execCommand('justifyRight', false, null);
        break;
      case 'indent':
        document.execCommand('indent', false, null);
        break;
      case 'outdent':
        document.execCommand('outdent', false, null);
        break;
      case 'date':
        const now = new Date();
        const dateStr = now.toLocaleDateString();
        document.execCommand('insertText', false, dateStr);
        break;
    }

    // Update button states after any formatting
    setTimeout(() => this.updateButtonStates(), 10);
    this.autoSaveNote();
  }

  // Update button active states
  updateButtonStates() {
    console.log('🔍 updateButtonStates called');
    
    const boldBtn = document.querySelector('[data-action="bold"]');
    const italicBtn = document.querySelector('[data-action="italic"]');
    const underlineBtn = document.querySelector('[data-action="underline"]');

    if (boldBtn) {
      const isBold = document.queryCommandState('bold');
      console.log('Bold state:', isBold);
      if (isBold) {
        boldBtn.classList.add('active');
      } else {
        boldBtn.classList.remove('active');
      }
    }

    if (italicBtn) {
      const isItalic = document.queryCommandState('italic');
      console.log('Italic state:', isItalic);
      if (isItalic) {
        italicBtn.classList.add('active');
      } else {
        italicBtn.classList.remove('active');
      }
    }

    if (underlineBtn) {
      const isUnderline = document.queryCommandState('underline');
      console.log('Underline state:', isUnderline);
      if (isUnderline) {
        underlineBtn.classList.add('active');
      } else {
        underlineBtn.classList.remove('active');
      }
    }
  }

  // Set line spacing
  setLineSpacing(spacing) {
    const editor = document.getElementById('note-content');
    if (!editor) return;

    editor.style.lineHeight = spacing;
    
    if (this.currentNote) {
      this.currentNote.lineSpacing = spacing;
      this.autoSaveNote();
    }
  }

  // Create new note
  createNewNote() {
    const note = storage.createNote('Untitled Note', '');
    privacyMonitor.trackNoteCreated();
    
    this.renderNotes();
    this.updateNotesCount();
    this.openNote(note.id);
    
    showToast('New note created!');
    
    setTimeout(() => {
      const titleInput = document.getElementById('note-title');
      if (titleInput) {
        titleInput.focus();
        titleInput.select();
      }
    }, 100);
  }

  // Open note
  openNote(noteId) {
    const note = storage.getNote(noteId);
    if (!note) return;

    this.currentNote = note;

    document.getElementById('welcome-screen').style.display = 'none';
    document.getElementById('note-editor-screen').style.display = 'flex';

    const encryptBtn = document.getElementById('encrypt-note-btn');
    const decryptBtn = document.getElementById('decrypt-note-btn');

    if (note.encrypted) {
      encryptBtn.style.display = 'none';
      decryptBtn.style.display = 'inline-flex';

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
      encryptBtn.style.display = 'inline-flex';
      decryptBtn.style.display = 'none';

      document.getElementById('note-title').value = note.title;
      document.getElementById('note-title').disabled = false;
      document.getElementById('note-content').innerHTML = note.content;
      document.getElementById('note-content').contentEditable = true;
    }

    document.querySelectorAll('.note-item').forEach(item => {
      item.classList.remove('active');
    });
    document.querySelector(`[data-note-id="${noteId}"]`)?.classList.add('active');

    log(`Opened note: ${noteId}${note.encrypted ? ' (encrypted)' : ''}`, 'info');

    const toolbar = document.getElementById('unified-toolbar');
    if (toolbar) {
      toolbar.style.display = 'flex';
    }
    
    this.renderNoteTagsCompact();
    this.updateButtonStates();
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

    this.renderNotes();

    const saveStatus = document.getElementById('save-status');
    if (saveStatus) {
      saveStatus.textContent = '✓ Saved';
      saveStatus.style.color = 'var(--color-success)';
    }

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

  // Toggle theme
  toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    this.setTheme(newTheme);
  }

  // Set theme
  setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
    
    const icon = document.getElementById('theme-icon');
    if (icon) {
      icon.textContent = theme === 'dark' ? '☀️' : '🌙';
    }
    
    console.log('🎨 Theme changed to: ' + theme);
    showToast(theme === 'dark' ? '🌙 Dark mode enabled' : '☀️ Light mode enabled');
  }

  // Load saved theme
  loadTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    this.setTheme(savedTheme);
  }
}

// ========================================
// PROTOTYPE METHODS - AI & Tags
// ========================================

NotesApp.prototype.suggestAITagsCompact = function() {
  if (!this.currentNote) {
    showToast('No note selected', 'warning');
    return;
  }

  const title = document.getElementById('note-title')?.value || '';
  const content = stripHtml(document.getElementById('note-content')?.innerHTML || '');

  const suggestedTags = aiTagging.generateTags(title, content, 5);

  if (suggestedTags.length === 0) {
    showToast('Not enough content to suggest tags. Write more!', 'info');
    return;
  }

  privacyMonitor.trackAIOperation('auto-tag', new Blob([title + content]).size);

  const container = document.getElementById('suggested-tags-compact');
  const row = document.getElementById('suggested-tags-row');
  
  container.innerHTML = suggestedTags.map(tag => 
    `<span class="suggested-tag-compact" data-tag="${tag}">${tag}</span>`
  ).join('');
  
  row.style.display = 'flex';

  const self = this;
  container.querySelectorAll('.suggested-tag-compact').forEach(tagEl => {
    tagEl.addEventListener('click', function() {
      self.addTag(tagEl.dataset.tag);
      tagEl.remove();
      
      if (container.querySelectorAll('.suggested-tag-compact').length === 0) {
        row.style.display = 'none';
      }
    });
  });

  showToast('🤖 AI suggested tags!', 'success');
};

NotesApp.prototype.renderNoteTagsCompact = function() {
  if (!this.currentNote) return;

  const container = document.getElementById('note-tags-display');
  if (!container) return;

  const tags = this.currentNote.tags || [];

  container.innerHTML = tags.map(tag => `
    <span class="tag-chip-compact">
      ${tag}
      <span class="remove" data-tag="${tag}">×</span>
    </span>
  `).join('');

  const self = this;
  container.querySelectorAll('.remove').forEach(removeBtn => {
    removeBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      self.removeTag(removeBtn.dataset.tag);
    });
  });
};

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

  this.renderNoteTagsCompact();
  this.renderNotes();

  showToast(`Added tag: ${tag}`);
};

NotesApp.prototype.removeTag = function(tag) {
  if (!this.currentNote || !this.currentNote.tags) return;

  this.currentNote.tags = this.currentNote.tags.filter(t => t !== tag);

  storage.updateNote(this.currentNote.id, {
    tags: this.currentNote.tags
  });

  this.renderNoteTagsCompact();
  this.renderNotes();

  showToast(`Removed tag: ${tag}`);
};

NotesApp.prototype.addTagFromCompactInput = function() {
  const input = document.getElementById('tag-input-compact');
  const tag = input?.value.trim().toLowerCase();

  if (!tag) return;

  if (tag.length < 2) {
    showToast('Tag must be at least 2 characters', 'warning');
    return;
  }

  this.addTag(tag);
  input.value = '';
  this.renderNoteTagsCompact();
};

// ========================================
// PROTOTYPE METHODS - Encryption
// ========================================

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

// ========================================
// INITIALIZATION
// ========================================

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.app = new NotesApp();
    app.loadTheme();
  });
} else {
  window.app = new NotesApp();
  app.loadTheme();
}

console.log('✅ Simple Notes App ready!');