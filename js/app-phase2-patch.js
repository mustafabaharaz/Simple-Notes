/* ============================================
   APP-PHASE2-PATCH.JS — Phase 2 Final Wiring
   Coordinates all org modules, protects personal
   mode, handles edge cases.
   Additive only — zero core edits.
   ============================================ */

(function () {

  /* ------------------------------------------
     WAIT FOR APP READY
  ------------------------------------------ */

  function onReady(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn);
    } else {
      fn();
    }
  }

  onReady(function () {
    // Modules may still be initializing — give one tick
    setTimeout(initPatch, 100);
  });

  /* ------------------------------------------
     MAIN PATCH
  ------------------------------------------ */

  function initPatch() {

    patchNotesListVisibility();
    injectOrgWelcome();
    wireOrgMeetingsView();
    wirePersonalModeRestore();
    wireKeyboardShortcuts();
    wireNewNoteButton();
    restoreStartupState();

    console.log('✅ app-phase2-patch.js wired');
  }

  /* ------------------------------------------
     1. NOTES LIST VISIBILITY
     Hide the personal notes list when org mode
     is active so it doesn't show through
  ------------------------------------------ */

  function patchNotesListVisibility() {
    document.addEventListener('workspaceChanged', ({ detail }) => {
      const notesList = document.querySelector('.notes-panel, #notes-list, .sidebar-notes');

      // The notes list lives inside .personal-sidebar-content which
      // org-mode.js already hides — this is a safety net for the
      // main content area edge cases only.

      if (detail.workspace === 'org') {
        ensureOrgContentVisible();
      } else {
        ensurePersonalContentVisible();
      }
    });
  }

  /* ------------------------------------------
     2. ORG WELCOME STATE
     When switching to org mode with no active
     view, show a friendly landing state in main
  ------------------------------------------ */

  function injectOrgWelcome() {
    if (document.getElementById('org-welcome')) return;

    const mainContent = document.querySelector('.main-content');
    if (!mainContent) return;

    const el = document.createElement('div');
    el.id = 'org-welcome';
    el.className = 'org-panel org-welcome-panel';
    el.innerHTML = `
      <div class="org-welcome-body">
        <div class="org-welcome-icon">🏢</div>
        <h2 class="org-welcome-title">Org Mode</h2>
        <p class="org-welcome-desc">
          Create meeting notes with structured agendas, track action items,
          and generate activity reports — all stored privately on your device.
        </p>
        <div class="org-welcome-actions">
          <button class="org-welcome-cta" id="org-welcome-new-meeting">
            📅 New Meeting Note
          </button>
          <div class="org-welcome-shortcuts">
            <span class="owc-shortcut">Ctrl+Shift+O</span>
            <span class="owc-label">toggle modes</span>
          </div>
        </div>
        <div class="org-welcome-stats" id="org-welcome-stats">
          <!-- populated dynamically -->
        </div>
      </div>
    `;

    mainContent.appendChild(el);

    el.querySelector('#org-welcome-new-meeting')?.addEventListener('click', () => {
      document.dispatchEvent(new CustomEvent('newMeetingRequested'));
    });
  }

  function updateOrgWelcomeStats() {
    const el = document.getElementById('org-welcome-stats');
    if (!el) return;

    const meetings = storage.getNotes().filter(n => n.type === 'meeting').length;
    const reports  = storage.getNotes().filter(n => n.type === 'report').length;
    const allActions = window.actionItems?.getAllActionItems() || [];
    const openActions = allActions.filter(i => (i.status || 'open') !== 'done').length;

    el.innerHTML = `
      <div class="ow-stat">
        <span class="ow-stat-value">${meetings}</span>
        <span class="ow-stat-label">Meeting${meetings !== 1 ? 's' : ''}</span>
      </div>
      <div class="ow-stat">
        <span class="ow-stat-value">${openActions}</span>
        <span class="ow-stat-label">Open Actions</span>
      </div>
      <div class="ow-stat">
        <span class="ow-stat-value">${reports}</span>
        <span class="ow-stat-label">Report${reports !== 1 ? 's' : ''}</span>
      </div>
    `;
  }

  /* ------------------------------------------
     3. WIRE "MEETINGS" ORG NAV VIEW
     Clicking Meetings in org nav shows the
     welcome/overview panel (meetings live in
     the sidebar mini-list)
  ------------------------------------------ */

  function wireOrgMeetingsView() {
    document.addEventListener('orgViewChanged', ({ detail }) => {
      if (detail.view === 'meetings') {
        showOrgMeetingsView();
      }
    });

    // Also show on workspace switch to org if meetings is active view
    document.addEventListener('workspaceChanged', ({ detail }) => {
      if (detail.workspace === 'org') {
        const currentView = window.orgMode?.getCurrentView() || 'meetings';
        if (currentView === 'meetings') {
          setTimeout(showOrgMeetingsView, 60);
        }
        updateOrgWelcomeStats();
      }
    });
  }

  function showOrgMeetingsView() {
    // Close all other org panels
    hideAllOrgPanels();

    // If a meeting is currently open, keep it visible
    if (window.meetingNotes?.activeMeetingId) {
      const editor = document.getElementById('meeting-editor');
      if (editor) {
        editor.style.display = '';
        return;
      }
    }

    // Otherwise show org welcome
    const welcome = document.getElementById('org-welcome');
    if (welcome) {
      welcome.classList.add('active');
      updateOrgWelcomeStats();
    }

    // Hide personal chrome
    hidePersonalChrome();
  }

  /* ------------------------------------------
     4. PERSONAL MODE RESTORE
     When switching back to personal, cleanly
     restore the editor / welcome state
  ------------------------------------------ */

  function wirePersonalModeRestore() {
    document.addEventListener('workspaceChanged', ({ detail }) => {
      if (detail.workspace === 'personal') {
        restorePersonalMode();
      }
    });
  }

  function restorePersonalMode() {
    // Close meeting editor
    if (window.meetingNotes?.activeMeetingId) {
      window.meetingNotes.closeMeetingEditor();
    }

    // Hide all org panels
    hideAllOrgPanels();

    // Restore personal chrome
    ensurePersonalContentVisible();

    // Show welcome or last note
    if (window.app) {
      if (window.app.currentNote) {
        const note = storage.getNote(window.app.currentNote.id);
        if (note && note.type !== 'meeting' && note.type !== 'report') {
          window.app.openNote(window.app.currentNote.id);
          return;
        }
      }
      window.app.showWelcomeScreen();
    }
  }

  /* ------------------------------------------
     5. KEYBOARD SHORTCUTS
  ------------------------------------------ */

  function wireKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      const mod = e.ctrlKey || e.metaKey;

      // Ctrl+Shift+M = new meeting (only in org mode)
      if (mod && e.shiftKey && e.key.toLowerCase() === 'm') {
        if (window.orgMode?.isOrgMode()) {
          e.preventDefault();
          document.dispatchEvent(new CustomEvent('newMeetingRequested'));
        }
      }

      // Escape = close meeting editor, go back to meetings view
      if (e.key === 'Escape') {
        if (window.meetingNotes?.activeMeetingId && window.orgMode?.isOrgMode()) {
          e.preventDefault();
          window.meetingNotes.closeMeetingEditor();
          showOrgMeetingsView();
        }
      }
    });
  }

  /* ------------------------------------------
     6. NEW NOTE BUTTON
     In org mode, Ctrl+N / "New Note" creates
     a meeting note instead of a personal note
  ------------------------------------------ */

  function wireNewNoteButton() {
    const newNoteBtn = document.getElementById('new-note-btn');
    if (!newNoteBtn || newNoteBtn.dataset.phase2Patched) return;
    newNoteBtn.dataset.phase2Patched = 'true';

    const originalClick = newNoteBtn.onclick;

    newNoteBtn.addEventListener('click', (e) => {
      if (window.orgMode?.isOrgMode()) {
        e.stopImmediatePropagation();
        document.dispatchEvent(new CustomEvent('newMeetingRequested'));
      }
      // Personal mode: original handler fires naturally
    }, true); // capture phase

    // Also patch Ctrl+N
    document.addEventListener('keydown', (e) => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key === 'n' && window.orgMode?.isOrgMode()) {
        e.preventDefault();
        e.stopImmediatePropagation();
        document.dispatchEvent(new CustomEvent('newMeetingRequested'));
      }
    }, true);
  }

  /* ------------------------------------------
     7. STARTUP STATE RESTORE
     If the user was in org mode last session,
     restore that state cleanly
  ------------------------------------------ */

  function restoreStartupState() {
    const savedWorkspace = localStorage.getItem('simple_notes_workspace') || 'personal';

    if (savedWorkspace === 'org' && window.orgMode) {
      // orgMode already applied it visually; we just need to
      // ensure the correct content panel is showing
      setTimeout(() => {
        ensureOrgContentVisible();
        const currentView = window.orgMode.getCurrentView() || 'meetings';
        if (currentView === 'meetings') {
          showOrgMeetingsView();
        } else {
          document.dispatchEvent(new CustomEvent('orgViewChanged', {
            detail: { view: currentView }
          }));
        }
      }, 150);
    }
  }

  /* ------------------------------------------
     HELPERS
  ------------------------------------------ */

  function hideAllOrgPanels() {
    document.querySelectorAll('.org-panel').forEach(p => p.classList.remove('active'));
  }

  function hidePersonalChrome() {
    const els = [
      document.querySelector('.toolbar'),
      document.querySelector('.note-header'),
      document.getElementById('note-content'),
      document.getElementById('welcome-screen'),
      document.getElementById('note-editor-screen'),
      document.getElementById('word-count-bar')
    ];
    els.forEach(el => { if (el) el.style.display = 'none'; });
  }

  function ensureOrgContentVisible() {
    hidePersonalChrome();

    // Hide meeting editor too (org nav will control what's visible)
    const meetingEditor = document.getElementById('meeting-editor');
    if (meetingEditor && !window.meetingNotes?.activeMeetingId) {
      meetingEditor.style.display = 'none';
    }
  }

  function ensurePersonalContentVisible() {
    const toolbar     = document.querySelector('.toolbar');
    const noteHeader  = document.querySelector('.note-header');
    const noteContent = document.getElementById('note-content');
    const editorScreen = document.getElementById('note-editor-screen');

    // Only restore if a personal note is actually open
    if (window.app?.currentNote) {
      [toolbar, noteHeader, noteContent, editorScreen].forEach(el => {
        if (el) el.style.display = '';
      });
    }

    // Always hide meeting editor when in personal mode
    const meetingEditor = document.getElementById('meeting-editor');
    if (meetingEditor) meetingEditor.style.display = 'none';

    // Hide the org mode banner
    const banner = document.getElementById('org-mode-banner');
    if (banner) banner.classList.remove('visible');
  }

})();

console.log('✅ app-phase2-patch.js loaded');
