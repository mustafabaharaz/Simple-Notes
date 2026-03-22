/* ============================================
   APP-PHASE1-PATCH.JS — NotesApp enhancements
   Simple Notes · Phase 1
   Loads after app.js. Zero edits to core files.
   ============================================ */

/* =============================================
   1. openNote — safe alias / fallback
   =============================================
   The existing renderNotes click handler calls
   this.openNote(noteId). If it isn't already
   defined on the prototype, we define it here.
   ============================================= */
if (!NotesApp.prototype.openNote) {
  NotesApp.prototype.openNote = function(noteId) {
    const note = storage.getNote(noteId);
    if (!note) return;

    this.currentNote = note;

    // Show editor, hide welcome
    const welcome = document.getElementById('welcome-screen');
    const editor  = document.getElementById('note-editor-screen');
    if (welcome) welcome.style.display = 'none';
    if (editor)  editor.style.display  = 'flex';

    // Populate title
    const titleEl = document.getElementById('note-title');
    if (titleEl) titleEl.value = note.title || '';

    // Populate content
    const contentEl = document.getElementById('note-content');
    if (contentEl) {
      if (note.encrypted) {
        contentEl.innerHTML = '';
        contentEl.setAttribute('contenteditable', 'false');
        document.getElementById('encrypt-note-btn')?.style.setProperty('display', 'none');
        document.getElementById('decrypt-note-btn')?.style.setProperty('display', 'inline-flex');
      } else {
        contentEl.innerHTML = (typeof DOMPurify !== 'undefined')
          ? DOMPurify.sanitize(note.content || '')
          : (note.content || '');
        contentEl.setAttribute('contenteditable', 'true');
        document.getElementById('encrypt-note-btn')?.style.setProperty('display', 'inline-flex');
        document.getElementById('decrypt-note-btn')?.style.setProperty('display', 'none');
      }
    }

    // Show toolbar
    const toolbar = document.getElementById('unified-toolbar');
    if (toolbar) toolbar.style.display = 'flex';

    // Highlight active note in list
    document.querySelectorAll('.note-item').forEach(el => {
      el.classList.toggle('active', el.dataset.noteId === noteId);
    });

    // Set folder dropdown
    const folderSel = document.getElementById('note-folder-select');
    if (folderSel) folderSel.value = note.folderId || '';

    // Render tags
    this.renderCompactTags?.(note.tags || []);

    // Update word count
    window.settingsManager?.updateWordCount();

    // Start time tracking
    this.startTimeTracking?.();
  };
}


/* =============================================
   2. sortNotes helper
   ============================================= */
NotesApp.prototype.sortNotes = function(notes, order) {
  const arr = [...notes];
  switch (order) {
    case 'newest':
      return arr.sort((a, b) => new Date(b.modified || b.created) - new Date(a.modified || a.created));
    case 'oldest':
      return arr.sort((a, b) => new Date(a.modified || a.created) - new Date(b.modified || b.created));
    case 'alphabetical':
      return arr.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
    case 'z-a':
      return arr.sort((a, b) => (b.title || '').localeCompare(a.title || ''));
    default:
      return arr;
  }
};


/* =============================================
   3. Patch renderNotes — sort + pinned support
   ============================================= */
const _origRenderNotes = NotesApp.prototype.renderNotes;
NotesApp.prototype.renderNotes = function() {
  // If search is active, delegate to search manager
  if (window.searchManager?.isActive) {
    window.searchManager.performSearch();
    return;
  }

  const notesList = document.getElementById('notes-list');
  if (!notesList) return;

  // Gather notes (folder-aware)
  let notes;
  if (!this.activeFolderId || this.activeFolderId === 'all') {
    notes = storage.getNotes();
  } else {
    notes = storage.getNotesInFolder(this.activeFolderId);
  }

  // Apply sort
  const order = window.settingsManager?.settings?.sortOrder || 'newest';
  notes = this.sortNotes(notes, order);

  // Pinned notes always first
  const pinned   = notes.filter(n => n.pinned);
  const unpinned = notes.filter(n => !n.pinned);
  notes = [...pinned, ...unpinned];

  if (notes.length === 0) {
    notesList.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📝</div>
        <div class="empty-state-text">No notes yet</div>
      </div>`;
    return;
  }

  notesList.innerHTML = notes.map(note => {
    const isActive = this.currentNote?.id === note.id;

    // Date label
    const date        = new Date(note.modified || note.created || Date.now());
    const now         = new Date();
    const isToday     = date.toDateString() === now.toDateString();
    const isYesterday = date.toDateString() === new Date(now - 86400000).toDateString();
    const dateLabel   = isToday     ? 'Today, ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                      : isYesterday ? 'Yesterday'
                      : date.toLocaleDateString([], { month: 'short', day: 'numeric' });

    // Badges
    const timeBadge  = note.timeSpent
      ? `<span class="note-item-time">${this.formatTimeSpent?.(note.timeSpent) || ''}</span>`
      : '';
    const encBadge = note.encrypted ? `<span class="note-item-badge badge-encrypted">🔒 Encrypted</span>` : '';
    const pinBadge = note.pinned    ? `<span class="note-item-badge badge-pinned">📌</span>`             : '';

    const previewCls = note.encrypted ? 'note-item-preview is-encrypted' : 'note-item-preview';
    const preview    = note.encrypted
      ? 'Contents hidden — click to decrypt'
      : (truncate(stripHtml(note.content), 120) || 'No content yet');

    const tagsHTML = (note.tags?.length)
      ? `<div class="note-item-tags">${note.tags.slice(0,4).map(t => `<span class="note-item-tag">${t}</span>`).join('')}</div>`
      : '';

    return `
      <div class="note-item ${isActive ? 'active' : ''} ${note.pinned ? 'is-pinned' : ''}"
           data-note-id="${note.id}"
           draggable="true">
        <div class="note-item-header">
          <div class="note-item-title">${pinBadge}${encBadge}${note.title || 'Untitled'}</div>
          <div class="note-item-date">${dateLabel}${timeBadge}</div>
        </div>
        <div class="${previewCls}">${preview}</div>
        ${tagsHTML}
      </div>`;
  }).join('');

  // Attach event handlers
  notesList.querySelectorAll('.note-item').forEach(item => {
    item.addEventListener('click', () => this.openNote(item.dataset.noteId));
    item.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      this.showNoteContextMenu(e, item.dataset.noteId);
    });
    item.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('noteId', item.dataset.noteId);
    });
  });
};


/* =============================================
   4. Patch context menu — add Pin/Unpin
   ============================================= */
const _origContextMenu = NotesApp.prototype.showNoteContextMenu;
NotesApp.prototype.showNoteContextMenu = function(e, noteId) {
  const menu = document.getElementById('note-context-menu');
  if (!menu) return;

  menu.style.left    = e.pageX + 'px';
  menu.style.top     = e.pageY + 'px';
  menu.style.display = 'block';

  // Clone to remove old listeners
  const newMenu = menu.cloneNode(true);
  menu.parentNode.replaceChild(newMenu, menu);

  // Update Pin label dynamically
  const note    = storage.getNote(noteId);
  const pinItem = newMenu.querySelector('[data-action="pin"]');
  if (pinItem && note) {
    pinItem.textContent = note.pinned ? '📌 Unpin Note' : '📌 Pin Note';
  }

  newMenu.querySelectorAll('.context-menu-item').forEach(item => {
    item.addEventListener('click', () => {
      const action = item.dataset.action;
      if (action === 'rename') this.renameNote(noteId);
      else if (action === 'move')   this.moveNoteToFolderPrompt(noteId);
      else if (action === 'delete') this.deleteNoteById(noteId);
      else if (action === 'pin')    this.togglePinNote(noteId);
      newMenu.style.display = 'none';
    });
  });

  const closeMenu = (ev) => {
    if (!newMenu.contains(ev.target)) {
      newMenu.style.display = 'none';
      document.removeEventListener('click', closeMenu);
    }
  };
  setTimeout(() => document.addEventListener('click', closeMenu), 0);
};


/* =============================================
   5. Pin / Unpin note
   ============================================= */
NotesApp.prototype.togglePinNote = function(noteId) {
  const note = storage.getNote(noteId);
  if (!note) return;
  const nowPinned = !note.pinned;
  storage.updateNote(noteId, { pinned: nowPinned });
  this.renderNotes();
  showToast(nowPinned ? '📌 Note pinned' : '📌 Note unpinned');
};


/* =============================================
   6. Initialize Phase 1 managers
   ============================================= */
const _initPhase1 = () => {
  if (!window.app) return;

  // Search manager
  window.searchManager = new SearchManager(window.app);

  // Settings manager
  window.settingsManager = new SettingsManager(window.app);

  // Sync sidebar sort dropdown to saved preference
  const sidebarSort = document.getElementById('sidebar-sort-order');
  if (sidebarSort) {
    sidebarSort.value = window.settingsManager.settings.sortOrder;
  }
};

// Wait for app to be ready (app.js initializes on DOMContentLoaded)
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => setTimeout(_initPhase1, 250));
} else {
  setTimeout(_initPhase1, 250);
}

console.log('✅ Phase 1 app patches loaded');
