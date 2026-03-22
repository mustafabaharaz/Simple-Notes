/* ============================================
   SETTINGS.JS — Settings Panel + Export/Import
   Simple Notes · Phase 1
   ============================================ */

class SettingsManager {
  constructor(app) {
    this.app = app;
    this.settings = this._load();
    this.init();
  }

  /* ---- Persistence ---- */

  _load() {
    const defaults = {
      theme:       'light',
      fontSize:    'medium',
      autoSave:    true,
      sortOrder:   'newest',
      wordCount:   true,
    };
    try {
      const saved = JSON.parse(localStorage.getItem('sn_settings_v1') || '{}');
      return { ...defaults, ...saved };
    } catch {
      return defaults;
    }
  }

  _save() {
    localStorage.setItem('sn_settings_v1', JSON.stringify(this.settings));
  }

  /* ---- Apply on startup ---- */

  applyAll() {
    this._applyFontSize(this.settings.fontSize);
    this._applyWordCountVisibility();
    // sort order picked up by renderNotes via this.settings
    // theme is managed by app.loadTheme() separately
  }

  _applyFontSize(size) {
    const map = { small: '14px', medium: '16px', large: '19px' };
    const el  = document.getElementById('note-content');
    if (el) el.style.fontSize = map[size] || '16px';
  }

  _applyWordCountVisibility() {
    const el = document.getElementById('word-count-display');
    if (el) el.style.display = this.settings.wordCount ? 'block' : 'none';
  }

  /* ---- Init ---- */

  init() {
    /* --- Open / close --- */
    document.getElementById('settings-btn')?.addEventListener('click', () => this.open());
    document.getElementById('close-settings')?.addEventListener('click', () => this.close());
    document.getElementById('settings-modal')?.addEventListener('click', (e) => {
      if (e.target.id === 'settings-modal') this.close();
    });

    // Ctrl/Cmd + , shortcut
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === ',') {
        e.preventDefault();
        this.open();
      }
    });

    /* --- Theme radio --- */
    document.querySelectorAll('input[name="sn-theme"]').forEach(radio => {
      radio.addEventListener('change', (e) => {
        this.settings.theme = e.target.value;
        this._save();
        if (e.target.value === 'auto') {
          const dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
          this.app.setTheme(dark ? 'dark' : 'light');
        } else {
          this.app.setTheme(e.target.value);
        }
      });
    });

    /* --- Font size radio --- */
    document.querySelectorAll('input[name="sn-font-size"]').forEach(radio => {
      radio.addEventListener('change', (e) => {
        this.settings.fontSize = e.target.value;
        this._save();
        this._applyFontSize(e.target.value);
      });
    });

    /* --- Sort order --- */
    document.getElementById('settings-sort-order')?.addEventListener('change', (e) => {
      this.settings.sortOrder = e.target.value;
      this._save();
      // Also sync the sidebar sort dropdown if present
      const sidebarSort = document.getElementById('sidebar-sort-order');
      if (sidebarSort) sidebarSort.value = e.target.value;
      this.app.renderNotes();
    });

    /* --- Auto-save toggle --- */
    document.getElementById('auto-save-toggle')?.addEventListener('change', (e) => {
      this.settings.autoSave = e.target.checked;
      this._save();
    });

    /* --- Word count toggle --- */
    document.getElementById('word-count-toggle')?.addEventListener('change', (e) => {
      this.settings.wordCount = e.target.checked;
      this._save();
      this._applyWordCountVisibility();
    });

    /* --- Export buttons --- */
    document.getElementById('export-json-btn')?.addEventListener('click', () => this.exportJSON());
    document.getElementById('export-txt-btn')?.addEventListener('click',  () => this.exportCurrentAsTxt());
    document.getElementById('export-md-btn')?.addEventListener('click',   () => this.exportCurrentAsMd());

    /* --- Import --- */
    document.getElementById('import-file-input')?.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) this.importJSON(file);
      e.target.value = ''; // allow re-importing same file
    });
    document.getElementById('import-btn')?.addEventListener('click', () => {
      document.getElementById('import-file-input')?.click();
    });

    /* --- Clear all --- */
    document.getElementById('clear-all-btn')?.addEventListener('click', () => {
      if (confirm('⚠️ Permanently delete ALL notes, folders, and data? This cannot be undone.')) {
        storage.clearAll();
        this.app.currentNote = null;
        this.app.renderNotes();
        this.app.renderFolders?.();
        this.app.renderTrash?.();
        this.app.updateNotesCount?.();
        this.app.showWelcomeScreen();
        this.close();
      }
    });

    /* --- Sidebar sort dropdown (outside settings modal) --- */
    document.getElementById('sidebar-sort-order')?.addEventListener('change', (e) => {
      this.settings.sortOrder = e.target.value;
      this._save();
      // sync settings modal dropdown
      const modalSort = document.getElementById('settings-sort-order');
      if (modalSort) modalSort.value = e.target.value;
      this.app.renderNotes();
    });

    /* --- Apply everything on startup --- */
    this.applyAll();
    this._setupWordCount();
  }

  /* ---- Open / Close ---- */

  open() {
    const modal = document.getElementById('settings-modal');
    if (!modal) return;
    this._syncUI();
    this._updateStorageStats();
    modal.style.display = 'flex';
    requestAnimationFrame(() => modal.classList.add('is-open'));
  }

  close() {
    const modal = document.getElementById('settings-modal');
    if (!modal) return;
    modal.classList.remove('is-open');
    setTimeout(() => { modal.style.display = 'none'; }, 220);
  }

  /* ---- Sync UI to stored settings ---- */

  _syncUI() {
    // Theme
    const themeR = document.querySelector(`input[name="sn-theme"][value="${this.settings.theme}"]`);
    if (themeR) themeR.checked = true;

    // Font size
    const fontR = document.querySelector(`input[name="sn-font-size"][value="${this.settings.fontSize}"]`);
    if (fontR) fontR.checked = true;

    // Sort
    const sortSel = document.getElementById('settings-sort-order');
    if (sortSel) sortSel.value = this.settings.sortOrder;

    // Toggles
    const autoSaveTgl = document.getElementById('auto-save-toggle');
    if (autoSaveTgl) autoSaveTgl.checked = this.settings.autoSave;

    const wcTgl = document.getElementById('word-count-toggle');
    if (wcTgl) wcTgl.checked = this.settings.wordCount;
  }

  /* ---- Storage stats ---- */

  _updateStorageStats() {
    const stats  = storage.getStorageStats?.();
    if (!stats) return;

    const bar   = document.getElementById('storage-bar-fill');
    const label = document.getElementById('storage-label');

    if (bar) {
      bar.style.width = Math.min(stats.percentUsed, 100) + '%';
      bar.className   = 'storage-bar-fill';
      if (stats.percentUsed > 80) bar.classList.add('storage-danger');
      else if (stats.percentUsed > 60) bar.classList.add('storage-warning');
    }

    if (label) {
      label.textContent = `${stats.storageUsedFormatted} used of ~5 MB · ${stats.totalNotes} note${stats.totalNotes !== 1 ? 's' : ''}`;
    }
  }


  /* ============ EXPORT ============ */

  exportJSON() {
    const data  = storage.exportData();
    const json  = JSON.stringify(data, null, 2);
    const blob  = new Blob([json], { type: 'application/json' });
    const url   = URL.createObjectURL(blob);
    const a     = document.createElement('a');
    const date  = new Date().toISOString().split('T')[0];
    a.href      = url;
    a.download  = `simple-notes-backup-${date}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('✅ Full backup exported!');
  }

  exportCurrentAsTxt() {
    const note = this.app.currentNote;
    if (!note) { showToast('Open a note first', 'warning'); return; }
    if (note.encrypted) { showToast('Decrypt the note before exporting', 'warning'); return; }

    const title = note.title || 'Untitled';
    const body  = stripHtml(note.content || '');
    const text  = `${title}\n${'─'.repeat(title.length)}\n\n${body}`;

    this._downloadBlob(text, 'text/plain', `${title}.txt`);
    showToast('✅ Exported as .txt');
  }

  exportCurrentAsMd() {
    const note = this.app.currentNote;
    if (!note) { showToast('Open a note first', 'warning'); return; }
    if (note.encrypted) { showToast('Decrypt the note before exporting', 'warning'); return; }

    let md = (note.content || '')
      .replace(/<strong>(.*?)<\/strong>/gi, '**$1**')
      .replace(/<b>(.*?)<\/b>/gi,          '**$1**')
      .replace(/<em>(.*?)<\/em>/gi,        '*$1*')
      .replace(/<i>(.*?)<\/i>/gi,          '*$1*')
      .replace(/<u>(.*?)<\/u>/gi,          '_$1_')
      .replace(/<h1[^>]*>(.*?)<\/h1>/gi,   '# $1\n')
      .replace(/<h2[^>]*>(.*?)<\/h2>/gi,   '## $1\n')
      .replace(/<h3[^>]*>(.*?)<\/h3>/gi,   '### $1\n')
      .replace(/<li[^>]*>(.*?)<\/li>/gi,   '- $1\n')
      .replace(/<br\s*\/?>/gi,             '\n')
      .replace(/<p[^>]*>(.*?)<\/p>/gi,     '$1\n\n')
      .replace(/<[^>]+>/g,                 '')
      .replace(/&amp;/g,   '&')
      .replace(/&lt;/g,    '<')
      .replace(/&gt;/g,    '>')
      .replace(/&nbsp;/g,  ' ')
      .trim();

    const title = note.title || 'Untitled';
    const full  = `# ${title}\n\n${md}`;

    this._downloadBlob(full, 'text/markdown', `${title}.md`);
    showToast('✅ Exported as .md');
  }

  _downloadBlob(content, type, filename) {
    const blob = new Blob([content], { type });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }


  /* ============ IMPORT ============ */

  importJSON(file) {
    if (!file.name.endsWith('.json')) {
      showToast('Please select a .json backup file', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);

        if (!data.notes) {
          showToast('Invalid backup file — missing notes data', 'error');
          return;
        }

        const count = Object.keys(data.notes).length;
        const merge = confirm(
          `Found ${count} note${count !== 1 ? 's' : ''} in backup.\n\n` +
          `OK → Merge with existing notes\n` +
          `Cancel → Replace ALL current notes`
        );

        const success = storage.importData(data, merge ? 'merge' : 'replace');
        if (success) {
          this.app.renderNotes?.();
          this.app.renderFolders?.();
          this.app.renderTrash?.();
          this.app.updateNotesCount?.();
          this._updateStorageStats();
          showToast(`✅ Imported ${count} note${count !== 1 ? 's' : ''}!`);
        }
      } catch (err) {
        showToast('Failed to read backup file', 'error');
        console.error('[Settings] Import error:', err);
      }
    };
    reader.readAsText(file);
  }


  /* ============ WORD COUNT ============ */

  _setupWordCount() {
    const noteContent = document.getElementById('note-content');
    if (!noteContent) return;
    noteContent.addEventListener('input', () => this.updateWordCount());
  }

  updateWordCount() {
    if (!this.settings.wordCount) return;
    const el      = document.getElementById('word-count-display');
    const content = document.getElementById('note-content');
    if (!el || !content) return;

    const text  = stripHtml(content.innerHTML).trim();
    const words = text ? text.split(/\s+/).filter(Boolean).length : 0;
    const chars = text.length;
    el.textContent = `${words} word${words !== 1 ? 's' : ''} · ${chars} char${chars !== 1 ? 's' : ''}`;
  }
}

console.log('✅ Settings module loaded');
