/* ================================================================
   PERSONAL-WELCOME.JS — Phase 10
   Replaces the old #welcome-screen with a modern design matching
   the org mode welcome screen in structure and styling.
   Additive — zero edits to any existing JS file.
   ================================================================ */

(function () {
  'use strict';

  const SCREEN_ID = 'wren-personal-welcome';

  /* ── Build screen HTML ──────────────────────────────────────── */
  function buildScreen () {
    const el = document.createElement('div');
    el.id = SCREEN_ID;
    el.className = 'wren-personal-welcome-screen';
    el.innerHTML = `
      <div class="wren-pw-inner">

        <div class="wren-pw-eyebrow">
          <span class="wren-pw-dot"></span>
          <span>Personal</span>
        </div>

        <h1 class="wren-pw-title">
          Your thoughts,<br><em>perfectly kept.</em>
        </h1>

        <p class="wren-pw-sub">
          Write anything — ideas, plans, or things you don't want
          to forget. Everything stays private, on your device.
        </p>

        <div class="wren-pw-actions">
          <button class="wren-pw-btn-primary" id="wren-pw-new-note">
            + New note
          </button>
          <button class="wren-pw-btn-ghost" id="wren-pw-search">
            Search notes →
          </button>
        </div>

        <div class="wren-pw-stats" id="wren-pw-stats" style="display:none">
          <!-- populated by updateStats() -->
        </div>

        <div class="wren-pw-features">
          <div class="wren-pw-feature">
            <span class="wren-pw-feature-icon">🔒</span>
            <span class="wren-pw-feature-label">AES encrypted</span>
          </div>
          <div class="wren-pw-feature">
            <span class="wren-pw-feature-icon">📁</span>
            <span class="wren-pw-feature-label">Folders &amp; tags</span>
          </div>
          <div class="wren-pw-feature">
            <span class="wren-pw-feature-icon">🔍</span>
            <span class="wren-pw-feature-label">Instant search</span>
          </div>
          <div class="wren-pw-feature">
            <span class="wren-pw-feature-icon">✈️</span>
            <span class="wren-pw-feature-label">Works offline</span>
          </div>
        </div>

      </div>
    `;
    return el;
  }

  /* ── Stats row ──────────────────────────────────────────────── */
  function updateStats (el) {
    const statsEl = el.querySelector('#wren-pw-stats');
    if (!statsEl) return;

    let noteCount = 0, folderCount = 0, encryptedCount = 0;

    try {
      const st = window.storage;
      if (st) {
        const notes = st.getNotes ? st.getNotes().filter(n => !n.deleted && n.type !== 'meeting') : [];
        noteCount      = notes.length;
        encryptedCount = notes.filter(n => n.encrypted).length;
        const folders  = st.getFolders ? st.getFolders() : [];
        folderCount    = folders.length;
      }
    } catch (e) {}

    if (noteCount === 0 && folderCount === 0) {
      statsEl.style.display = 'none';
      return;
    }

    const stats = [];
    stats.push({ num: noteCount, label: noteCount !== 1 ? 'Notes' : 'Note' });
    if (folderCount > 0) stats.push({ num: folderCount, label: folderCount !== 1 ? 'Folders' : 'Folder' });
    if (encryptedCount > 0) stats.push({ num: encryptedCount, label: encryptedCount !== 1 ? 'Encrypted' : 'Encrypted' });

    statsEl.style.display = 'flex';
    statsEl.innerHTML = stats.map((s, i) => `
      ${i > 0 ? '<div class="wren-pw-stat-divider"></div>' : ''}
      <div class="wren-pw-stat">
        <span class="wren-pw-stat-num">${s.num}</span>
        <span class="wren-pw-stat-label">${s.label}</span>
      </div>
    `).join('');
  }

  /* ── Show / hide ────────────────────────────────────────────── */
  function isPersonalMode () {
    const sidebar = document.querySelector('.sidebar');
    return sidebar ? !sidebar.classList.contains('org-active') : true;
  }

  function isNoteOpen () {
    const editor = document.getElementById('note-editor-screen');
    return editor && editor.style.display !== 'none' && editor.offsetParent !== null;
  }

  function findMainContent () {
    return document.querySelector('.main-content');
  }

  function show () {
    /* Hide the old welcome screen */
    const old = document.getElementById('welcome-screen');
    if (old) old.style.display = 'none';

    if (document.getElementById(SCREEN_ID)) {
      updateStats(document.getElementById(SCREEN_ID));
      document.getElementById(SCREEN_ID).style.display = 'flex';
      return;
    }

    const main = findMainContent();
    if (!main) return;

    const screen = buildScreen();
    main.appendChild(screen);
    updateStats(screen);

    /* Wire buttons */
    screen.querySelector('#wren-pw-new-note')?.addEventListener('click', () => {
      document.getElementById('new-note-btn')?.click();
    });

    screen.querySelector('#wren-pw-search')?.addEventListener('click', () => {
      /* Toggle the search bar from sidebar-redesign.js */
      const searchBtn = document.getElementById('qa-search-btn');
      if (searchBtn) { searchBtn.click(); return; }
      document.getElementById('search-input')?.focus();
    });
  }

  function hide () {
    const el = document.getElementById(SCREEN_ID);
    if (el) el.style.display = 'none';
  }

  function sync () {
    if (!isPersonalMode()) return;

    if (isNoteOpen()) {
      hide();
    } else {
      /* Only show if the old welcome screen would have been shown */
      const old = document.getElementById('welcome-screen');
      const oldVisible = old && old.style.display !== 'none'
        && getComputedStyle(old).display !== 'none';

      /* Show if old screen is visible OR if no note is open */
      if (oldVisible || (!isNoteOpen() && isPersonalMode())) {
        show();
      }
    }
  }

  /* ── Patch app.showWelcomeScreen ────────────────────────────── */
  function patchApp () {
    if (!window.app || window.app.__pwPatched) return;
    window.app.__pwPatched = true;

    const origShow = window.app.showWelcomeScreen?.bind(window.app);
    window.app.showWelcomeScreen = function () {
      if (origShow) origShow();          /* still hide note editor etc. */
      if (isPersonalMode()) show();
    };

    /* Also override hideWelcomeScreen / openNote to hide our screen */
    const origOpen = window.app.openNote?.bind(window.app);
    if (origOpen) {
      window.app.openNote = function (...args) {
        hide();
        return origOpen(...args);
      };
    }
  }

  /* ── Events ─────────────────────────────────────────────────── */
  document.addEventListener('workspaceChanged', ({ detail }) => {
    if (detail?.workspace === 'personal') {
      setTimeout(sync, 80);
    } else {
      hide();
    }
  });

  document.addEventListener('noteOpened',   () => { if (isPersonalMode()) hide(); });
  document.addEventListener('noteClosed',   () => { if (isPersonalMode()) setTimeout(sync, 80); });

  /* Observe note-editor-screen visibility changes */
  function startObserver () {
    const editor = document.getElementById('note-editor-screen');
    if (editor) {
      new MutationObserver(() => {
        if (!isPersonalMode()) return;
        if (isNoteOpen()) hide();
        else setTimeout(sync, 80);
      }).observe(editor, { attributes: true, attributeFilter: ['style'] });
    }

    /* Also observe the old welcome screen — if app hides it, sync ours */
    const old = document.getElementById('welcome-screen');
    if (old) {
      new MutationObserver(() => {
        if (!isPersonalMode()) return;
        const hidden = old.style.display === 'none' || getComputedStyle(old).display === 'none';
        if (!hidden && !isNoteOpen()) show();   /* old screen shown → show ours too */
      }).observe(old, { attributes: true, attributeFilter: ['style'] });
    }
  }

  /* ── Boot ───────────────────────────────────────────────────── */
  function boot () {
    startObserver();
    patchApp();
    /* Delay so app.js finishes its own init first */
    setTimeout(() => {
      if (isPersonalMode() && !isNoteOpen()) show();
    }, 400);

    /* Re-patch if app re-initialises */
    setTimeout(patchApp, 1500);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  console.log('✅ Personal welcome screen loaded');
})();
