/* ============================================
   APP.JS - Main Application Logic
   Privacy-First AI Notes App
   ============================================ */

class NotesApp {
  constructor() {
    this.currentNote = null;
    this.activeTagFilter = null;
    this.autoSaveTimeout = null;
    this.timeTracker = null;
    this.timeTrackerInterval = null;
    this.noteStartTime = null;
    this.init();
  }

  // Initialize app
  init() {
    setTimeout(() => {
      document.getElementById('loading-screen').style.display = 'none';
      document.getElementById('app').style.display = 'flex';
    }, 1000);

    this.setupEventListeners();

    this.activeFolderId = 'all';
    this.renderFolders();
    this.renderNotes();
    this.updateNotesCount();
    this.enableNoteDragDrop();
    this.renderTrash();
    storage.cleanupOldTrash();

    if (storage.getNotes().length === 0) {
      this.showWelcomeScreen();
    }

  }

  // Setup all event listeners
  setupEventListeners() {
    document.getElementById('new-note-btn')?.addEventListener('click', () => {
      this.createNewNote();
    });

    document.getElementById('get-started-btn')?.addEventListener('click', () => {
      this.createNewNote();
    });

    document.getElementById('privacy-dashboard-btn')?.addEventListener('click', () => {
      if (window.privacyMonitor) window.privacyMonitor.showDashboard();
    });

    document.getElementById('close-privacy-dashboard')?.addEventListener('click', () => {
      privacyMonitor.hideDashboard();
    });

    document.getElementById('privacy-dashboard')?.addEventListener('click', (e) => {
      if (e.target.id === 'privacy-dashboard') {
        privacyMonitor.hideDashboard();
      }
    });

    document.getElementById('ai-suggest-tags-btn-compact')?.addEventListener('click', () => {
      this.suggestAITagsCompact();
    });

    document.getElementById('tag-input-compact')?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.addTagFromCompactInput();
      }
    });

    document.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', () => {
        const action = btn.dataset.action;
        this.handleFormatAction(action);
      });
    });

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

    document.getElementById('line-spacing')?.addEventListener('change', (e) => {
      this.setLineSpacing(e.target.value);
    });

    const titleInput = document.getElementById('note-title');
    if (titleInput) {
      titleInput.addEventListener('input', debounce(() => {
        this.autoSaveNote();
      }, 500));
    }

    document.getElementById('delete-note-btn')?.addEventListener('click', () => {
      this.deleteCurrentNote();
    });

    document.getElementById('encrypt-note-btn')?.addEventListener('click', () => {
      this.encryptCurrentNote();
    });

    document.getElementById('decrypt-note-btn')?.addEventListener('click', () => {
      this.decryptCurrentNote();
    });

    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
      themeToggle.addEventListener('click', () => {
        this.toggleTheme();
      });
    }

    document.getElementById('new-folder-btn')?.addEventListener('click', () => {
      this.createNewFolder();
    });

    document.querySelectorAll('.special-folder').forEach(folder => {
      folder.addEventListener('click', () => {
        const folderId = folder.dataset.folderId;
        this.filterByFolder(folderId);
      });
    });

    document.getElementById('note-folder-select')?.addEventListener('change', (e) => {
      if (this.currentNote) {
        const folderId = e.target.value || null;
        this.moveNoteToFolder(this.currentNote.id, folderId);
      }
    });

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

    document.getElementById('empty-trash-btn')?.addEventListener('click', () => {
      if (confirm('Permanently delete all notes in trash? This cannot be undone.')) {
        storage.emptyTrash();
        this.renderTrash();
      }
    });

  }

  // Handle formatting actions
  handleFormatAction(action) {
    const editor = document.getElementById('note-content');
    if (!editor) return;

    editor.focus();

    switch (action) {
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
      case 'date': {
        const now = new Date();
        const dateStr = now.toLocaleDateString();
        document.execCommand('insertText', false, dateStr);
        break;
      }
    }

    setTimeout(() => this.updateButtonStates(), 10);
    this.autoSaveNote();
  }

  // Update button active states
  updateButtonStates() {
    const boldBtn      = document.querySelector('[data-action="bold"]');
    const italicBtn    = document.querySelector('[data-action="italic"]');
    const underlineBtn = document.querySelector('[data-action="underline"]');

    if (boldBtn)      boldBtn.classList.toggle('active', document.queryCommandState('bold'));
    if (italicBtn)    italicBtn.classList.toggle('active', document.queryCommandState('italic'));
    if (underlineBtn) underlineBtn.classList.toggle('active', document.queryCommandState('underline'));
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

    if (this.activeFolderId && this.activeFolderId !== 'all' && this.activeFolderId !== 'unfiled') {
      note.folderId = this.activeFolderId;
      storage.updateNote(note.id, { folderId: this.activeFolderId });
    }

    if (window.privacyMonitor) window.privacyMonitor.trackNoteCreated();

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

    this.stopTimeTracking();

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

    const toolbar = document.getElementById('unified-toolbar');
    if (toolbar) toolbar.style.display = 'flex';

    this.renderNoteTagsCompact();
    this.renderFolderDropdown();
    this.updateButtonStates();

    const voiceSection = document.getElementById('voice-to-text-section');
    if (voiceSection) voiceSection.style.display = 'flex';
    if (window.templatesSystem) window.templatesSystem.loadSavedLanguage();

    this.startTimeTracking(note);
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

    const title   = document.getElementById('note-title')?.value || 'Untitled Note';
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
      const preview  = truncate(stripHtml(note.content), 120);
      const isActive = this.currentNote?.id === note.id;

      const date      = new Date(note.modified || note.created || Date.now());
      const now       = new Date();
      const isToday   = date.toDateString() === now.toDateString();
      const isYesterday = date.toDateString() === new Date(now - 86400000).toDateString();

      let dateLabel;
      if (isToday) {
        dateLabel = 'Today, ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      } else if (isYesterday) {
        dateLabel = 'Yesterday';
      } else {
        dateLabel = date.toLocaleDateString([], { month: 'short', day: 'numeric' });
      }

      const timeBadge = note.timeSpent
        ? `<span class="note-item-time">${this.formatTimeSpent(note.timeSpent)}</span>`
        : '';

      const encryptedBadge = note.encrypted
        ? `<span class="note-item-badge badge-encrypted">🔒 Encrypted</span>`
        : '';
      const previewClass = note.encrypted ? 'note-item-preview is-encrypted' : 'note-item-preview';
      const previewText  = note.encrypted ? 'Contents hidden — click to decrypt' : (preview || 'No content yet');

      const tagsHTML = (note.tags && note.tags.length > 0)
        ? `<div class="note-item-tags">
            ${note.tags.slice(0, 4).map(tag =>
              `<span class="note-item-tag">${tag}</span>`
            ).join('')}
           </div>`
        : '';

      return `
        <div class="note-item ${isActive ? 'active' : ''}" data-note-id="${note.id}" draggable="true">
          <div class="note-item-header">
            <div class="note-item-title">${note.title || 'Untitled Note'}</div>
            ${encryptedBadge}
          </div>
          <div class="${previewClass}">${previewText}</div>
          <div class="note-item-footer">
            <div class="note-item-date">${dateLabel}</div>
            <div class="note-item-right">${timeBadge}</div>
          </div>
          ${tagsHTML}
        </div>
      `;
    }).join('');

    notesList.querySelectorAll('.note-item').forEach(item => {
      item.addEventListener('click', () => {
        this.openNote(item.dataset.noteId);
      });

      item.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        this.showNoteContextMenu(e, item.dataset.noteId);
      });
    });
  }

  // Render trash items
  renderTrash() {
    const trashList    = document.getElementById('trash-list');
    const trashCount   = document.getElementById('trash-count');
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

    trashList.querySelectorAll('.trash-item').forEach(item => {
      item.addEventListener('click', (e) => {
        this.showTrashItemMenu(item.dataset.noteId, e);
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
    menu.style.top  = event.pageY + 'px';
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
    this.setTheme(currentTheme === 'dark' ? 'light' : 'dark');
  }

  // Set theme
  setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);

    const icon = document.getElementById('theme-icon');
    if (icon) icon.textContent = theme === 'dark' ? '☀️' : '🌙';

    showToast(theme === 'dark' ? '🌙 Dark mode enabled' : '☀️ Light mode enabled');
  }

  // Load saved theme
  loadTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    this.setTheme(savedTheme);
  }
}

// ==========================================
// PROTOTYPE METHODS - AI & Tags
// ==========================================

NotesApp.prototype.showNoteContextMenu = function(e, noteId) {
  const menu = document.getElementById('note-context-menu');
  if (!menu) return;

  menu.style.left    = e.pageX + 'px';
  menu.style.top     = e.pageY + 'px';
  menu.style.display = 'block';

  const newMenu = menu.cloneNode(true);
  menu.parentNode.replaceChild(newMenu, menu);

  newMenu.querySelectorAll('.context-menu-item').forEach(item => {
    item.addEventListener('click', () => {
      const action = item.dataset.action;

      if (action === 'rename') {
        this.renameNote(noteId);
      } else if (action === 'move') {
        this.moveNoteToFolderPrompt(noteId);
      } else if (action === 'delete') {
        this.deleteNoteById(noteId);
      }

      newMenu.style.display = 'none';
    });
  });

  const closeMenu = (event) => {
    if (!newMenu.contains(event.target)) {
      newMenu.style.display = 'none';
      document.removeEventListener('click', closeMenu);
    }
  };
  setTimeout(() => document.addEventListener('click', closeMenu), 0);
};

NotesApp.prototype.renameNote = function(noteId) {
  const note = storage.getNote(noteId);
  if (!note) return;

  const newTitle = prompt('Enter new title:', note.title);
  if (newTitle && newTitle.trim()) {
    storage.updateNote(noteId, { title: newTitle.trim() });
    this.renderNotes();
    showToast('✓ Note renamed');
  }
};

NotesApp.prototype.moveNoteToFolderPrompt = function(noteId) {
  const folders = storage.getFolders();
  if (folders.length === 0) {
    showToast('No folders available. Create a folder first.', 'warning');
    return;
  }

  const folderList = folders.map((f, i) => `${i + 1}. ${f.name}`).join('\n');
  const choice = prompt(`Select folder:\n${folderList}\n\nEnter number:`);

  if (choice) {
    const index = parseInt(choice) - 1;
    if (index >= 0 && index < folders.length) {
      this.moveNoteToFolder(noteId, folders[index].id);
    }
  }
};

NotesApp.prototype.deleteNoteById = function(noteId) {
  if (confirm('Move this note to trash?')) {
    storage.deleteNote(noteId);
    this.renderNotes();
    this.renderTrash();

    if (this.currentNote?.id === noteId) {
      this.showWelcomeScreen();
    }
  }
};

NotesApp.prototype.suggestAITagsCompact = function() {
  if (!this.currentNote) {
    showToast('No note selected', 'warning');
    return;
  }

  const title   = document.getElementById('note-title')?.value || '';
  const content = stripHtml(document.getElementById('note-content')?.innerHTML || '');

  const suggestedTags = aiTagging.generateTags(title, content, 5);

  if (suggestedTags.length === 0) {
    showToast('Not enough content to suggest tags. Write more!', 'info');
    return;
  }

  privacyMonitor.trackAIOperation('auto-tag', new Blob([title + content]).size);

  const container = document.getElementById('suggested-tags-compact');
  const row       = document.getElementById('suggested-tags-row');

  document.getElementById('close-suggested-tags').onclick = () => {
    row.style.display = 'none';
    container.innerHTML = '';
  };

  container.innerHTML = suggestedTags.map(tag =>
    `<span class="suggested-tag-compact" data-tag="${tag}">${tag}</span>`
  ).join('');

  row.style.display = 'flex';

  container.querySelectorAll('.suggested-tag-compact').forEach(tagEl => {
    tagEl.addEventListener('click', () => {
      this.addTag(tagEl.dataset.tag);
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

  container.querySelectorAll('.remove').forEach(removeBtn => {
    removeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.removeTag(removeBtn.dataset.tag);
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

  storage.updateNote(this.currentNote.id, { tags: this.currentNote.tags });

  this.renderNoteTagsCompact();
  this.renderNotes();

  showToast(`Added tag: ${tag}`);
};

NotesApp.prototype.removeTag = function(tag) {
  if (!this.currentNote || !this.currentNote.tags) return;

  this.currentNote.tags = this.currentNote.tags.filter(t => t !== tag);

  storage.updateNote(this.currentNote.id, { tags: this.currentNote.tags });

  this.renderNoteTagsCompact();
  this.renderNotes();

  showToast(`Removed tag: ${tag}`);
};

NotesApp.prototype.addTagFromCompactInput = function() {
  const input = document.getElementById('tag-input-compact');
  const tag   = input?.value.trim().toLowerCase();

  if (!tag) return;

  if (tag.length < 2) {
    showToast('Tag must be at least 2 characters', 'warning');
    return;
  }

  this.addTag(tag);
  input.value = '';
  this.renderNoteTagsCompact();
};

// ==========================================
// TIME TRACKING SYSTEM
// ==========================================

NotesApp.prototype.startTimeTracking = function(note) {
  this.stopTimeTracking();

  if (!note.timeSpent) note.timeSpent = 0;

  this.noteStartTime = Date.now();

  this.timeTrackerInterval = setInterval(() => {
    this.updateTimeDisplay();
  }, 1000);

  this.updateTimeDisplay();
};

NotesApp.prototype.stopTimeTracking = function() {
  if (this.timeTrackerInterval) {
    clearInterval(this.timeTrackerInterval);
    this.timeTrackerInterval = null;
  }

  if (this.currentNote && this.noteStartTime) {
    const elapsed = Math.floor((Date.now() - this.noteStartTime) / 1000);
    this.currentNote.timeSpent = (this.currentNote.timeSpent || 0) + elapsed;

    storage.updateNote(this.currentNote.id, {
      timeSpent: this.currentNote.timeSpent
    });

    this.noteStartTime = null;
  }
};

NotesApp.prototype.updateTimeDisplay = function() {
  const display = document.getElementById('time-display');
  if (!display || !this.currentNote) return;

  const sessionTime  = this.noteStartTime ? Math.floor((Date.now() - this.noteStartTime) / 1000) : 0;
  const totalSeconds = (this.currentNote.timeSpent || 0) + sessionTime;

  const hours   = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  display.textContent = `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

NotesApp.prototype.formatTimeSpent = function(seconds) {
  if (!seconds) return '0m';

  const hours   = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
};

// ==========================================
// PROTOTYPE METHODS - Encryption
// ==========================================

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
  const confirmBtn    = document.getElementById('confirm-password-btn');
  const cancelBtn     = document.getElementById('cancel-password-btn');

  setTimeout(() => passwordInput.focus(), 100);

  if (action === 'encrypt') {
    passwordInput.addEventListener('input', () => {
      const strength    = checkPasswordStrength(passwordInput.value);
      const strengthBar = document.getElementById('password-strength-bar');
      const feedback    = document.getElementById('password-feedback');

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
    if (e.key === 'Enter') confirmBtn.click();
  });

  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.remove();
  });
};

NotesApp.prototype.performEncryption = function(password) {
  if (!this.currentNote) return;

  try {
    const title   = document.getElementById('note-title')?.value || '';
    const content = document.getElementById('note-content')?.innerHTML || '';

    const encryptedTitle   = advancedEncrypt(title, password);
    const encryptedContent = advancedEncrypt(content, password);

    storage.updateNote(this.currentNote.id, {
      title:       encryptedTitle,
      content:     encryptedContent,
      encrypted:   true,
      encryptedAt: new Date().toISOString()
    });

    privacyMonitor.trackEncryption();

    this.openNote(this.currentNote.id);
    this.renderNotes();

    showToast('🔒 Note encrypted successfully!', 'success');

  } catch (error) {
    console.error('Encryption failed:', error);
    showToast('Encryption failed. Please try again.', 'error');
  }
};

NotesApp.prototype.performDecryption = function(password) {
  if (!this.currentNote || !this.currentNote.encrypted) return;

  try {
    const decryptedTitle   = advancedDecrypt(this.currentNote.title, password);
    const decryptedContent = advancedDecrypt(this.currentNote.content, password);

    if (!decryptedTitle && !decryptedContent) {
      showToast('❌ Wrong password!', 'error');
      return;
    }

    storage.updateNote(this.currentNote.id, {
      title:     decryptedTitle,
      content:   decryptedContent,
      encrypted: false
    });

    this.openNote(this.currentNote.id);
    this.renderNotes();

    showToast('🔓 Note decrypted successfully!', 'success');

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

  userFoldersList.querySelectorAll('.folder-item').forEach(item => {
    const folderId = item.dataset.folderId;

    item.addEventListener('click', (e) => {
      if (!e.target.classList.contains('folder-action-btn')) {
        this.filterByFolder(folderId);
      }
    });

    const renameBtn = item.querySelector('[data-action="rename"]');
    if (renameBtn) {
      renameBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.renameFolder(folderId);
      });
    }

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
  const allCount    = document.getElementById('all-notes-count');
  const unfiledCount = document.getElementById('unfiled-count');

  if (allCount)     allCount.textContent    = storage.getNotes().length;
  if (unfiledCount) unfiledCount.textContent = storage.getNotesInFolder('unfiled').length;
};

NotesApp.prototype.createNewFolder = function() {
  const name = prompt('Enter folder name:');

  if (!name || !name.trim()) return;

  const folder = storage.createFolder(name.trim());
  this.renderFolders();
  this.renderFolderDropdown();
  showToast(`📁 Folder "${folder.name}" created!`);
};

NotesApp.prototype.renameFolder = function(folderId) {
  const folder = storage.getFolder(folderId);
  if (!folder) return;

  const newName = prompt('Rename folder:', folder.name);

  if (!newName || !newName.trim() || newName.trim() === folder.name) return;

  storage.updateFolder(folderId, { name: newName.trim() });
  this.renderFolders();
  this.renderFolderDropdown();
  showToast(`📁 Folder renamed to "${newName.trim()}"`);
};

NotesApp.prototype.deleteFolder = function(folderId) {
  const folder = storage.getFolder(folderId);
  if (!folder) return;

  const noteCount = storage.getNotesInFolder(folderId).length;
  const message   = noteCount > 0
    ? `Delete "${folder.name}"? ${noteCount} note(s) will be moved to Unfiled.`
    : `Delete "${folder.name}"?`;

  if (!confirm(message)) return;

  storage.deleteFolder(folderId);
  this.renderFolders();
  this.renderFolderDropdown();
  this.renderNotes();
  showToast(`📁 Folder "${folder.name}" deleted`);

  if (this.activeFolderId === folderId) {
    this.filterByFolder('all');
  }
};

NotesApp.prototype.filterByFolder = function(folderId) {
  this.activeFolderId = folderId;

  document.querySelectorAll('.folder-item').forEach(item => {
    item.classList.remove('active');
  });

  const activeFolder = document.querySelector(`[data-folder-id="${folderId}"]`);
  if (activeFolder) activeFolder.classList.add('active');

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

  const folders         = storage.getFolders();
  const currentFolderId = this.currentNote?.folderId || '';

  select.innerHTML = '<option value="">Unfiled</option>';

  folders.forEach(folder => {
    const option     = document.createElement('option');
    option.value     = folder.id;
    option.textContent = folder.name;
    option.selected  = folder.id === currentFolderId;
    select.appendChild(option);
  });
};

// ==========================================
// DRAG & DROP SYSTEM
// ==========================================

NotesApp.prototype.enableNoteDragDrop = function() {
  const notesList = document.getElementById('notes-list');
  if (!notesList) return;

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

    const noteId   = e.dataTransfer.getData('text/plain');
    const folderId = folderItem.dataset.folderId;

    document.querySelectorAll('.folder-item').forEach(f => f.classList.remove('drag-over'));

    if (folderId === 'all') {
      showToast('Cannot move notes to "All Notes"', 'warning');
      return;
    }

    this.moveNoteToFolder(noteId, folderId === 'unfiled' ? null : folderId);
  });
};

// ==========================================
// TAKE A BREAK SYSTEM
// ==========================================

class BreakActivities {
  constructor() {
    this.currentActivity      = null;
    this.meditationTimer      = null;
    this.meditationSeconds    = 300;
    this.meditationInterval   = null;
    this.breathingInterval    = null;
    this.breakTimerStart      = null;
    this.breakTimerInterval   = null;
    this.currentExerciseIndex = 0;
    this.exerciseTimer        = null;

    this.setupEventListeners();
  }

  setupEventListeners() {
    document.getElementById('take-break-btn')?.addEventListener('click', () => {
      this.openModal();
    });

    document.getElementById('break-modal-close')?.addEventListener('click', () => {
      this.closeModal();
    });

    document.querySelectorAll('.break-activity-card').forEach(card => {
      card.addEventListener('click', () => {
        this.openActivity(card.dataset.activity);
      });
    });

    document.getElementById('back-to-activities')?.addEventListener('click', () => {
      this.backToActivities();
    });

    this.setupDrawingPad();
    this.setupMeditationTimer();
    this.setupBreathingExercise();
    this.setupMemoryGame();
    this.setupBreakTimer();
    this.setupMovementExercise();

    document.getElementById('break-modal')?.addEventListener('click', (e) => {
      if (e.target.id === 'break-modal') this.closeModal();
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

    document.querySelector('.break-activities').style.display = 'none';
    document.getElementById('activity-view').style.display = 'block';

    document.querySelectorAll('.activity-content').forEach(content => {
      content.style.display = 'none';
    });

    document.getElementById(`${activity}-activity`).style.display = 'block';

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
    if (this.meditationInterval) {
      clearInterval(this.meditationInterval);
      this.meditationInterval = null;
    }

    if (this.breathingInterval) {
      clearInterval(this.breathingInterval);
      this.breathingInterval = null;
    }

    if (this.breakTimerInterval) {
      clearInterval(this.breakTimerInterval);
      this.breakTimerInterval = null;
    }
  }

  // Drawing Pad
  setupDrawingPad() {
    this.canvas       = document.getElementById('break-canvas');
    this.ctx          = this.canvas ? this.canvas.getContext('2d') : null;
    this.isDrawing    = false;
    this.currentColor = '#000000';
    this.brushSize    = 3;

    if (!this.canvas || !this.ctx) return;

    document.querySelectorAll('.color-btn-break').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.color-btn-break').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.currentColor = btn.dataset.color;
      });
    });

    document.getElementById('break-brush-size')?.addEventListener('input', (e) => {
      this.brushSize = parseInt(e.target.value);
    });

    document.getElementById('clear-break-canvas')?.addEventListener('click', () => {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    });

    this.canvas.addEventListener('mousedown', (e) => this.startDrawing(e));
    this.canvas.addEventListener('mousemove', (e) => this.draw(e));
    this.canvas.addEventListener('mouseup',   () => this.stopDrawing());
    this.canvas.addEventListener('mouseout',  () => this.stopDrawing());

    this.canvas.addEventListener('touchstart', (e) => { e.preventDefault(); this.startDrawing(e.touches[0]); });
    this.canvas.addEventListener('touchmove',  (e) => { e.preventDefault(); this.draw(e.touches[0]); });
    this.canvas.addEventListener('touchend',   () => this.stopDrawing());
  }

  initDrawingPad() {
    if (!this.canvas) return;
    this.canvas.width  = this.canvas.offsetWidth;
    this.canvas.height = this.canvas.offsetHeight;
  }

  startDrawing(e) {
    this.isDrawing = true;
    const rect = this.canvas.getBoundingClientRect();
    this.ctx.beginPath();
    this.ctx.moveTo((e.clientX || e.pageX) - rect.left, (e.clientY || e.pageY) - rect.top);
  }

  draw(e) {
    if (!this.isDrawing) return;
    const rect = this.canvas.getBoundingClientRect();
    this.ctx.lineWidth   = this.brushSize;
    this.ctx.lineCap     = 'round';
    this.ctx.strokeStyle = this.currentColor;
    this.ctx.lineTo((e.clientX || e.pageX) - rect.left, (e.clientY || e.pageY) - rect.top);
    this.ctx.stroke();
  }

  stopDrawing() {
    this.isDrawing = false;
  }

  // Meditation Timer
  setupMeditationTimer() {
    document.getElementById('meditation-start')?.addEventListener('click', () => this.startMeditation());
    document.getElementById('meditation-pause')?.addEventListener('click', () => this.pauseMeditation());
    document.getElementById('meditation-reset')?.addEventListener('click', () => this.resetMeditation());

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
    const activePreset     = document.querySelector('.timer-presets button.active');
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
    document.getElementById('breathing-start')?.addEventListener('click', () => this.startBreathing());
    document.getElementById('breathing-stop')?.addEventListener('click',  () => this.stopBreathing());
  }

  startBreathing() {
    document.getElementById('breathing-start').style.display = 'none';
    document.getElementById('breathing-stop').style.display  = 'inline-block';

    const circle      = document.getElementById('breathing-circle');
    const instruction = document.getElementById('breathing-instruction');

    let phase = 0;

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
    document.getElementById('breathing-start').style.display      = 'inline-block';
    document.getElementById('breathing-stop').style.display       = 'none';
    document.getElementById('breathing-instruction').textContent  = 'Click Start';
    document.getElementById('breathing-circle').classList.remove('inhale', 'exhale');
  }

  // Memory Game
  setupMemoryGame() {
    document.getElementById('new-game')?.addEventListener('click', () => this.initMemoryGame());
  }

  initMemoryGame() {
    const emojis = ['🎨', '🎭', '🎪', '🎬', '🎮', '🎯', '🎲', '🎸'];
    const cards  = [...emojis, ...emojis].sort(() => Math.random() - 0.5);

    const gameContainer = document.getElementById('memory-game');
    gameContainer.innerHTML = '';

    let flippedCards = [];
    let matchedPairs = 0;

    cards.forEach((emoji, index) => {
      const card          = document.createElement('div');
      card.className      = 'memory-card';
      card.dataset.emoji  = emoji;
      card.dataset.index  = index;

      card.addEventListener('click', () => {
        if (card.classList.contains('flipped') || card.classList.contains('matched') || flippedCards.length === 2) return;

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
    document.getElementById('timer-start')?.addEventListener('click', () => this.startBreakTimer());
    document.getElementById('timer-stop')?.addEventListener('click',  () => this.stopBreakTimer());
  }

  // Movement Exercise
  setupMovementExercise() {
    this.exercises = [
      { icon: '🙆‍♂️', name: 'Neck Stretch',     instruction: 'Gently tilt your head to each side, holding for 10 seconds' },
      { icon: '💪',    name: 'Shoulder Rolls',   instruction: 'Roll your shoulders backward 10 times, then forward 10 times' },
      { icon: '🤸‍♂️', name: 'Standing Stretch', instruction: 'Stand up, reach arms overhead, and stretch tall for 15 seconds' },
      { icon: '🦵',    name: 'Leg Raises',        instruction: 'While seated, extend one leg straight and hold for 10 seconds. Alternate legs' },
      { icon: '👐',    name: 'Wrist Circles',     instruction: 'Rotate your wrists in circles, 10 times each direction' },
      { icon: '🚶‍♂️', name: 'Walk Around',       instruction: 'Stand up and walk around your space for 30 seconds' },
      { icon: '🧘‍♀️', name: 'Seated Twist',      instruction: 'Sit tall, twist your torso gently to each side, holding for 10 seconds' },
      { icon: '👀',    name: 'Eye Rest',           instruction: 'Look away from screen. Focus on something 20 feet away for 20 seconds' }
    ];

    document.getElementById('prev-exercise')?.addEventListener('click',  () => this.previousExercise());
    document.getElementById('next-exercise')?.addEventListener('click',  () => this.nextExercise());
    document.getElementById('start-exercise')?.addEventListener('click', () => this.startExerciseTimer());

    this.currentExerciseIndex = 0;
    this.showExercise(0);
  }

  showExercise(index) {
    const exercise = this.exercises[index];
    document.querySelector('.exercise-icon').textContent        = exercise.icon;
    document.querySelector('.exercise-name').textContent        = exercise.name;
    document.querySelector('.exercise-instruction').textContent = exercise.instruction;
  }

  previousExercise() {
    this.currentExerciseIndex = (this.currentExerciseIndex - 1 + this.exercises.length) % this.exercises.length;
    this.showExercise(this.currentExerciseIndex);
  }

  nextExercise() {
    this.currentExerciseIndex = (this.currentExerciseIndex + 1) % this.exercises.length;
    this.showExercise(this.currentExerciseIndex);
  }

  startExerciseTimer() {
    let timeLeft      = 30;
    const timerDisplay = document.getElementById('exercise-timer');
    const startBtn    = document.getElementById('start-exercise');

    startBtn.style.display    = 'none';
    timerDisplay.style.display = 'block';
    timerDisplay.textContent  = timeLeft;

    this.exerciseTimer = setInterval(() => {
      timeLeft--;
      timerDisplay.textContent = timeLeft;

      if (timeLeft <= 0) {
        clearInterval(this.exerciseTimer);
        startBtn.style.display     = 'inline-block';
        timerDisplay.style.display = 'none';
        showToast('✓ Exercise complete!');
        setTimeout(() => this.nextExercise(), 1000);
      }
    }, 1000);
  }

  startBreakTimer() {
    this.breakTimerStart = Date.now();
    document.getElementById('timer-start').style.display = 'none';
    document.getElementById('timer-stop').style.display  = 'inline-block';

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
    document.getElementById('timer-stop').style.display  = 'none';
  }
}

// ==========================================
// TEMPLATES SYSTEM
// ==========================================

class TemplatesSystem {
  constructor(notesApp) {
    this.app          = notesApp;
    this.templates    = this.defineTemplates();
    this.recognition  = null;
    this.isListening  = false;

    this.setupEventListeners();
    this.initVoiceRecognition();
  }

  defineTemplates() {
    const today = new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      year:    'numeric',
      month:   'long',
      day:     'numeric'
    });

    return {
      journal: {
        title: `Daily Journal - ${today}`,
        content: `<h2>📔 Daily Journal Entry</h2>
<p><strong>Date:</strong> ${today}</p>

<h3>🌅 Morning Reflection</h3>
<p><em>What made you get up this morning? What are you looking forward to today?</em></p>
<p><br></p>

<h3>🙏 Gratitude</h3>
<p><em>What are you grateful for today?</em></p>
<p><br></p>

<h3>🎯 Today's Focus</h3>
<p><em>What's the one thing that would make today great?</em></p>
<p><br></p>

<h3>💭 Thoughts & Feelings</h3>
<p><em>How are you feeling right now? What's on your mind?</em></p>
<p><br></p>

<h3>🌙 Evening Reflection</h3>
<p><em>What will let you sleep peacefully tonight? What did you accomplish?</em></p>
<p><br></p>

<h3>📝 Free Writing</h3>
<p><em>Any other thoughts, ideas, or reflections...</em></p>
<p><br></p>`,
        hasVoice: true
      },

      meeting: {
        title: `Meeting Notes - ${today}`,
        content: `<h2>🤝 Meeting Notes</h2>
<p><strong>Date:</strong> ${today}</p>
<p><strong>Time:</strong> </p>
<p><strong>Location:</strong> </p>

<h3>👥 Attendees</h3>
<ul>
<li></li>
<li></li>
</ul>

<h3>📋 Agenda</h3>
<ol>
<li></li>
<li></li>
</ol>

<h3>💬 Discussion Points</h3>
<p><em>Use voice-to-text to capture key points during the meeting!</em></p>
<p><br></p>

<h3>✅ Action Items</h3>
<ul>
<li>[ ] </li>
<li>[ ] </li>
</ul>

<h3>📝 Additional Notes</h3>
<p><br></p>`,
        hasVoice: true
      },

      brainstorm: {
        title: `Brainstorming - ${today}`,
        content: `<h2>💡 Brainstorming Session</h2>
<p><strong>Date:</strong> ${today}</p>

<h3>🎯 Topic / Challenge</h3>
<p><em>What are you brainstorming about?</em></p>
<p><br></p>

<h3>💭 Stream of Consciousness</h3>
<p><em>Click the voice button 🎤 and just speak your thoughts! No filtering, no judgment - let the ideas flow!</em></p>
<p><br></p>

<h3>✨ Key Ideas</h3>
<ul>
<li></li>
<li></li>
<li></li>
</ul>

<h3>🔥 Best Ideas to Explore</h3>
<ol>
<li></li>
<li></li>
</ol>

<h3>🚀 Next Steps</h3>
<p><br></p>`,
        hasVoice: true
      }
    };
  }

  setupEventListeners() {
    document.getElementById('templates-btn')?.addEventListener('click', () => this.openModal());
    document.getElementById('templates-modal-close')?.addEventListener('click', () => this.closeModal());

    document.querySelectorAll('.template-card').forEach(card => {
      card.addEventListener('click', () => {
        this.createFromTemplate(card.dataset.template);
      });
    });

    document.getElementById('voice-btn')?.addEventListener('click', () => this.toggleVoice());

    document.getElementById('voice-language')?.addEventListener('change', (e) => {
      this.changeLanguage(e.target.value);
    });

    document.getElementById('templates-modal')?.addEventListener('click', (e) => {
      if (e.target.id === 'templates-modal') this.closeModal();
    });
  }

  openModal()  { document.getElementById('templates-modal').style.display = 'flex'; }
  closeModal() { document.getElementById('templates-modal').style.display = 'none'; }

  createFromTemplate(templateType) {
    const template = this.templates[templateType];
    if (!template) return;

    const note = storage.createNote(template.title, template.content);

    storage.updateNote(note.id, {
      isTemplate:   true,
      templateType: templateType,
      hasVoice:     template.hasVoice
    });

    this.closeModal();

    if (typeof this.app.renderNotes === 'function') this.app.renderNotes();
    this.app.openNote(note.id);

    if (template.hasVoice) this.showVoiceButton();

    showToast(`✓ Created ${template.title.split(' - ')[0]}`);
  }

  showVoiceButton() {
    const voiceSection = document.getElementById('voice-to-text-section');
    if (voiceSection) voiceSection.style.display = 'flex';
    this.loadSavedLanguage();
  }

  hideVoiceButton() {
    const voiceSection = document.getElementById('voice-to-text-section');
    if (voiceSection) voiceSection.style.display = 'none';
    this.stopVoice();
  }

  // Voice Recognition
  initVoiceRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) return;

    this.recognition              = new SpeechRecognition();
    this.recognition.continuous   = true;
    this.recognition.interimResults = true;
    this.currentLanguage          = localStorage.getItem('voiceLanguage') || 'en-US';
    this.recognition.lang         = this.currentLanguage;

    let finalTranscript = '';

    this.recognition.onresult = (event) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;

        if (event.results[i].isFinal) {
          finalTranscript += transcript + ' ';
        }
      }

      if (finalTranscript) {
        this.insertVoiceText(finalTranscript);
        finalTranscript = '';
      }
    };

    this.recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      if (event.error === 'no-speech') {
        showToast('No speech detected. Try again.', 'warning');
      } else if (event.error === 'not-allowed') {
        showToast('Microphone access denied', 'error');
      }
      this.stopVoice();
    };

    this.recognition.onend = () => {
      this.isListening = false;
      this.updateVoiceButton();
    };
  }

  toggleVoice() {
    if (!this.recognition) {
      showToast('Voice recognition not supported in this browser', 'error');
      return;
    }

    this.isListening ? this.stopVoice() : this.startVoice();
  }

  startVoice() {
    try {
      this.recognition.start();
      this.isListening = true;
      this.updateVoiceButton();
      showToast('🎤 Listening... Speak now!');
    } catch (error) {
      console.error('Failed to start voice recognition:', error);
      showToast('Failed to start voice recognition', 'error');
    }
  }

  stopVoice() {
    if (this.recognition && this.isListening) {
      this.recognition.stop();
      this.isListening = false;
      this.updateVoiceButton();
    }
  }

  updateVoiceButton() {
    const voiceBtn    = document.getElementById('voice-btn');
    const voiceStatus = document.getElementById('voice-status');

    if (this.isListening) {
      voiceBtn.classList.add('listening');
      voiceStatus.textContent = 'Listening...';
    } else {
      voiceBtn.classList.remove('listening');
      voiceStatus.textContent = 'Voice';
    }
  }

  insertVoiceText(text) {
    const editor = document.getElementById('note-content');
    if (!editor) return;

    editor.focus();

    const selection = window.getSelection();
    if (selection.rangeCount > 0) {
      const range    = selection.getRangeAt(0);
      range.deleteContents();

      const textNode = document.createTextNode(text);
      range.insertNode(textNode);

      range.setStartAfter(textNode);
      range.setEndAfter(textNode);
      selection.removeAllRanges();
      selection.addRange(range);
    } else {
      editor.innerHTML += text;
    }

    if (this.app) this.app.autoSaveNote();
  }

  changeLanguage(language) {
    this.currentLanguage = language;
    localStorage.setItem('voiceLanguage', language);

    if (this.recognition) this.recognition.lang = language;

    if (this.isListening) {
      this.stopVoice();
      setTimeout(() => this.startVoice(), 100);
    }

    const langName = document.querySelector(`#voice-language option[value="${language}"]`).text;
    showToast(`🌍 Voice language: ${langName}`);
  }

  loadSavedLanguage() {
    const savedLanguage = localStorage.getItem('voiceLanguage') || 'en-US';
    const selector      = document.getElementById('voice-language');
    if (selector) selector.value = savedLanguage;
  }

  checkVoiceSupport() {
    this.showVoiceButton();
  }
}

// ==========================================
// INITIALIZATION
// ==========================================

function initApp() {
  window.app = new NotesApp();
  app.loadTheme();

  const sidebarToggle = document.getElementById('sidebar-toggle');
  const sidebar       = document.querySelector('.sidebar');

  const overlay       = document.createElement('div');
  overlay.className   = 'sidebar-overlay';
  document.body.appendChild(overlay);

  function openSidebar() {
    sidebar.classList.add('is-open');
    overlay.classList.add('is-visible');
    sidebarToggle.classList.add('is-open');
    document.body.style.overflow = 'hidden';
  }

  function closeSidebar() {
    sidebar.classList.remove('is-open');
    overlay.classList.remove('is-visible');
    sidebarToggle.classList.remove('is-open');
    document.body.style.overflow = '';
  }

  sidebarToggle.addEventListener('click', () => {
    sidebar.classList.contains('is-open') ? closeSidebar() : openSidebar();
  });

  overlay.addEventListener('click', closeSidebar);

  document.getElementById('notes-list').addEventListener('click', () => {
    if (window.innerWidth <= 768) closeSidebar();
  });

  window.breakActivities = new BreakActivities();
  window.templatesSystem = new TemplatesSystem(window.app);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}

// Save time tracking before page closes
window.addEventListener('beforeunload', () => {
  if (window.app) window.app.stopTimeTracking();
});