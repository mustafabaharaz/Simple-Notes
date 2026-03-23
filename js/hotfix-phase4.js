/* ============================================================
   HOTFIX-PHASE4.JS — Phase 4 Hotfixes
   Additive only — zero modifications to any existing file
   ============================================================
   Fix 1 — Attendees & agenda items not appearing
   Fix 2 — Share button & Contacts not visible
   Fix 3 — No context menu on org-mode meeting items
   Fix 4 — Drag-to-folder broken in org mode
   Fix 5 — Trash / delete broken in org mode
   Fix 6 — Personal note-taking linked to a meeting
   ============================================================ */

(function () {
  'use strict';

  /* ──────────────────────────────────────────────────────────
     FIX 1 — Attendees & agenda items never re-render
     Root cause: HTMLElement has no .getElementById() method.
     (editorEl || document).getElementById(...) throws when
     editorEl is truthy, so addAttendeeAction / add-agenda
     silently fail every time.
  ────────────────────────────────────────────────────────── */

  function fix1_patchMeetingNotes () {
    const mn = window.meetingNotes;
    if (!mn || mn.__hf4_patched) return;
    mn.__hf4_patched = true;

    /* Helper: safe querySelector that works on both document and elements */
    function qs (root, sel) {
      if (!root) return document.querySelector(sel);
      return typeof root.querySelector === 'function'
        ? root.querySelector(sel)
        : document.querySelector(sel);
    }

    /* Patch renderAttendees */
    mn.renderAttendees = function (attendees, editorEl) {
      const chips = qs(editorEl, '#attendees-chips');
      if (!chips) return;
      chips.innerHTML = attendees.map(a => this.attendeeChipHTML(a)).join('');
    };

    /* Patch renderAgendaItems */
    mn.renderAgendaItems = function (items, editorEl) {
      const list = qs(editorEl, '#agenda-list');
      if (!list) return;
      list.innerHTML = items.map((item, idx) => `
        <div class="agenda-item" data-id="${item.id}">
          <div class="agenda-item-header">
            <button class="agenda-check-btn ${item.completed ? 'completed' : ''}"
              data-agenda-id="${item.id}" title="Mark complete">
              ${item.completed ? '✓' : ''}
            </button>
            <span class="agenda-number">${idx + 1}.</span>
            <input type="text" class="agenda-title-input"
              data-agenda-id="${item.id}"
              value="${this.escapeHTML(item.title)}"
              placeholder="Agenda item title" autocomplete="off" />
            <button class="agenda-delete-btn" data-agenda-id="${item.id}" title="Remove">✕</button>
          </div>
          <textarea class="agenda-notes-input" data-agenda-id="${item.id}"
            placeholder="Notes for this agenda item…" rows="2"
          >${this.escapeHTML(item.notes || '')}</textarea>
        </div>
      `).join('');
    };

    console.log('✅ Fix 1: Meeting attendees & agenda querySelector patched');
  }

  /* ──────────────────────────────────────────────────────────
     FIX 2 — Share button & Contacts not visible
     Root cause A: share.js looks for .editor-toolbar —
       the actual class in index.html is .unified-toolbar.
     Root cause B: no UI entry-point for Contacts.
  ────────────────────────────────────────────────────────── */

  function fix2_injectShareButton () {
    if (document.getElementById('editor-share-btn')) return;
    const toolbar = document.querySelector('.unified-toolbar');
    if (!toolbar) return;

    const btn = document.createElement('button');
    btn.id    = 'editor-share-btn';
    btn.className = 'share-btn toolbar-share-btn';
    btn.title = 'Share this note (Ctrl+Shift+S)';
    btn.innerHTML = '<span class="share-btn-icon">📤</span> Share';

    btn.addEventListener('click', () => {
      const note = (typeof app !== 'undefined' && app.currentNote)
        ? app.currentNote : null;
      if (!note) { if (typeof showToast === 'function') showToast('Open a note first', 'error'); return; }
      if (window.wrenShare) wrenShare.share('note', note);
    });

    toolbar.appendChild(btn);
    console.log('✅ Fix 2a: Share button injected into .unified-toolbar');
  }

  function fix2_injectContactsButton () {
    if (document.getElementById('contacts-btn')) return;
    const qaRow = document.querySelector('.qa-secondary-row');
    if (!qaRow) return;

    const btn = document.createElement('button');
    btn.id = 'contacts-btn';
    btn.className = 'qa-btn qa-btn-secondary';
    btn.title = 'Contact Groups';
    btn.innerHTML = '<span class="qa-icon">👥</span><span>Contacts</span>';
    btn.addEventListener('click', () => {
      if (window.contacts) contacts.openModal();
    });

    qaRow.appendChild(btn);
    console.log('✅ Fix 2b: Contacts button injected into sidebar');
  }

  /* ──────────────────────────────────────────────────────────
     FIX 3, 4, 5 — Org mode: context menu, drag, delete
     Inject a meeting context menu and wire it + drag events
     onto every .meeting-mini-item each time the list renders.
  ────────────────────────────────────────────────────────── */

  function fix345_injectMeetingContextMenu () {
    if (document.getElementById('meeting-context-menu')) return;

    const menu = document.createElement('div');
    menu.id = 'meeting-context-menu';
    menu.className = 'context-menu';
    menu.style.display = 'none';
    menu.innerHTML = `
      <div class="context-menu-item" data-action="open">📅 Open Meeting</div>
      <div class="context-menu-item" data-action="rename">✏️ Rename</div>
      <div class="context-menu-item" data-action="move">📁 Move to Folder</div>
      <div class="context-menu-item" data-action="delete">🗑️ Delete</div>
    `;
    document.body.appendChild(menu);
  }

  function fix345_showMeetingContextMenu (e, noteId) {
    e.preventDefault();
    e.stopPropagation();

    const menu = document.getElementById('meeting-context-menu');
    if (!menu) return;

    /* Position */
    menu.style.left = e.pageX + 'px';
    menu.style.top  = e.pageY + 'px';
    menu.style.display = 'block';

    /* Clone to clear stale listeners */
    const fresh = menu.cloneNode(true);
    menu.parentNode.replaceChild(fresh, menu);
    fresh.style.left    = e.pageX + 'px';
    fresh.style.top     = e.pageY + 'px';
    fresh.style.display = 'block';

    fresh.querySelector('[data-action="open"]').addEventListener('click', () => {
      const note = storage.getNote(noteId);
      if (note && window.meetingNotes) meetingNotes.openMeetingNote(note);
      fresh.style.display = 'none';
    });

    fresh.querySelector('[data-action="rename"]').addEventListener('click', () => {
      const note = storage.getNote(noteId);
      if (!note) return;
      const newTitle = prompt('Rename meeting:', note.title);
      if (newTitle && newTitle.trim()) {
        storage.updateNote(noteId, { title: newTitle.trim() });
        if (window.meetingNotes) meetingNotes.refreshMiniList();
        if (typeof showToast === 'function') showToast('✓ Meeting renamed');
      }
      fresh.style.display = 'none';
    });

    fresh.querySelector('[data-action="move"]').addEventListener('click', () => {
      const folders = storage.getFolders();
      if (!folders.length) {
        if (typeof showToast === 'function') showToast('No folders yet — create one first', 'warning');
        fresh.style.display = 'none';
        return;
      }
      const list = folders.map((f, i) => `${i + 1}. ${f.name}`).join('\n');
      const choice = prompt(`Move to folder:\n${list}\n\nEnter number:`);
      if (choice) {
        const idx = parseInt(choice, 10) - 1;
        if (idx >= 0 && idx < folders.length) {
          storage.updateNote(noteId, { folderId: folders[idx].id });
          if (typeof showToast === 'function') showToast(`Moved to ${folders[idx].name}`);
        }
      }
      fresh.style.display = 'none';
    });

    fresh.querySelector('[data-action="delete"]').addEventListener('click', () => {
      if (confirm('Move this meeting to trash?')) {
        storage.deleteNote(noteId);
        if (window.meetingNotes) {
          if (meetingNotes.activeMeetingId === noteId) meetingNotes.closeMeetingEditor();
          meetingNotes.refreshMiniList();
        }
        if (typeof showToast === 'function') showToast('Meeting moved to trash');
      }
      fresh.style.display = 'none';
    });

    /* Close on outside click */
    const closeMenu = (evt) => {
      if (!fresh.contains(evt.target)) {
        fresh.style.display = 'none';
        document.removeEventListener('click', closeMenu);
      }
    };
    setTimeout(() => document.addEventListener('click', closeMenu), 0);
  }

  /* Attach context-menu + drag to every already-rendered meeting item */
  function fix345_decorateMiniItems () {
    const list = document.getElementById('org-meetings-mini-list');
    if (!list) return;

    list.querySelectorAll('.meeting-mini-item').forEach(btn => {
      if (btn.__hf4_decorated) return;
      btn.__hf4_decorated = true;

      const noteId = btn.dataset.meetingId;

      /* Fix 3 — right-click context menu */
      btn.addEventListener('contextmenu', (e) => {
        fix345_showMeetingContextMenu(e, noteId);
      });

      /* Fix 4 — drag to folder */
      btn.setAttribute('draggable', 'true');
      btn.style.cursor = 'grab';

      btn.addEventListener('dragstart', (e) => {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', noteId);
        btn.style.opacity = '0.5';
      });
      btn.addEventListener('dragend', () => {
        btn.style.opacity = '';
        btn.style.cursor = 'grab';
      });

      /* Fix 5 — delete is already covered by the context menu above */
    });
  }

  /* Patch refreshMiniList to re-decorate after every render */
  function fix345_patchMiniListRefresh () {
    const mn = window.meetingNotes;
    if (!mn || mn.__hf4_listPatched) return;
    mn.__hf4_listPatched = true;

    const orig = mn.refreshMiniList.bind(mn);
    mn.refreshMiniList = function () {
      orig();
      /* Defer one tick so the new DOM is fully written */
      setTimeout(fix345_decorateMiniItems, 0);
    };

    /* Decorate any items already in the DOM right now */
    fix345_decorateMiniItems();
    console.log('✅ Fix 3/4/5: Org mode context menu, drag, delete patched');
  }

  /* ──────────────────────────────────────────────────────────
     FIX 6 — Personal note-taking panel during a meeting
     A slide-in notepad linked to the active meeting.
     Notes are stored as regular notes with linkedMeetingId.
     "Open in Notes" switches to personal mode and opens it.
  ────────────────────────────────────────────────────────── */

  function fix6_injectStyles () {
    if (document.getElementById('hf4-notepad-styles')) return;

    const style = document.createElement('style');
    style.id = 'hf4-notepad-styles';
    style.textContent = `
      /* Slide-in notepad panel */
      .hf4-notepad {
        position: fixed;
        right: 0; top: 0;
        height: 100vh;
        width: 320px;
        max-width: 90vw;
        background: var(--color-surface);
        border-left: 1.5px solid var(--color-border);
        box-shadow: -6px 0 24px rgba(0,0,0,.12);
        z-index: 8000;
        display: flex;
        flex-direction: column;
        animation: hf4-slide-in .22s ease;
      }
      @keyframes hf4-slide-in {
        from { transform: translateX(100%); opacity: 0; }
        to   { transform: translateX(0);    opacity: 1; }
      }
      .hf4-notepad-header {
        padding: 14px 16px;
        border-bottom: 1px solid var(--color-border);
        background: var(--color-bg-secondary);
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 10px;
      }
      .hf4-notepad-header-text h4 {
        margin: 0;
        font-size: 13px;
        font-weight: 700;
        color: var(--color-text-primary);
      }
      .hf4-notepad-header-text span {
        font-size: 11px;
        color: var(--color-text-secondary);
        display: block;
        margin-top: 2px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        max-width: 220px;
      }
      .hf4-notepad-close {
        background: none;
        border: none;
        font-size: 16px;
        cursor: pointer;
        color: var(--color-text-secondary);
        width: 26px; height: 26px;
        border-radius: 50%;
        display: flex; align-items: center; justify-content: center;
        flex-shrink: 0;
        transition: background .15s;
      }
      .hf4-notepad-close:hover { background: var(--color-border); }
      .hf4-notepad-body {
        flex: 1;
        padding: 14px;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
      }
      .hf4-notepad-editor {
        flex: 1;
        min-height: 280px;
        width: 100%;
        border: none;
        outline: none;
        font-size: 14px;
        line-height: 1.7;
        color: var(--color-text-primary);
        background: transparent;
        resize: none;
        font-family: inherit;
      }
      .hf4-notepad-footer {
        padding: 10px 14px;
        border-top: 1px solid var(--color-border);
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
      }
      .hf4-notepad-status {
        font-size: 11px;
        color: var(--color-text-secondary);
      }
      .hf4-btn-open-in-notes {
        padding: 7px 12px;
        background: linear-gradient(135deg, var(--color-primary), #7c3aed);
        color: white;
        border: none;
        border-radius: 7px;
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
        white-space: nowrap;
        transition: all .2s;
      }
      .hf4-btn-open-in-notes:hover {
        transform: translateY(-1px);
        box-shadow: 0 4px 10px rgba(99,102,241,.35);
      }
      /* "Take Notes" trigger button in meeting editor footer */
      .hf4-take-notes-btn {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        padding: 7px 13px;
        background: transparent;
        border: 1.5px solid var(--color-border);
        border-radius: 8px;
        font-size: 12px;
        font-weight: 600;
        color: var(--color-text-secondary);
        cursor: pointer;
        transition: all .2s;
      }
      .hf4-take-notes-btn:hover {
        border-color: var(--color-primary);
        color: var(--color-primary);
        background: rgba(99,102,241,.04);
      }
      .hf4-linked-badge {
        font-size: 11px;
        color: var(--color-text-secondary);
        margin-left: 6px;
      }
      /* Dark mode */
      [data-theme="dark"] .hf4-notepad {
        background: #1a1a1a;
        border-left-color: rgba(64,64,64,.5);
        box-shadow: -6px 0 24px rgba(0,0,0,.4);
      }
      [data-theme="dark"] .hf4-notepad-header {
        background: #111;
        border-bottom-color: rgba(64,64,64,.3);
      }
    `;
    document.head.appendChild(style);
  }

  function fix6_openNotepad (meetingNoteId, meetingTitle) {
    /* Close any existing notepad */
    document.getElementById('hf4-notepad')?.remove();

    fix6_injectStyles();

    /* Find or create the linked personal note */
    const allNotes = storage.getNotes();
    let linked = allNotes.find(n => n.linkedMeetingId === meetingNoteId && !n.deleted);

    if (!linked) {
      const raw = storage.createNote(`Notes — ${meetingTitle}`, '');
      storage.updateNote(raw.id, { linkedMeetingId: meetingNoteId });
      linked = storage.getNote(raw.id);
    }

    /* Strip HTML for the textarea */
    const plainContent = (() => {
      const tmp = document.createElement('div');
      tmp.innerHTML = linked.content || '';
      return tmp.textContent || '';
    })();

    /* Build panel */
    const panel = document.createElement('div');
    panel.id = 'hf4-notepad';
    panel.className = 'hf4-notepad';
    panel.innerHTML = `
      <div class="hf4-notepad-header">
        <div class="hf4-notepad-header-text">
          <h4>📝 Personal notes</h4>
          <span title="${_esc(meetingTitle)}">During: ${_esc(meetingTitle)}</span>
        </div>
        <button class="hf4-notepad-close" id="hf4-close-btn" title="Close">✕</button>
      </div>
      <div class="hf4-notepad-body">
        <textarea
          class="hf4-notepad-editor"
          id="hf4-editor"
          placeholder="Jot down your personal thoughts, questions, or observations…"
        >${_esc(plainContent)}</textarea>
      </div>
      <div class="hf4-notepad-footer">
        <span class="hf4-notepad-status" id="hf4-status">✓ Auto-saved</span>
        <button class="hf4-btn-open-in-notes" id="hf4-open-btn">Open in Notes →</button>
      </div>
    `;

    document.body.appendChild(panel);

    /* Auto-save */
    let saveTimer = null;
    const editor = panel.querySelector('#hf4-editor');
    const status = panel.querySelector('#hf4-status');

    editor.addEventListener('input', () => {
      status.textContent = 'Saving…';
      clearTimeout(saveTimer);
      saveTimer = setTimeout(() => {
        storage.updateNote(linked.id, { content: editor.value });
        status.textContent = '✓ Auto-saved';
        _refreshLinkedBadge(meetingNoteId);
      }, 700);
    });

    /* Close */
    panel.querySelector('#hf4-close-btn').addEventListener('click', () => {
      storage.updateNote(linked.id, { content: editor.value });
      panel.remove();
    });

    /* Open the note in personal mode */
    panel.querySelector('#hf4-open-btn').addEventListener('click', () => {
      storage.updateNote(linked.id, { content: editor.value });
      panel.remove();
      if (window.orgMode) orgMode.applyWorkspace('personal');
      setTimeout(() => {
        if (window.app) app.openNote(linked.id);
      }, 180);
    });

    /* Focus editor */
    editor.focus();
    editor.selectionStart = editor.selectionEnd = editor.value.length;
  }

  /* Re-render the linked-notes badge in the meeting footer */
  function _refreshLinkedBadge (meetingNoteId) {
    const badge = document.querySelector('.hf4-linked-badge');
    if (!badge) return;
    const count = storage.getNotes().filter(n => n.linkedMeetingId === meetingNoteId && !n.deleted).length;
    badge.textContent = count ? `${count} note${count > 1 ? 's' : ''} attached` : '';
  }

  /* Patch renderMeetingEditor to inject the "Take Notes" button */
  function fix6_patchMeetingEditor () {
    const mn = window.meetingNotes;
    if (!mn || mn.__hf4_editorPatched) return;
    mn.__hf4_editorPatched = true;

    const origRender = mn.renderMeetingEditor.bind(mn);

    mn.renderMeetingEditor = function (note, data) {
      origRender(note, data);

      const footer = document.querySelector('#meeting-editor .meeting-editor-footer');
      if (!footer || footer.querySelector('.hf4-take-notes-btn')) return;

      /* "Take Notes" button */
      const takeBtn = document.createElement('button');
      takeBtn.className = 'hf4-take-notes-btn';
      takeBtn.innerHTML = '📝 Take Notes';
      takeBtn.title = 'Open a personal notepad linked to this meeting';
      takeBtn.addEventListener('click', () => fix6_openNotepad(note.id, note.title));

      /* Linked notes badge */
      const badge = document.createElement('span');
      badge.className = 'hf4-linked-badge';
      const linkedCount = storage.getNotes().filter(n => n.linkedMeetingId === note.id && !n.deleted).length;
      badge.textContent = linkedCount ? `${linkedCount} note${linkedCount > 1 ? 's' : ''} attached` : '';

      footer.insertBefore(badge,   footer.firstChild);
      footer.insertBefore(takeBtn, footer.firstChild);
    };

    console.log('✅ Fix 6: Meeting notepad patched');
  }

  /* ──────────────────────────────────────────────────────────
     UTILS
  ────────────────────────────────────────────────────────── */

  function _esc (str) {
    const d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
  }

  /* ──────────────────────────────────────────────────────────
     INIT — run after all Phase 2/3 modules are ready
  ────────────────────────────────────────────────────────── */

  function applyAll () {
    fix345_injectMeetingContextMenu();
    fix1_patchMeetingNotes();
    fix2_injectShareButton();
    fix2_injectContactsButton();
    fix345_patchMiniListRefresh();
    fix6_patchMeetingEditor();
    console.log('✅ hotfix-phase4.js — all fixes applied');
  }

  /* org-mode + meeting-notes use DOMContentLoaded; we use load
     with a small delay to guarantee all modules have initialised. */
  if (document.readyState === 'complete') {
    setTimeout(applyAll, 400);
  } else {
    window.addEventListener('load', () => setTimeout(applyAll, 400));
  }

  /* Re-apply org decorations whenever user switches to org workspace */
  document.addEventListener('workspaceChanged', ({ detail }) => {
    if (detail && detail.workspace === 'org') {
      setTimeout(fix345_decorateMiniItems, 80);
    }
  });

})();
