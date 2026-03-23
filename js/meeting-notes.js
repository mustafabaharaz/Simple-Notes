/* ============================================
   MEETING-NOTES.JS — Structured Meeting Notes
   Phase 2 — Additive only, zero core edits
   Hotfix3: keeps original API signatures so
   existing hotfix-phase4 patches don't break.
   Added: _liveData, group detection,
          attendee detail popup, 12h time fix.
   ============================================ */

class MeetingNotes {
  constructor() {
    this.activeMeetingId = null;
    this.saveTimer       = null;
    this._liveData       = null; // exposed for meeting-brief.js
    this.init();
  }

  /* ------------------------------------------
     INIT
  ------------------------------------------ */

  init() {
    const ready = () => {
      this.patchOpenNote();
      this.bindEvents();
      this.refreshMiniList();
      console.log('📅 MeetingNotes initialized');
    };
    if (window.app) { ready(); }
    else { window.addEventListener('load', ready); }
  }

  /* ------------------------------------------
     PATCH openNote
  ------------------------------------------ */

  patchOpenNote() {
    if (!window.app || window.app.__meetingPatched) return;
    window.app.__meetingPatched = true;
    const original = window.app.openNote.bind(window.app);
    window.app.openNote = (id) => {
      const note = storage.getNote(id);
      if (note && note.type === 'meeting') { this.openMeetingNote(note); }
      else { this.closeMeetingEditor(); original(id); }
    };
  }

  /* ------------------------------------------
     CREATE MEETING
  ------------------------------------------ */

  createMeeting() {
    const now     = new Date();
    const dateStr = now.toLocaleDateString('en-US', { weekday:'short', year:'numeric', month:'short', day:'numeric' });
    const timeStr = now.toLocaleTimeString('en-US', { hour:'2-digit', minute:'2-digit' });

    const meetingData = {
      date:            now.toISOString().split('T')[0],
      time:            timeStr,
      attendees:       [],
      attendeeDetails: {},
      agendaItems:     [
        this.newAgendaItem('Opening / Check-in'),
        this.newAgendaItem(''),
        this.newAgendaItem('Next steps')
      ],
      actionItems:     [],
      summary:         '',
      decisions:       ''
    };

    const title = `Meeting — ${dateStr}`;
    const note  = storage.createNote(title, JSON.stringify(meetingData));
    storage.updateNote(note.id, { type: 'meeting' });
    privacyMonitor.trackNoteCreated();
    this.refreshMiniList();

    if (window.orgMode && !window.orgMode.isOrgMode()) {
      window.orgMode.applyWorkspace('org');
    }
    this.patchOpenNote();
    setTimeout(() => {
      const fresh = storage.getNote(note.id);
      if (fresh) this.openMeetingNote(fresh);
    }, 50);

    showToast('📅 New meeting note created');
    return note;
  }

  newAgendaItem(title = '') {
    return {
      id:        'ag_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      title,
      notes:     '',
      completed: false
    };
  }

  /* ------------------------------------------
     OPEN MEETING NOTE
  ------------------------------------------ */

  openMeetingNote(note) {
    this.activeMeetingId = note.id;

    let data;
    try { data = JSON.parse(note.content || '{}'); } catch (e) { data = {}; }

    data.date            = data.date            || new Date().toISOString().split('T')[0];
    data.time            = data.time            || '';
    data.attendees       = data.attendees       || [];
    data.attendeeDetails = data.attendeeDetails || {};
    data.agendaItems     = data.agendaItems     || [this.newAgendaItem('')];
    data.actionItems     = data.actionItems     || [];
    data.summary         = data.summary         || '';
    data.decisions       = data.decisions       || '';

    // Convert stored 12h time to 24h for <input type="time">
    data.time = this.to24h(data.time);

    // Expose live reference so meeting-brief.js can read it
    this._liveData = data;

    this.setEditorVisibility(false);
    this.renderMeetingEditor(note, data);
    this.highlightMiniListItem(note.id);
  }

  /* ------------------------------------------
     EDITOR VISIBILITY
  ------------------------------------------ */

  setEditorVisibility(show) {
    const toolbar      = document.querySelector('.toolbar');
    const noteHeader   = document.querySelector('.note-header');
    const noteContent  = document.getElementById('note-content');
    const canvas       = document.getElementById('drawing-canvas');
    const voiceSection = document.getElementById('voice-to-text-section');
    const wordCount    = document.getElementById('word-count-bar');

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

    document.getElementById('meeting-editor')?.remove();

    const welcome = document.getElementById('welcome-screen');
    if (welcome) welcome.style.display = 'none';

    const editor = document.createElement('div');
    editor.id        = 'meeting-editor';
    editor.className = 'meeting-editor';
    editor.innerHTML = this.buildEditorHTML(note, data);

    mainContent.appendChild(editor);

    this.bindEditorEvents(editor, note.id, data);
    this.renderAgendaItems(data.agendaItems, editor);
    this.renderAttendees(data.attendees, editor);
  }

  /* ------------------------------------------
     BUILD EDITOR HTML
  ------------------------------------------ */

  buildEditorHTML(note, data) {
    const attendeeChips = data.attendees.map(a =>
      this.attendeeChipHTML(a, (data.attendeeDetails || {})[a] || {})
    ).join('');
    const summaryVal   = this.escapeHTML(data.summary   || '');
    const decisionsVal = this.escapeHTML(data.decisions || '');

    return `
      <div class="meeting-editor-header">
        <div class="meeting-editor-meta">
          <span class="meeting-type-badge">📅 Meeting Note</span>
          <button class="meeting-close-btn" id="meeting-close-btn" title="Back to notes">✕ Close</button>
        </div>
        <input class="meeting-title-input" id="meeting-title-input" type="text"
               value="${this.escapeHTML(note.title)}" placeholder="Meeting title" autocomplete="off" />
        <div class="meeting-datetime-row">
          <input type="date" class="meeting-date-input" id="meeting-date-input" value="${data.date}" />
          <input type="time" class="meeting-time-input" id="meeting-time-input" value="${data.time || ''}" />
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
            <input type="text" id="attendee-input" class="attendee-input"
                   placeholder="Add name, family or group — press Enter" autocomplete="off" />
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
          <textarea class="meeting-textarea" id="meeting-summary"
                    placeholder="Key decisions made in this meeting…" rows="3"
          >${summaryVal}${decisionsVal ? '\n\n' + decisionsVal : ''}</textarea>
        </section>

      </div>

      <!-- Meeting Footer -->
      <div class="meeting-editor-footer">
        <span class="meeting-save-status" id="meeting-save-status">All changes saved</span>
        <button class="meeting-report-btn" id="meeting-generate-report"
                title="Generate activity report from this meeting">
          📊 Generate Report
        </button>
      </div>
    `;
  }

  /* ------------------------------------------
     RENDER AGENDA ITEMS
     Signature unchanged: (items, editorEl)
  ------------------------------------------ */

  renderAgendaItems(items, editorEl) {
    const list = (editorEl || document).getElementById('agenda-list');
    if (!list) return;

    list.innerHTML = items.map((item, idx) => `
      <div class="agenda-item" data-id="${item.id}">
        <div class="agenda-item-header">
          <button class="agenda-check-btn ${item.completed ? 'completed' : ''}"
                  data-agenda-id="${item.id}" title="Mark complete">
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
     Original 2-param signature kept.
     Reads attendeeDetails from _liveData.
  ------------------------------------------ */

  renderAttendees(attendees, editorEl) {
    const chips = (editorEl || document).getElementById('attendees-chips');
    if (!chips) return;
    const details = this._liveData?.attendeeDetails || {};
    chips.innerHTML = attendees.map(a =>
      this.attendeeChipHTML(a, details[a] || {})
    ).join('');
    // Re-bind detail click events after re-render
    this.bindAttendeeDetailEvents(editorEl);
  }

  /* ------------------------------------------
     ATTENDEE CHIP HTML
     Groups/families → 👥 icon.
     Clickable for email/phone popup.
  ------------------------------------------ */

  attendeeChipHTML(name, detail = {}) {
    const isGroup   = this.isGroupName(name);
    const hasDetail = detail.email || detail.phone;
    const avatar    = isGroup
      ? `<span class="attendee-initials attendee-group-icon">👥</span>`
      : `<span class="attendee-initials">${name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}</span>`;

    return `
      <div class="attendee-chip${isGroup ? ' attendee-chip-group' : ''}"
           data-name="${this.escapeHTML(name)}"
           title="Click name to add email / phone">
        ${avatar}
        <span class="attendee-name">${this.escapeHTML(name)}</span>
        ${hasDetail ? `<span class="attendee-has-detail" title="${this.escapeHTML(detail.email || '')}"></span>` : ''}
        <button class="attendee-remove-btn" data-name="${this.escapeHTML(name)}" title="Remove">✕</button>
      </div>
    `;
  }

  /* ------------------------------------------
     GROUP DETECTION
     Matches single-word family/group names,
     multi-word names (3+ words), or keywords.
  ------------------------------------------ */

  isGroupName(name) {
    const lower    = (name || '').trim().toLowerCase();
    const words    = lower.split(/\s+/);
    const keywords = /\b(team|group|dept|department|committee|board|council|chapter|crew|squad|staff|org|division|unit|club|association|society|guild|family|families|household|class|community|network|circle|cohort|collective|alliance|coalition|tribe|forum|branch|hub|partners|stakeholders)\b/;
    return keywords.test(lower) || words.length >= 3;
  }

  /* ------------------------------------------
     ATTENDEE DETAIL POPUP
     Email + phone, stored in attendeeDetails.
  ------------------------------------------ */

  showAttendeeDetail(name, editorEl) {
    const editor  = editorEl || document.getElementById('meeting-editor');
    const data    = this._liveData;
    if (!editor || !data) return;

    // Remove any open popup first
    editor.querySelectorAll('.attendee-detail-popup').forEach(p => p.remove());

    const chip   = editor.querySelector(`.attendee-chip[data-name="${CSS.escape(name)}"]`);
    if (!chip) return;

    const detail = (data.attendeeDetails || {})[name] || {};
    const popup  = document.createElement('div');
    popup.className = 'attendee-detail-popup';
    popup.innerHTML = `
      <div class="adp-header">
        <span class="adp-name">${this.escapeHTML(name)}</span>
        <button class="adp-close" title="Close">✕</button>
      </div>
      <label class="adp-label">Email</label>
      <input type="email" class="adp-email" placeholder="email@example.com"
             value="${this.escapeHTML(detail.email || '')}" />
      <label class="adp-label">Phone / WhatsApp</label>
      <input type="tel" class="adp-phone" placeholder="+1 555 000 0000"
             value="${this.escapeHTML(detail.phone || '')}" />
      <button class="adp-save">Save</button>
    `;

    chip.appendChild(popup);
    popup.querySelector('.adp-email').focus();

    const save = () => {
      const email = popup.querySelector('.adp-email').value.trim();
      const phone = popup.querySelector('.adp-phone').value.trim();
      if (!data.attendeeDetails) data.attendeeDetails = {};
      data.attendeeDetails[name] = { email, phone };
      this.renderAttendees(data.attendees, editor);
      this.scheduleSave(this.activeMeetingId, editor, data);
    };

    popup.querySelector('.adp-save').addEventListener('click', () => {
      save(); popup.remove();
    });
    popup.querySelector('.adp-close').addEventListener('click', () => popup.remove());
    popup.addEventListener('click', e => e.stopPropagation());

    const closeOnOutside = (e) => {
      if (!chip.contains(e.target)) {
        save(); popup.remove();
        document.removeEventListener('click', closeOnOutside);
      }
    };
    setTimeout(() => document.addEventListener('click', closeOnOutside), 10);
  }

  bindAttendeeDetailEvents(editorEl) {
    const editor = editorEl || document.getElementById('meeting-editor');
    if (!editor) return;
    editor.querySelectorAll('.attendee-chip').forEach(chip => {
      // Click on name or avatar opens popup; remove-btn is handled separately
      ['attendee-name', 'attendee-initials', 'attendee-group-icon'].forEach(cls => {
        chip.querySelector('.' + cls)?.addEventListener('click', (e) => {
          e.stopPropagation();
          this.showAttendeeDetail(chip.dataset.name, editor);
        });
      });
    });
  }

  /* ------------------------------------------
     BIND EDITOR EVENTS
  ------------------------------------------ */

  bindEditorEvents(editor, noteId, data) {
    // Keep _liveData pointing at the active data object
    this._liveData = data;

    editor.querySelector('#meeting-close-btn')?.addEventListener('click', () => {
      this.closeMeetingEditor();
    });

    editor.querySelector('#meeting-title-input')?.addEventListener('input', (e) => {
      storage.updateNote(noteId, { title: e.target.value });
      this.refreshMiniList();
      this.scheduleSave(noteId, editor, data);
    });

    editor.querySelector('#meeting-date-input')?.addEventListener('input', (e) => {
      data.date = e.target.value;
      this.scheduleSave(noteId, editor, data);
    });
    editor.querySelector('#meeting-time-input')?.addEventListener('input', (e) => {
      data.time = e.target.value;
      this.scheduleSave(noteId, editor, data);
    });

    // Add attendee
    const attendeeInput     = editor.querySelector('#attendee-input');
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
        const nm = btn.dataset.name;
        data.attendees = data.attendees.filter(a => a !== nm);
        if (data.attendeeDetails) delete data.attendeeDetails[nm];
        this.renderAttendees(data.attendees, editor);
        this.scheduleSave(noteId, editor, data);
      }
    });

    // Initial bind of detail popup
    this.bindAttendeeDetailEvents(editor);

    // Add agenda item
    editor.querySelector('#add-agenda-btn')?.addEventListener('click', () => {
      data.agendaItems.push(this.newAgendaItem(''));
      this.renderAgendaItems(data.agendaItems, editor);
      this.bindAgendaEvents(editor, noteId, data);
      this.scheduleSave(noteId, editor, data);
      const inputs = editor.querySelectorAll('.agenda-title-input');
      inputs[inputs.length - 1]?.focus();
    });

    this.bindAgendaEvents(editor, noteId, data);

    editor.querySelector('#meeting-summary')?.addEventListener('input', (e) => {
      data.summary = e.target.value;
      this.scheduleSave(noteId, editor, data);
    });

    editor.querySelector('#meeting-generate-report')?.addEventListener('click', () => {
      document.dispatchEvent(new CustomEvent('generateReportRequested', {
        detail: { noteId }
      }));
    });
  }

  bindAgendaEvents(editor, noteId, data) {
    const list = editor.querySelector('#agenda-list');
    if (!list) return;

    const newList = list.cloneNode(true);
    list.parentNode.replaceChild(newList, list);

    newList.addEventListener('input', (e) => {
      const agId = e.target.dataset.agendaId;
      if (!agId) return;
      const item = data.agendaItems.find(i => i.id === agId);
      if (!item) return;
      if (e.target.classList.contains('agenda-title-input'))      item.title = e.target.value;
      else if (e.target.classList.contains('agenda-notes-input')) item.notes = e.target.value;
      this.scheduleSave(noteId, editor, data);
    });

    newList.addEventListener('click', (e) => {
      const del = e.target.closest('.agenda-delete-btn');
      if (del) {
        data.agendaItems = data.agendaItems.filter(i => i.id !== del.dataset.agendaId);
        this.renderAgendaItems(data.agendaItems, editor);
        this.bindAgendaEvents(editor, noteId, data);
        this.scheduleSave(noteId, editor, data);
        return;
      }
      const check = e.target.closest('.agenda-check-btn');
      if (check) {
        const item = data.agendaItems.find(i => i.id === check.dataset.agendaId);
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
     CLOSE
  ------------------------------------------ */

  closeMeetingEditor() {
    document.getElementById('meeting-editor')?.remove();
    this.activeMeetingId = null;
    this._liveData       = null;
    this.setEditorVisibility(true);

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
          dateStr = new Date(d.date + 'T12:00:00').toLocaleDateString('en-US', {
            month: 'short', day: 'numeric'
          });
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
     PUBLIC ACCESSORS
  ------------------------------------------ */

  getMeetingData(noteId) {
    const note = storage.getNote(noteId);
    if (!note || note.type !== 'meeting') return null;
    try { return JSON.parse(note.content || '{}'); } catch (e) { return null; }
  }

  getAllMeetings() {
    return storage.getNotes()
      .filter(n => n.type === 'meeting')
      .map(note => ({ note, data: this.getMeetingData(note.id) }));
  }

  /* ------------------------------------------
     GLOBAL EVENTS
  ------------------------------------------ */

  bindEvents() {
    document.addEventListener('newMeetingRequested', () => {
      this.createMeeting();
    });
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

  // Keep original name — existing hotfix patches call this.escapeHTML
  escapeHTML(str) {
    return String(str || '')
      .replace(/&/g,  '&amp;')
      .replace(/</g,  '&lt;')
      .replace(/>/g,  '&gt;')
      .replace(/"/g,  '&quot;');
  }

  // Convert "02:45 AM" / "2:45 PM" → "02:45" / "14:45" for <input type="time">
  to24h(timeStr) {
    if (!timeStr) return '';
    // Already 24h format (HH:mm or HH:mm:ss) — pass through
    if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(timeStr.trim())) return timeStr.trim().slice(0, 5);
    // Parse 12h format
    const m = timeStr.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (!m) return '';
    let h = parseInt(m[1], 10);
    const min = m[2];
    const ampm = m[3].toUpperCase();
    if (ampm === 'AM' && h === 12) h = 0;
    if (ampm === 'PM' && h !== 12) h += 12;
    return String(h).padStart(2, '0') + ':' + min;
  }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  window.meetingNotes = new MeetingNotes();
});

console.log('✅ meeting-notes.js loaded');
