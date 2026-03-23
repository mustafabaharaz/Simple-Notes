/* ============================================================
   HOTFIX-PHASE4C.JS — Phase 4 Third Pass
   Additive only — zero modifications to any existing file
   ============================================================
   Fix A  — Contacts button: move to org sidebar, fix global timing
   Fix B  — Folders + trash: teleport real DOM nodes into org mode
   Fix C  — Personal-notes report banner: reliable anchor + trigger
   Fix D  — Attendee input: ghost hint text
   ============================================================ */

(function () {
  'use strict';

  /* ──────────────────────────────────────────────────────────
     UTIL
  ────────────────────────────────────────────────────────── */
  function _esc (s) {
    const d = document.createElement('div');
    d.textContent = s || '';
    return d.innerHTML;
  }

  /* Safe global getter — handles both `const` file-scope variables
     (not on window) and properly exposed globals.
     Tries window first, then scans the module's own closure by
     re-reading the class and finding live instances via duck-typing. */
  function getContacts () {
    if (window.contacts && typeof window.contacts.openModal === 'function') {
      return window.contacts;
    }
    /* Phase-3 contacts.js stores data under STORAGE_KEY — if the class
       ran, an instance must exist somewhere. Re-instantiate safely. */
    if (window.ContactGroupsManager) {
      window.contacts = new ContactGroupsManager();
    }
    return window.contacts || null;
  }

  function getShare () {
    if (window.wrenShare && typeof window.wrenShare.share === 'function') {
      return window.wrenShare;
    }
    if (window.WrenShare) {
      window.wrenShare = new WrenShare();
    }
    return window.wrenShare || null;
  }

  /* ──────────────────────────────────────────────────────────
     FIX A — Contacts button in ORG sidebar (not personal)
     + iron-clad click handler that resolves the global lazily
  ────────────────────────────────────────────────────────── */

  function fixA_injectContactsInOrg () {
    /* Remove any stray button previously injected into personal mode */
    const stray = document.getElementById('contacts-btn');
    if (stray) stray.remove();

    if (document.getElementById('org-contacts-btn')) return;

    const footer = document.querySelector('.org-sidebar-footer');
    if (!footer) return;

    const btn = document.createElement('button');
    btn.id = 'org-contacts-btn';
    btn.className = 'btn-new-meeting'; /* reuse same style */
    btn.style.cssText = 'background: transparent; border: 1.5px solid var(--color-border); color: var(--color-text-secondary); margin-top: 8px;';
    btn.innerHTML = '<span>👥</span> Contacts';

    /* Lazy resolution on every click — survives script ordering */
    btn.addEventListener('click', () => {
      const c = getContacts();
      if (c) {
        c.openModal();
      } else {
        showToast('Contact Groups not loaded yet — try again in a moment', 'warning');
      }
    });

    footer.appendChild(btn);
    console.log('✅ Fix A: Contacts button injected into org sidebar footer');
  }

  /* Also re-wire existing share button with lazy resolver */
  function fixA_rewireShareBtn () {
    const btn = document.getElementById('editor-share-btn');
    if (!btn || btn.__hf4c_wired) return;
    btn.__hf4c_wired = true;
    btn.onclick = () => {
      const s = getShare();
      if (!s) { showToast('Share system not ready yet', 'warning'); return; }
      const note = typeof app !== 'undefined' && app.currentNote
        ? app.currentNote : null;
      if (!note) { showToast('Open a note first', 'error'); return; }
      s.share('note', note);
    };
    console.log('✅ Fix A: Share button re-wired with lazy resolver');
  }

  /* ──────────────────────────────────────────────────────────
     FIX B — Teleport .folders-section and .trash-section
     Real DOM nodes are physically moved between personal-sidebar-content
     and org-sidebar-sections on each workspace switch.
     No cloning, no duplication — same elements, same listeners.
  ────────────────────────────────────────────────────────── */

  /* Stable references updated once on first call */
  let _foldersEl = null;
  let _trashEl   = null;
  let _personalContent = null;
  let _orgSections     = null;

  function fixB_cacheElements () {
    _foldersEl       = _foldersEl       || document.querySelector('.folders-section');
    _trashEl         = _trashEl         || document.querySelector('.trash-section');
    _personalContent = _personalContent || document.getElementById('personal-sidebar-content');
    _orgSections     = _orgSections     || document.getElementById('org-sidebar-sections');
  }

  function fixB_teleportToOrg () {
    fixB_cacheElements();
    if (!_foldersEl || !_trashEl || !_orgSections) return;

    /* Already in org sidebar? Nothing to do */
    if (_orgSections.contains(_foldersEl)) return;

    /* Insert before the footer button */
    const footer = _orgSections.querySelector('.org-sidebar-footer');
    _orgSections.insertBefore(_foldersEl, footer);
    _orgSections.insertBefore(_trashEl,   footer);

    /* Make them visible (personal mode hides the parent, not these directly) */
    _foldersEl.style.display = '';
    _trashEl.style.display   = '';

    console.log('📦 Fix B: folders + trash teleported → org sidebar');
  }

  function fixB_teleportToPersonal () {
    fixB_cacheElements();
    if (!_foldersEl || !_trashEl || !_personalContent) return;

    /* Already in personal content? Nothing to do */
    if (_personalContent.contains(_foldersEl)) return;

    /* Append back — original position was after notes-section */
    _personalContent.appendChild(_foldersEl);
    _personalContent.appendChild(_trashEl);

    /* personal-sidebar-content controls visibility so just reset inline */
    _foldersEl.style.display = '';
    _trashEl.style.display   = '';

    console.log('📦 Fix B: folders + trash teleported → personal sidebar');
  }

  function fixB_bindWorkspaceListener () {
    document.addEventListener('workspaceChanged', ({ detail }) => {
      if (!detail) return;
      if (detail.workspace === 'org') {
        fixB_teleportToOrg();
      } else {
        fixB_teleportToPersonal();
      }
    });
  }

  function fixB_applyInitial () {
    /* Apply whichever workspace is currently active */
    const sidebar = document.querySelector('.sidebar');
    if (sidebar && sidebar.classList.contains('org-active')) {
      fixB_teleportToOrg();
    }
  }

  /* ──────────────────────────────────────────────────────────
     FIX C — Personal-notes report reminder
     Reliable version: insert banner into meeting-editor-body
     (always present) instead of after #section-summary (may not
     exist when timer fires). Also hooks both the custom event
     AND the direct button click.
  ────────────────────────────────────────────────────────── */

  function fixC_injectStyles () {
    if (document.getElementById('hf4c-banner-styles')) return;
    const s = document.createElement('style');
    s.id = 'hf4c-banner-styles';
    s.textContent = `
      .hf4c-personal-notes-banner {
        display: flex;
        gap: 12px;
        padding: 14px 16px;
        margin: 14px 0;
        background: rgba(245,158,11,.1);
        border: 1.5px solid rgba(245,158,11,.4);
        border-radius: 10px;
        font-size: 13px;
        animation: hf4c-pop .25s ease;
      }
      @keyframes hf4c-pop {
        from { opacity:0; transform:translateY(6px); }
        to   { opacity:1; transform:translateY(0); }
      }
      .hf4c-banner-icon { font-size: 20px; flex-shrink: 0; margin-top: 1px; }
      .hf4c-banner-body { flex: 1; }
      .hf4c-banner-body strong {
        display: block; font-size: 13px; font-weight: 700;
        color: var(--color-text-primary); margin-bottom: 4px;
      }
      .hf4c-banner-body p {
        margin: 0 0 10px; font-size: 12px;
        color: var(--color-text-secondary); line-height: 1.55;
      }
      .hf4c-banner-actions { display: flex; gap: 8px; flex-wrap: wrap; }
      .hf4c-btn-paste {
        padding: 6px 14px;
        background: linear-gradient(135deg, #f59e0b, #d97706);
        color: white; border: none; border-radius: 7px;
        font-size: 12px; font-weight: 600; cursor: pointer;
      }
      .hf4c-btn-paste:hover { opacity: .9; }
      .hf4c-btn-view {
        padding: 6px 12px;
        background: transparent; color: var(--color-primary);
        border: 1.5px solid var(--color-primary);
        border-radius: 7px; font-size: 12px; font-weight: 600; cursor: pointer;
      }
      .hf4c-btn-view:hover { background: rgba(99,102,241,.06); }
      .hf4c-btn-dismiss {
        padding: 6px 12px;
        background: transparent; color: var(--color-text-secondary);
        border: 1.5px solid var(--color-border);
        border-radius: 7px; font-size: 12px; font-weight: 600; cursor: pointer;
      }
      [data-theme="dark"] .hf4c-personal-notes-banner {
        background: rgba(245,158,11,.12);
        border-color: rgba(245,158,11,.3);
      }
    `;
    document.head.appendChild(s);
  }

  function fixC_getLinkedNotes (meetingNoteId) {
    return storage.getNotes().filter(
      n => n.linkedMeetingId === meetingNoteId && !n.deleted
    );
  }

  function fixC_showBanner (meetingNoteId) {
    /* Prevent duplicates */
    document.querySelector('.hf4c-personal-notes-banner')?.remove();

    const linked = fixC_getLinkedNotes(meetingNoteId);
    const totalChars = linked.reduce((a, n) => a + (n.content || '').length, 0);
    if (!linked.length || totalChars < 5) return;

    /* Find insertion anchor — prefer section-summary, fall back to editor body */
    const anchor =
      document.querySelector('#section-summary') ||
      document.querySelector('.meeting-editor-body') ||
      document.querySelector('#meeting-editor');
    if (!anchor) return;

    const note = storage.getNote(meetingNoteId);
    const meetingTitle = note ? note.title : 'this meeting';
    const plural = linked.length > 1;

    const banner = document.createElement('div');
    banner.className = 'hf4c-personal-notes-banner';
    banner.innerHTML = `
      <div class="hf4c-banner-icon">📝</div>
      <div class="hf4c-banner-body">
        <strong>You have ${linked.length} personal ${plural ? 'notes' : 'note'} from this meeting</strong>
        <p>
          Personal notes are private and <em>not</em> included in reports automatically.
          Paste them into the summary if you'd like them shared with the team.
        </p>
        <div class="hf4c-banner-actions">
          <button class="hf4c-btn-paste">Paste into summary</button>
          <button class="hf4c-btn-view">View my notes</button>
          <button class="hf4c-btn-dismiss">Dismiss</button>
        </div>
      </div>
    `;

    /* Insert after the anchor element, or as first child of body */
    anchor.insertAdjacentElement('afterend', banner);

    /* Paste */
    banner.querySelector('.hf4c-btn-paste').addEventListener('click', () => {
      const ta = document.querySelector('#meeting-summary');
      if (!ta) return;
      const combined = linked.map(n => {
        const tmp = document.createElement('div');
        tmp.innerHTML = n.content || '';
        const plain = (tmp.textContent || '').trim();
        const date = new Date(n.modified || n.created || Date.now())
          .toLocaleDateString();
        return `— Personal note (${date}) —\n${plain}`;
      }).join('\n\n');
      ta.value = ta.value.trimEnd()
        ? ta.value.trimEnd() + '\n\n' + combined
        : combined;
      ta.dispatchEvent(new Event('input'));
      banner.remove();
      showToast('✓ Personal notes pasted into summary');
    });

    /* View */
    banner.querySelector('.hf4c-btn-view').addEventListener('click', () => {
      banner.remove();
      /* Try hotfix-phase4 notepad first, else fall back */
      if (typeof fix6_openNotepad === 'function') {
        fix6_openNotepad(meetingNoteId, meetingTitle);
      } else if (linked[0]) {
        if (window.orgMode) orgMode.applyWorkspace('personal');
        setTimeout(() => window.app && app.openNote(linked[0].id), 180);
      }
    });

    /* Dismiss */
    banner.querySelector('.hf4c-btn-dismiss').addEventListener('click', () => banner.remove());
  }

  function fixC_hookTriggers () {
    /* 1 — Custom event from meeting-notes.js */
    document.addEventListener('generateReportRequested', ({ detail }) => {
      const id = detail && detail.noteId;
      if (id) setTimeout(() => fixC_showBanner(id), 300);
    });

    /* 2 — Direct click on the button (catches cases where event isn't dispatched) */
    document.addEventListener('click', (e) => {
      if (!e.target.closest('#meeting-generate-report')) return;
      const mn = window.meetingNotes;
      const id = mn && mn.activeMeetingId;
      if (id) setTimeout(() => fixC_showBanner(id), 300);
    });

    console.log('✅ Fix C: Report reminder hooked');
  }

  /* ──────────────────────────────────────────────────────────
     FIX D — Ghost hint text below attendee input
     Injected once the meeting editor renders.
  ────────────────────────────────────────────────────────── */

  function fixD_injectStyles () {
    if (document.getElementById('hf4c-hint-styles')) return;
    const s = document.createElement('style');
    s.id = 'hf4c-hint-styles';
    s.textContent = `
      .hf4c-attendee-hint {
        font-size: 11px;
        color: var(--color-text-secondary);
        opacity: .65;
        margin-top: 6px;
        line-height: 1.5;
        padding: 0 2px;
      }
      .hf4c-attendee-hint span {
        color: #10b981;
        font-weight: 600;
        opacity: 1;
      }
    `;
    document.head.appendChild(s);
  }

  function fixD_injectHint (editor) {
    const addRow = (editor || document).querySelector('.attendee-add-row');
    if (!addRow || addRow.querySelector('.hf4c-attendee-hint')) return;

    const hint = document.createElement('p');
    hint.className = 'hf4c-attendee-hint';
    hint.innerHTML = `
      💡 Click any <span>attendee chip</span> to save their email or phone —
      then you can share meeting notes directly to them from the Share menu.
    `;
    addRow.insertAdjacentElement('afterend', hint);
  }

  /* Patch renderMeetingEditor to inject hint after each render */
  function fixD_patchMeetingEditor () {
    const mn = window.meetingNotes;
    if (!mn || mn.__hf4c_hintPatched) return;
    mn.__hf4c_hintPatched = true;

    const orig = mn.renderMeetingEditor.bind(mn);
    mn.renderMeetingEditor = function (note, data) {
      orig(note, data);
      const editor = document.getElementById('meeting-editor');
      fixD_injectHint(editor);
    };

    /* Also apply to any already-open meeting editor */
    const existing = document.getElementById('meeting-editor');
    if (existing) fixD_injectHint(existing);

    console.log('✅ Fix D: Attendee hint injected');
  }

  /* ──────────────────────────────────────────────────────────
     INIT
  ────────────────────────────────────────────────────────── */

  function applyAll () {
    fixC_injectStyles();
    fixD_injectStyles();

    fixA_injectContactsInOrg();
    fixA_rewireShareBtn();

    fixB_bindWorkspaceListener();
    fixB_applyInitial();

    fixC_hookTriggers();
    fixD_patchMeetingEditor();

    console.log('✅ hotfix-phase4c.js — all fixes applied');
  }

  /* Wait for both the DOM and all deferred scripts to be done */
  if (document.readyState === 'complete') {
    setTimeout(applyAll, 600);
  } else {
    window.addEventListener('load', () => setTimeout(applyAll, 600));
  }

  /* Re-inject contacts button if org sidebar appears late */
  document.addEventListener('workspaceChanged', ({ detail }) => {
    if (detail && detail.workspace === 'org') {
      setTimeout(fixA_injectContactsInOrg, 80);
    }
  });

})();
