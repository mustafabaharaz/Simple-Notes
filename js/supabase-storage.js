/* ============================================
   SUPABASE-STORAGE.JS
   Cloud data layer for Simple Notes WebApp
   Plain global script, no ES modules
   Drop-in replacement for storage.js —
   exposes the same window.storage API
   ============================================ */

/* ── helpers ──────────────────────────────── */
function _uid() { return window.auth?.userId ?? null; }

function _rowToNote(row) {
  return {
    id:          row.id,
    title:       row.title,
    content:     row.content,
    tags:        row.tags        ?? [],
    encrypted:   row.encrypted   ?? false,
    folderId:    row.folder_id   ?? null,
    lineSpacing: row.line_spacing ?? '1.6',
    timeSpent:   row.time_spent  ?? 0,
    wordCount:   row.word_count  ?? 0,
    modified:    row.updated_at,
    created:     row.created_at,
    isDeleted:   row.is_deleted  ?? false,
    deletedAt:   row.deleted_at  ?? null,
  };
}

function _noteToRow(note) {
  return {
    title:        note.title       ?? 'Untitled Note',
    content:      note.content     ?? '',
    tags:         note.tags        ?? [],
    encrypted:    note.encrypted   ?? false,
    folder_id:    note.folderId    ?? null,
    line_spacing: note.lineSpacing ?? '1.6',
    time_spent:   note.timeSpent   ?? 0,
    word_count:   note.wordCount   ?? 0,
  };
}

function _rowToFolder(row) {
  return {
    id:        row.id,
    name:      row.name,
    color:     row.color      ?? '#007AFF',
    icon:      row.icon       ?? '📁',
    sortOrder: row.sort_order ?? 0,
    created:   row.created_at,
    modified:  row.updated_at,
  };
}

/* ============================================
   StorageManager (cloud edition)
   ============================================ */
class StorageManager {
  constructor() {
    this._notes   = {};
    this._folders = [];
    this._trash   = {};
    this._loaded  = false;

    // Boot once user is signed in
    window.auth.onChange(user => {
      if (user) {
        this._bootstrap();
      } else {
        this._clear();
      }
    });
  }

  async _bootstrap() {
    if (this._loaded) return;
    await Promise.all([this._fetchNotes(), this._fetchFolders()]);
    this._loaded = true;
    this._subscribeRealtime();

    // Migrate any old localStorage notes (runs once)
    await this.migrateFromLocalStorage();

    // Re-render the app now that data is loaded
    if (window.app) {
      window.app.renderNotes();
      window.app.renderFolders();
      window.app.updateNotesCount();
      window.app.renderTrash();
    }
  }

  _clear() {
    this._notes   = {};
    this._folders = [];
    this._trash   = {};
    this._loaded  = false;
  }

  /* ── Fetch ───────────────────────────────── */
  async _fetchNotes() {
    const { data, error } = await window.__sbClient
      .from('notes')
      .select('*')
      .eq('user_id', _uid())
      .order('updated_at', { ascending: false });

    if (error) { console.error('fetchNotes:', error); return; }

    this._notes = {};
    this._trash = {};
    (data ?? []).forEach(row => {
      const note = _rowToNote(row);
      if (note.isDeleted) this._trash[note.id] = note;
      else                this._notes[note.id] = note;
    });
  }

  async _fetchFolders() {
    const { data, error } = await window.__sbClient
      .from('folders')
      .select('*')
      .eq('user_id', _uid())
      .order('sort_order');

    if (error) { console.error('fetchFolders:', error); return; }
    this._folders = (data ?? []).map(_rowToFolder);
  }

  /* ── Realtime ─────────────────────────────── */
  _subscribeRealtime() {
    window.__sbClient
      .channel(`notes:${_uid()}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'notes',
        filter: `user_id=eq.${_uid()}`,
      }, payload => this._handleRealtimeNote(payload))
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'folders',
        filter: `user_id=eq.${_uid()}`,
      }, payload => this._handleRealtimeFolder(payload))
      .subscribe();
  }

  _handleRealtimeNote({ eventType, new: row, old }) {
    if (eventType === 'DELETE') {
      delete this._notes[old.id];
      delete this._trash[old.id];
    } else {
      const note = _rowToNote(row);
      if (note.isDeleted) {
        delete this._notes[note.id];
        this._trash[note.id] = note;
      } else {
        delete this._trash[note.id];
        this._notes[note.id] = note;
      }
    }
    window.dispatchEvent(new CustomEvent('notes:changed'));
  }

  _handleRealtimeFolder({ eventType, new: row, old }) {
    if (eventType === 'DELETE') {
      this._folders = this._folders.filter(f => f.id !== old.id);
    } else {
      const folder = _rowToFolder(row);
      const idx    = this._folders.findIndex(f => f.id === folder.id);
      if (idx >= 0) this._folders[idx] = folder;
      else          this._folders.push(folder);
    }
    window.dispatchEvent(new CustomEvent('folders:changed'));
  }

  /* ============================================
     PUBLIC API — identical to original storage.js
     ============================================ */

  // ── Notes ─────────────────────────────────────

  getNotes() {
    return Object.values(this._notes);
  }

  getNote(id) {
    return this._notes[id] ?? null;
  }

  async createNote(title = 'Untitled Note', content = '') {
    const { data, error } = await window.__sbClient
      .from('notes')
      .insert({ user_id: _uid(), title, content })
      .select()
      .single();

    if (error) {
      console.error('createNote:', error);
      showToast('Failed to create note', 'error');
      return null;
    }

    const note = _rowToNote(data);
    this._notes[note.id] = note;
    return note;
  }

  async updateNote(id, updates) {
    // Optimistic local update first
    if (this._notes[id]) Object.assign(this._notes[id], updates);

    const row = _noteToRow({ ...(this._notes[id] ?? {}), ...updates });

    const { error } = await window.__sbClient
      .from('notes')
      .update(row)
      .eq('id', id)
      .eq('user_id', _uid());

    if (error) {
      console.error('updateNote:', error);
      showToast('Save failed — retrying…', 'warning');
      await this._fetchNotes();
    }

    return this._notes[id] ?? null;
  }

  async deleteNote(id) {
    const { error } = await window.__sbClient
      .from('notes')
      .update({ is_deleted: true, deleted_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', _uid());

    if (error) { console.error('deleteNote:', error); return false; }

    const note = this._notes[id];
    if (note) {
      note.isDeleted = true;
      note.deletedAt = new Date().toISOString();
      this._trash[id] = note;
      delete this._notes[id];
    }
    return true;
  }

  async restoreNote(id) {
    const { error } = await window.__sbClient
      .from('notes')
      .update({ is_deleted: false, deleted_at: null })
      .eq('id', id)
      .eq('user_id', _uid());

    if (error) { console.error('restoreNote:', error); return false; }

    const note = this._trash[id];
    if (note) {
      note.isDeleted = false;
      note.deletedAt = null;
      this._notes[id] = note;
      delete this._trash[id];
    }
    return true;
  }

  async permanentlyDeleteNote(id) {
    const { error } = await window.__sbClient
      .from('notes')
      .delete()
      .eq('id', id)
      .eq('user_id', _uid());

    if (error) { console.error('permanentlyDeleteNote:', error); return false; }
    delete this._notes[id];
    delete this._trash[id];
    return true;
  }

  // ── Trash ──────────────────────────────────────

  getTrash() {
    return Object.values(this._trash);
  }

  async cleanupOldTrash() {
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    for (const [id, note] of Object.entries(this._trash)) {
      if (note.deletedAt && new Date(note.deletedAt).getTime() < cutoff) {
        await this.permanentlyDeleteNote(id);
      }
    }
  }

  async emptyTrash() {
    const ids = Object.keys(this._trash);
    if (!ids.length) return true;

    const { error } = await window.__sbClient
      .from('notes')
      .delete()
      .in('id', ids)
      .eq('user_id', _uid());

    if (error) { console.error('emptyTrash:', error); return false; }
    this._trash = {};
    return true;
  }

  // ── Folders ────────────────────────────────────

  getFolders() { return this._folders; }

  getFolder(id) { return this._folders.find(f => f.id === id) ?? null; }

  async createFolder(name) {
    const { data, error } = await window.__sbClient
      .from('folders')
      .insert({ user_id: _uid(), name })
      .select()
      .single();

    if (error) {
      console.error('createFolder:', error);
      showToast('Failed to create folder', 'error');
      return null;
    }

    const folder = _rowToFolder(data);
    this._folders.push(folder);
    return folder;
  }

  async updateFolder(id, updates) {
    const folder = this.getFolder(id);
    if (!folder) return null;

    Object.assign(folder, updates);

    const { error } = await window.__sbClient
      .from('folders')
      .update({ name: folder.name, color: folder.color, icon: folder.icon, sort_order: folder.sortOrder })
      .eq('id', id)
      .eq('user_id', _uid());

    if (error) { console.error('updateFolder:', error); }
    return folder;
  }

  async deleteFolder(id) {
    const { error } = await window.__sbClient
      .from('folders')
      .delete()
      .eq('id', id)
      .eq('user_id', _uid());

    if (error) { console.error('deleteFolder:', error); return false; }

    this._folders = this._folders.filter(f => f.id !== id);
    Object.values(this._notes).forEach(n => {
      if (n.folderId === id) n.folderId = null;
    });
    return true;
  }

  getNotesInFolder(folderId) {
    if (folderId === 'unfiled') return Object.values(this._notes).filter(n => !n.folderId);
    return Object.values(this._notes).filter(n => n.folderId === folderId);
  }

  async moveNoteToFolder(noteId, folderId) {
    return this.updateNote(noteId, { folderId });
  }

  // ── Settings ───────────────────────────────────

  async getSettings() {
    const profile = await window.auth.getProfile();
    return {
      theme:    profile?.theme     ?? 'auto',
      autoSave: profile?.auto_save ?? true,
    };
  }

  async updateSettings(updates) {
    const profileUpdates = {};
    if (updates.theme    !== undefined) profileUpdates.theme     = updates.theme;
    if (updates.autoSave !== undefined) profileUpdates.auto_save = updates.autoSave;
    await window.auth.updateProfile(profileUpdates);
  }

  // ── Export / Import ────────────────────────────

  exportData() {
    return JSON.stringify({
      notes:    this._notes,
      trash:    this._trash,
      folders:  this._folders,
      metadata: { version: '2.0.0', exported: new Date().toISOString() },
    }, null, 2);
  }

  async importData(jsonStr) {
    try {
      const parsed = JSON.parse(jsonStr);
      for (const folder of (parsed.folders ?? [])) {
        await this.createFolder(folder.name);
      }
      for (const note of Object.values(parsed.notes ?? {})) {
        await this.createNote(note.title, note.content);
      }
      showToast('Data imported successfully!', 'success');
      return true;
    } catch (e) {
      console.error('importData:', e);
      showToast('Failed to import data', 'error');
      return false;
    }
  }

  // ── localStorage migration (runs once) ─────────

  async migrateFromLocalStorage() {
    const raw = localStorage.getItem('simple_notes_data');
    if (!raw) return false;

    let parsed;
    try { parsed = JSON.parse(raw); } catch { return false; }

    const notes   = Object.values(parsed.notes   ?? {});
    const folders = parsed.folders ?? [];

    if (!notes.length && !folders.length) return false;

    showToast('Migrating local notes to cloud…', 'info');

    const folderMap = {};
    for (const f of folders) {
      const created = await this.createFolder(f.name);
      if (created) folderMap[f.id] = created.id;
    }

    for (const n of notes) {
      const created = await this.createNote(n.title, n.content);
      if (created && n.folderId && folderMap[n.folderId]) {
        await this.moveNoteToFolder(created.id, folderMap[n.folderId]);
      }
    }

    localStorage.setItem('simple_notes_data_migrated_backup', raw);
    localStorage.removeItem('simple_notes_data');

    showToast(`Migrated ${notes.length} note(s) to cloud ✅`, 'success');
    return true;
  }
}

window.storage = new StorageManager();