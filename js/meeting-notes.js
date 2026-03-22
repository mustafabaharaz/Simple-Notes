/* ============================================
   MEETING-NOTES.JS — Structured Meeting Notes
   Phase 2 — Additive only, zero core edits
   ============================================ */

class MeetingNotes {
  constructor() {
    this.activeMeetingId = null;
    this.saveTimer = null;

    this.init();
  }

  /* ------------------------------------------
     INIT
  ------------------------------------------ */

  init() {
    // Wait for app to be ready
    const ready = () => {
      this.patchOpenNote();
      this.bindEvents();
      this.refreshMiniList();
      console.log('📅 MeetingNotes initialized');
    };

    if (window.app) {
      ready();
    } else {
      // app.js initializes on DOMContentLoaded — wait a tick
      window.addEventListener('load', ready);
    }
  }

  /* ------------------------------------------
     PATCH window.app.openNote
     Intercept opens for meeting-type notes
  ------------------------------------------ */

  patchOpenNote() {
    if (!window.app || window.app.__meetingPatched) return;
    window.app.__meetingPatched = true;

    const original = window.app.openNote.bind(window.app);

    window.app.openNote = (id) => {
      const note = storage.getNote(id);

      if (note && note.type === 'meeting') {
        this.openMeetingNote(note);
      } else {
        this.closeMeetingEditor();
        original(id);
      }
    };
  }

  /* ------------------------------------------
     CREATE NEW MEETING NOTE
  ------------------------------------------ */

  createMeeting() {
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-US', {
      weekday: 'short', year: 'numeric', month: 'short', day: 'numeric'
    });
    const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

    const meetingData = {
      date: now.toISOString().split('T')[0],
      time: timeStr,
      attendees: [],
      agendaItems: [
        this.newAgendaItem('Opening / Check-in'),
        this.newAgendaItem(''),
        this.newAgendaItem('Next steps')
      ],
      actionItems: [],
      summary: '',
      decisions: ''
    };

    const title = `Meeting — ${dateStr}`;
    const note = storage.createNote(title, JSON.stringify(meetingData));
    storage.updateNote(note.id, { type: 'meeting' });

    privacyMonitor.trackNoteCreated();

    this.refreshMiniList();

    // Switch to org mode if not already
    if (window.orgMode && !window.orgMode.isOrgMode()) {
      window.orgMode.applyWorkspace('org');
    }

    // Re-patch in case app was re-initialized
    this.patchOpenNote();

    // Open immediately
    setTimeout(() => {
      const fresh = storage.getNote(note.id);
      if (fresh) this.openMeetingNote(fresh);
    }, 50);

    showToast('📅 New meeting note created');
    return note;
  }

  newAgendaItem(title = '') {
    return {
      id: 'ag_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      title,
      notes: '',
      completed: false
    };
  }

  /* ------------------------------------------
     OPEN MEETING NOTE — render structured UI
  ------------------------------------------ */

  openMeetingNote(note) {
    this.activeMeetingId = note.id;

    // Parse meeting data
    let data;
    try {
      data = JSON.parse(note.content || '{}');
    } catch (e) {
      data = {};
    }

    // Ensure fields exist
    data.date        = data.date || new Date().toISOString().split('T')[0];
    data.time        = data.time || '';
    data.attendees   = data.attendees || [];
    data.agendaItems = data.agendaItems || [this.newAgendaItem('')];
    data.actionItems = data.actionItems || [];
    data.summary     = data.summary || '';
    data.decisions   = data.decisions || '';

    // Hide personal editor chrome
    this.setEditorVisibility(false);

    // Show / build meeting editor
    this.renderMeetingEditor(note, data);

    // Highlight in sidebar
    this.highlightMiniListItem(note.id);
  }

  /* ------------------------------------------
     EDITOR VISIBILITY TOGGLE
  ------------------------------------------ */

  setEditorVisibility(show) {
    const toolbar    = document.querySelector('.toolbar');
    const noteHeader = document.querySelector('.note-header');
    const noteContent = document.getElementById('note-content');
    const canvas     = document.getElementById('drawing-canvas');
    const voiceSection = document.getElementById('voice-to-text-section');
    const wordCount  = document.getElementById('word-count-bar');

    [toolbar, noteHeader, noteContent, canvas, voiceSection, wordCount].forEach(el => {
      if (el) el.style.display = show ? '' : 'none';
    });
  }

  /* ------------------------------------------
     RENDER MEETING EDITOR
  ------------------------------------------ */

  renderMeetingEditor(note, data) {
    const mainContent = document.querySelector('.main-content');
    if (!mainContent) return;

    // Remove existing meeting editor if any
    document.getElementById('meeting-editor')?.remove();

    // Hide welcome screen
    const welcome = document.getElementById('welcome-screen');
    if (welcome) welcome.style.display = 'none';

    const editor = document.createElement('div');
    editor.id = 'meeting-editor';
    editor.className = 'meeting-editor';
    editor.innerHTML = this.buildEditorHTML(note, data);

    mainContent.appendChild(editor);

    // Bind internal events
    this.bindEditorEvents(editor, note.id, data);

    // Render agenda items
    this.renderAgendaItems(data.agendaItems, editor);

    // Render attendees
    this.renderAttendees(data.attendees, editor);
  }

  /* ------------------------------------------
     BUILD EDITOR HTML
  ------------------------------------------ */

  buildEditorHTML(note, data) {
    const attendeeChips = data.attendees.map(a => this.attendeeChipHTML(a)).join('');
    const summaryVal  = this.escapeHTML(data.summary || '');
    const decisionsVal = this.escapeHTML(data.decisions || '');

    return `
      <!-- Meeting Header -->
      <div class="meeting-editor-header">
        <div class="meeting-editor-meta">
          <span class="meeting-type-badge">📅 Meeting Note</span>
          <button class="meeting-close-btn" id="meeting-close-btn" title="Back to notes">✕ Close</button>
        </div>
        <input
          class="meeting-title-input"
          id="meeting-title-input"
          type="text"
          value="${this.escapeHTML(note.title)}"
          placeholder="Meeting title"
          autocomplete="off"
        />
        <div class="meeting-datetime-row">
          <input type="date" class="meeting-date-input" id="meeting-date-input" value="${data.date}" />
          <input type="time" class="meeting-time-input" id="meeting-time-input" value="${data.time || ''}" placeholder="Time" />
        </div>
      </div>

      <div class="meeting-editor-body">

        <!-- Attendees -->
        <section class="meeting-section" id="section-attendees">
          <div class="meeting-section-header">
            <span class="meeting-section-icon">👥</span>
            <h3 class="meeting-section-title">Attendees</h3>
          </div>
          <div class="attendees-chips" id="attendees-chips">
            ${attendeeChips}
          </div>
          <div class="attendee-add-row">
            <input
              type="text"
              id="attendee-input"
              class="attendee-input"
              placeholder="Add name and press Enter"
              autocomplete="off"
            />
            <button class="attendee-add-btn" id="attendee-add-btn">Add</button>
          </div>
        </section>

        <div class="meeting-divider"></div>

        <!-- Agenda -->
        <section class="meeting-section" id="section-agenda">
          <div class="meeting-section-header">
            <span class="meeting-section-icon">📋</span>
            <h3 class="meeting-section-title">Agenda</h3>
            <button class="meeting-add-btn" id="add-agenda-btn">＋ Add Item</button>
          </div>
          <div class="agenda-list" id="agenda-list">
            <!-- rendered by renderAgendaItems() -->
          </div>
        </section>

        <div class="meeting-divider"></div>

        <!-- Action Items -->
        <section class="meeting-section" id="section-actions">
          <div class="meeting-section-header">
            <span class="meeting-section-icon">✅</span>
            <h3 class="meeting-section-title">Action Items</h3>
            <button class="meeting-add-btn" id="add-action-btn">＋ Add</button>
          </div>
          <div class="action-items-list" id="meeting-action-list">
            <!-- rendered by action-items.js in Step 3 -->
            <div class="action-items-placeholder" id="action-items-placeholder">
              <span class="placeholder-text">No action items yet — add one above</span>
            </div>
          </div>
        </section>

        <div class="meeting-divider"></div>

        <!-- Summary & Decisions -->
        <section class="meeting-section" id="section-summary">
          <div class="meeting-section-header">
            <span class="meeting-section-icon">💡</span>
            <h3 class="meeting-section-title">Summary &amp; Decisions</h3>
          </div>
          <textarea
            class="meeting-textarea"
            id="meeting-summary"
            placeholder="Key decisions made in this meeting…"
            rows="3"
          >${summaryVal}${decisionsVal ? '\n\n' + decisionsVal : ''}</textarea>
        </section>

      </div>

      <!-- Meeting Footer -->
      <div class="meeting-editor-footer">
        <span class="meeting-save-status" id="meeting-save-status">All changes saved</span>
        <button class="meeting-report-btn" id="meeting-generate-report" title="Generate activity report from this meeting">
          📊 Generate Report
        </button>
      </div>
    `;
  }

  /* ------------------------------------------
     RENDER AGENDA ITEMS
  ------------------------------------------ */

  renderAgendaItems(items, editorEl) {
    const list = (editorEl || document).getElementById('agenda-list');
    if (!list) return;

    list.innerHTML = items.map((item, idx) => `
      <div class="agenda-item" data-id="${item.id}">
        <div class="agenda-item-header">
          <button class="agenda-check-btn ${item.completed ? 'completed' : ''}" data-agenda-id="${item.id}" title="Mark complete">
            ${item.completed ? '✓' : ''}
          </button>
          <span class="agenda-number">${idx + 1}.</span>
          <input
            type="text"
            class="agenda-title-input"
            data-agenda-id="${item.id}"
            value="${this.escapeHTML(item.title)}"
            placeholder="Agenda item title"
            autocomplete="off"
          />
          <button class="agenda-delete-btn" data-agenda-id="${item.id}" title="Remove">✕</button>
        </div>
        <textarea
          class="agenda-notes-input"
          data-agenda-id="${item.id}"
          placeholder="Notes for this agenda item…"
          rows="2"
        >${this.escapeHTML(item.notes || '')}</textarea>
      </div>
    `).join('');
  }

  /* ------------------------------------------
     RENDER ATTENDEES
  ------------------------------------------ */

  renderAttendees(attendees, editorEl) {
    const chips = (editorEl || document).getElementById('attendees-chips');
    if (!chips) return;
    chips.innerHTML = attendees.map(a => this.attendeeChipHTML(a)).join('');
  }

  attendeeChipHTML(name) {
    const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
    return `
      <div class="attendee-chip" data-name="${this.escapeHTML(name)}">
        <span class="attendee-initials">${initials}</span>
        <span class="attendee-name">${this.escapeHTML(name)}</span>
        <button class="attendee-remove-btn" data-name="${this.escapeHTML(name)}" title="Remove">✕</button>
      </div>
    `;
  }

  /* ------------------------------------------
     BIND EDITOR EVENTS
  ------------------------------------------ */

  bindEditorEvents(editor, noteId, data) {
    // Close button
    editor.querySelector('#meeting-close-btn')?.addEventListener('click', () => {
      this.closeMeetingEditor();
    });

    // Title input
    editor.querySelector('#meeting-title-input')?.addEventListener('input', (e) => {
      storage.updateNote(noteId, { title: e.target.value });
      this.refreshMiniList();
      this.scheduleSave(noteId, editor, data);
    });

    // Date / time
    editor.querySelector('#meeting-date-input')?.addEventListener('input', (e) => {
      data.date = e.target.value;
      this.scheduleSave(noteId, editor, data);
    });
    editor.querySelector('#meeting-time-input')?.addEventListener('input', (e) => {
      data.time = e.target.value;
      this.scheduleSave(noteId, editor, data);
    });

    // Add attendee
    const attendeeInput = editor.querySelector('#attendee-input');
    const addAttendeeAction = () => {
      const val = attendeeInput.value.trim();
      if (!val) return;
      if (!data.attendees.includes(val)) {
        data.attendees.push(val);
        this.renderAttendees(data.attendees, editor);
        this.scheduleSave(noteId, editor, data);
      }
      attendeeInput.value = '';
    };
    attendeeInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); addAttendeeAction(); }
    });
    editor.querySelector('#attendee-add-btn')?.addEventListener('click', addAttendeeAction);

    // Remove attendee (delegated)
    editor.querySelector('#attendees-chips')?.addEventListener('click', (e) => {
      const btn = e.target.closest('.attendee-remove-btn');
      if (btn) {
        const name = btn.dataset.name;
        data.attendees = data.attendees.filter(a => a !== name);
        this.renderAttendees(data.attendees, editor);
        this.scheduleSave(noteId, editor, data);
      }
    });

    // Add agenda item
    editor.querySelector('#add-agenda-btn')?.addEventListener('click', () => {
      data.agendaItems.push(this.newAgendaItem(''));
      this.renderAgendaItems(data.agendaItems, editor);
      this.bindAgendaEvents(editor, noteId, data);
      this.scheduleSave(noteId, editor, data);
      // Focus new input
      const inputs = editor.querySelectorAll('.agenda-title-input');
      inputs[inputs.length - 1]?.focus();
    });

    // Agenda events (delegated)
    this.bindAgendaEvents(editor, noteId, data);

    // Summary
    editor.querySelector('#meeting-summary')?.addEventListener('input', (e) => {
      data.summary = e.target.value;
      this.scheduleSave(noteId, editor, data);
    });

    // Generate report button
    editor.querySelector('#meeting-generate-report')?.addEventListener('click', () => {
      document.dispatchEvent(new CustomEvent('generateReportRequested', {
        detail: { noteId }
      }));
    });
  }

  bindAgendaEvents(editor, noteId, data) {
    const list = editor.querySelector('#agenda-list');
    if (!list) return;

    // Remove duplicates — re-bind cleanly
    const newList = list.cloneNode(true);
    list.parentNode.replaceChild(newList, list);

    newList.addEventListener('input', (e) => {
      const agId = e.target.dataset.agendaId;
      if (!agId) return;
      const item = data.agendaItems.find(i => i.id === agId);
      if (!item) return;

      if (e.target.classList.contains('agenda-title-input')) {
        item.title = e.target.value;
      } else if (e.target.classList.contains('agenda-notes-input')) {
        item.notes = e.target.value;
      }
      this.scheduleSave(noteId, editor, data);
    });

    newList.addEventListener('click', (e) => {
      // Delete agenda item
      const del = e.target.closest('.agenda-delete-btn');
      if (del) {
        const agId = del.dataset.agendaId;
        data.agendaItems = data.agendaItems.filter(i => i.id !== agId);
        this.renderAgendaItems(data.agendaItems, editor);
        this.bindAgendaEvents(editor, noteId, data);
        this.scheduleSave(noteId, editor, data);
        return;
      }

      // Toggle complete
      const check = e.target.closest('.agenda-check-btn');
      if (check) {
        const agId = check.dataset.agendaId;
        const item = data.agendaItems.find(i => i.id === agId);
        if (item) {
          item.completed = !item.completed;
          check.classList.toggle('completed', item.completed);
          check.textContent = item.completed ? '✓' : '';
          this.scheduleSave(noteId, editor, data);
        }
      }
    });
  }

  /* ------------------------------------------
     SAVE
  ------------------------------------------ */

  scheduleSave(noteId, editor, data) {
    clearTimeout(this.saveTimer);
    this.setSaveStatus(editor, 'Saving…');
    this.saveTimer = setTimeout(() => {
      storage.updateNote(noteId, { content: JSON.stringify(data) });
      this.setSaveStatus(editor, 'All changes saved');
    }, 800);
  }

  setSaveStatus(editor, msg) {
    const el = (editor || document).querySelector('#meeting-save-status');
    if (el) el.textContent = msg;
  }

  /* ------------------------------------------
     CLOSE MEETING EDITOR
  ------------------------------------------ */

  closeMeetingEditor() {
    document.getElementById('meeting-editor')?.remove();
    this.activeMeetingId = null;
    this.setEditorVisibility(true);

    // Show welcome screen if no note is open
    if (window.app && !window.app.currentNote) {
      const welcome = document.getElementById('welcome-screen');
      if (welcome) welcome.style.display = '';
    }
  }

  /* ------------------------------------------
     ORG SIDEBAR MINI LIST
  ------------------------------------------ */

  refreshMiniList() {
    const list = document.getElementById('org-meetings-mini-list');
    if (!list) return;

    const meetings = storage.getNotes().filter(n => n.type === 'meeting');

    // Update count badge
    if (window.orgMode) {
      window.orgMode.updateCount('meetings', meetings.length);
    }

    if (meetings.length === 0) {
      list.innerHTML = `
        <div class="org-empty-state" style="padding: 20px 12px;">
          <div class="org-empty-icon">📅</div>
          <div class="org-empty-title">No meetings yet</div>
          <div class="org-empty-desc">Start your first meeting note below</div>
        </div>
      `;
      return;
    }

    list.innerHTML = meetings.slice(0, 8).map(note => {
      let dateStr = '';
      try {
        const d = JSON.parse(note.content || '{}');
        if (d.date) {
          dateStr = new Date(d.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        }
      } catch (e) { /* ignore */ }

      const active = note.id === this.activeMeetingId ? 'active' : '';

      return `
        <button class="org-nav-item meeting-mini-item ${active}" data-meeting-id="${note.id}">
          <span class="org-nav-icon">📅</span>
          <span class="org-nav-label">${this.escapeHTML(note.title)}</span>
          ${dateStr ? `<span style="font-size:11px;color:var(--color-text-tertiary);flex-shrink:0">${dateStr}</span>` : ''}
        </button>
      `;
    }).join('');

    // Bind clicks
    list.querySelectorAll('.meeting-mini-item').forEach(btn => {
      btn.addEventListener('click', () => {
        const note = storage.getNote(btn.dataset.meetingId);
        if (note) this.openMeetingNote(note);
      });
    });
  }

  highlightMiniListItem(id) {
    document.querySelectorAll('.meeting-mini-item').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.meetingId === id);
    });
  }

  /* ------------------------------------------
     GET MEETING DATA (used by reports/actions)
  ------------------------------------------ */

  getMeetingData(noteId) {
    const note = storage.getNote(noteId);
    if (!note || note.type !== 'meeting') return null;
    try { return JSON.parse(note.content || '{}'); } catch (e) { return null; }
  }

  getAllMeetings() {
    return storage.getNotes()
      .filter(n => n.type === 'meeting')
      .map(note => ({
        note,
        data: this.getMeetingData(note.id)
      }));
  }

  /* ------------------------------------------
     BIND GLOBAL EVENTS
  ------------------------------------------ */

  bindEvents() {
    // New Meeting button
    document.addEventListener('newMeetingRequested', () => {
      this.createMeeting();
    });

    // Workspace switch — refresh list
    document.addEventListener('workspaceChanged', ({ detail }) => {
      if (detail.workspace === 'org') {
        this.patchOpenNote();
        this.refreshMiniList();
      }
    });
  }

  /* ------------------------------------------
     UTIL
  ------------------------------------------ */

  escapeHTML(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  window.meetingNotes = new MeetingNotes();
});

console.log('✅ meeting-notes.js loaded');
