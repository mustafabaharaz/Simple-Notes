/* ============================================
   MEETING-JOURNEY.JS — Meeting Journey Map
   Phase 6 — Additive only, zero core edits
   ============================================ */

class MeetingJourney {
  constructor() {
    this.nudgeLoading   = false;
    this._refreshTimer  = null;
    this.init();
  }

  /* ------------------------------------------
     INIT
  ------------------------------------------ */

  init() {
    this.watchForMeetingEditor();
    this.bindDocumentEvents();
    console.log('✅ MeetingJourney initialized');
  }

  /* ------------------------------------------
     MUTATION OBSERVER
     Fires every time .meeting-editor-body
     appears (i.e. every time a meeting opens)
  ------------------------------------------ */

  watchForMeetingEditor() {
    const observer = new MutationObserver(() => {
      const body = document.querySelector('.meeting-editor-body');
      if (!body || body.dataset.journeyBound) return;
      body.dataset.journeyBound = 'true';

      this.injectStrip(body);
      this.patchScheduleSave();
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  /* ------------------------------------------
     PATCH meetingNotes.scheduleSave
     After every save, re-render the strip so
     the journey updates in real-time — zero
     edits to meeting-notes.js required.
  ------------------------------------------ */

  patchScheduleSave() {
    if (!window.meetingNotes || window.meetingNotes.__journeyPatched) return;
    window.meetingNotes.__journeyPatched = true;

    const orig = window.meetingNotes.scheduleSave.bind(window.meetingNotes);

    window.meetingNotes.scheduleSave = (noteId, editor, data) => {
      orig(noteId, editor, data);
      // Refresh strip 900ms after save (slightly after the 800ms storage write)
      clearTimeout(this._refreshTimer);
      this._refreshTimer = setTimeout(() => this.refresh(), 900);
    };
  }

  /* ------------------------------------------
     INJECT STRIP
     Prepended to .meeting-editor-body, before
     the first .meeting-section (Attendees).
     A matching .meeting-divider separates them.
  ------------------------------------------ */

  injectStrip(body) {
    // Divider (goes AFTER the strip)
    const divider = document.createElement('div');
    divider.className = 'meeting-divider journey-divider';

    // Strip container
    const strip = document.createElement('div');
    strip.id        = 'journey-strip';
    strip.className = 'journey-strip';

    body.insertBefore(divider, body.firstChild);
    body.insertBefore(strip, divider);

    this.refresh();
  }

  /* ------------------------------------------
     COMPUTE STATIONS
     Pure function — derives state from data.
  ------------------------------------------ */

  computeStations(data) {
    const now   = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    let meetingDay = null;
    let dayBefore  = null;

    if (data.date) {
      meetingDay = new Date(data.date + 'T00:00:00');
      dayBefore  = new Date(meetingDay.getTime() - 86_400_000); // D-1
    }

    const meetingPassed   = meetingDay && meetingDay < today;
    const isMeetingDay    = meetingDay && meetingDay.getTime() === today.getTime();
    const briefOverdue    = dayBefore && today >= dayBefore && !data.briefSentAt;
    const followUpOverdue = meetingPassed && !data.followUpSentAt;

    const hasAttendees = (data.attendees   || []).length > 0;
    const hasAgenda    = (data.agendaItems || []).filter(i => i.title && i.title.trim()).length > 0;
    const hasBrief     = !!data.briefSentAt;
    const hasItems     = (data.actionItems || []).length > 0;
    const hasFollowUp  = !!data.followUpSentAt;

    // Success: all meaningful steps complete
    const allDone = hasAttendees && hasAgenda && hasBrief
      && (meetingPassed || isMeetingDay)
      && hasItems && hasFollowUp;

    return [
      {
        id:      'created',
        label:   'Created',
        icon:    '📝',
        state:   'complete',
        tooltip: 'Meeting note created'
      },
      {
        id:      'attendees',
        label:   'Attendees',
        icon:    '👥',
        state:   hasAttendees ? 'complete' : 'pending',
        tooltip: hasAttendees
          ? `${data.attendees.length} attendee${data.attendees.length !== 1 ? 's' : ''} added`
          : 'Add at least one attendee'
      },
      {
        id:      'agenda',
        label:   'Agenda',
        icon:    '📋',
        state:   hasAgenda ? 'complete' : 'pending',
        tooltip: hasAgenda
          ? 'Agenda is ready'
          : 'Add at least one agenda item'
      },
      {
        id:      'brief',
        label:   'Brief Sent',
        icon:    '📤',
        state:   hasBrief      ? 'complete'
               : briefOverdue  ? 'warning'
               :                 'pending',
        tooltip: hasBrief
          ? `Sent at ${this.fmtTime(data.briefSentAt)}`
          : briefOverdue
            ? 'Brief is overdue — send it now!'
            : dayBefore
              ? `Due by ${this.fmtDate(dayBefore)}`
              : 'Send a pre-meeting brief to attendees'
      },
      {
        id:      'meeting-day',
        label:   'Meeting Day',
        icon:    '📅',
        state:   meetingPassed  ? 'complete'
               : isMeetingDay   ? 'active'
               :                  'pending',
        tooltip: isMeetingDay
          ? "Today's the day — you're in it!"
          : meetingPassed
            ? `Held on ${this.fmtDate(meetingDay)}`
            : meetingDay
              ? `Scheduled for ${this.fmtDate(meetingDay)}`
              : 'Set a meeting date'
      },
      {
        id:      'items',
        label:   'Items Logged',
        icon:    '✅',
        state:   hasItems       ? 'complete'
               : meetingPassed  ? 'warning'
               :                  'pending',
        tooltip: hasItems
          ? `${data.actionItems.length} action item${data.actionItems.length !== 1 ? 's' : ''} logged`
          : meetingPassed
            ? 'Log action items from the meeting'
            : 'Action items will be logged during the meeting'
      },
      {
        id:      'followup',
        label:   'Follow-Up',
        icon:    '📬',
        state:   hasFollowUp       ? 'complete'
               : followUpOverdue   ? 'warning'
               :                     'pending',
        tooltip: hasFollowUp
          ? `Sent at ${this.fmtTime(data.followUpSentAt)}`
          : followUpOverdue
            ? 'Send the follow-up to your attendees now'
            : 'Send a follow-up after the meeting wraps'
      },
      {
        id:      'success',
        label:   'Success!',
        icon:    '🎉',
        state:   allDone ? 'complete' : 'pending',
        tooltip: allDone
          ? 'This meeting is fully wrapped — great work!'
          : 'Complete all steps to reach success'
      }
    ];
  }

  /* ------------------------------------------
     REFRESH — recomputes and re-renders strip.
     Preserves the nudge panel if it was open.
  ------------------------------------------ */

  refresh() {
    const strip = document.getElementById('journey-strip');
    if (!strip) return;

    const noteId = window.meetingNotes?.activeMeetingId;
    if (!noteId) return;

    const data = window.meetingNotes.getMeetingData(noteId);
    if (!data) return;

    const stations = this.computeStations(data);

    // Remember nudge panel state before re-render
    const nudgePanelOpen = strip.querySelector('#journey-nudge-panel')?.style.display !== 'none';
    const nudgeContent   = strip.querySelector('#journey-nudge-content')?.innerHTML || '';

    strip.innerHTML = this.buildHTML(stations);
    this.bindStripEvents(strip, noteId);

    // Restore nudge panel
    if (nudgePanelOpen && nudgeContent) {
      const panel   = strip.querySelector('#journey-nudge-panel');
      const content = strip.querySelector('#journey-nudge-content');
      if (panel)   panel.style.display = 'block';
      if (content) content.innerHTML   = nudgeContent;
    }
  }

  /* ------------------------------------------
     BUILD HTML
  ------------------------------------------ */

  buildHTML(stations) {
    const trackItems = [];

    stations.forEach((s, idx) => {
      // Badge overlay
      let badge = '';
      if (s.state === 'complete') badge = '<span class="journey-badge journey-badge-check">✓</span>';
      if (s.state === 'warning')  badge = '<span class="journey-badge journey-badge-warn">!</span>';

      trackItems.push(`
        <div class="journey-station journey-${s.state}" title="${this.esc(s.tooltip)}">
          <div class="journey-dot">
            <span class="journey-icon">${s.icon}</span>
            ${badge}
          </div>
          <div class="journey-label">${s.label}</div>
        </div>
      `);

      // Connector: lit green if current station is complete
      if (idx < stations.length - 1) {
        const lit = s.state === 'complete' ? 'complete' : 'pending';
        trackItems.push(`<div class="journey-connector journey-connector-${lit}"></div>`);
      }
    });

    return `
      <div class="journey-header">
        <span class="journey-title">Meeting Journey</span>
        <button class="journey-nudge-btn" id="journey-nudge-btn"
                title="Get an AI nudge for your next step">
          ✨ AI Nudge
        </button>
      </div>
      <div class="journey-track">
        ${trackItems.join('')}
      </div>
      <div class="journey-nudge-panel" id="journey-nudge-panel" style="display:none">
        <div class="journey-nudge-content" id="journey-nudge-content"></div>
      </div>
    `;
  }

  /* ------------------------------------------
     BIND STRIP EVENTS
  ------------------------------------------ */

  bindStripEvents(strip, noteId) {
    if (!strip) return;
    strip.querySelector('#journey-nudge-btn')?.addEventListener('click', () => {
      this.triggerNudge(noteId);
    });
  }

  /* ------------------------------------------
     AI NUDGE — calls Claude API
  ------------------------------------------ */

  async triggerNudge(noteId) {
    if (this.nudgeLoading) return;

    const data = window.meetingNotes?.getMeetingData(noteId);
    const note = storage.getNote(noteId);
    if (!data || !note) return;

    const stations = this.computeStations(data);
    const panel    = document.getElementById('journey-nudge-panel');
    const content  = document.getElementById('journey-nudge-content');
    const btn      = document.getElementById('journey-nudge-btn');
    if (!panel || !content || !btn) return;

    // Toggle off if already open and not loading
    if (panel.style.display !== 'none' && !this.nudgeLoading) {
      panel.style.display = 'none';
      return;
    }

    this.nudgeLoading  = true;
    btn.textContent    = '⏳ Thinking…';
    btn.disabled       = true;
    panel.style.display = 'block';
    content.innerHTML  = '<span class="journey-nudge-loading">Getting your nudge…</span>';

    // Build a compact state summary for Claude
    const stateLines = stations
      .map(s => `• ${s.label}: ${s.state.toUpperCase()} — ${s.tooltip}`)
      .join('\n');

    const prompt =
      `You are Wren, a friendly meeting secretary built into a note-taking app. ` +
      `A user needs a quick nudge about their meeting.\n\n` +
      `Meeting: "${note.title}"\n\n` +
      `Journey status:\n${stateLines}\n\n` +
      `Give ONE short, warm, specific nudge (max 2 sentences) about the single most ` +
      `important action they should take right now. Be encouraging, direct, and practical. ` +
      `No preamble or sign-off — just the nudge.`;

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model:      'claude-sonnet-4-20250514',
          max_tokens: 1000,
          messages:   [{ role: 'user', content: prompt }]
        })
      });

      if (!response.ok) throw new Error(`API ${response.status}`);

      const result = await response.json();
      const text   = result.content?.find(b => b.type === 'text')?.text
                     || "You're on track — keep going!";

      content.innerHTML = `<span class="journey-nudge-text">${this.esc(text)}</span>`;
    } catch (err) {
      console.error('MeetingJourney: nudge error', err);
      content.innerHTML = `<span class="journey-nudge-error">⚠ AI unavailable — check your connection and try again.</span>`;
    }

    this.nudgeLoading = false;
    btn.textContent   = '✨ AI Nudge';
    btn.disabled      = false;
  }

  /* ------------------------------------------
     DOCUMENT-LEVEL EVENTS
  ------------------------------------------ */

  bindDocumentEvents() {
    // Brief and follow-up dispatch this after they write to storage
    document.addEventListener('meetingDataChanged', () => this.refresh());
  }

  /* ------------------------------------------
     HELPERS
  ------------------------------------------ */

  fmtDate(d) {
    if (!d) return '';
    try {
      return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch (e) { return ''; }
  }

  fmtTime(iso) {
    if (!iso) return '';
    try {
      return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    } catch (e) { return ''; }
  }

  esc(str) {
    return String(str || '')
      .replace(/&/g,  '&amp;')
      .replace(/</g,  '&lt;')
      .replace(/>/g,  '&gt;')
      .replace(/"/g,  '&quot;');
  }
}

/* ------------------------------------------
   INITIALIZE
------------------------------------------ */

document.addEventListener('DOMContentLoaded', () => {
  window.meetingJourney = new MeetingJourney();
});

console.log('✅ meeting-journey.js loaded');
