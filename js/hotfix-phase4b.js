/* ============================================================
   HOTFIX-PHASE4B.JS — Phase 4 Second Pass
   Additive only — zero modifications to any existing file
   ============================================================
   Fix A  — contacts & share globals not on window (const vs var)
   Fix A+ — Attendee-contact linking with color-coded chips
   Fix B  — Folders & trash invisible in org mode (drag targets)
   Fix C  — Personal notes reminder when generating a report
   ============================================================ */

(function () {
  'use strict';

  /* ──────────────────────────────────────────────────────────
     FIX A — Expose const globals to window
     contacts.js uses `const contacts = new ContactGroupsManager()`
     share.js   uses `const wrenShare  = new WrenShare()`
     `const` at top-level does NOT attach to window, so every
     `window.contacts` / `window.wrenShare` check is undefined.
     Solution: re-instantiate using the class constructors
     (safe — both constructors guard against double-injection
     and load state from localStorage).
  ────────────────────────────────────────────────────────── */

  function fixA_ensureGlobals () {
    if (!window.contacts && window.ContactGroupsManager) {
      window.contacts = new ContactGroupsManager();
      console.log('✅ Fix A: window.contacts exposed');
    }
    if (!window.wrenShare && window.WrenShare) {
      window.wrenShare = new WrenShare();
      console.log('✅ Fix A: window.wrenShare exposed');
    }

    /* Re-wire the two injected buttons from hotfix-phase4.js
       now that the globals exist */
    const contactsBtn = document.getElementById('contacts-btn');
    if (contactsBtn) {
      contactsBtn.onclick = () => window.contacts && window.contacts.openModal();
    }

    const shareBtn = document.getElementById('editor-share-btn');
    if (shareBtn) {
      shareBtn.onclick = () => {
        const note = (typeof app !== 'undefined' && app.currentNote)
          ? app.currentNote : null;
        if (!note) { showToast('Open a note first', 'error'); return; }
        window.wrenShare && window.wrenShare.share('note', note);
      };
    }
  }

  /* ──────────────────────────────────────────────────────────
     FIX A+ — Attendee-contact linking
     Lightweight per-person store: wren_people
     { "Alice Smith": { email: "alice@co.com", phone: "" }, … }

     Visual rules:
       - Green chip  = person has at least an email on file
       - Default chip = no contact info yet
       - Click the chip → mini inline popover to add/edit info
       - "Add to Contacts group" copies email into an existing group
  ────────────────────────────────────────────────────────── */

  const PEOPLE_KEY = 'wren_people';

  const people = {
    load () {
      try { return JSON.parse(localStorage.getItem(PEOPLE_KEY) || '{}'); } catch { return {}; }
    },
    save (data) {
      try { localStorage.setItem(PEOPLE_KEY, JSON.stringify(data)); } catch { /* quota */ }
    },
    get (name) {
      return this.load()[name] || null;
    },
    set (name, info) {
      const all = this.load();
      all[name] = { ...(all[name] || {}), ...info };
      this.save(all);
    },
    has (name) {
      const p = this.get(name);
      return !!(p && (p.email || p.phone));
    }
  };

  /* Inject styles for the contact-linked chips and popover */
  function fixAplus_injectStyles () {
    if (document.getElementById('hf4b-people-styles')) return;
    const s = document.createElement('style');
    s.id = 'hf4b-people-styles';
    s.textContent = `
      /* Attendee chip — default (no contact info) */
      .attendee-chip {
        transition: box-shadow .15s, border-color .15s;
        cursor: pointer;
      }
      .attendee-chip:hover { box-shadow: 0 2px 8px rgba(0,0,0,.12); }

      /* Attendee chip — has contact info */
      .attendee-chip.has-contact {
        border: 1.5px solid #10b981 !important;
        background: rgba(16,185,129,.07) !important;
      }
      .attendee-chip.has-contact .attendee-initials {
        background: #10b981 !important;
      }
      .attendee-chip.has-contact-icon::after {
        content: '✓';
        font-size: 10px;
        color: #10b981;
        margin-left: 2px;
        font-weight: 700;
      }

      /* Contact info popover */
      .hf4b-contact-popover {
        position: absolute;
        z-index: 10200;
        background: var(--color-surface);
        border: 1.5px solid var(--color-border);
        border-radius: 10px;
        padding: 14px 16px;
        box-shadow: 0 8px 24px rgba(0,0,0,.18);
        min-width: 240px;
        animation: hf4b-pop .15s ease;
      }
      @keyframes hf4b-pop {
        from { opacity:0; transform: translateY(4px) scale(.97); }
        to   { opacity:1; transform: translateY(0)  scale(1); }
      }
      .hf4b-contact-popover h5 {
        margin: 0 0 10px;
        font-size: 13px;
        font-weight: 700;
        color: var(--color-text-primary);
        display: flex; align-items: center; gap: 6px;
      }
      .hf4b-contact-popover label {
        display: block;
        font-size: 10px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: .06em;
        color: var(--color-text-secondary);
        margin-bottom: 3px;
        margin-top: 8px;
      }
      .hf4b-contact-popover input {
        width: 100%;
        padding: 6px 10px;
        border: 1.5px solid var(--color-border);
        border-radius: 7px;
        font-size: 13px;
        color: var(--color-text-primary);
        background: var(--color-bg-secondary);
        box-sizing: border-box;
        font-family: inherit;
        transition: border-color .2s;
      }
      .hf4b-contact-popover input:focus {
        outline: none;
        border-color: var(--color-primary);
        box-shadow: 0 0 0 3px rgba(99,102,241,.1);
      }
      .hf4b-popover-actions {
        display: flex; gap: 6px; margin-top: 12px; justify-content: flex-end;
      }
      .hf4b-btn-save-contact {
        padding: 6px 14px;
        background: linear-gradient(135deg, var(--color-primary), #7c3aed);
        color: white; border: none; border-radius: 7px;
        font-size: 12px; font-weight: 600; cursor: pointer;
        transition: all .2s;
      }
      .hf4b-btn-save-contact:hover { transform: translateY(-1px); }
      .hf4b-btn-cancel-contact {
        padding: 6px 12px;
        background: var(--color-bg-secondary);
        color: var(--color-text-secondary);
        border: 1.5px solid var(--color-border);
        border-radius: 7px; font-size: 12px; font-weight: 600; cursor: pointer;
      }
      [data-theme="dark"] .hf4b-contact-popover {
        background: #1a1a1a;
        border-color: rgba(64,64,64,.5);
        box-shadow: 0 8px 24px rgba(0,0,0,.4);
      }
      [data-theme="dark"] .hf4b-contact-popover input {
        background: #111;
        border-color: rgba(64,64,64,.5);
        color: #e5e5e5;
      }
    `;
    document.head.appendChild(s);
  }

  /* Open contact-info popover anchored to a chip element */
  function fixAplus_openContactPopover (chip, name) {
    /* Close any existing popover */
    document.querySelector('.hf4b-contact-popover')?.remove();

    const info = people.get(name) || { email: '', phone: '' };

    const pop = document.createElement('div');
    pop.className = 'hf4b-contact-popover';
    pop.innerHTML = `
      <h5>👤 ${_esc(name)}</h5>
      <label>Email</label>
      <input type="email" id="hf4b-email" value="${_esc(info.email || '')}" placeholder="alice@example.com" />
      <label>Phone</label>
      <input type="tel"   id="hf4b-phone" value="${_esc(info.phone || '')}" placeholder="+1 555 000 0000" />
      <div class="hf4b-popover-actions">
        <button class="hf4b-btn-cancel-contact" id="hf4b-cancel">Cancel</button>
        <button class="hf4b-btn-save-contact"   id="hf4b-save">Save</button>
      </div>
    `;

    /* Position below the chip */
    document.body.appendChild(pop);
    const rect = chip.getBoundingClientRect();
    const popH = pop.offsetHeight || 160;
    const spaceBelow = window.innerHeight - rect.bottom;
    const top = spaceBelow > popH + 10
      ? rect.bottom + 6
      : rect.top - popH - 6;
    pop.style.top  = (top + window.scrollY)  + 'px';
    pop.style.left = Math.min(rect.left + window.scrollX,
                              window.innerWidth - 260) + 'px';

    pop.querySelector('#hf4b-save').addEventListener('click', () => {
      const email = pop.querySelector('#hf4b-email').value.trim();
      const phone = pop.querySelector('#hf4b-phone').value.trim();
      people.set(name, { email, phone });

      /* Refresh chip appearance */
      if (email || phone) {
        chip.classList.add('has-contact', 'has-contact-icon');
      } else {
        chip.classList.remove('has-contact', 'has-contact-icon');
      }
      pop.remove();
      showToast(email || phone ? `✓ Contact info saved for ${name}` : 'Contact info cleared');
    });

    pop.querySelector('#hf4b-cancel').addEventListener('click', () => pop.remove());

    /* Close when clicking outside */
    const outside = (e) => {
      if (!pop.contains(e.target) && e.target !== chip) {
        pop.remove();
        document.removeEventListener('mousedown', outside);
      }
    };
    setTimeout(() => document.addEventListener('mousedown', outside), 0);

    pop.querySelector('#hf4b-email').focus();
  }

  /* Patch MeetingNotes.renderAttendees to apply contact-linked styling */
  function fixAplus_patchAttendeeChips () {
    const mn = window.meetingNotes;
    if (!mn || mn.__hf4b_chipsPatched) return;
    mn.__hf4b_chipsPatched = true;

    /* Override attendeeChipHTML to inject contact status class */
    const origChipHTML = mn.attendeeChipHTML.bind(mn);
    mn.attendeeChipHTML = function (name) {
      const html = origChipHTML(name);
      /* Inject contact-status classes into the chip div */
      if (people.has(name)) {
        return html.replace('class="attendee-chip"',
          'class="attendee-chip has-contact has-contact-icon"');
      }
      return html;
    };

    /* After any renderAttendees call, bind click-to-edit on each chip */
    const origRender = mn.renderAttendees.bind(mn);
    mn.renderAttendees = function (attendees, editorEl) {
      origRender(attendees, editorEl);
      /* Bind click handler on each chip (excluding the remove ✕ button) */
      const root = editorEl || document;
      root.querySelectorAll('.attendee-chip').forEach(chip => {
        if (chip.__hf4b_clickBound) return;
        chip.__hf4b_clickBound = true;
        chip.title = 'Click to add/edit contact info';
        chip.addEventListener('click', (e) => {
          /* Don't fire if they clicked the remove button */
          if (e.target.closest('.attendee-remove-btn')) return;
          const name = chip.dataset.name;
          if (name) fixAplus_openContactPopover(chip, name);
        });
      });
    };

    console.log('✅ Fix A+: Attendee contact linking patched');
  }

  /* ──────────────────────────────────────────────────────────
     FIX B — Folders & trash missing in org mode
     Root cause: org-mode.js hides personal-sidebar-content
     (display:none), which buries folders + trash — the only
     drag targets the app knows about.
     Fix: inject a compact "drop zones" strip into the org
     sidebar that mirrors folders and stays visible in org mode.
     It uses the same .folder-item / data-folder-id attributes
     so app.js's existing dragover/drop listeners pick them up.
  ────────────────────────────────────────────────────────── */

  function fixB_injectStyles () {
    if (document.getElementById('hf4b-org-folder-styles')) return;
    const s = document.createElement('style');
    s.id = 'hf4b-org-folder-styles';
    s.textContent = `
      /* Org-mode folder drop zone section */
      .org-folder-dropzones {
        padding: 0 10px 16px;
        display: none;
      }
      .org-active .org-folder-dropzones { display: block; }

      .org-folder-dropzones-label {
        font-size: 10px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: .08em;
        color: var(--color-text-secondary);
        padding: 10px 4px 6px;
        display: flex;
        align-items: center;
        gap: 5px;
      }

      /* Re-use core .folder-item styles but compact them */
      .org-folder-dropzones .folder-item {
        padding: 7px 10px;
        font-size: 12px;
        border-radius: 7px;
        margin-bottom: 3px;
      }

      /* Org-mode trash section */
      .org-trash-section {
        padding: 0 10px 16px;
        display: none;
      }
      .org-active .org-trash-section { display: block; }
      .org-trash-section .trash-header {
        font-size: 10px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: .08em;
        color: var(--color-text-secondary);
        padding: 4px 4px 6px;
        display: flex; align-items: center; gap: 6px;
      }
      .org-trash-section .trash-list {
        max-height: 120px;
        overflow-y: auto;
      }
    `;
    document.head.appendChild(s);
  }

  function fixB_buildDropZones () {
    if (document.getElementById('org-folder-dropzones')) return;

    const orgSections = document.getElementById('org-sidebar-sections');
    if (!orgSections) return;

    /* ── Folders section ── */
    const folderSection = document.createElement('div');
    folderSection.className = 'org-folder-dropzones';
    folderSection.id = 'org-folder-dropzones';
    folderSection.innerHTML = `
      <div class="org-folder-dropzones-label">📁 Folders (drop here)</div>
      <div class="folders-list" id="org-folders-list">
        <!-- Populated by fixB_syncFolders() -->
      </div>
    `;

    /* ── Trash section ── */
    const trashSection = document.createElement('div');
    trashSection.className = 'org-trash-section';
    trashSection.id = 'org-trash-section';
    trashSection.innerHTML = `
      <div class="trash-header">
        <span>🗑️ Trash</span>
        <span class="trash-count" id="org-trash-count">0</span>
      </div>
      <div class="trash-list" id="org-trash-list"></div>
    `;

    /* Insert before the bottom footer (New Meeting button) */
    const footer = orgSections.querySelector('.org-sidebar-footer');
    orgSections.insertBefore(folderSection, footer);
    orgSections.insertBefore(trashSection, footer);

    /* Wire the new folders-list for drag-and-drop using the same
       logic as app.js (same event names, same class names) */
    const newFoldersList = folderSection.querySelector('#org-folders-list');

    newFoldersList.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      const fi = e.target.closest('.folder-item');
      if (fi) {
        newFoldersList.querySelectorAll('.folder-item').forEach(f => f.classList.remove('drag-over'));
        fi.classList.add('drag-over');
      }
    });

    newFoldersList.addEventListener('dragleave', (e) => {
      const fi = e.target.closest('.folder-item');
      if (fi && !fi.contains(e.relatedTarget)) fi.classList.remove('drag-over');
    });

    newFoldersList.addEventListener('drop', (e) => {
      e.preventDefault();
      const fi = e.target.closest('.folder-item');
      if (!fi) return;
      newFoldersList.querySelectorAll('.folder-item').forEach(f => f.classList.remove('drag-over'));

      const noteId   = e.dataTransfer.getData('text/plain');
      const folderId = fi.dataset.folderId;

      if (!noteId || !folderId || folderId === 'all') {
        showToast('Cannot move here', 'warning'); return;
      }

      const targetId = folderId === 'unfiled' ? null : folderId;
      storage.updateNote(noteId, { folderId: targetId });

      const folderName = targetId ? (storage.getFolder(targetId)?.name || 'folder') : 'Unfiled';
      showToast(`Moved to ${folderName}`);

      /* Refresh the mini list if it was a meeting */
      if (window.meetingNotes) meetingNotes.refreshMiniList();
      if (window.app)          app.renderNotes();
    });

    fixB_syncFolders();
    fixB_syncTrash();
    console.log('✅ Fix B: Org mode folder drop zones injected');
  }

  function fixB_syncFolders () {
    const list = document.getElementById('org-folders-list');
    if (!list || typeof storage === 'undefined') return;

    const folders = storage.getFolders ? storage.getFolders() : [];

    list.innerHTML = `
      <div class="folder-item special-folder" data-folder-id="all" style="pointer-events:none;opacity:.5;">
        <span class="folder-icon">📋</span>
        <span class="folder-name">All Notes</span>
      </div>
      <div class="folder-item special-folder" data-folder-id="unfiled">
        <span class="folder-icon">📂</span>
        <span class="folder-name">Unfiled</span>
      </div>
      ${folders.map(f => `
        <div class="folder-item" data-folder-id="${f.id}">
          <span class="folder-icon">📁</span>
          <span class="folder-name">${_esc(f.name)}</span>
          <span class="folder-count">${storage.getNotesInFolder ? storage.getNotesInFolder(f.id).length : ''}</span>
        </div>
      `).join('')}
    `;
  }

  function fixB_syncTrash () {
    const list  = document.getElementById('org-trash-list');
    const count = document.getElementById('org-trash-count');
    if (!list || typeof storage === 'undefined') return;

    const trashed = storage.getTrash ? storage.getTrash() : [];
    if (count) count.textContent = trashed.length;

    if (!trashed.length) {
      list.innerHTML = '<div style="font-size:11px;color:var(--color-text-secondary);padding:4px 4px;">Empty</div>';
      return;
    }

    list.innerHTML = trashed.slice(0, 6).map(n => `
      <div class="trash-item" data-note-id="${n.id}" style="font-size:11px;padding:5px 4px;cursor:pointer;border-radius:5px;color:var(--color-text-secondary);">
        🗑️ ${_esc((n.title || 'Untitled').slice(0, 28))}
      </div>
    `).join('');

    /* Click to restore/delete permanently */
    list.querySelectorAll('.trash-item').forEach(item => {
      item.addEventListener('click', (e) => {
        const noteId = item.dataset.noteId;
        const choice = confirm('Restore this item?\n\nOK = Restore   Cancel = Delete permanently');
        if (choice) {
          storage.restoreNote && storage.restoreNote(noteId);
          showToast('Item restored');
        } else {
          if (confirm('Delete permanently? This cannot be undone.')) {
            storage.permanentlyDeleteNote && storage.permanentlyDeleteNote(noteId);
            showToast('Deleted permanently');
          }
        }
        fixB_syncTrash();
        if (window.app) { app.renderNotes(); app.renderTrash(); }
        if (window.meetingNotes) meetingNotes.refreshMiniList();
      });
    });
  }

  /* Keep org drop zones in sync when workspace changes or folders change */
  function fixB_bindSyncEvents () {
    document.addEventListener('workspaceChanged', ({ detail }) => {
      if (detail && detail.workspace === 'org') {
        fixB_syncFolders();
        fixB_syncTrash();
      }
    });

    /* Re-sync on any storage mutation (new folder, rename, etc.)
       by polling lightly — avoids having to patch storage.js */
    setInterval(() => {
      if (document.querySelector('.sidebar.org-active')) {
        fixB_syncFolders();
        fixB_syncTrash();
      }
    }, 4000);
  }

  /* ──────────────────────────────────────────────────────────
     FIX C — Personal notes reminder in reports
     When "Generate Report" fires, check for any linked personal
     notes. If found, show a persistent banner inside the meeting
     editor with two actions: "Paste into meeting notes" and
     "I'll handle it manually" (dismiss).
  ────────────────────────────────────────────────────────── */

  function fixC_injectStyles () {
    if (document.getElementById('hf4b-reminder-styles')) return;
    const s = document.createElement('style');
    s.id = 'hf4b-reminder-styles';
    s.textContent = `
      .hf4b-personal-notes-banner {
        display: flex;
        align-items: flex-start;
        gap: 12px;
        padding: 14px 16px;
        background: linear-gradient(135deg, rgba(245,158,11,.1), rgba(234,88,12,.07));
        border: 1.5px solid rgba(245,158,11,.35);
        border-radius: 10px;
        margin: 12px 0;
        font-size: 13px;
        color: var(--color-text-primary);
        animation: hf4b-pop .25s ease;
      }
      .hf4b-personal-notes-banner-icon { font-size: 20px; flex-shrink: 0; }
      .hf4b-personal-notes-banner-body { flex: 1; }
      .hf4b-personal-notes-banner-body strong {
        display: block;
        font-weight: 700;
        margin-bottom: 4px;
        color: var(--color-text-primary);
      }
      .hf4b-personal-notes-banner-body p {
        margin: 0 0 10px;
        font-size: 12px;
        color: var(--color-text-secondary);
        line-height: 1.5;
      }
      .hf4b-banner-actions { display: flex; gap: 8px; flex-wrap: wrap; }
      .hf4b-btn-paste {
        padding: 6px 14px;
        background: linear-gradient(135deg, #f59e0b, #d97706);
        color: white; border: none; border-radius: 7px;
        font-size: 12px; font-weight: 600; cursor: pointer;
        transition: all .2s;
      }
      .hf4b-btn-paste:hover { transform: translateY(-1px); box-shadow: 0 4px 10px rgba(245,158,11,.3); }
      .hf4b-btn-dismiss-banner {
        padding: 6px 12px;
        background: transparent;
        color: var(--color-text-secondary);
        border: 1.5px solid var(--color-border);
        border-radius: 7px; font-size: 12px; font-weight: 600; cursor: pointer;
        transition: all .2s;
      }
      .hf4b-btn-dismiss-banner:hover {
        border-color: var(--color-text-secondary);
        color: var(--color-text-primary);
      }
      .hf4b-btn-open-notepad {
        padding: 6px 12px;
        background: transparent;
        color: var(--color-primary);
        border: 1.5px solid var(--color-primary);
        border-radius: 7px; font-size: 12px; font-weight: 600; cursor: pointer;
        transition: all .2s;
      }
      .hf4b-btn-open-notepad:hover {
        background: rgba(99,102,241,.06);
      }
      [data-theme="dark"] .hf4b-personal-notes-banner {
        background: linear-gradient(135deg, rgba(245,158,11,.12), rgba(234,88,12,.08));
        border-color: rgba(245,158,11,.3);
      }
    `;
    document.head.appendChild(s);
  }

  /* Collect all personal notepad content linked to a meeting */
  function fixC_getLinkedNotes (meetingNoteId) {
    return storage.getNotes().filter(
      n => n.linkedMeetingId === meetingNoteId && !n.deleted
    );
  }

  /* Show the reminder banner inside the meeting editor */
  function fixC_showBanner (meetingNoteId, meetingTitle) {
    /* Only one banner at a time */
    document.querySelector('.hf4b-personal-notes-banner')?.remove();

    const linked = fixC_getLinkedNotes(meetingNoteId);
    if (!linked.length) return; /* No personal notes — nothing to remind about */

    const totalChars = linked.reduce((acc, n) => acc + (n.content || '').length, 0);
    if (totalChars < 10) return; /* Notes are empty */

    /* Find a good insertion point — after the summary section */
    const summarySection = document.querySelector('#section-summary');
    if (!summarySection) return;

    const banner = document.createElement('div');
    banner.className = 'hf4b-personal-notes-banner';

    const noteWord = linked.length === 1 ? 'note' : 'notes';
    banner.innerHTML = `
      <div class="hf4b-personal-notes-banner-icon">📝</div>
      <div class="hf4b-personal-notes-banner-body">
        <strong>You have ${linked.length} personal ${noteWord} from this meeting</strong>
        <p>
          Personal notes stay private and are <em>not</em> included in reports automatically.
          Paste them into the meeting notes or summary now if you'd like them shared.
        </p>
        <div class="hf4b-banner-actions">
          <button class="hf4b-btn-paste" id="hf4b-paste-btn">Paste into summary</button>
          <button class="hf4b-btn-open-notepad" id="hf4b-open-notepad-btn">View my notes</button>
          <button class="hf4b-btn-dismiss-banner" id="hf4b-dismiss-btn">Dismiss</button>
        </div>
      </div>
    `;

    summarySection.insertAdjacentElement('afterend', banner);

    /* Paste action — appends plain-text content to the summary textarea */
    banner.querySelector('#hf4b-paste-btn').addEventListener('click', () => {
      const summaryTextarea = document.querySelector('#meeting-summary');
      if (!summaryTextarea) return;

      const combined = linked.map(n => {
        const plain = (() => {
          const tmp = document.createElement('div');
          tmp.innerHTML = n.content || '';
          return (tmp.textContent || '').trim();
        })();
        return `— Personal note (${new Date(n.modified || n.created || Date.now())
          .toLocaleDateString()}) —\n${plain}`;
      }).join('\n\n');

      const existing = summaryTextarea.value.trimEnd();
      summaryTextarea.value = existing
        ? existing + '\n\n' + combined
        : combined;

      /* Trigger a save via input event */
      summaryTextarea.dispatchEvent(new Event('input'));

      banner.remove();
      showToast('✓ Personal notes pasted into summary');
    });

    /* Open the notepad */
    banner.querySelector('#hf4b-open-notepad-btn').addEventListener('click', () => {
      banner.remove();
      if (window.fix6_openNotepad) {
        fix6_openNotepad(meetingNoteId, meetingTitle);
      } else {
        /* Fallback: switch to personal and open the first linked note */
        if (window.orgMode) orgMode.applyWorkspace('personal');
        setTimeout(() => { if (window.app && linked[0]) app.openNote(linked[0].id); }, 180);
      }
    });

    banner.querySelector('#hf4b-dismiss-btn').addEventListener('click', () => banner.remove());
  }

  /* Hook into the report-generation event (Phase 2 fires this) */
  function fixC_hookReportButton () {
    /* The meeting editor's "Generate Report" button fires
       a custom event: generateReportRequested */
    document.addEventListener('generateReportRequested', ({ detail }) => {
      const noteId = detail && detail.noteId;
      if (!noteId) return;
      const note = storage.getNote(noteId);
      if (!note) return;
      /* Show banner after a short delay so the report panel renders first */
      setTimeout(() => fixC_showBanner(noteId, note.title), 400);
    });

    /* Also trigger when the meeting editor footer report button is clicked
       directly (in case the event is not dispatched) */
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('#meeting-generate-report');
      if (!btn) return;
      const editor = document.getElementById('meeting-editor');
      if (!editor) return;
      const mn = window.meetingNotes;
      const noteId = mn && mn.activeMeetingId;
      if (!noteId) return;
      const note = storage.getNote(noteId);
      if (note) setTimeout(() => fixC_showBanner(noteId, note.title), 400);
    });

    console.log('✅ Fix C: Personal notes report reminder hooked');
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
     INIT
  ────────────────────────────────────────────────────────── */

  function applyAll () {
    fixA_ensureGlobals();
    fixAplus_injectStyles();
    fixAplus_patchAttendeeChips();
    fixB_injectStyles();
    fixB_buildDropZones();
    fixB_bindSyncEvents();
    fixC_injectStyles();
    fixC_hookReportButton();
    console.log('✅ hotfix-phase4b.js — all fixes applied');
  }

  if (document.readyState === 'complete') {
    setTimeout(applyAll, 500);
  } else {
    window.addEventListener('load', () => setTimeout(applyAll, 500));
  }

  /* Re-expose globals if scripts loaded late */
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(fixA_ensureGlobals, 200);
  });

})();
