/* ============================================
   STORAGE.JS - Data Persistence Layer
   ============================================ */

class StorageManager {
  constructor() {
    this.STORAGE_KEY = 'simple_notes_data';
    this.data = this.load();
  }

  // Load data from localStorage
  load() {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);

        if (!parsed.folders) parsed.folders = [];
        if (!parsed.trash)   parsed.trash   = {};

        return parsed;
      }
    } catch (e) {
      console.error('Failed to load data:', e);
      showToast('Failed to load saved data', 'error');
    }

    return {
      notes: {},
      trash: {},
      folders: [],
      settings: {
        theme:             'auto',
        autoSave:          true,
        encryptionEnabled: false
      },
      metadata: {
        version:      '1.0.0',
        created:      new Date().toISOString(),
        lastModified: new Date().toISOString()
      }
    };
  }

  // Save data to localStorage
  save() {
    try {
      this.data.metadata.lastModified = new Date().toISOString();
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.data));
      return true;
    } catch (e) {
      console.error('Failed to save data:', e);

      if (e.name === 'QuotaExceededError') {
        showToast('Storage full! Please delete some notes.', 'error');
      } else {
        showToast('Failed to save data', 'error');
      }
      return false;
    }
  }

  // Get all notes
  getNotes() {
    return Object.values(this.data.notes).sort((a, b) => {
      return new Date(b.modified) - new Date(a.modified);
    });
  }

  // Get single note
  getNote(id) {
    return this.data.notes[id] || null;
  }

  // Create new note
  createNote(title = '', content = '') {
    const id  = generateId();
    const now = new Date().toISOString();

    const note = {
      id,
      title:     title || 'Untitled Note',
      content:   content || '',
      created:   now,
      modified:  now,
      encrypted: false,
      tags:      [],
      folderId:  null,
      color:     null
    };

    this.data.notes[id] = note;
    this.save();
    return note;
  }

  // Update note
  updateNote(id, updates) {
    if (!this.data.notes[id]) {
      console.error('Note not found:', id);
      return false;
    }

    this.data.notes[id] = {
      ...this.data.notes[id],
      ...updates,
      modified: new Date().toISOString()
    };

    this.save();
    return this.data.notes[id];
  }

  // Soft delete note (move to trash)
  deleteNote(id) {
    if (!this.data.notes[id]) {
      console.error('Note not found:', id);
      return false;
    }

    const note = this.data.notes[id];
    note.deletedAt = new Date().toISOString();

    this.data.trash[id] = note;
    delete this.data.notes[id];

    this.save();
    showToast('Note moved to trash');
    return true;
  }

  // Get trash items
  getTrash() {
    return Object.values(this.data.trash).sort((a, b) => {
      return new Date(b.deletedAt) - new Date(a.deletedAt);
    });
  }

  // Restore note from trash
  restoreNote(id) {
    if (!this.data.trash[id]) {
      console.error('Note not found in trash:', id);
      return false;
    }

    const note = this.data.trash[id];
    delete note.deletedAt;
    note.modified = new Date().toISOString();

    this.data.notes[id] = note;
    delete this.data.trash[id];

    this.save();
    showToast('Note restored');
    return true;
  }

  // Permanently delete note from trash
  permanentlyDeleteNote(id) {
    if (!this.data.trash[id]) {
      console.error('Note not found in trash:', id);
      return false;
    }

    delete this.data.trash[id];
    this.save();

    showToast('Note permanently deleted');
    return true;
  }

  // Empty trash (delete all)
  emptyTrash() {
    const count = Object.keys(this.data.trash).length;
    this.data.trash = {};
    this.save();

    showToast(`Deleted ${count} notes permanently`);
    return true;
  }

  // Auto-cleanup old trash items (30 days)
  cleanupOldTrash() {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    let deleted = 0;
    Object.keys(this.data.trash).forEach(id => {
      if (new Date(this.data.trash[id].deletedAt) < thirtyDaysAgo) {
        delete this.data.trash[id];
        deleted++;
      }
    });

    if (deleted > 0) this.save();

    return deleted;
  }

  // Search notes
  searchNotes(query) {
    if (!query) return this.getNotes();

    const lowerQuery = query.toLowerCase();
    return this.getNotes().filter(note => {
      return note.title.toLowerCase().includes(lowerQuery) ||
             stripHtml(note.content).toLowerCase().includes(lowerQuery);
    });
  }

  // Get storage stats
  getStorageStats() {
    const bytes = new Blob([JSON.stringify(this.data)]).size;

    return {
      totalNotes:           Object.keys(this.data.notes).length,
      storageUsed:          bytes,
      storageUsedFormatted: formatBytes(bytes),
      estimatedLimit:       5 * 1024 * 1024,
      percentUsed:          (bytes / (5 * 1024 * 1024)) * 100
    };
  }

  // Export all data
  exportData() {
    return {
      ...this.data,
      exportedAt: new Date().toISOString(),
      version:    '1.0.0'
    };
  }

  // Import data
  importData(importedData, mode = 'merge') {
    try {
      if (mode === 'replace') {
        this.data = importedData;
      } else {
        this.data.notes = {
          ...this.data.notes,
          ...importedData.notes
        };
      }

      this.save();
      showToast('Data imported successfully!');
      return true;
    } catch (e) {
      console.error('Import failed:', e);
      showToast('Failed to import data', 'error');
      return false;
    }
  }

  // Clear all data (with confirmation)
  clearAll() {
    if (confirm('⚠️ Delete ALL notes? This cannot be undone!')) {
      this.data = {
        notes:   {},
        trash:   {},
        folders: [],
        settings: this.data.settings,
        metadata: {
          version:      '1.0.0',
          created:      new Date().toISOString(),
          lastModified: new Date().toISOString()
        }
      };
      this.save();
      showToast('All notes deleted', 'warning');
      return true;
    }
    return false;
  }

  // ==========================================
  // FOLDER MANAGEMENT
  // ==========================================

  // Get all folders
  getFolders() {
    return this.data.folders || [];
  }

  // Get folder by ID
  getFolder(folderId) {
    return this.data.folders.find(f => f.id === folderId);
  }

  // Create new folder
  createFolder(name) {
    const folder = {
      id:       generateId(),
      name:     name,
      created:  new Date().toISOString(),
      modified: new Date().toISOString()
    };

    this.data.folders.push(folder);
    this.save();
    return folder;
  }

  // Update folder
  updateFolder(folderId, updates) {
    const folder = this.getFolder(folderId);
    if (!folder) return null;

    Object.assign(folder, updates, { modified: new Date().toISOString() });

    this.save();
    return folder;
  }

  // Delete folder
  deleteFolder(folderId) {
    const index = this.data.folders.findIndex(f => f.id === folderId);
    if (index === -1) return false;

    // Remove folder reference from all notes
    this.data.notes = Object.fromEntries(
      Object.entries(this.data.notes).map(([id, note]) => {
        if (note.folderId === folderId) note.folderId = null;
        return [id, note];
      })
    );

    this.data.folders.splice(index, 1);
    this.save();
    return true;
  }

  // Get notes in folder
  getNotesInFolder(folderId) {
    if (folderId === 'unfiled') {
      return Object.values(this.data.notes).filter(note => !note.folderId);
    }
    return Object.values(this.data.notes).filter(note => note.folderId === folderId);
  }

  // Move note to folder
  moveNoteToFolder(noteId, folderId) {
    const note = this.getNote(noteId);
    if (!note) return false;

    note.folderId = folderId;
    note.modified = new Date().toISOString();

    this.save();
    return true;
  }
}

// Create global instance
window.storage = new StorageManager();