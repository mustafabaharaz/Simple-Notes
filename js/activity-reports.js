/* ============================================
   ACTIVITY-REPORTS.JS — Report Generation
   Phase 2 — Additive only, zero core edits
   ============================================ */

class ActivityReports {
  constructor() {
    this.activeReportId = null;
    this._saveTimer    = null;
    this.init();
  }

  /* ------------------------------------------
     INIT
  ------------------------------------------ */

  init() {
    this.injectPanel();
    this.watchForReportButton();
    this.bindEvents();
    console.log('✅ ActivityReports initialized');
  }

  /* ------------------------------------------
     INJECT REPORTS PANEL
  ------------------------------------------ */

  injectPanel() {
    if (document.getElementById('org-reports-panel')) return;

    const mainContent = document.querySelector('.main-content');
    if (!mainContent) return;

    const panel = document.createElement('div');
    panel.id = 'org-reports-panel';
    panel.className = 'org-panel';
    panel.innerHTML = `
      <div class="org-panel-header">
        <div class="org-panel-title">📊 Activity Reports</div>
        <button class="rp-new-btn" id="rp-new-btn">＋ New Report</button>
      </div>
      <div class="org-panel-body" id="rp-body">
        <!-- populated by renderReportsList() -->
      </div>
    `;

    mainContent.appendChild(panel);
  }

  /* ------------------------------------------
     MUTATION OBSERVER
     Watches for the Generate Report button
     that lives inside the meeting editor
  ------------------------------------------ */

  watchForReportButton() {
    const observer = new MutationObserver(() => {
      const btn = document.getElementById('meeting-generate-report');
      if (btn && !btn.dataset.rpBound) {
        btn.dataset.rpBound = 'true';
        btn.addEventListener('click', () => {
          const noteId = window.meetingNotes?.activeMeetingId;
          if (noteId) this.generateFromMeeting(noteId);
        });
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  /* ------------------------------------------
     GENERATE REPORT FROM MEETING
  ------------------------------------------ */

  generateFromMeeting(meetingNoteId) {
    const note = storage.getNote(meetingNoteId);
    if (!note) return;

    let data;
    try { data = JSON.parse(note.content || '{}'); } catch (e) { data = {}; }

    const now     = new Date();
    const dateStr = now.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

    // Build auto-draft content
    const content = this.buildDraftContent(note.title, data, dateStr);

    // Create report note
    const reportTitle  = `Report — ${note.title}`;
    const reportNote   = storage.createNote(reportTitle, content);
    storage.updateNote(reportNote.id, {
      type:          'report',
      sourceMeetingId: meetingNoteId
    });

    this.activeReportId = reportNote.id;

    // Switch to Reports view
    if (window.orgMode) {
      window.orgMode.switchOrgView('reports');
      // Trigger the panel to show
      document.dispatchEvent(new CustomEvent('orgViewChanged', { detail: { view: 'reports' } }));
    }

    // Small delay so panel renders, then open editor
    setTimeout(() => {
      this.renderReportsList();
      this.openReportEditor(reportNote.id);
    }, 60);

    showToast('📊 Report draft generated');
  }

  /* ------------------------------------------
     BUILD DRAFT CONTENT (plain text, editable)
  ------------------------------------------ */

  buildDraftContent(meetingTitle, data, dateStr) {
    const attendees   = (data.attendees || []).join(', ') || '—';
    const agendaLines = (data.agendaItems || [])
      .map((item, i) => {
        const status = item.completed ? '✓' : '○';
        const notes  = item.notes ? `\n   ${item.notes.trim()}` : '';
        return `  ${status} ${i + 1}. ${item.title || 'Untitled'}${notes}`;
      }).join('\n') || '  — No agenda items';

    const openItems = (data.actionItems || []).filter(i => i.status !== 'done');
    const doneItems = (data.actionItems || []).filter(i => i.status === 'done');

    const formatActionItem = (item) => {
      const assignee = item.assignee ? ` → ${item.assignee}` : '';
      const due      = item.due      ? ` (due ${this.formatDate(item.due)})` : '';
      return `  • ${item.text}${assignee}${due}`;
    };

    const openLines = openItems.length
      ? openItems.map(formatActionItem).join('\n')
      : '  — None';

    const doneLines = doneItems.length
      ? doneItems.map(formatActionItem).join('\n')
      : '  — None';

    const summary = (data.summary || '').trim() || '—';

    return `ACTIVITY REPORT
Generated: ${dateStr}
Source: ${meetingTitle}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ATTENDEES
${attendees}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

AGENDA COVERED
${agendaLines}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

OPEN ACTION ITEMS
${openLines}

COMPLETED ITEMS
${doneLines}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

SUMMARY & DECISIONS
${summary}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

NOTES / ADDITIONAL REMARKS
(Add any additional context here)
`;
  }

  /* ------------------------------------------
     RENDER REPORTS LIST (panel body)
  ------------------------------------------ */

  renderReportsList() {
    const body = document.getElementById('rp-body');
    if (!body) return;

    const reports = storage.getNotes().filter(n => n.type === 'report');

    // Update sidebar count
    if (window.orgMode) window.orgMode.updateCount('reports', reports.length);

    if (reports.length === 0) {
      body.innerHTML = `
        <div class="rp-empty">
          <div class="rp-empty-icon">📊</div>
          <div class="rp-empty-title">No reports yet</div>
          <div class="rp-empty-desc">
            Open a meeting note and click
            <strong>Generate Report</strong> to create an auto-drafted report,
            or start a blank one above.
          </div>
        </div>
      `;
      return;
    }

    // If a report is open, show editor; otherwise show list
    if (this.activeReportId && storage.getNote(this.activeReportId)) {
      this.openReportEditor(this.activeReportId);
      return;
    }

    body.innerHTML = `
      <div class="rp-list">
        ${reports.map(r => this.reportCardHTML(r)).join('')}
      </div>
    `;

    // Bind card clicks
    body.querySelectorAll('.rp-card').forEach(card => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('.rp-card-delete')) return;
        this.activeReportId = card.dataset.reportId;
        this.openReportEditor(card.dataset.reportId);
      });
    });

    // Delete buttons
    body.querySelectorAll('.rp-card-delete').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (confirm('Delete this report?')) {
          storage.deleteNote(btn.dataset.reportId);
          this.activeReportId = null;
          this.renderReportsList();
        }
      });
    });
  }

  reportCardHTML(report) {
    const date = new Date(report.modified).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric'
    });
    const preview = (report.content || '').split('\n').slice(1, 3).join(' ').trim().slice(0, 80);

    return `
      <div class="rp-card" data-report-id="${report.id}">
        <div class="rp-card-icon">📊</div>
        <div class="rp-card-body">
          <div class="rp-card-title">${this.esc(report.title)}</div>
          <div class="rp-card-preview">${this.esc(preview)}</div>
          <div class="rp-card-date">${date}</div>
        </div>
        <button class="rp-card-delete" data-report-id="${report.id}" title="Delete report">🗑</button>
      </div>
    `;
  }

  /* ------------------------------------------
     OPEN REPORT EDITOR
  ------------------------------------------ */

  openReportEditor(reportId) {
    const note = storage.getNote(reportId);
    if (!note) return;

    this.activeReportId = reportId;

    const body = document.getElementById('rp-body');
    if (!body) return;

    body.innerHTML = `
      <div class="rp-editor" id="rp-editor">

        <div class="rp-editor-toolbar">
          <button class="rp-back-btn" id="rp-back-btn">← All Reports</button>
          <div class="rp-editor-actions">
            <button class="rp-export-btn" id="rp-export-txt" title="Export as .txt">⬇ Export</button>
            <button class="rp-copy-btn"   id="rp-copy-btn"   title="Copy to clipboard">⎘ Copy</button>
          </div>
        </div>

        <input
          type="text"
          class="rp-title-input"
          id="rp-title-input"
          value="${this.esc(note.title)}"
          placeholder="Report title"
          autocomplete="off"
        />

        <textarea
          class="rp-content-area"
          id="rp-content-area"
          spellcheck="true"
          placeholder="Report content…"
        >${this.esc(note.content)}</textarea>

        <div class="rp-editor-footer">
          <span class="rp-save-status" id="rp-save-status">All changes saved</span>
        </div>
      </div>
    `;

    this.bindEditorEvents(reportId);
  }

  /* ------------------------------------------
     BIND EDITOR EVENTS
  ------------------------------------------ */

  bindEditorEvents(reportId) {
    // Back
    document.getElementById('rp-back-btn')?.addEventListener('click', () => {
      this.activeReportId = null;
      this.renderReportsList();
    });

    // Title
    document.getElementById('rp-title-input')?.addEventListener('input', (e) => {
      storage.updateNote(reportId, { title: e.target.value });
      this.scheduleSave(reportId);
    });

    // Content
    document.getElementById('rp-content-area')?.addEventListener('input', () => {
      this.scheduleSave(reportId);
    });

    // Export TXT
    document.getElementById('rp-export-txt')?.addEventListener('click', () => {
      this.exportTxt(reportId);
    });

    // Copy
    document.getElementById('rp-copy-btn')?.addEventListener('click', () => {
      this.copyToClipboard(reportId);
    });
  }

  /* ------------------------------------------
     SAVE
  ------------------------------------------ */

  scheduleSave(reportId) {
    clearTimeout(this._saveTimer);
    const status = document.getElementById('rp-save-status');
    if (status) status.textContent = 'Saving…';
    this._saveTimer = setTimeout(() => {
      const titleEl   = document.getElementById('rp-title-input');
      const contentEl = document.getElementById('rp-content-area');
      const updates   = {};
      if (titleEl)   updates.title   = titleEl.value;
      if (contentEl) updates.content = contentEl.value;
      storage.updateNote(reportId, updates);
      if (status) status.textContent = 'All changes saved';
    }, 800);
  }

  /* ------------------------------------------
     EXPORT / COPY
  ------------------------------------------ */

  exportTxt(reportId) {
    const note = storage.getNote(reportId);
    if (!note) return;

    const blob     = new Blob([note.content], { type: 'text/plain' });
    const url      = URL.createObjectURL(blob);
    const filename = note.title.replace(/[^a-z0-9]/gi, '_').toLowerCase() + '.txt';

    const a = document.createElement('a');
    a.href  = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    showToast('📄 Report exported');
  }

  copyToClipboard(reportId) {
    const note = storage.getNote(reportId);
    if (!note) return;

    navigator.clipboard.writeText(note.content)
      .then(() => showToast('⎘ Report copied to clipboard'))
      .catch(() => {
        // Fallback
        const ta = document.getElementById('rp-content-area');
        if (ta) { ta.select(); document.execCommand('copy'); showToast('⎘ Copied'); }
      });
  }

  /* ------------------------------------------
     SHOW / HIDE PANEL
  ------------------------------------------ */

  show() {
    document.querySelectorAll('.org-panel').forEach(p => p.classList.remove('active'));
    document.getElementById('org-reports-panel')?.classList.add('active');

    // Hide personal editor chrome
    const els = [
      document.querySelector('.toolbar'),
      document.querySelector('.note-header'),
      document.getElementById('note-content'),
      document.getElementById('welcome-screen'),
      document.getElementById('meeting-editor')
    ];
    els.forEach(el => { if (el) el.style.display = 'none'; });

    this.renderReportsList();
  }

  hide() {
    document.getElementById('org-reports-panel')?.classList.remove('active');
  }

  /* ------------------------------------------
     BIND GLOBAL EVENTS
  ------------------------------------------ */

  bindEvents() {
    // Org view switch
    document.addEventListener('orgViewChanged', ({ detail }) => {
      if (detail.view === 'reports') {
        this.show();
      } else {
        this.hide();
      }
    });

    // New Report button
    document.addEventListener('click', (e) => {
      if (e.target.closest('#rp-new-btn')) {
        this.createBlankReport();
      }
    });

    // Workspace change
    document.addEventListener('workspaceChanged', ({ detail }) => {
      if (detail.workspace === 'org' && window.orgMode?.getCurrentView() === 'reports') {
        this.show();
      }
      if (detail.workspace === 'personal') {
        this.hide();
      }
    });

    // Generate report from meeting editor button (MutationObserver handles binding)
    document.addEventListener('generateReportRequested', ({ detail }) => {
      if (detail?.noteId) this.generateFromMeeting(detail.noteId);
    });
  }

  /* ------------------------------------------
     CREATE BLANK REPORT
  ------------------------------------------ */

  createBlankReport() {
    const dateStr = new Date().toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric'
    });
    const content = `ACTIVITY REPORT
Generated: ${dateStr}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ATTENDEES


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

AGENDA COVERED


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

OPEN ACTION ITEMS


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

SUMMARY & DECISIONS


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

NOTES / ADDITIONAL REMARKS

`;
    const note = storage.createNote(`Report — ${dateStr}`, content);
    storage.updateNote(note.id, { type: 'report' });
    this.activeReportId = note.id;
    this.renderReportsList();
    showToast('📊 Blank report created');
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
  window.activityReports = new ActivityReports();
});

console.log('✅ activity-reports.js loaded');
