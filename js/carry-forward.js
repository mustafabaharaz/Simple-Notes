/* ============================================
   CARRY-FORWARD.JS — Action Item Carry-Forward
   Phase 5 — Additive only, zero core edits
   ============================================ */

class CarryForward {
  constructor() {
    this.init();
  }

  /* ------------------------------------------
     INIT
     Waits for meetingNotes to be ready,
     then patches createMeeting
  ------------------------------------------ */

  init() {
    this.patchWhenReady();
    this.watchForCarriedBadges();
    console.log('✅ CarryForward initialized');
  }

  patchWhenReady() {
    const tryPatch = () => {
      if (window.meetingNotes) {
        this.patchCreateMeeting();
      } else {
        setTimeout(tryPatch, 100);
      }
    };
    tryPatch();
  }

  /* ------------------------------------------
     PATCH window.meetingNotes.createMeeting
     After a new meeting is created, check
     for open items in previous meetings
  ------------------------------------------ */

  patchCreateMeeting() {
    if (window.meetingNotes.__cfPatched) return;
    window.meetingNotes.__cfPatched = true;

    const original = window.meetingNotes.createMeeting.bind(window.meetingNotes);

    window.meetingNotes.createMeeting = () => {
      const note = original();

      // Small delay so the new meeting editor has time to render
      setTimeout(() => {
        if (note && note.id) this.checkForOpenItems(note.id);
      }, 300);

      return note;
    };
  }

  /* ------------------------------------------
     CHECK FOR OPEN ITEMS
     Gather all open action items from
     every meeting EXCEPT the new one
  ------------------------------------------ */

  checkForOpenItems(newNoteId) {
    if (!window.meetingNotes) return;

    const openItems = [];

    window.meetingNotes.getAllMeetings().forEach(({ note, data }) => {
      if (note.id === newNoteId) return;
      (data?.actionItems || []).forEach(item => {
        if (item.status !== 'done') {
          openItems.push({
            ...item,
            sourceMeetingTitle: note.title,
            sourceMeetingId:    note.id
          });
        }
      });
    });

    if (openItems.length === 0) return;

    this.showModal(newNoteId, openItems);
  }

  /* ------------------------------------------
     CARRY-FORWARD MODAL
  ------------------------------------------ */

  showModal(newNoteId, openItems) {
    document.getElementById('carry-forward-modal')?.remove();

    const modal = document.createElement('div');
    modal.id = 'carry-forward-modal';
    modal.className = 'phase5-modal-overlay';

    const itemRows = openItems.map(item => {
      const due      = item.due      ? ` — due ${this.formatDate(item.due)}` : '';
      const assignee = item.assignee ? ` → ${item.assignee}` : '';
      return `
        <label class="cf-item-row">
          <input
            type="checkbox"
            class="cf-checkbox"
            data-item-id="${this.esc(item.id)}"
            data-source-id="${this.esc(item.sourceMeetingId)}"
            checked
          />
          <div class="cf-item-body">
            <span class="cf-item-text">${this.esc(item.text)}</span>
            <span class="cf-item-meta">${this.esc(item.sourceMeetingTitle)}${assignee}${due}</span>
          </div>
        </label>
      `;
    }).join('');

    const count = openItems.length;
    const label = count === 1 ? '1 open item' : `${count} open items`;

    modal.innerHTML = `
      <div class="phase5-modal phase5-modal--cf">
        <div class="phase5-modal-header">
          <div class="phase5-modal-title">↩ Carry Forward Open Items?</div>
          <button class="phase5-modal-close" id="cf-close-btn">✕</button>
        </div>
        <div class="phase5-modal-subtitle">
          You have ${label} from previous meetings still open.
          Select which ones to bring into this meeting.
        </div>
        <div class="cf-items-list">
          ${itemRows}
        </div>
        <div class="phase5-modal-footer">
          <button class="phase5-btn-ghost" id="cf-skip-btn">Skip</button>
          <div class="phase5-modal-actions">
            <button class="phase5-btn-primary" id="cf-confirm-btn">↩ Carry Forward Selected</button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    this.bindModalEvents(modal, newNoteId, openItems);
  }

  /* ------------------------------------------
     BIND MODAL EVENTS
  ------------------------------------------ */

  bindModalEvents(modal, newNoteId, openItems) {
    const close = () => modal.remove();

    modal.querySelector('#cf-close-btn').addEventListener('click', close);
    modal.querySelector('#cf-skip-btn').addEventListener('click', close);
    modal.addEventListener('click', (e) => { if (e.target === modal) close(); });

    const onKeyDown = (e) => {
      if (e.key === 'Escape') { close(); document.removeEventListener('keydown', onKeyDown); }
    };
    document.addEventListener('keydown', onKeyDown);

    modal.querySelector('#cf-confirm-btn').addEventListener('click', () => {
      const checked     = modal.querySelectorAll('.cf-checkbox:checked');
      const selectedIds = new Set([...checked].map(cb => cb.dataset.itemId));
      const selected    = openItems.filter(i => selectedIds.has(i.id));

      if (selected.length > 0) {
        this.carryItemsInto(newNoteId, selected);
      }

      close();
    });
  }

  /* ------------------------------------------
     CARRY ITEMS INTO NEW MEETING
  ------------------------------------------ */

  carryItemsInto(newNoteId, items) {
    const note = storage.getNote(newNoteId);
    if (!note) return;

    let data;
    try { data = JSON.parse(note.content || '{}'); } catch (e) { data = {}; }
    if (!data.actionItems) data.actionItems = [];

    items.forEach(item => {
      data.actionItems.push({
        id:            'cf_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
        text:          item.text,
        assignee:      item.assignee || '',
        due:           item.due || '',
        status:        'open',
        createdAt:     new Date().toISOString(),
        carriedFrom:   item.sourceMeetingTitle,
        carriedFromId: item.sourceMeetingId
      });
    });

    storage.updateNote(newNoteId, { content: JSON.stringify(data) });

    // Trigger ActionItems to re-render with the new data
    this.triggerActionItemsRerender(newNoteId, data);

    const n = items.length;
    showToast(`↩ ${n} item${n > 1 ? 's' : ''} carried forward`);
  }

  /* ------------------------------------------
     TRIGGER ACTION ITEMS RE-RENDER
     Calls window.actionItems.renderActionItems
     directly if meeting editor is open
  ------------------------------------------ */

  triggerActionItemsRerender(noteId, data) {
    const container = document.getElementById('meeting-action-list');
    if (!container || !window.actionItems) return;

    // Clear the rendered flag so ActionItems will re-render
    delete container.dataset.aiRendered;

    // Call renderActionItems directly
    window.actionItems.renderActionItems(noteId, data);
  }

  /* ------------------------------------------
     MUTATION OBSERVER — CARRIED BADGES
     Watches for action item rows and appends
     the ↩ carried-from badge when applicable
  ------------------------------------------ */

  watchForCarriedBadges() {
    const observer = new MutationObserver(() => {
      const noteId = window.meetingNotes?.activeMeetingId;
      if (!noteId) return;

      const data = window.meetingNotes.getMeetingData(noteId);
      if (!data?.actionItems) return;

      document.querySelectorAll('.action-item-row').forEach(row => {
        if (row.dataset.cfBadged) return;

        const actionId = row.dataset.actionId;
        const item = data.actionItems.find(i => i.id === actionId);

        if (item?.carriedFrom) {
          row.dataset.cfBadged = 'true';

          const badge = document.createElement('span');
          badge.className = 'cf-carried-badge';
          badge.title = `Carried from: ${item.carriedFrom}`;
          badge.textContent = `↩ ${item.carriedFrom}`;

          const body = row.querySelector('.action-item-body');
          if (body) body.appendChild(badge);
        }
      });
    });

    observer.observe(document.body, { childList: true, subtree: true });
  }

  /* ------------------------------------------
     HELPERS
  ------------------------------------------ */

  formatDate(dateStr) {
    try {
      return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', {
        month: 'short', day: 'numeric'
      });
    } catch (e) { return dateStr; }
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
  window.carryForward = new CarryForward();
});

console.log('✅ carry-forward.js loaded');
