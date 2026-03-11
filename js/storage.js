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
        
        // Ensure folders array exists
        if (!parsed.folders) {
          parsed.folders = [];
        }
        
        log('Data loaded from storage', 'success');
        return parsed;
      }
    } catch (e) {
      console.error('Failed to load data:', e);
      showToast('Failed to load saved data', 'error');
    }
    
    // Return default structure
    return {
      notes: {},
      folders: [],
      settings: {
        theme: 'auto',
        autoSave: true,
        encryptionEnabled: false
      },
      metadata: {
        version: '1.0.0',
        created: new Date().toISOString(),
        lastModified: new Date().toISOString()
      }
    };
  }

  // Save data to localStorage
  save() {
    try {
      this.data.metadata.lastModified = new Date().toISOString();
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.data));
      log('Data saved to storage', 'success');
      return true;
    } catch (e) {
      console.error('Failed to save data:', e);
      
      // Check if quota exceeded
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
    const id = generateId();
    const now = new Date().toISOString();
    
    const note = {
      id,
      title: title || 'Untitled Note',
      content: content || '',
      created: now,
      modified: now,
      encrypted: false,
      tags: [],
      folderId: null,
      color: null
    };
    
    this.data.notes[id] = note;
    this.save();
    
    log(`Note created: ${id}`, 'success');
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
    log(`Note updated: ${id}`, 'info');
    return this.data.notes[id];
  }

  // Delete note
  deleteNote(id) {
    if (!this.data.notes[id]) {
      console.error('Note not found:', id);
      return false;
    }
    
    delete this.data.notes[id];
    this.save();
    
    log(`Note deleted: ${id}`, 'warning');
    showToast('Note deleted');
    return true;
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
    const dataStr = JSON.stringify(this.data);
    const bytes = new Blob([dataStr]).size;
    
    return {
      totalNotes: Object.keys(this.data.notes).length,
      storageUsed: bytes,
      storageUsedFormatted: formatBytes(bytes),
      estimatedLimit: 5 * 1024 * 1024, // 5MB typical limit
      percentUsed: (bytes / (5 * 1024 * 1024)) * 100
    };
  }

  // Export all data
  exportData() {
    return {
      ...this.data,
      exportedAt: new Date().toISOString(),
      version: '1.0.0'
    };
  }

  // Import data
  importData(importedData, mode = 'merge') {
    try {
      if (mode === 'replace') {
        this.data = importedData;
      } else {
        // Merge notes
        this.data.notes = {
          ...this.data.notes,
          ...importedData.notes
        };
      }
      
      this.save();
      log('Data imported successfully', 'success');
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
        notes: {},
        folders: [],
        settings: this.data.settings,
        metadata: {
          version: '1.0.0',
          created: new Date().toISOString(),
          lastModified: new Date().toISOString()
        }
      };
      this.save();
      log('All data cleared', 'warning');
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
      id: generateId(),
      name: name,
      created: new Date().toISOString(),
      modified: new Date().toISOString()
    };

    this.data.folders.push(folder);
    this.save();
    
    log(`Folder created: ${name}`, 'info');
    return folder;
  }

  // Update folder
  updateFolder(folderId, updates) {
    const folder = this.getFolder(folderId);
    if (!folder) return null;

    Object.assign(folder, updates, {
      modified: new Date().toISOString()
    });

    this.save();
    log(`Folder updated: ${folderId}`, 'info');
    return folder;
  }

  // Delete folder
  deleteFolder(folderId) {
    const index = this.data.folders.findIndex(f => f.id === folderId);
    if (index === -1) return false;

    // Remove folder reference from all notes
    this.data.notes = Object.fromEntries(
      Object.entries(this.data.notes).map(([id, note]) => {
        if (note.folderId === folderId) {
          note.folderId = null;
        }
        return [id, note];
      })
    );

    this.data.folders.splice(index, 1);
    this.save();
    
    log(`Folder deleted: ${folderId}`, 'info');
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
    log(`Note moved to folder: ${noteId} -> ${folderId}`, 'info');
    return true;
  }
}

// Create global instance
const storage = new StorageManager();

console.log('✅ Storage manager loaded');