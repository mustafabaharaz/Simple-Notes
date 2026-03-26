/* ================================================================
   DIALOG-PATCH.JS — Phase 10 QF4
   Patches confirm() / prompt() call sites in app.js, settings.js,
   hotfix-phase4.js, hotfix-phase4b.js so they all use Wren's
   custom dialog instead of browser native dialogs.
   Must load AFTER sidebar-redesign.js (which sets window.wrenConfirm)
   and AFTER the files being patched.
   Additive — zero edits to existing files.
   ================================================================ */

(function () {
  'use strict';

  function waitFor (fn, interval, timeout) {
    return new Promise((resolve, reject) => {
      const start = Date.now();
      const t = setInterval(() => {
        if (fn()) { clearInterval(t); resolve(); }
        else if (Date.now() - start > timeout) { clearInterval(t); reject(); }
      }, interval);
    });
  }

  /* ── Wait until app + wrenConfirm are both ready ─────────── */
  waitFor(() => window.wrenConfirm && window.app, 100, 10000)
    .then(patchApp)
    .catch(() => console.warn('dialog-patch: app or wrenConfirm not found'));

  waitFor(() => window.wrenConfirm, 100, 10000)
    .then(patchSettings)
    .catch(() => {});

  /* ── Patch NotesApp methods ───────────────────────────────── */
  function patchApp () {
    const app = window.app;
    if (!app || app.__dialogPatched) return;
    app.__dialogPatched = true;

    /* ── deleteCurrentNote ──────────────────────────────────── */
    /* Replaces the confirm() inside app.js deleteCurrentNote */
    app.deleteCurrentNote = function () {
      if (!this.currentNote) return;
      const noteId = this.currentNote.id;
      wrenConfirm({
        title: 'Move to Trash?',
        body: 'You can recover this note from the Trash.',
        icon: '🗑️',
        confirmText: 'Move to Trash',
        danger: true
      }).then(ok => {
        if (!ok) return;
        storage.deleteNote(noteId);
        this.currentNote = null;
        this.renderNotes();
        this.renderFolders();
        this.renderTrash();
        this.updateNotesCount?.();
        this.showWelcomeScreen();
      });
    };

    /* ── deleteNoteById (context menu trash) ─────────────────── */
    app.deleteNoteById = function (noteId) {
      wrenConfirm({
        title: 'Move to Trash?',
        body: 'You can recover this note from the Trash.',
        icon: '🗑️',
        confirmText: 'Move to Trash',
        danger: true
      }).then(ok => {
        if (!ok) return;
        storage.deleteNote(noteId);
        this.renderNotes();
        this.renderTrash();
        if (this.currentNote?.id === noteId) this.showWelcomeScreen();
      });
    };

    /* ── permanentlyDeleteNote ───────────────────────────────── */
    const origPermDelete = NotesApp?.prototype?.permanentlyDeleteNote
      ? NotesApp.prototype.permanentlyDeleteNote.bind(app)
      : null;
    app.permanentlyDeleteNote = function (noteId) {
      wrenConfirm({
        title: 'Delete Permanently?',
        body: 'This note will be gone forever. This cannot be undone.',
        icon: '⚠️',
        confirmText: 'Delete Forever',
        danger: true
      }).then(ok => {
        if (!ok) return;
        storage.permanentlyDeleteNote?.(noteId) || storage.deleteNote?.(noteId);
        this.renderTrash?.();
      });
    };

    /* ── emptyTrash button ───────────────────────────────────── */
    patchEmptyTrashBtn();

    /* ── createNewFolder ─────────────────────────────────────── */
    app.createNewFolder = function () {
      wrenPrompt({
        title: 'New Folder',
        placeholder: 'Folder name…',
        icon: '📁',
        confirmText: 'Create'
      }).then(val => {
        if (!val?.trim()) return;
        const folder = storage.createFolder?.(val.trim());
        if (folder) {
          this.renderFolders?.();
          this.renderFolderDropdown?.();
          if (typeof showToast === 'function') showToast('📁 Folder "' + folder.name + '" created!');
        }
      });
    };

    /* ── renameFolder ────────────────────────────────────────── */
    app.renameFolder = function (folderId) {
      const folder = storage.getFolder?.(folderId);
      wrenPrompt({
        title: 'Rename Folder',
        placeholder: 'New name…',
        defaultValue: folder?.name || '',
        icon: '📁',
        confirmText: 'Rename'
      }).then(val => {
        if (!val?.trim() || val.trim() === folder?.name) return;
        storage.updateFolder?.(folderId, { name: val.trim() });
        this.renderFolders?.();
        this.renderFolderDropdown?.();
        if (typeof showToast === 'function') showToast('📁 Renamed to "' + val.trim() + '"');
      });
    };

    console.log('✅ dialog-patch: app methods patched');
  }

  function patchEmptyTrashBtn () {
    const btn = document.getElementById('empty-trash-btn');
    if (!btn || btn.__dialogPatched) return;
    btn.__dialogPatched = true;
    /* Clone to strip all existing listeners, then re-add ours */
    const fresh = btn.cloneNode(true);
    btn.parentNode.replaceChild(fresh, btn);
    fresh.addEventListener('click', () => {
      wrenConfirm({
        title: 'Empty Trash?',
        body: 'All trashed notes will be permanently deleted. This cannot be undone.',
        icon: '🗑️',
        confirmText: 'Empty Trash',
        danger: true
      }).then(ok => {
        if (!ok) return;
        storage.emptyTrash?.();
        window.app?.renderTrash?.();
      });
    });
  }

  /* ── Patch Settings clear-all button ─────────────────────── */
  function patchSettings () {
    const clearBtn = document.getElementById('clear-all-btn');
    if (!clearBtn || clearBtn.__dialogPatched) return;
    clearBtn.__dialogPatched = true;

    clearBtn.addEventListener('click', e => {
      e.stopImmediatePropagation();
      wrenConfirm({
        title: 'Delete All Data?',
        body: 'This permanently removes every note, folder, and setting. There is no undo.',
        icon: '💥',
        confirmText: 'Delete Everything',
        danger: true
      }).then(ok => {
        if (!ok) return;
        if (window.storage?.clearAll) {
          window.storage.clearAll();
          window.location.reload();
        }
      });
    }, true /* capture to fire before settings.js listener */);

    /* Patch import merge/replace confirm */
    const importBtn = document.getElementById('import-btn');
    if (importBtn && !importBtn.__dialogPatched) {
      importBtn.__dialogPatched = true;
      // The actual confirm fires in settings.js after file is read —
      // window.confirm override from sidebar-redesign.js handles that automatically.
    }

    console.log('✅ dialog-patch: settings patched');
  }

  /* ── Patch meeting context menu (hotfix-phase4.js) ─────────── */
  /* Uses capture-phase event delegation so we intercept BEFORE
     hotfix-phase4's listener calls confirm() or prompt()          */
  document.addEventListener('click', function meetingCtxPatch (e) {
    const item = e.target.closest('.context-menu-item[data-action]');
    if (!item) return;

    const menu = item.closest('#meeting-context-menu');
    if (!menu) return; // only intercept meeting context menu

    const action = item.dataset.action;
    const noteId = window.__lastRightClickedNoteId || menu.__noteId || menu.dataset.noteId;

    if (action === 'delete') {
      e.stopImmediatePropagation();
      menu.style.display = 'none';
      wrenConfirm({
        title: 'Move Meeting to Trash?',
        body: 'You can recover it from the Trash.',
        icon: '🗑️',
        confirmText: 'Move to Trash',
        danger: true
      }).then(ok => {
        if (!ok) return;
        storage.deleteNote(noteId);
        if (window.meetingNotes) {
          if (meetingNotes.activeMeetingId === noteId) meetingNotes.closeMeetingEditor();
          meetingNotes.refreshMiniList?.();
        }
        if (typeof showToast === 'function') showToast('Meeting moved to trash');
      });
    }

    if (action === 'rename') {
      e.stopImmediatePropagation();
      menu.style.display = 'none';
      const note = storage.getNote(noteId);
      wrenPrompt({
        title: 'Rename Meeting',
        placeholder: 'New title…',
        defaultValue: note?.title || '',
        icon: '✏️',
        confirmText: 'Rename'
      }).then(val => {
        if (!val?.trim()) return;
        storage.updateNote(noteId, { title: val.trim() });
        window.meetingNotes?.refreshMiniList?.();
        if (typeof showToast === 'function') showToast('✓ Meeting renamed');
      });
    }
  }, true /* capture */);

  /* Track which meeting item was right-clicked so we have the noteId
     when our capture listener fires (hotfix-phase4 uses a closure) */
  document.addEventListener('contextmenu', function trackMeetingRightClick (e) {
    const meetingItem = e.target.closest('.meeting-mini-item, .org-meeting-item, [data-meeting-id], [data-note-id]');
    if (meetingItem) {
      window.__lastRightClickedNoteId =
        meetingItem.dataset.meetingId ||   // meeting-notes.js uses data-meeting-id
        meetingItem.dataset.noteId ||
        null;
    }
  }, true);

  /* ── Patch note context menu delete (app.js) ─────────────── */
  document.addEventListener('click', function noteCtxPatch (e) {
    const item = e.target.closest('#note-context-menu .context-menu-item[data-action="delete"]');
    if (!item) return;
    e.stopImmediatePropagation();
    // Get noteId from the menu's stored state
    const noteId = window.app?._contextMenuNoteId || window.app?.currentNote?.id;
    document.getElementById('note-context-menu').style.display = 'none';
    wrenConfirm({
      title: 'Move to Trash?',
      body: 'You can recover this note from the Trash.',
      icon: '🗑️',
      confirmText: 'Move to Trash',
      danger: true
    }).then(ok => {
      if (!ok || !noteId) return;
      storage.deleteNote(noteId);
      window.app?.renderNotes?.();
      window.app?.renderTrash?.();
      if (window.app?.currentNote?.id === noteId) window.app.showWelcomeScreen?.();
    });
  }, true);

  /* ── Patch trash restore/permanent delete (hotfix-phase4b) ── */
  waitFor(() => window.wrenConfirm, 100, 10000).then(() => {
    /* hotfix-phase4b uses confirm() inline — patch via event delegation */
    document.addEventListener('click', function trashCtxPatch (e) {
      const restoreBtn = e.target.closest('[data-action="restore"]');
      const deleteBtn  = e.target.closest('[data-action="delete"]');
      const trashItem  = e.target.closest('.trash-item');
      if (!trashItem) return;
      const noteId = trashItem.dataset.noteId;
      if (!noteId) return;

      if (restoreBtn) {
        e.stopImmediatePropagation();
        storage.restoreNote?.(noteId);
        window.app?.renderNotes?.();
        window.app?.renderTrash?.();
      }

      if (deleteBtn) {
        e.stopImmediatePropagation();
        wrenConfirm({
          title: 'Delete Permanently?',
          body: 'This note will be gone forever. This cannot be undone.',
          icon: '⚠️',
          confirmText: 'Delete Forever',
          danger: true
        }).then(ok => {
          if (!ok) return;
          storage.permanentlyDeleteNote?.(noteId);
          window.app?.renderTrash?.();
        });
      }
    }, true);
  }).catch(() => {});

  /* ── Fix 2: clean meeting note preview in personal sidebar ── */
  function patchMeetingPreview () {
    if (!window.app || window.app.__meetingPreviewPatched) return;
    window.app.__meetingPreviewPatched = true;

    const origRenderNotes = window.app.renderNotes?.bind(window.app);
    if (!origRenderNotes) return;

    window.app.renderNotes = function () {
      origRenderNotes();

      // After rendering, replace JSON-garbled previews with clean text
      const notesList = document.getElementById('notes-list');
      if (!notesList) return;

      notesList.querySelectorAll('.note-item').forEach(item => {
        const noteId = item.dataset.noteId;
        if (!noteId) return;
        const note = window.storage?.getNote?.(noteId);
        if (!note || note.type !== 'meeting') return;

        const previewEl = item.querySelector('.note-item-preview');
        if (!previewEl) return;

        // Build a clean preview from the meeting JSON
        try {
          const data = JSON.parse(note.content || '{}');
          const parts = [];
          if (Array.isArray(data.attendees) && data.attendees.length) {
            parts.push('👥 ' + data.attendees.slice(0, 3).join(', ') + (data.attendees.length > 3 ? '…' : ''));
          }
          if (Array.isArray(data.agenda) && data.agenda.length) {
            const firstItem = data.agenda[0]?.text || data.agenda[0]?.title || '';
            if (firstItem) parts.push('📋 ' + firstItem);
          }
          if (Array.isArray(data.actionItems) && data.actionItems.length) {
            const open = data.actionItems.filter(a => !a.done && !a.completed).length;
            if (open > 0) parts.push('✅ ' + open + ' open action' + (open !== 1 ? 's' : ''));
          }
          previewEl.textContent = parts.length ? parts.join(' · ') : 'Meeting note';
        } catch (e) {
          previewEl.textContent = 'Meeting note';
        }
      });
    };
  }

  waitFor(() => window.app?.renderNotes, 100, 10000)
    .then(patchMeetingPreview)
    .catch(() => {});

})();
