/* ============================================
   ORG-MODE.JS — Workspace Toggle & Org Sidebar
   Phase 2 — Additive only, zero core edits
   ============================================ */

class OrgMode {
  constructor() {
    this.STORAGE_KEY = 'simple_notes_workspace';
    this.currentWorkspace = this.loadWorkspace();
    this.currentOrgView = 'meetings'; // meetings | actions | reports

    this.init();
  }

  /* ------------------------------------------
     INIT
  ------------------------------------------ */

  init() {
    this.injectToggle();
    this.injectOrgSidebar();
    this.injectOrgBanner();
    this.applyWorkspace(this.currentWorkspace, false);
    this.bindEvents();
    console.log('🏢 OrgMode initialized — workspace:', this.currentWorkspace);
  }

  /* ------------------------------------------
     PERSISTENCE
  ------------------------------------------ */

  loadWorkspace() {
    try {
      return localStorage.getItem(this.STORAGE_KEY) || 'personal';
    } catch (e) {
      return 'personal';
    }
  }

  saveWorkspace(workspace) {
    try {
      localStorage.setItem(this.STORAGE_KEY, workspace);
    } catch (e) {
      console.warn('Could not save workspace preference');
    }
  }

  /* ------------------------------------------
     DOM INJECTION — WORKSPACE TOGGLE
  ------------------------------------------ */

  injectToggle() {
    const sidebarHeader = document.querySelector('.sidebar-header');
    if (!sidebarHeader || document.getElementById('workspace-toggle-wrapper')) return;

    const wrapper = document.createElement('div');
    wrapper.className = 'workspace-toggle-wrapper';
    wrapper.id = 'workspace-toggle-wrapper';
    wrapper.innerHTML = `
      <div class="workspace-toggle" id="workspace-toggle" role="tablist" aria-label="Workspace mode">
        <button
          class="workspace-tab personal-tab"
          id="tab-personal"
          role="tab"
          aria-selected="true"
          data-workspace="personal"
          title="Personal notes"
        >
          <span class="workspace-tab-icon">📝</span>
          Personal
        </button>
        <button
          class="workspace-tab org-tab"
          id="tab-org"
          role="tab"
          aria-selected="false"
          data-workspace="org"
          title="Org / Team mode"
        >
          <span class="workspace-tab-icon">🏢</span>
          Org
        </button>
      </div>
    `;

    // Insert after the sidebar-header
    sidebarHeader.insertAdjacentElement('afterend', wrapper);
  }

  /* ------------------------------------------
     DOM INJECTION — ORG SIDEBAR SECTIONS
  ------------------------------------------ */

  injectOrgSidebar() {
    if (document.getElementById('org-sidebar-sections')) return;

    // Wrap existing personal sidebar content
    this.wrapPersonalContent();

    // Create org sidebar sections
    const orgSections = document.createElement('div');
    orgSections.className = 'org-sidebar-sections';
    orgSections.id = 'org-sidebar-sections';
    orgSections.innerHTML = `
      <nav class="org-nav" id="org-nav" aria-label="Org navigation">

        <div class="org-section-label">Workspace</div>

        <button class="org-nav-item active" data-view="meetings" aria-label="Meetings">
          <span class="org-nav-icon">📅</span>
          <span class="org-nav-label">Meetings</span>
          <span class="org-nav-count" id="org-count-meetings">0</span>
        </button>

        <button class="org-nav-item" data-view="actions" aria-label="Action Items">
          <span class="org-nav-icon">✅</span>
          <span class="org-nav-label">Action Items</span>
          <span class="org-nav-count" id="org-count-actions">0</span>
        </button>

        <button class="org-nav-item" data-view="reports" aria-label="Activity Reports">
          <span class="org-nav-icon">📊</span>
          <span class="org-nav-label">Reports</span>
          <span class="org-nav-count" id="org-count-reports">0</span>
        </button>

      </nav>

      <div class="org-section-divider"></div>
      <div class="org-section-label">Recent Meetings</div>

      <div id="org-meetings-mini-list" class="org-nav" style="padding-top: 4px;">
        <!-- populated by meeting-notes.js -->
        <div class="org-empty-state" style="padding: 20px 12px;">
          <div class="org-empty-icon">📅</div>
          <div class="org-empty-title">No meetings yet</div>
          <div class="org-empty-desc">Start your first meeting note below</div>
        </div>
      </div>

      <div class="org-sidebar-footer">
        <button class="btn-new-meeting" id="btn-new-meeting">
          <span>＋</span>
          New Meeting
        </button>
      </div>
    `;

    const sidebar = document.querySelector('.sidebar');
    if (sidebar) {
      sidebar.appendChild(orgSections);
    }
  }

  /* ------------------------------------------
     WRAP PERSONAL CONTENT
  ------------------------------------------ */

  wrapPersonalContent() {
    const sidebar = document.querySelector('.sidebar');
    if (!sidebar || document.querySelector('.personal-sidebar-content')) return;

    const sidebarHeader = document.querySelector('.sidebar-header');
    const toggleWrapper = document.getElementById('workspace-toggle-wrapper');

    // Collect all sidebar children that are NOT header or toggle
    const personalChildren = [];
    sidebar.childNodes.forEach(node => {
      if (
        node !== sidebarHeader &&
        node !== toggleWrapper &&
        node.nodeType === Node.ELEMENT_NODE
      ) {
        personalChildren.push(node);
      }
    });

    // Create wrapper
    const wrapper = document.createElement('div');
    wrapper.className = 'personal-sidebar-content';
    wrapper.id = 'personal-sidebar-content';

    // Move children into wrapper
    personalChildren.forEach(child => wrapper.appendChild(child));

    // Append wrapper to sidebar
    sidebar.appendChild(wrapper);
  }

  /* ------------------------------------------
     DOM INJECTION — ORG BANNER (main content)
  ------------------------------------------ */

  injectOrgBanner() {
    if (document.getElementById('org-mode-banner')) return;

    const mainContent = document.querySelector('.main-content');
    if (!mainContent) return;

    const banner = document.createElement('div');
    banner.className = 'org-mode-banner';
    banner.id = 'org-mode-banner';
    banner.innerHTML = `
      <span class="org-mode-banner-icon">🏢</span>
      <span>Org Mode</span>
      <span class="org-mode-banner-dot"></span>
    `;

    mainContent.insertAdjacentElement('afterbegin', banner);
  }

  /* ------------------------------------------
     APPLY WORKSPACE
  ------------------------------------------ */

  applyWorkspace(workspace, animate = true) {
    this.currentWorkspace = workspace;
    this.saveWorkspace(workspace);

    const sidebar = document.querySelector('.sidebar');
    const personalContent = document.getElementById('personal-sidebar-content');
    const orgSections = document.getElementById('org-sidebar-sections');
    const orgBanner = document.getElementById('org-mode-banner');
    const tabPersonal = document.getElementById('tab-personal');
    const tabOrg = document.getElementById('tab-org');

    if (!sidebar) return;

    if (workspace === 'org') {
      // Activate org mode
      sidebar.classList.add('org-active');
      if (personalContent) personalContent.style.display = 'none';
      if (orgSections) orgSections.classList.add('visible');
      if (orgBanner) orgBanner.classList.add('visible');

      // Update tabs
      if (tabPersonal) { tabPersonal.classList.remove('active'); tabPersonal.setAttribute('aria-selected', 'false'); }
      if (tabOrg) { tabOrg.classList.add('active'); tabOrg.setAttribute('aria-selected', 'true'); }

    } else {
      // Activate personal mode
      sidebar.classList.remove('org-active');
      if (personalContent) personalContent.style.display = '';
      if (orgSections) orgSections.classList.remove('visible');
      if (orgBanner) orgBanner.classList.remove('visible');

      // Update tabs
      if (tabOrg) { tabOrg.classList.remove('active'); tabOrg.setAttribute('aria-selected', 'false'); }
      if (tabPersonal) { tabPersonal.classList.add('active'); tabPersonal.setAttribute('aria-selected', 'true'); }
    }

    // Dispatch event so other modules can react
    document.dispatchEvent(new CustomEvent('workspaceChanged', {
      detail: { workspace }
    }));
  }

  /* ------------------------------------------
     ORG VIEW NAVIGATION
  ------------------------------------------ */

  switchOrgView(view) {
    this.currentOrgView = view;

    // Update nav active state
    document.querySelectorAll('.org-nav-item[data-view]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.view === view);
    });

    // Dispatch event so panels can react
    document.dispatchEvent(new CustomEvent('orgViewChanged', {
      detail: { view }
    }));
  }

  /* ------------------------------------------
     UPDATE COUNTS
  ------------------------------------------ */

  updateCount(view, count) {
    const el = document.getElementById(`org-count-${view}`);
    if (el) el.textContent = count;
  }

  /* ------------------------------------------
     EVENTS
  ------------------------------------------ */

  bindEvents() {
    // Workspace tab clicks
    document.addEventListener('click', (e) => {
      const tab = e.target.closest('.workspace-tab[data-workspace]');
      if (tab) {
        this.applyWorkspace(tab.dataset.workspace);
        return;
      }

      // Org nav view clicks
      const navItem = e.target.closest('.org-nav-item[data-view]');
      if (navItem) {
        this.switchOrgView(navItem.dataset.view);
        return;
      }

      // New Meeting button
      if (e.target.closest('#btn-new-meeting')) {
        document.dispatchEvent(new CustomEvent('newMeetingRequested'));
        return;
      }
    });

    // Keyboard shortcut: Ctrl/Cmd + Shift + O = toggle workspace
    document.addEventListener('keydown', (e) => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.shiftKey && e.key.toLowerCase() === 'o') {
        e.preventDefault();
        const next = this.currentWorkspace === 'personal' ? 'org' : 'personal';
        this.applyWorkspace(next);
      }
    });
  }

  /* ------------------------------------------
     PUBLIC API
  ------------------------------------------ */

  isOrgMode() {
    return this.currentWorkspace === 'org';
  }

  getCurrentView() {
    return this.currentOrgView;
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.orgMode = new OrgMode();
});

console.log('✅ org-mode.js loaded');
