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

    // Load and render notes and folders
    this.activeFolderId = 'all'; // Default to All Notes
    this.renderFolders();
    this.renderNotes();
    this.updateNotesCount();
    this.enableNoteDragDrop();
    this.renderTrash();
    storage.cleanupOldTrash(); // Auto-cleanup on startup

    // Show welcome screen if no notes
    if (storage.getNotes().length === 0) {
      this.showWelcomeScreen();
    }

    // Initialize drawing system
    this.initDrawingSystem();

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

    // Folder management
    document.getElementById('new-folder-btn')?.addEventListener('click', () => {
      this.createNewFolder();
    });

    // Special folder clicks (All Notes, Unfiled)
    document.querySelectorAll('.special-folder').forEach(folder => {
      folder.addEventListener('click', () => {
        const folderId = folder.dataset.folderId;
        this.filterByFolder(folderId);
      });
    });

    // Folder dropdown change
    document.getElementById('note-folder-select')?.addEventListener('change', (e) => {
      if (this.currentNote) {
        const folderId = e.target.value || null;
        this.moveNoteToFolder(this.currentNote.id, folderId);
      }
    });

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
    // Empty trash button
    document.getElementById('empty-trash-btn')?.addEventListener('click', () => {
      if (confirm('Permanently delete all notes in trash? This cannot be undone.')) {
        storage.emptyTrash();
        this.renderTrash();
      }
    });
    // Toggle drawing mode
    document.getElementById('toggle-draw-btn')?.addEventListener('click', () => {
      this.toggleDrawingMode();
    });

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
    const boldBtn = document.querySelector('[data-action="bold"]');
    const italicBtn = document.querySelector('[data-action="italic"]');
    const underlineBtn = document.querySelector('[data-action="underline"]');

    if (boldBtn) {
      const isBold = document.queryCommandState('bold');
      if (isBold) {
        boldBtn.classList.add('active');
      } else {
        boldBtn.classList.remove('active');
      }
    }

    if (italicBtn) {
      const isItalic = document.queryCommandState('italic');
      if (isItalic) {
        italicBtn.classList.add('active');
      } else {
        italicBtn.classList.remove('active');
      }
    }

    if (underlineBtn) {
      const isUnderline = document.queryCommandState('underline');
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
    
    // Assign to current folder if not viewing "All Notes"
    if (this.activeFolderId && this.activeFolderId !== 'all' && this.activeFolderId !== 'unfiled') {
      note.folderId = this.activeFolderId;
      storage.updateNote(note.id, { folderId: this.activeFolderId });
    }
    
    privacyMonitor.trackNoteCreated();
    
    this.renderNotes();
    this.renderFolders();
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
    // Show draw button
    const drawBtn = document.getElementById('toggle-draw-btn');
    if (drawBtn) {
      drawBtn.style.display = 'inline-flex';
    }
    this.renderNoteTagsCompact();
    this.renderFolderDropdown();
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
      this.renderFolders();
      this.renderTrash();
      this.updateNotesCount();
      this.showWelcomeScreen();
    }
  }

  // Render notes list
  renderNotes() {
    const notesList = document.getElementById('notes-list');
    if (!notesList) return;

    // Get notes based on active folder filter
    let notes;
    if (!this.activeFolderId || this.activeFolderId === 'all') {
      notes = storage.getNotes();
    } else {
      notes = storage.getNotesInFolder(this.activeFolderId).sort((a, b) => {
        return new Date(b.modified) - new Date(a.modified);
      });
    }

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
        <div class="note-item ${isActive ? 'active' : ''}" data-note-id="${note.id}" draggable="true">
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
  // Render trash items
  renderTrash() {
    const trashList = document.getElementById('trash-list');
    const trashCount = document.getElementById('trash-count');
    const emptyTrashBtn = document.getElementById('empty-trash-btn');
    
    if (!trashList) return;

    const trashItems = storage.getTrash();
    trashCount.textContent = trashItems.length;

    if (trashItems.length === 0) {
      trashList.innerHTML = '<div class="trash-empty-state">Trash is empty</div>';
      emptyTrashBtn.style.display = 'none';
      return;
    }

    emptyTrashBtn.style.display = 'block';

    trashList.innerHTML = trashItems.map(note => {
      const deletedDate = new Date(note.deletedAt);
      const daysAgo = Math.floor((new Date() - deletedDate) / (1000 * 60 * 60 * 24));
      
      return `
        <div class="trash-item" data-note-id="${note.id}">
          <div class="trash-item-title">${note.title}</div>
          <div class="trash-item-date">
            Deleted ${daysAgo === 0 ? 'today' : daysAgo + ' days ago'}
          </div>
        </div>
      `;
    }).join('');

    // Add click handlers for trash items
    trashList.querySelectorAll('.trash-item').forEach(item => {
      item.addEventListener('click', (e) => {
        const noteId = item.dataset.noteId;
        this.showTrashItemMenu(noteId, e);
      });
    });
  }

  // Show menu for trash item
  showTrashItemMenu(noteId, event) {
    event.stopPropagation();
    
    const menu = document.createElement('div');
    menu.className = 'context-menu';
    menu.style.position = 'fixed';
    menu.style.left = event.pageX + 'px';
    menu.style.top = event.pageY + 'px';
    menu.innerHTML = `
      <div class="context-menu-item" data-action="restore">↩️ Restore</div>
      <div class="context-menu-item danger" data-action="delete">🗑️ Delete Forever</div>
    `;

    document.body.appendChild(menu);

    menu.querySelector('[data-action="restore"]').addEventListener('click', () => {
      storage.restoreNote(noteId);
      this.renderNotes();
      this.renderTrash();
      menu.remove();
    });

    menu.querySelector('[data-action="delete"]').addEventListener('click', () => {
      if (confirm('Permanently delete this note? This cannot be undone.')) {
        storage.permanentlyDeleteNote(noteId);
        this.renderTrash();
      }
      menu.remove();
    });

    // Close menu when clicking outside
    const closeMenu = (e) => {
      if (!menu.contains(e.target)) {
        menu.remove();
        document.removeEventListener('click', closeMenu);
      }
    };
    setTimeout(() => document.addEventListener('click', closeMenu), 0);
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

// ==========================================
// FOLDER MANAGEMENT
// ==========================================

NotesApp.prototype.renderFolders = function() {
  const userFoldersList = document.getElementById('user-folders-list');
  if (!userFoldersList) return;

  const folders = storage.getFolders();

  if (folders.length === 0) {
    userFoldersList.innerHTML = `
      <div style="text-align: center; padding: 20px; color: var(--color-text-secondary); font-size: 12px;">
        No folders yet
      </div>
    `;
    return;
  }

  userFoldersList.innerHTML = folders.map(folder => {
    const noteCount = storage.getNotesInFolder(folder.id).length;
    return `
      <div class="folder-item" data-folder-id="${folder.id}">
        <span class="folder-icon">📁</span>
        <span class="folder-name">${folder.name}</span>
        <span class="folder-count">${noteCount}</span>
        <div class="folder-actions">
          <button class="folder-action-btn" data-action="rename" title="Rename">✏️</button>
          <button class="folder-action-btn" data-action="delete" title="Delete">🗑️</button>
        </div>
      </div>
    `;
  }).join('');

  // Add click listeners
  userFoldersList.querySelectorAll('.folder-item').forEach(item => {
    const folderId = item.dataset.folderId;
    
    // Click folder to filter
    item.addEventListener('click', (e) => {
      if (!e.target.classList.contains('folder-action-btn')) {
        this.filterByFolder(folderId);
      }
    });

    // Rename button
    const renameBtn = item.querySelector('[data-action="rename"]');
    if (renameBtn) {
      renameBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.renameFolder(folderId);
      });
    }

    // Delete button
    const deleteBtn = item.querySelector('[data-action="delete"]');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.deleteFolder(folderId);
      });
    }
  });

  this.updateFolderCounts();
};

NotesApp.prototype.updateFolderCounts = function() {
  const allCount = document.getElementById('all-notes-count');
  const unfiledCount = document.getElementById('unfiled-count');

  if (allCount) {
    allCount.textContent = storage.getNotes().length;
  }

  if (unfiledCount) {
    unfiledCount.textContent = storage.getNotesInFolder('unfiled').length;
  }
};

NotesApp.prototype.createNewFolder = function() {
  const name = prompt('Enter folder name:');
  
  if (!name || !name.trim()) {
    return;
  }

  const folder = storage.createFolder(name.trim());
  this.renderFolders();
  this.renderFolderDropdown(); // ← ADD THIS LINE
  showToast(`📁 Folder "${folder.name}" created!`);
};

NotesApp.prototype.renameFolder = function(folderId) {
  const folder = storage.getFolder(folderId);
  if (!folder) return;

  const newName = prompt('Rename folder:', folder.name);
  
  if (!newName || !newName.trim() || newName.trim() === folder.name) {
    return;
  }

  storage.updateFolder(folderId, { name: newName.trim() });
  this.renderFolders();
  this.renderFolderDropdown();
  showToast(`📁 Folder renamed to "${newName.trim()}"`);
};

NotesApp.prototype.deleteFolder = function(folderId) {
  const folder = storage.getFolder(folderId);
  if (!folder) return;

  const noteCount = storage.getNotesInFolder(folderId).length;
  const message = noteCount > 0
    ? `Delete "${folder.name}"? ${noteCount} note(s) will be moved to Unfiled.`
    : `Delete "${folder.name}"?`;

  if (!confirm(message)) {
    return;
  }

  storage.deleteFolder(folderId);
  this.renderFolders();
  this.renderFolderDropdown();
  this.renderNotes();
  showToast(`📁 Folder "${folder.name}" deleted`);
  
  // If currently viewing this folder, switch to All Notes
  if (this.activeFolderId === folderId) {
    this.filterByFolder('all');
  }
};

NotesApp.prototype.filterByFolder = function(folderId) {
  this.activeFolderId = folderId;

  // Update active states
  document.querySelectorAll('.folder-item').forEach(item => {
    item.classList.remove('active');
  });

  const activeFolder = document.querySelector(`[data-folder-id="${folderId}"]`);
  if (activeFolder) {
    activeFolder.classList.add('active');
  }

  // Render filtered notes
  this.renderNotes();
};

NotesApp.prototype.moveNoteToFolder = function(noteId, folderId) {
  storage.moveNoteToFolder(noteId, folderId);
  this.renderNotes();
  this.renderFolders();
  
  const folderName = folderId ? storage.getFolder(folderId)?.name : 'Unfiled';
  showToast(`Note moved to ${folderName || 'Unfiled'}`);
};

NotesApp.prototype.renderFolderDropdown = function() {
  const select = document.getElementById('note-folder-select');
  if (!select) return;

  const folders = storage.getFolders();
  const currentFolderId = this.currentNote?.folderId || '';

  select.innerHTML = '<option value="">Unfiled</option>';
  
  folders.forEach(folder => {
    const option = document.createElement('option');
    option.value = folder.id;
    option.textContent = folder.name;
    option.selected = folder.id === currentFolderId;
    select.appendChild(option);
  });
};
// ==========================================
// DRAG & DROP SYSTEM
// ==========================================

NotesApp.prototype.enableNoteDragDrop = function() {
  const notesList = document.getElementById('notes-list');
  if (!notesList) return;

  // Make notes draggable
  notesList.addEventListener('dragstart', (e) => {
    if (e.target.classList.contains('note-item')) {
      e.target.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', e.target.dataset.noteId);
    }
  });

  notesList.addEventListener('dragend', (e) => {
    if (e.target.classList.contains('note-item')) {
      e.target.classList.remove('dragging');
    }
  });

  // Make folders drop zones
  const foldersList = document.querySelector('.folders-list');
  if (!foldersList) return;

  foldersList.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    
    const folderItem = e.target.closest('.folder-item');
    if (folderItem) {
      document.querySelectorAll('.folder-item').forEach(f => f.classList.remove('drag-over'));
      folderItem.classList.add('drag-over');
    }
  });

  foldersList.addEventListener('dragleave', (e) => {
    const folderItem = e.target.closest('.folder-item');
    if (folderItem && !folderItem.contains(e.relatedTarget)) {
      folderItem.classList.remove('drag-over');
    }
  });

  foldersList.addEventListener('drop', (e) => {
    e.preventDefault();
    
    const folderItem = e.target.closest('.folder-item');
    if (!folderItem) return;

    const noteId = e.dataTransfer.getData('text/plain');
    const folderId = folderItem.dataset.folderId;

    // Clear drag-over state
    document.querySelectorAll('.folder-item').forEach(f => f.classList.remove('drag-over'));

    // Handle special folders
    if (folderId === 'all') {
      showToast('Cannot move notes to "All Notes"', 'warning');
      return;
    }

    const targetFolderId = folderId === 'unfiled' ? null : folderId;

    // Move the note
    this.moveNoteToFolder(noteId, targetFolderId);
  });
};

// ==========================================
// DRAWING SYSTEM
  // ==========================================

  NotesApp.prototype.initDrawingSystem = function() {
    this.drawingMode = false;
    this.canvas = document.getElementById('drawing-canvas');
    this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
    this.isDrawing = false;
    this.currentTool = 'pen';
    this.currentColor = '#000000';
    this.brushSize = 3;

    if (!this.canvas || !this.ctx) return;

    // Setup canvas size
    this.resizeCanvas();
    window.addEventListener('resize', () => this.resizeCanvas());

    // Tool buttons
    document.querySelectorAll('.drawing-tool-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const tool = btn.dataset.tool;
        
        if (tool === 'clear') {
          this.clearCanvas();
        } else {
          document.querySelectorAll('.drawing-tool-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          this.currentTool = tool;
        }
      });
    });

    // Color buttons
    document.querySelectorAll('.color-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.color-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.currentColor = btn.dataset.color;
      });
    });

    // Brush size
    const brushSlider = document.getElementById('brush-size');
    const brushValue = document.getElementById('brush-size-value');
    
    brushSlider?.addEventListener('input', (e) => {
      this.brushSize = parseInt(e.target.value);
      brushValue.textContent = this.brushSize;
    });

    // Drawing events
    this.canvas.addEventListener('mousedown', (e) => this.startDrawing(e));
    this.canvas.addEventListener('mousemove', (e) => this.draw(e));
    this.canvas.addEventListener('mouseup', () => this.stopDrawing());
    this.canvas.addEventListener('mouseout', () => this.stopDrawing());

    // Touch events
    this.canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      this.startDrawing(e.touches[0]);
    });
    this.canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      this.draw(e.touches[0]);
    });
    this.canvas.addEventListener('touchend', () => this.stopDrawing());
  }

  NotesApp.prototype.resizeCanvas = function() {
    if (!this.canvas) return;
    
    const noteContent = document.getElementById('note-content');
    if (!noteContent) return;

    // Save current drawing
    const imageData = this.canvas.toDataURL();
    
    // Resize canvas to match note content
    this.canvas.width = noteContent.offsetWidth;
    this.canvas.height = noteContent.offsetHeight;

    // Restore drawing
    if (imageData && this.drawingMode) {
      const img = new Image();
      img.onload = () => {
        this.ctx.drawImage(img, 0, 0);
      };
      img.src = imageData;
    }
  }

  NotesApp.prototype.toggleDrawingMode = function() {
    this.drawingMode = !this.drawingMode;
    
    const canvas = document.getElementById('drawing-canvas');
    const toolbar = document.getElementById('drawing-toolbar');
    const noteContent = document.getElementById('note-content');
    const drawBtn = document.getElementById('toggle-draw-btn');

    if (this.drawingMode) {
      // Enable drawing mode
      canvas.style.display = 'block';
      canvas.style.pointerEvents = 'auto';
      toolbar.style.display = 'flex';
      noteContent.contentEditable = 'false';
      noteContent.style.pointerEvents = 'none';
      drawBtn.classList.add('active');
      drawBtn.textContent = '📝 Edit';
      
      this.resizeCanvas();
      this.loadDrawing();
      
      showToast('🎨 Drawing mode enabled');
    } else {
      // Disable drawing mode
      canvas.style.display = 'none';
      canvas.style.pointerEvents = 'none';
      toolbar.style.display = 'none';
      noteContent.contentEditable = 'true';
      noteContent.style.pointerEvents = 'auto';
      drawBtn.classList.remove('active');
      drawBtn.textContent = '🎨 Draw';
      
      this.saveDrawing();
      
      showToast('📝 Edit mode enabled');
    }
  }

  NotesApp.prototype.startDrawing = function(e) {
    if (!this.drawingMode) return;
    
    this.isDrawing = true;
    const rect = this.canvas.getBoundingClientRect();
    const x = (e.clientX || e.pageX) - rect.left;
    const y = (e.clientY || e.pageY) - rect.top;

    this.ctx.beginPath();
    this.ctx.moveTo(x, y);
  }

  NotesApp.prototype.draw = function(e) {
    if (!this.isDrawing || !this.drawingMode) return;

    const rect = this.canvas.getBoundingClientRect();
    const x = (e.clientX || e.pageX) - rect.left;
    const y = (e.clientY || e.pageY) - rect.top;

    this.ctx.lineWidth = this.brushSize;
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';

    if (this.currentTool === 'eraser') {
      this.ctx.globalCompositeOperation = 'destination-out';
      this.ctx.strokeStyle = 'rgba(0,0,0,1)';
    } else {
      this.ctx.globalCompositeOperation = 'source-over';
      this.ctx.strokeStyle = this.currentColor;
    }

    this.ctx.lineTo(x, y);
    this.ctx.stroke();
  }

  NotesApp.prototype.stopDrawing = function() {
    if (this.isDrawing) {
      this.isDrawing = false;
      this.saveDrawing();
    }
  }

  NotesApp.prototype.clearCanvas = function() {
    if (confirm('Clear all drawings? This cannot be undone.')) {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      this.saveDrawing();
      showToast('Canvas cleared');
    }
  }

  NotesApp.prototype.saveDrawing = function() {
    if (!this.currentNote || !this.canvas) return;

    const drawingData = this.canvas.toDataURL();
    
    storage.updateNote(this.currentNote.id, {
      drawing: drawingData
    });
  }

  NotesApp.prototype.loadDrawing = function() {
    if (!this.currentNote || !this.canvas || !this.ctx) return;

    const note = storage.getNote(this.currentNote.id);
    if (note && note.drawing) {
      const img = new Image();
      img.onload = () => {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.drawImage(img, 0, 0);
      };
      img.src = note.drawing;
    } else {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
  };
// ==========================================
// TAKE A BREAK SYSTEM
// ==========================================

class BreakActivities {
  constructor() {
    this.currentActivity = null;
    this.meditationTimer = null;
    this.meditationSeconds = 300; // 5 minutes default
    this.meditationInterval = null;
    this.breathingInterval = null;
    this.breakTimerStart = null;
    this.breakTimerInterval = null;
    
    this.setupEventListeners();
  }

  setupEventListeners() {
    // Open modal
    document.getElementById('take-break-btn')?.addEventListener('click', () => {
      this.openModal();
    });

    // Close modal
    document.getElementById('break-modal-close')?.addEventListener('click', () => {
      this.closeModal();
    });

    // Activity cards
    document.querySelectorAll('.break-activity-card').forEach(card => {
      card.addEventListener('click', () => {
        const activity = card.dataset.activity;
        this.openActivity(activity);
      });
    });

    // Back button
    document.getElementById('back-to-activities')?.addEventListener('click', () => {
      this.backToActivities();
    });

    // Drawing pad
    this.setupDrawingPad();
    
    // Meditation timer
    this.setupMeditationTimer();
    
    // Breathing exercise
    this.setupBreathingExercise();
    
    // Memory game
    this.setupMemoryGame();
    
    // Break timer
    this.setupBreakTimer();

    // Close on outside click
    document.getElementById('break-modal')?.addEventListener('click', (e) => {
      if (e.target.id === 'break-modal') {
        this.closeModal();
      }
    });
  }

  openModal() {
    document.getElementById('break-modal').style.display = 'flex';
    this.backToActivities();
  }

  closeModal() {
    document.getElementById('break-modal').style.display = 'none';
    this.stopAllActivities();
  }

  openActivity(activity) {
    this.currentActivity = activity;
    
    // Hide activity grid, show activity view
    document.querySelector('.break-activities').style.display = 'none';
    document.getElementById('activity-view').style.display = 'block';
    
    // Hide all activity contents
    document.querySelectorAll('.activity-content').forEach(content => {
      content.style.display = 'none';
    });
    
    // Show selected activity
    document.getElementById(`${activity}-activity`).style.display = 'block';
    
    // Initialize activity
    if (activity === 'drawing') {
      this.initDrawingPad();
    } else if (activity === 'puzzle') {
      this.initMemoryGame();
    }
  }

  backToActivities() {
    document.querySelector('.break-activities').style.display = 'grid';
    document.getElementById('activity-view').style.display = 'none';
    this.stopAllActivities();
  }

  stopAllActivities() {
    // Stop meditation timer
    if (this.meditationInterval) {
      clearInterval(this.meditationInterval);
      this.meditationInterval = null;
    }
    
    // Stop breathing exercise
    if (this.breathingInterval) {
      clearInterval(this.breathingInterval);
      this.breathingInterval = null;
    }
    
    // Stop break timer
    if (this.breakTimerInterval) {
      clearInterval(this.breakTimerInterval);
      this.breakTimerInterval = null;
    }
  }

  // Drawing Pad
  setupDrawingPad() {
    this.canvas = document.getElementById('break-canvas');
    this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
    this.isDrawing = false;
    this.currentColor = '#000000';
    this.brushSize = 3;

    if (!this.canvas || !this.ctx) return;

    // Color buttons
    document.querySelectorAll('.color-btn-break').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.color-btn-break').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.currentColor = btn.dataset.color;
      });
    });

    // Brush size
    document.getElementById('break-brush-size')?.addEventListener('input', (e) => {
      this.brushSize = parseInt(e.target.value);
    });

    // Clear button
    document.getElementById('clear-break-canvas')?.addEventListener('click', () => {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    });

    // Drawing events
    this.canvas.addEventListener('mousedown', (e) => this.startDrawing(e));
    this.canvas.addEventListener('mousemove', (e) => this.draw(e));
    this.canvas.addEventListener('mouseup', () => this.stopDrawing());
    this.canvas.addEventListener('mouseout', () => this.stopDrawing());

    // Touch events
    this.canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      this.startDrawing(e.touches[0]);
    });
    this.canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      this.draw(e.touches[0]);
    });
    this.canvas.addEventListener('touchend', () => this.stopDrawing());
  }

  initDrawingPad() {
    if (!this.canvas) return;
    this.canvas.width = this.canvas.offsetWidth;
    this.canvas.height = this.canvas.offsetHeight;
  }

  startDrawing(e) {
    this.isDrawing = true;
    const rect = this.canvas.getBoundingClientRect();
    const x = (e.clientX || e.pageX) - rect.left;
    const y = (e.clientY || e.pageY) - rect.top;
    this.ctx.beginPath();
    this.ctx.moveTo(x, y);
  }

  draw(e) {
    if (!this.isDrawing) return;
    const rect = this.canvas.getBoundingClientRect();
    const x = (e.clientX || e.pageX) - rect.left;
    const y = (e.clientY || e.pageY) - rect.top;
    this.ctx.lineWidth = this.brushSize;
    this.ctx.lineCap = 'round';
    this.ctx.strokeStyle = this.currentColor;
    this.ctx.lineTo(x, y);
    this.ctx.stroke();
  }

  stopDrawing() {
    this.isDrawing = false;
  }

  // Meditation Timer
  setupMeditationTimer() {
    document.getElementById('meditation-start')?.addEventListener('click', () => {
      this.startMeditation();
    });

    document.getElementById('meditation-pause')?.addEventListener('click', () => {
      this.pauseMeditation();
    });

    document.getElementById('meditation-reset')?.addEventListener('click', () => {
      this.resetMeditation();
    });

    document.querySelectorAll('.timer-presets button').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.timer-presets button').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.meditationSeconds = parseInt(btn.dataset.minutes) * 60;
        this.updateMeditationDisplay();
      });
    });
  }

  startMeditation() {
    document.getElementById('meditation-start').style.display = 'none';
    document.getElementById('meditation-pause').style.display = 'inline-block';

    this.meditationInterval = setInterval(() => {
      this.meditationSeconds--;
      this.updateMeditationDisplay();

      if (this.meditationSeconds <= 0) {
        this.pauseMeditation();
        showToast('🧘 Meditation complete!');
      }
    }, 1000);
  }

  pauseMeditation() {
    clearInterval(this.meditationInterval);
    this.meditationInterval = null;
    document.getElementById('meditation-start').style.display = 'inline-block';
    document.getElementById('meditation-pause').style.display = 'none';
  }

  resetMeditation() {
    this.pauseMeditation();
    const activePreset = document.querySelector('.timer-presets button.active');
    this.meditationSeconds = parseInt(activePreset.dataset.minutes) * 60;
    this.updateMeditationDisplay();
  }

  updateMeditationDisplay() {
    const minutes = Math.floor(this.meditationSeconds / 60);
    const seconds = this.meditationSeconds % 60;
    document.getElementById('meditation-timer').textContent = 
      `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  // Breathing Exercise
  setupBreathingExercise() {
    document.getElementById('breathing-start')?.addEventListener('click', () => {
      this.startBreathing();
    });

    document.getElementById('breathing-stop')?.addEventListener('click', () => {
      this.stopBreathing();
    });
  }

  startBreathing() {
    document.getElementById('breathing-start').style.display = 'none';
    document.getElementById('breathing-stop').style.display = 'inline-block';

    const circle = document.getElementById('breathing-circle');
    const instruction = document.getElementById('breathing-instruction');
    
    let phase = 0; // 0: inhale, 1: hold, 2: exhale, 3: hold

    const runCycle = () => {
      if (phase === 0) {
        instruction.textContent = 'Breathe In...';
        circle.classList.remove('exhale');
        circle.classList.add('inhale');
      } else if (phase === 1) {
        instruction.textContent = 'Hold...';
      } else if (phase === 2) {
        instruction.textContent = 'Breathe Out...';
        circle.classList.remove('inhale');
        circle.classList.add('exhale');
      } else if (phase === 3) {
        instruction.textContent = 'Hold...';
      }

      phase = (phase + 1) % 4;
    };

    runCycle();
    this.breathingInterval = setInterval(runCycle, 4000);
  }

  stopBreathing() {
    clearInterval(this.breathingInterval);
    this.breathingInterval = null;
    document.getElementById('breathing-start').style.display = 'inline-block';
    document.getElementById('breathing-stop').style.display = 'none';
    document.getElementById('breathing-instruction').textContent = 'Click Start';
    document.getElementById('breathing-circle').classList.remove('inhale', 'exhale');
  }

  // Memory Game
  setupMemoryGame() {
    document.getElementById('new-game')?.addEventListener('click', () => {
      this.initMemoryGame();
    });
  }

  initMemoryGame() {
    const emojis = ['🎨', '🎭', '🎪', '🎬', '🎮', '🎯', '🎲', '🎸'];
    const cards = [...emojis, ...emojis].sort(() => Math.random() - 0.5);
    
    const gameContainer = document.getElementById('memory-game');
    gameContainer.innerHTML = '';

    let flippedCards = [];
    let matchedPairs = 0;

    cards.forEach((emoji, index) => {
      const card = document.createElement('div');
      card.className = 'memory-card';
      card.dataset.emoji = emoji;
      card.dataset.index = index;
      
      card.addEventListener('click', () => {
        if (card.classList.contains('flipped') || card.classList.contains('matched') || flippedCards.length === 2) {
          return;
        }

        card.classList.add('flipped');
        card.textContent = emoji;
        flippedCards.push(card);

        if (flippedCards.length === 2) {
          if (flippedCards[0].dataset.emoji === flippedCards[1].dataset.emoji) {
            flippedCards.forEach(c => c.classList.add('matched'));
            matchedPairs++;
            flippedCards = [];

            if (matchedPairs === emojis.length) {
              setTimeout(() => showToast('🎉 You won!'), 500);
            }
          } else {
            setTimeout(() => {
              flippedCards.forEach(c => {
                c.classList.remove('flipped');
                c.textContent = '';
              });
              flippedCards = [];
            }, 1000);
          }
        }
      });

      gameContainer.appendChild(card);
    });
  }

  // Break Timer
  setupBreakTimer() {
    document.getElementById('timer-start')?.addEventListener('click', () => {
      this.startBreakTimer();
    });

    document.getElementById('timer-stop')?.addEventListener('click', () => {
      this.stopBreakTimer();
    });
  }

  startBreakTimer() {
    this.breakTimerStart = Date.now();
    document.getElementById('timer-start').style.display = 'none';
    document.getElementById('timer-stop').style.display = 'inline-block';

    this.breakTimerInterval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - this.breakTimerStart) / 1000);
      const minutes = Math.floor(elapsed / 60);
      const seconds = elapsed % 60;
      document.getElementById('break-timer').textContent = 
        `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }, 1000);
  }

  stopBreakTimer() {
    clearInterval(this.breakTimerInterval);
    this.breakTimerInterval = null;
    document.getElementById('timer-start').style.display = 'inline-block';
    document.getElementById('timer-stop').style.display = 'none';
  }
}

// Initialize break activities
window.breakActivities = new BreakActivities();
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