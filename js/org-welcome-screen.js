/* ================================================================
   ORG-WELCOME-SCREEN.JS — Phase 10
   Shows a welcome screen in the main content area when org mode
   is active and no meeting is currently open.
   Additive — zero edits to any existing JS file.
   ================================================================ */

(function () {
  'use strict';

  const SCREEN_ID = 'wren-org-welcome';

  /* ── Build the screen HTML ──────────────────────────────────── */

  function buildScreen () {
    const el = document.createElement('div');
    el.id = SCREEN_ID;
    el.className = 'wren-org-welcome-screen';
    el.innerHTML = `
      <div class="wren-org-welcome-inner">

        <div class="wren-org-welcome-eyebrow">
          <span class="wren-org-welcome-dot"></span>
          <span>Org mode</span>
        </div>

        <h1 class="wren-org-welcome-title">
          Nothing slips<br>past a <em>Wren.</em>
        </h1>

        <p class="wren-org-welcome-sub">
          Start a meeting note to capture agendas, attendees,
          action items, and send follow-ups — all in one place.
        </p>

        <div class="wren-org-welcome-actions">
          <button class="wren-org-btn-primary" id="wren-org-welcome-new-meeting">
            + New meeting
          </button>
          <button class="wren-org-btn-ghost" id="wren-org-welcome-view-actions">
            View open actions →
          </button>
        </div>

        <div class="wren-org-welcome-stats" id="wren-org-welcome-stats">
          <!-- populated by updateStats() -->
        </div>

        <div class="wren-org-welcome-features">
          <div class="wren-org-feature">
            <div class="wren-org-feature-icon">📋</div>
            <div class="wren-org-feature-label">Structured notes</div>
          </div>
          <div class="wren-org-feature">
            <div class="wren-org-feature-icon">✅</div>
            <div class="wren-org-feature-label">Action tracking</div>
          </div>
          <div class="wren-org-feature">
            <div class="wren-org-feature-icon">📤</div>
            <div class="wren-org-feature-label">Auto follow-ups</div>
          </div>
          <div class="wren-org-feature">
            <div class="wren-org-feature-icon">↩</div>
            <div class="wren-org-feature-label">Carry-forward</div>
          </div>
        </div>

      </div>
    `;
    return el;
  }

  /* ── Stats row ──────────────────────────────────────────────── */

  function updateStats (el) {
    const statsEl = el.querySelector('#wren-org-welcome-stats');
    if (!statsEl) return;

    let meetings = 0, openActions = 0;

    try {
      const storage = window.storage || window.noteStorage;
      if (storage && typeof storage.getNotes === 'function') {
        const notes = storage.getNotes();
        meetings = notes.filter(n => n.type === 'meeting' && !n.deleted).length;

        notes.filter(n => n.type === 'meeting' && !n.deleted).forEach(n => {
          try {
            const d = JSON.parse(n.content || '{}');
            if (Array.isArray(d.actionItems)) {
              openActions += d.actionItems.filter(a => !a.done && !a.completed).length;
            }
          } catch (e) {}
        });
      }
    } catch (e) {}

    if (meetings === 0 && openActions === 0) {
      statsEl.style.display = 'none';
      return;
    }

    statsEl.style.display = 'flex';
    statsEl.innerHTML = `
      <div class="wren-org-stat">
        <span class="wren-org-stat-num">${meetings}</span>
        <span class="wren-org-stat-label">Meeting${meetings !== 1 ? 's' : ''}</span>
      </div>
      <div class="wren-org-stat-divider"></div>
      <div class="wren-org-stat">
        <span class="wren-org-stat-num">${openActions}</span>
        <span class="wren-org-stat-label">Open action${openActions !== 1 ? 's' : ''}</span>
      </div>
    `;
  }

  /* ── Show / hide ────────────────────────────────────────────── */

  function isMeetingOpen () {
    const editor = document.getElementById('meeting-editor');
    if (editor && editor.style.display !== 'none' && editor.offsetParent !== null) {
      return true;
    }
    /* Also check if a regular note is open in org mode */
    const noteContent = document.getElementById('note-content');
    if (noteContent && noteContent.closest('#main-content')) {
      const mainContent = document.getElementById('main-content');
      if (mainContent && mainContent.style.display !== 'none') {
        return true;
      }
    }
    return false;
  }

  function isOrgMode () {
    const sidebar = document.querySelector('.sidebar');
    if (!sidebar) return false;
    return (
      sidebar.classList.contains('org-mode') ||
      sidebar.classList.contains('org-active') ||
      sidebar.dataset.workspace === 'org' ||
      document.body.classList.contains('org-mode') ||
      !!document.getElementById('org-meetings-mini-list')
    );
  }

  function findMainContent () {
    return (
      document.getElementById('main-content') ||
      document.querySelector('.main-content') ||
      document.querySelector('.editor-area') ||
      document.querySelector('.editor-panel') ||
      document.querySelector('.editor-wrapper')
    );
  }

  function show () {
    if (document.getElementById(SCREEN_ID)) {
      update();
      return;
    }

    const main = findMainContent();
    if (!main) return;

    const screen = buildScreen();
    main.appendChild(screen);

    /* Wire buttons */
    screen.querySelector('#wren-org-welcome-new-meeting')
      ?.addEventListener('click', () => {
        document.dispatchEvent(new CustomEvent('newMeetingRequested'));
        /* Also try direct button click as fallback */
        const btn = document.getElementById('btn-new-meeting') ||
                    document.getElementById('org-new-meeting-btn');
        btn?.click();
      });

    screen.querySelector('#wren-org-welcome-view-actions')
      ?.addEventListener('click', () => {
        /* Try to open action items panel */
        const panel = document.getElementById('action-items-panel') ||
                      document.querySelector('.action-panel');
        if (panel) {
          panel.style.display = '';
          panel.scrollIntoView({ behavior: 'smooth' });
        }
      });

    updateStats(screen);
  }

  function hide () {
    document.getElementById(SCREEN_ID)?.remove();
  }

  function update () {
    const screen = document.getElementById(SCREEN_ID);
    if (screen) updateStats(screen);
  }

  /* Guard flag — prevents show() from firing during/after a
     personal-mode switch. Set to true on personal switch,
     cleared after 600ms once the DOM has fully settled. */
  let _blocked = false;
  let _blockTimer = null;

  function blockShow (ms = 600) {
    _blocked = true;
    clearTimeout(_blockTimer);
    _blockTimer = setTimeout(() => { _blocked = false; }, ms);
  }

  function sync () {
    if (_blocked) return;
    if (isOrgMode() && !isMeetingOpen()) {
      show();
    } else {
      hide();
    }
  }

  /* ── Event listeners ────────────────────────────────────────── */

  /* Workspace switch */
  document.addEventListener('workspaceChanged', ({ detail }) => {
    if (detail?.workspace === 'org') {
      /* Unblock and show after org finishes rendering */
      _blocked = false;
      setTimeout(sync, 150);
    } else {
      /* Block immediately, hide immediately */
      blockShow(600);
      hide();
    }
  });

  /* Meeting opened / closed */
  document.addEventListener('meetingOpened', hide);
  document.addEventListener('meetingClosed', () => {
    if (!_blocked && isOrgMode()) setTimeout(show, 80);
  });
  document.addEventListener('noteOpened', () => {
    if (!_blocked && isOrgMode()) setTimeout(sync, 80);
  });
  document.addEventListener('noteClosed', () => {
    if (!_blocked && isOrgMode()) setTimeout(sync, 80);
  });

  /* Watch for meeting editor appearing / disappearing in DOM.
     Only fires sync if we're confidently in org mode AND unblocked. */
  const observer = new MutationObserver(() => {
    if (!_blocked && isOrgMode()) setTimeout(sync, 80);
  });

  function startObserver () {
    const main = findMainContent();
    if (main) {
      observer.observe(main, { childList: true, subtree: false });
    }
  }

  /* ── Boot ───────────────────────────────────────────────────── */

  function boot () {
    startObserver();
    /* Check initial state */
    setTimeout(sync, 300);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  console.log('✅ Org welcome screen loaded');

})();
