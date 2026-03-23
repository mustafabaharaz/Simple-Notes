/* ============================================
   ORG-WELCOME.JS — Org Mode Empty State
   Phase 5 — Additive only, zero core edits
   ============================================ */

class OrgWelcome {
  constructor() {
    this.init();
  }

  /* ------------------------------------------
     INIT
  ------------------------------------------ */

  init() {
    this.injectEmptyState();
    this.patchCloseMeetingEditor();
    this.watchMeetingEditorDOM();
    this.bindEvents();
    console.log('✅ OrgWelcome initialized');
  }

  /* ------------------------------------------
     INJECT ORG EMPTY STATE
  ------------------------------------------ */

  injectEmptyState() {
    if (document.getElementById('org-empty-state')) return;

    const mainContent = document.querySelector('.main-content');
    if (!mainContent) return;

    const el = document.createElement('div');
    el.id = 'org-empty-state';
    el.className = 'org-empty-state-full';
    el.style.display = 'none';
    el.innerHTML = `
      <div class="org-es-inner">
        <div class="org-es-icon">📅</div>
        <h2 class="org-es-title">No meeting open</h2>
        <p class="org-es-desc">
          Select a meeting from the sidebar or start a new one.
        </p>
        <button class="org-es-cta" id="org-es-new-meeting">
          <span>＋</span> New Meeting
        </button>
      </div>
    `;

    mainContent.appendChild(el);

    el.querySelector('#org-es-new-meeting').addEventListener('click', () => {
      document.dispatchEvent(new CustomEvent('newMeetingRequested'));
    });
  }

  /* ------------------------------------------
     PATCH closeMeetingEditor
     Intercept so that in org mode we show
     the org empty state instead of the
     personal welcome screen
  ------------------------------------------ */

  patchCloseMeetingEditor() {
    const tryPatch = () => {
      if (!window.meetingNotes || window.meetingNotes.__owPatched) {
        if (!window.meetingNotes) { setTimeout(tryPatch, 100); return; }
        return;
      }
      window.meetingNotes.__owPatched = true;

      const original = window.meetingNotes.closeMeetingEditor.bind(window.meetingNotes);

      window.meetingNotes.closeMeetingEditor = () => {
        original();

        if (window.orgMode?.isOrgMode()) {
          // In org mode: keep personal welcome hidden, show org empty state
          const personalWelcome = document.getElementById('welcome-screen');
          if (personalWelcome) personalWelcome.style.display = 'none';
          this.showEmptyState();
        }
      };
    };
    tryPatch();
  }

  /* ------------------------------------------
     MUTATION OBSERVER
     Watches for #meeting-editor being
     added/removed to react immediately
  ------------------------------------------ */

  watchMeetingEditorDOM() {
    const observer = new MutationObserver(() => {
      const editorExists = !!document.getElementById('meeting-editor');

      if (window.orgMode?.isOrgMode()) {
        if (editorExists) {
          this.hideEmptyState();
          // Always keep personal welcome hidden in org mode
          const personalWelcome = document.getElementById('welcome-screen');
          if (personalWelcome) personalWelcome.style.display = 'none';
        }
        // Don't show empty state here — let closeMeetingEditor handle it
        // so we don't flash it on every DOM mutation
      }
    });

    observer.observe(document.body, { childList: true, subtree: false });
  }

  /* ------------------------------------------
     SHOW / HIDE ORG EMPTY STATE
  ------------------------------------------ */

  showEmptyState() {
    const el = document.getElementById('org-empty-state');
    if (el) el.style.display = '';

    // Ensure personal welcome is hidden
    const personalWelcome = document.getElementById('welcome-screen');
    if (personalWelcome) personalWelcome.style.display = 'none';

    // Ensure personal editor chrome is hidden
    this.setPersonalEditorVisibility(false);
  }

  hideEmptyState() {
    const el = document.getElementById('org-empty-state');
    if (el) el.style.display = 'none';
  }

  setPersonalEditorVisibility(show) {
    const selectors = ['.toolbar', '.note-header', '#note-content', '#drawing-canvas',
                       '#voice-to-text-section', '#word-count-bar'];
    selectors.forEach(sel => {
      const el = document.querySelector(sel);
      if (el) el.style.display = show ? '' : 'none';
    });
  }

  /* ------------------------------------------
     BIND EVENTS
  ------------------------------------------ */

  bindEvents() {
    document.addEventListener('workspaceChanged', ({ detail }) => {
      if (detail.workspace === 'org') {
        this.onEnterOrg();
      } else {
        this.onLeaveOrg();
      }
    });
  }

  onEnterOrg() {
    const meetingEditorOpen = !!document.getElementById('meeting-editor');

    // Hide personal welcome always
    const personalWelcome = document.getElementById('welcome-screen');
    if (personalWelcome) personalWelcome.style.display = 'none';

    if (!meetingEditorOpen) {
      this.showEmptyState();
    } else {
      this.hideEmptyState();
    }
  }

  onLeaveOrg() {
    this.hideEmptyState();

    // Restore personal welcome if no note is open
    if (window.app && !window.app.currentNote) {
      const personalWelcome = document.getElementById('welcome-screen');
      if (personalWelcome) personalWelcome.style.display = '';
    }
  }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  window.orgWelcome = new OrgWelcome();
});

console.log('✅ org-welcome.js loaded');
