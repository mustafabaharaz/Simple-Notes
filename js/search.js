/* ============================================
   SEARCH.JS — Live Note Search
   Simple Notes · Phase 1
   ============================================ */

class SearchManager {
  constructor(app) {
    this.app = app;
    this.query = '';
    this.isActive = false;
    this.init();
  }

  init() {
    const input  = document.getElementById('search-input');
    const clear  = document.getElementById('search-clear');
    if (!input) return;

    // Live search as user types (debounced 180ms)
    input.addEventListener('input', debounce((e) => {
      this.query = e.target.value.trim();
      this.performSearch();
    }, 180));

    // Escape key clears
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.clearSearch();
        input.blur();
      }
    });

    // ✕ clear button
    clear?.addEventListener('click', () => {
      this.clearSearch();
      input.focus();
    });

    // Ctrl/Cmd+F to focus search (only when not in editor)
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        const activeEl = document.activeElement;
        const inEditor = activeEl?.id === 'note-content' || activeEl?.id === 'note-title';
        if (!inEditor) {
          e.preventDefault();
          this.focusSearch();
        }
      }
    });
  }

  focusSearch() {
    const input = document.getElementById('search-input');
    if (input) {
      input.focus();
      input.select();
    }
  }

  performSearch() {
    const clear        = document.getElementById('search-clear');
    const resultsLabel = document.getElementById('search-results-label');

    if (!this.query) {
      this.clearSearch();
      return;
    }

    this.isActive = true;
    clear?.classList.add('visible');

    const results = storage.searchNotes(this.query);

    if (resultsLabel) {
      resultsLabel.textContent = results.length === 0
        ? 'No results'
        : `${results.length} result${results.length !== 1 ? 's' : ''}`;
      resultsLabel.style.display = 'inline';
    }

    this._renderResults(results);
  }

  _renderResults(notes) {
    const notesList = document.getElementById('notes-list');
    if (!notesList) return;

    if (notes.length === 0) {
      notesList.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">🔍</div>
          <div class="empty-state-text">No notes match "${this.query}"</div>
        </div>`;
      return;
    }

    notesList.innerHTML = notes.map(note => {
      const isActive = this.app.currentNote?.id === note.id;

      // Date label
      const date        = new Date(note.modified || note.created || Date.now());
      const now         = new Date();
      const isToday     = date.toDateString() === now.toDateString();
      const isYesterday = date.toDateString() === new Date(now - 86400000).toDateString();
      const dateLabel   = isToday     ? 'Today, ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        : isYesterday ? 'Yesterday'
                        : date.toLocaleDateString([], { month: 'short', day: 'numeric' });

      // Highlighted title + preview
      const rawTitle   = note.title || 'Untitled';
      const rawPreview = truncate(stripHtml(note.content), 120);
      const title      = this._highlight(rawTitle, this.query);
      const preview    = note.encrypted ? 'Contents hidden — click to decrypt'
                                        : this._highlight(rawPreview, this.query);

      const encBadge  = note.encrypted ? `<span class="note-item-badge badge-encrypted">🔒 Encrypted</span>` : '';
      const pinBadge  = note.pinned    ? `<span class="note-item-badge badge-pinned">📌</span>` : '';
      const previewCls = note.encrypted ? 'note-item-preview is-encrypted' : 'note-item-preview';

      const tagsHTML = (note.tags?.length)
        ? `<div class="note-item-tags">${note.tags.slice(0,4).map(t => `<span class="note-item-tag">${t}</span>`).join('')}</div>`
        : '';

      return `
        <div class="note-item ${isActive ? 'active' : ''} ${note.pinned ? 'is-pinned' : ''}"
             data-note-id="${note.id}"
             draggable="true">
          <div class="note-item-header">
            <div class="note-item-title">${pinBadge}${encBadge}${title}</div>
            <div class="note-item-date">${dateLabel}</div>
          </div>
          <div class="${previewCls}">${preview}</div>
          ${tagsHTML}
        </div>`;
    }).join('');

    // Re-attach handlers
    notesList.querySelectorAll('.note-item').forEach(item => {
      item.addEventListener('click', () => {
        this.app.openNote(item.dataset.noteId);
      });
      item.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        this.app.showNoteContextMenu(e, item.dataset.noteId);
      });
    });
  }

  _highlight(text, query) {
    if (!text || !query) return text;
    const esc   = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${esc})`, 'gi');
    return text.replace(regex, '<mark class="search-highlight">$1</mark>');
  }

  clearSearch() {
    const input        = document.getElementById('search-input');
    const clear        = document.getElementById('search-clear');
    const resultsLabel = document.getElementById('search-results-label');

    this.query    = '';
    this.isActive = false;

    if (input) input.value = '';
    clear?.classList.remove('visible');
    if (resultsLabel) resultsLabel.style.display = 'none';

    // Restore normal notes list
    this.app.renderNotes();
  }
}

console.log('✅ Search module loaded');
