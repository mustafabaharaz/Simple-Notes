/* ============================================
   ACTION-ITEMS-PANEL.JS — Unified Action Items View
   Phase 2 — Additive only, zero core edits
   ============================================ */

class ActionItemsPanel {
  constructor() {
    this.activeFilter = 'all'; // all | open | in-progress | done
    this.init();
  }

  /* ------------------------------------------
     INIT
  ------------------------------------------ */

  init() {
    this.injectPanel();
    this.bindEvents();
    console.log('✅ ActionItemsPanel initialized');
  }

  /* ------------------------------------------
     INJECT PANEL into main content area
  ------------------------------------------ */

  injectPanel() {
    if (document.getElementById('org-actions-panel')) return;

    const mainContent = document.querySelector('.main-content');
    if (!mainContent) return;

    const panel = document.createElement('div');
    panel.id = 'org-actions-panel';
    panel.className = 'org-panel';
    panel.innerHTML = `
      <div class="org-panel-header">
        <div class="org-panel-title">
          ✅ Action Items
        </div>
        <div class="aip-filter-row" id="aip-filter-row">
          <button class="aip-filter-btn active" data-filter="all">All</button>
          <button class="aip-filter-btn" data-filter="open">
            <span class="aip-filter-dot dot-open"></span>Open
          </button>
          <button class="aip-filter-btn" data-filter="in-progress">
            <span class="aip-filter-dot dot-in-progress"></span>In Progress
          </button>
          <button class="aip-filter-btn" data-filter="done">
            <span class="aip-filter-dot dot-done"></span>Done
          </button>
        </div>
      </div>

      <div class="org-panel-body" id="aip-body">
        <!-- populated by render() -->
      </div>
    `;

    mainContent.appendChild(panel);
  }

  /* ------------------------------------------
     RENDER
  ------------------------------------------ */

  render() {
    const body = document.getElementById('aip-body');
    if (!body) return;

    const all = window.actionItems?.getAllActionItems() || [];

    // Apply filter
    const filtered = this.activeFilter === 'all'
      ? all
      : all.filter(i => (i.status || 'open') === this.activeFilter);

    // Update total count badge in sidebar
    const openCount = all.filter(i => (i.status || 'open') !== 'done').length;
    if (window.orgMode) window.orgMode.updateCount('actions', openCount);

    if (filtered.length === 0) {
      body.innerHTML = this.emptyStateHTML();
      return;
    }

    // Group by meeting
    const grouped = this.groupByMeeting(filtered);

    body.innerHTML = Object.entries(grouped).map(([meetingId, { title, items }]) => `
      <div class="aip-meeting-group">
        <div class="aip-meeting-label">
          <span class="aip-meeting-icon">📅</span>
          <span class="aip-meeting-title">${this.esc(title)}</span>
          <span class="aip-meeting-count">${items.length}</span>
        </div>
        <div class="aip-items-list">
          ${items.map(item => this.itemRowHTML(item)).join('')}
        </div>
      </div>
    `).join('');

    // Bind status toggles
    body.querySelectorAll('.aip-status-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.cycleStatus(btn.dataset.meetingId, btn.dataset.actionId);
      });
    });

    // Click meeting title → open that meeting note
    body.querySelectorAll('.aip-meeting-label[data-meeting-id]').forEach(el => {
      el.addEventListener('click', () => {
        const note = storage.getNote(el.dataset.meetingId);
        if (note) window.meetingNotes?.openMeetingNote(note);
      });
    });
  }

  /* ------------------------------------------
     ROW HTML
  ------------------------------------------ */

  itemRowHTML(item) {
    const status  = item.status || 'open';
    const overdue = this.isOverdue(item);

    return `
      <div class="aip-item-row status-${status}" data-action-id="${item.id}">
        <button
          class="aip-status-btn"
          data-action-id="${item.id}"
          data-meeting-id="${item.meetingId}"
          title="Cycle status"
        >
          ${this.statusIcon(status)}
        </button>

        <div class="aip-item-body">
          <span class="aip-item-text ${status === 'done' ? 'aip-done-text' : ''}">
            ${this.esc(item.text)}
          </span>
          <div class="aip-item-meta">
            ${item.assignee
              ? `<span class="aip-meta-assignee">
                   <span class="aip-assignee-avatar">${this.initials(item.assignee)}</span>
                   ${this.esc(item.assignee)}
                 </span>`
              : ''}
            ${item.due
              ? `<span class="aip-meta-due ${overdue ? 'aip-overdue' : ''}">
                   ${overdue ? '⚠' : '📅'} ${this.formatDate(item.due)}
                 </span>`
              : ''}
            <span class="aip-status-pill status-pill-${status}">
              ${this.statusLabel(status)}
            </span>
          </div>
        </div>
      </div>
    `;
  }

  /* ------------------------------------------
     CYCLE STATUS from panel
  ------------------------------------------ */

  cycleStatus(meetingId, actionId) {
    const note = storage.getNote(meetingId);
    if (!note) return;

    let data;
    try { data = JSON.parse(note.content || '{}'); } catch (e) { return; }

    const item = (data.actionItems || []).find(i => i.id === actionId);
    if (!item) return;

    const cycle = { open: 'in-progress', 'in-progress': 'done', done: 'open' };
    item.status = cycle[item.status || 'open'] || 'open';

    storage.updateNote(meetingId, { content: JSON.stringify(data) });
    this.render();

    // If this meeting is currently open, re-render its action items too
    if (window.meetingNotes?.activeMeetingId === meetingId && window.actionItems) {
      window.actionItems.renderActionItems(meetingId, data);
    }
  }

  /* ------------------------------------------
     EMPTY STATE
  ------------------------------------------ */

  emptyStateHTML() {
    const messages = {
      all:         { icon: '✅', title: 'No action items yet', desc: 'Action items you create inside meeting notes will appear here.' },
      open:        { icon: '○',  title: 'No open items',       desc: 'Everything is either in progress or done.' },
      'in-progress': { icon: '◑', title: 'Nothing in progress', desc: 'Move items from Open to start tracking them.' },
      done:        { icon: '✓',  title: 'Nothing done yet',    desc: 'Completed items will show up here.' }
    };
    const m = messages[this.activeFilter] || messages.all;
    return `
      <div class="aip-empty">
        <div class="aip-empty-icon">${m.icon}</div>
        <div class="aip-empty-title">${m.title}</div>
        <div class="aip-empty-desc">${m.desc}</div>
      </div>
    `;
  }

  /* ------------------------------------------
     SHOW / HIDE PANEL
  ------------------------------------------ */

  show() {
    // Hide other org panels
    document.querySelectorAll('.org-panel').forEach(p => p.classList.remove('active'));
    document.getElementById('org-actions-panel')?.classList.add('active');

    // Hide personal editor chrome
    this.setEditorVisibility(false);

    this.render();
  }

  hide() {
    document.getElementById('org-actions-panel')?.classList.remove('active');
    this.setEditorVisibility(true);
  }

  setEditorVisibility(show) {
    const toolbar     = document.querySelector('.toolbar');
    const noteHeader  = document.querySelector('.note-header');
    const noteContent = document.getElementById('note-content');
    const welcome     = document.getElementById('welcome-screen');
    const meetingEd   = document.getElementById('meeting-editor');

    [toolbar, noteHeader, noteContent].forEach(el => {
      if (el) el.style.display = show ? '' : 'none';
    });

    if (!show) {
      if (welcome)   welcome.style.display = 'none';
      if (meetingEd) meetingEd.style.display = 'none';
    }
  }

  /* ------------------------------------------
     EVENTS
  ------------------------------------------ */

  bindEvents() {
    // Filter buttons
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('.aip-filter-btn[data-filter]');
      if (!btn) return;
      document.querySelectorAll('.aip-filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      this.activeFilter = btn.dataset.filter;
      this.render();
    });

    // Org nav "Action Items" click
    document.addEventListener('orgViewChanged', ({ detail }) => {
      if (detail.view === 'actions') {
        this.show();
      } else {
        this.hide();
      }
    });

    // Re-render when workspace switches to org
    document.addEventListener('workspaceChanged', ({ detail }) => {
      if (detail.workspace === 'org' && window.orgMode?.getCurrentView() === 'actions') {
        this.show();
      }
    });
  }

  /* ------------------------------------------
     HELPERS
  ------------------------------------------ */

  groupByMeeting(items) {
    const groups = {};
    items.forEach(item => {
      if (!groups[item.meetingId]) {
        groups[item.meetingId] = { title: item.meetingTitle, items: [] };
      }
      groups[item.meetingId].items.push(item);
    });
    return groups;
  }

  isOverdue(item) {
    if (!item.due || item.status === 'done') return false;
    return new Date(item.due) < new Date(new Date().toDateString());
  }

  formatDate(dateStr) {
    try {
      return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', {
        month: 'short', day: 'numeric'
      });
    } catch (e) { return dateStr; }
  }

  initials(name) {
    return String(name).split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  }

  statusIcon(status) {
    const icons = {
      open:          '<span class="status-icon status-open">○</span>',
      'in-progress': '<span class="status-icon status-in-progress">◑</span>',
      done:          '<span class="status-icon status-done">✓</span>'
    };
    return icons[status] || icons.open;
  }

  statusLabel(status) {
    const labels = { open: 'Open', 'in-progress': 'In Progress', done: 'Done' };
    return labels[status] || 'Open';
  }

  esc(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  window.actionItemsPanel = new ActionItemsPanel();
});

console.log('✅ action-items-panel.js loaded');
