/* ============================================
   APP.JS - Main Application Logic
   Privacy-First AI Notes App
   ============================================ */

class NotesApp {
  constructor() {
    this.currentNote = null;
    this.autoSaveTimeout = null;
    this.init();
  }

  // Initialize app
  init() {
    log('Initializing Simple Notes App...', 'info');

    // Hide loading screen, show app
    setTimeout(() => {
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
  // Open note
  openNote(noteId) {
    const note = storage.getNote(noteId);
    if (!note) return;

    this.currentNote = note;

    // Hide welcome, show editor
    document.getElementById('welcome-screen').style.display = 'none';
    document.getElementById('note-editor-screen').style.display = 'flex';

    // Load note content
    document.getElementById('note-title').value = note.title;
    document.getElementById('note-content').innerHTML = note.content;

    // Update active state in list
    document.querySelectorAll('.note-item').forEach(item => {
      item.classList.remove('active');
    });
    document.querySelector(`[data-note-id="${noteId}"]`)?.classList.add('active');

    log(`Opened note: ${noteId}`, 'info');
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

console.log('✅ Simple Notes App ready!');