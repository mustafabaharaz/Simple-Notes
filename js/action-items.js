/* ============================================
   ACTION-ITEMS.JS — Action Item Tracking
   Phase 2 — Additive only, zero core edits
   ============================================ */

class ActionItems {
  constructor() {
    this._saveTimer = null;
    this.init();
  }

  /* ------------------------------------------
     INIT — MutationObserver watches for the
     meeting editor to appear in the DOM, then
     renders action items. No timing race.
  ------------------------------------------ */

  init() {
    this.watchForMeetingEditor();
    this.bindGlobalEvents();
    console.log('✅ ActionItems initialized');
  }

  /* ------------------------------------------
     MUTATION OBSERVER
     Fires every time #meeting-action-list
     appears (i.e. every time a meeting opens)
  ------------------------------------------ */

  watchForMeetingEditor() {
    const observer = new MutationObserver(() => {
      const container = document.getElementById('meeting-action-list');
      if (!container || container.dataset.aiRendered === 'true') return;

      // Find the active meeting note id
      const noteId = window.meetingNotes?.activeMeetingId;
      if (!noteId) return;

      const data = window.meetingNotes.getMeetingData(noteId);
      if (!data) return;

      // Mark so we don't double-render
      container.dataset.aiRendered = 'true';

      this.renderActionItems(noteId, data);
    });

    observer.observe(document.body, { childList: true, subtree: true });
    this._observer = observer;
  }

  /* ------------------------------------------
     RENDER ACTION ITEMS LIST
  ------------------------------------------ */

  renderActionItems(noteId, data) {
    const container = document.getElementById('meeting-action-list');
    if (!container) return;

    // Remove placeholder
    document.getElementById('action-items-placeholder')?.remove();

    // Clear and rebuild
    container.innerHTML = '';

    // Existing items
    (data.actionItems || []).forEach(item => {
      container.appendChild(this.buildActionRow(item, noteId, data));
    });

    // "Add" row always at the bottom
    container.appendChild(this.buildAddRow(noteId, data));

    // Wire add-action button in section header
    const addBtn = document.getElementById('add-action-btn');
    if (addBtn) {
      addBtn.onclick = () => this.focusAddRow();
    }

    this.refreshOrgCount(data);
  }

  /* ------------------------------------------
     BUILD ACTION ROW (existing item)
  ------------------------------------------ */

  buildActionRow(item, noteId, data) {
    const row = document.createElement('div');
    row.className = `action-item-row status-${item.status || 'open'}`;
    row.dataset.actionId = item.id;

    row.innerHTML = `
      <button class="action-status-btn" data-action-id="${item.id}" title="Cycle status: Open → In Progress → Done">
        ${this.statusIcon(item.status)}
      </button>

      <div class="action-item-body">
        <input
          type="text"
          class="action-item-text"
          value="${this.esc(item.text)}"
          placeholder="Action item…"
          autocomplete="off"
          data-action-id="${item.id}"
        />
        <div class="action-item-meta">
          <input
            type="text"
            class="action-assignee-input"
            value="${this.esc(item.assignee || '')}"
            placeholder="Assignee"
            autocomplete="off"
            data-action-id="${item.id}"
            title="Who owns this?"
          />
          <input
            type="date"
            class="action-due-input"
            value="${item.due || ''}"
            data-action-id="${item.id}"
            title="Due date"
          />
          <span class="action-status-label status-label-${item.status || 'open'}">
            ${this.statusLabel(item.status)}
          </span>
        </div>
      </div>

      <button class="action-delete-btn" data-action-id="${item.id}" title="Delete">✕</button>
    `;

    this.bindRowEvents(row, noteId, data);
    return row;
  }

  /* ------------------------------------------
     BUILD ADD ROW
  ------------------------------------------ */

  buildAddRow(noteId, data) {
    const row = document.createElement('div');
    row.className = 'action-add-row';
    row.id = 'action-add-row';

    row.innerHTML = `
      <span class="action-add-icon">＋</span>
      <input
        type="text"
        id="action-add-input"
        class="action-add-input"
        placeholder="Add action item and press Enter…"
        autocomplete="off"
      />
      <input
        type="text"
        id="action-add-assignee"
        class="action-add-assignee"
        placeholder="Assignee"
        autocomplete="off"
      />
      <input
        type="date"
        id="action-add-due"
        class="action-add-due"
        title="Due date"
      />
      <button class="action-add-confirm" id="action-add-confirm">Add</button>
    `;

    const confirm = () => {
      const textEl   = row.querySelector('#action-add-input');
      const assignEl = row.querySelector('#action-add-assignee');
      const dueEl    = row.querySelector('#action-add-due');

      const text = textEl.value.trim();
      if (!text) { textEl.focus(); return; }

      const newItem = {
        id:        'ai_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
        text,
        assignee:  assignEl.value.trim(),
        due:       dueEl.value,
        status:    'open',
        createdAt: new Date().toISOString()
      };

      if (!data.actionItems) data.actionItems = [];
      data.actionItems.push(newItem);

      // Clear inputs
      textEl.value   = '';
      assignEl.value = '';
      dueEl.value    = '';

      this.renderActionItems(noteId, data);
      this.save(noteId, data);

      // Refocus add input after re-render
      setTimeout(() => document.getElementById('action-add-input')?.focus(), 20);
    };

    row.querySelector('#action-add-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); confirm(); }
    });
    row.querySelector('#action-add-confirm').addEventListener('click', confirm);

    return row;
  }

  focusAddRow() {
    document.getElementById('action-add-input')?.focus();
  }

  /* ------------------------------------------
     BIND ROW EVENTS
  ------------------------------------------ */

  bindRowEvents(row, noteId, data) {
    const id = row.dataset.actionId;

    // Status cycle
    row.querySelector('.action-status-btn').addEventListener('click', () => {
      const item = data.actionItems.find(i => i.id === id);
      if (!item) return;
      item.status = this.nextStatus(item.status);
      this.renderActionItems(noteId, data);
      this.save(noteId, data);
    });

    // Text
    row.querySelector('.action-item-text').addEventListener('input', (e) => {
      const item = data.actionItems.find(i => i.id === id);
      if (item) { item.text = e.target.value; this.scheduleSave(noteId, data); }
    });

    // Assignee
    row.querySelector('.action-assignee-input').addEventListener('input', (e) => {
      const item = data.actionItems.find(i => i.id === id);
      if (item) { item.assignee = e.target.value; this.scheduleSave(noteId, data); }
    });

    // Due date
    row.querySelector('.action-due-input').addEventListener('change', (e) => {
      const item = data.actionItems.find(i => i.id === id);
      if (item) { item.due = e.target.value; this.save(noteId, data); }
    });

    // Delete
    row.querySelector('.action-delete-btn').addEventListener('click', () => {
      data.actionItems = data.actionItems.filter(i => i.id !== id);
      this.renderActionItems(noteId, data);
      this.save(noteId, data);
    });
  }

  /* ------------------------------------------
     STATUS HELPERS
  ------------------------------------------ */

  nextStatus(current) {
    const cycle = { open: 'in-progress', 'in-progress': 'done', done: 'open' };
    return cycle[current] || 'open';
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

  /* ------------------------------------------
     SAVE
  ------------------------------------------ */

  scheduleSave(noteId, data) {
    clearTimeout(this._saveTimer);
    this._saveTimer = setTimeout(() => this.save(noteId, data), 800);
  }

  save(noteId, data) {
    storage.updateNote(noteId, { content: JSON.stringify(data) });
    const status = document.getElementById('meeting-save-status');
    if (status) status.textContent = 'All changes saved';
    this.refreshOrgCount(data);
  }

  /* ------------------------------------------
     ORG SIDEBAR COUNT
  ------------------------------------------ */

  refreshOrgCount(data) {
    const open = (data.actionItems || []).filter(i => i.status !== 'done').length;
    if (window.orgMode) window.orgMode.updateCount('actions', open);
  }

  /* ------------------------------------------
     GLOBAL EVENTS
  ------------------------------------------ */

  bindGlobalEvents() {
    // Nothing extra needed — MutationObserver handles all cases
  }

  /* ------------------------------------------
     PUBLIC: all action items across meetings
  ------------------------------------------ */

  getAllActionItems() {
    if (!window.meetingNotes) return [];
    const results = [];
    window.meetingNotes.getAllMeetings().forEach(({ note, data }) => {
      if (!data?.actionItems) return;
      data.actionItems.forEach(item => {
        results.push({ ...item, meetingTitle: note.title, meetingId: note.id });
      });
    });
    return results;
  }

  /* ------------------------------------------
     UTIL
  ------------------------------------------ */

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
  window.actionItems = new ActionItems();
});

console.log('✅ action-items.js loaded');
