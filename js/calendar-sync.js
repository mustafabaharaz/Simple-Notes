/**
 * calendar-sync.js
 * Phase 7 — Calendar Sync
 * Wren — Your always-on secretary
 *
 * Features:
 *   EXPORT:
 *     - All meetings → .ics download
 *     - Today's meetings → .ics download
 *
 *   IMPORT:
 *     - .ics file upload → creates Wren meeting notes
 *     - Google Calendar OAuth2 (implicit flow, requires client ID)
 *       → imports next 7 days of events as meeting notes
 *
 * All additive — zero edits to existing files.
 */

(function () {
  'use strict';

  class CalendarSync {
    constructor() {
      this.googleToken  = null;
      this.googleExpiry = 0;
      this.init();
    }

    // ─── Init ─────────────────────────────────────────────────────────

    init() {
      this.checkOAuthCallback(); // Must happen before DOM changes URL hash
      this.injectModal();
      this.injectTriggerButton();
      this.restoreGoogleSession();
      console.log('✅ Calendar sync loaded');
    }

    // ─── OAuth callback (runs before modal injection) ─────────────────

    checkOAuthCallback() {
      if (!window.location.hash.includes('access_token')) return;

      const params    = new URLSearchParams(window.location.hash.slice(1));
      const token     = params.get('access_token');
      const expiresIn = parseInt(params.get('expires_in') || '3600', 10);

      if (token) {
        this.googleToken  = token;
        this.googleExpiry = Date.now() + expiresIn * 1000;
        localStorage.setItem('wren_google_token',  token);
        localStorage.setItem('wren_google_expiry', String(this.googleExpiry));

        // Clean hash from URL without page reload
        history.replaceState(null, '', window.location.pathname + window.location.search);

        // Show success after DOM ready
        setTimeout(() => {
          this.updateGCalUI(true);
          this.showToast('✅ Google Calendar connected!', '#10b981');
        }, 800);
      }
    }

    restoreGoogleSession() {
      const token  = localStorage.getItem('wren_google_token');
      const expiry = parseInt(localStorage.getItem('wren_google_expiry') || '0', 10);
      if (token && expiry > Date.now()) {
        this.googleToken  = token;
        this.googleExpiry = expiry;
        this.updateGCalUI(true);
      }
    }

    // ─── Modal HTML ──────────────────────────────────────────────────

    injectModal() {
      const modal = document.createElement('div');
      modal.id        = 'cal-sync-modal';
      modal.className = 'cal-sync-modal';
      modal.style.display = 'none';
      modal.setAttribute('role', 'dialog');
      modal.setAttribute('aria-modal', 'true');
      modal.setAttribute('aria-label', 'Calendar Sync');

      modal.innerHTML = `
        <div class="cal-sync-content">
          <div class="cal-sync-header">
            <h2>📅 Calendar Sync</h2>
            <button class="cal-sync-close" id="cal-sync-close" title="Close">✕</button>
          </div>

          <div class="cal-sync-body">

            <!-- ── EXPORT ─────────────────────────────── -->
            <div class="cal-sync-section">
              <div class="cal-sync-section-title">📤 Export to Calendar</div>

              <div class="cal-option-card">
                <div class="cal-option-header">
                  <span class="cal-option-icon">📅</span>
                  <span class="cal-option-title">Download as .ics file</span>
                </div>
                <p class="cal-option-desc">
                  Export Wren meeting notes as a standard calendar file. Import into Google Calendar,
                  Apple Calendar, Outlook, or any calendar app that supports .ics.
                </p>
                <div class="cal-btn-row">
                  <button class="cal-btn cal-btn-primary" id="cal-export-all-btn">
                    ⬇️ Export All Meetings
                  </button>
                  <button class="cal-btn cal-btn-secondary" id="cal-export-today-btn">
                    📅 Today Only
                  </button>
                </div>
                <div class="cal-export-status" id="cal-export-status"></div>
              </div>
            </div>

            <!-- ── IMPORT ─────────────────────────────── -->
            <div class="cal-sync-section">
              <div class="cal-sync-section-title">📥 Import from Calendar</div>

              <!-- .ics file import -->
              <div class="cal-option-card">
                <div class="cal-option-header">
                  <span class="cal-option-icon">📂</span>
                  <span class="cal-option-title">Import from .ics file</span>
                </div>
                <p class="cal-option-desc">
                  Upload any .ics calendar file. Events are converted into Wren meeting notes.
                  Export from Google Calendar (Settings → Import/Export), Apple Calendar
                  (File → Export), or Outlook.
                </p>
                <input type="file" id="cal-ics-input" accept=".ics,.ical" style="display:none">
                <div class="cal-btn-row">
                  <button class="cal-btn cal-btn-secondary" id="cal-import-ics-btn">
                    📂 Choose .ics File
                  </button>
                </div>
                <div id="cal-ics-result" class="cal-import-result" style="display:none;"></div>
              </div>

              <!-- Google Calendar -->
              <div class="cal-option-card">
                <div class="cal-option-header">
                  <span class="cal-option-icon">${this.googleSVG()}</span>
                  <span class="cal-option-title">Google Calendar</span>
                  <span id="gcal-status-badge" class="cal-status-badge disconnected">Not connected</span>
                </div>
                <p class="cal-option-desc" id="gcal-desc">
                  Import upcoming events from Google Calendar as Wren meeting notes.
                  Requires a Google OAuth Client ID (free setup, ~2 minutes).
                </p>

                <!-- Setup instructions (collapsed) -->
                <div id="gcal-setup-box" class="cal-setup-box" style="display:none;">
                  <strong>One-time setup</strong>
                  1. Go to <a href="https://console.cloud.google.com" target="_blank" rel="noopener">console.cloud.google.com</a><br>
                  2. Create a project → Enable <strong>Google Calendar API</strong><br>
                  3. Create <strong>OAuth 2.0 credentials</strong> → Web Application<br>
                  4. Add your site URL as an authorized JavaScript origin<br>
                  5. Copy the Client ID and paste below
                </div>

                <!-- Client ID entry -->
                <div id="gcal-clientid-section" style="display:none;margin-bottom:10px;">
                  <div class="cal-client-id-row">
                    <input type="text" id="gcal-clientid-input" class="cal-client-id-input"
                      placeholder="Paste your Google OAuth Client ID…">
                    <button class="cal-btn cal-btn-primary" id="gcal-save-clientid-btn" style="padding:8px 12px;font-size:12px;">
                      Save
                    </button>
                  </div>
                </div>

                <!-- Connect / Setup buttons (shown when disconnected) -->
                <div id="gcal-connect-row" class="cal-btn-row">
                  <button class="cal-btn cal-btn-google" id="gcal-connect-btn">
                    ${this.googleSVG(14)} Connect Google Calendar
                  </button>
                  <button class="cal-btn cal-btn-secondary" id="gcal-setup-btn" style="font-size:11px;">
                    ⚙️ Setup help
                  </button>
                </div>

                <!-- Connected panel -->
                <div id="gcal-connected-panel" class="gcal-connected-panel" style="display:none;">
                  <div class="cal-btn-row">
                    <button class="cal-btn cal-btn-primary" id="gcal-import-btn">
                      📥 Import Next 7 Days
                    </button>
                    <button class="cal-btn cal-btn-danger" id="gcal-disconnect-btn" style="font-size:11px;">
                      Disconnect
                    </button>
                  </div>
                  <div id="gcal-import-status" class="gcal-status-text"></div>
                </div>
              </div>
            </div>

          </div><!-- /cal-sync-body -->
        </div><!-- /cal-sync-content -->
      `;

      document.body.appendChild(modal);
      this.bindModalEvents(modal);
    }

    bindModalEvents(modal) {
      // Close
      modal.querySelector('#cal-sync-close')
        ?.addEventListener('click', () => this.closeModal());
      modal.addEventListener('click', (e) => {
        if (e.target === modal) this.closeModal();
      });

      // Export
      modal.querySelector('#cal-export-all-btn')
        ?.addEventListener('click', () => this.exportAll());
      modal.querySelector('#cal-export-today-btn')
        ?.addEventListener('click', () => this.exportToday());

      // ICS import
      modal.querySelector('#cal-import-ics-btn')
        ?.addEventListener('click', () => modal.querySelector('#cal-ics-input')?.click());
      modal.querySelector('#cal-ics-input')
        ?.addEventListener('change', (e) => {
          if (e.target.files?.[0]) this.importFromFile(e.target.files[0]);
        });

      // Google setup toggle
      modal.querySelector('#gcal-setup-btn')
        ?.addEventListener('click', () => {
          ['gcal-setup-box', 'gcal-clientid-section'].forEach(id => {
            const el = modal.querySelector('#' + id);
            if (el) el.style.display = el.style.display === 'none' ? 'block' : 'none';
          });
          modal.querySelector('#gcal-clientid-input')?.focus();
        });

      // Save client ID
      modal.querySelector('#gcal-save-clientid-btn')
        ?.addEventListener('click', () => {
          const val = (modal.querySelector('#gcal-clientid-input')?.value || '').trim();
          if (val) {
            localStorage.setItem('wren_google_client_id', val);
            this.showToast('✅ Client ID saved — now click Connect', '#10b981');
            modal.querySelector('#gcal-setup-box').style.display    = 'none';
            modal.querySelector('#gcal-clientid-section').style.display = 'none';
          }
        });

      // Connect / disconnect
      modal.querySelector('#gcal-connect-btn')
        ?.addEventListener('click', () => this.startGoogleAuth());
      modal.querySelector('#gcal-disconnect-btn')
        ?.addEventListener('click', () => this.disconnectGoogle());

      // Import from Google
      modal.querySelector('#gcal-import-btn')
        ?.addEventListener('click', () => this.importFromGoogle());
    }

    // ─── Trigger Button ──────────────────────────────────────────────

    injectTriggerButton() {
      setTimeout(() => {
        if (document.getElementById('cal-trigger-btn')) return;

        const btn = document.createElement('button');
        btn.id        = 'cal-trigger-btn';
        btn.className = 'cal-trigger-btn';
        btn.title     = 'Calendar Sync';
        btn.innerHTML = '📅 Calendar';
        btn.addEventListener('click', () => this.openModal());

        // Try org-nav first, then contacts button, then just body
        const orgNav  = document.getElementById('org-nav');
        const orgBtn  = document.getElementById('org-contacts-btn');
        const orgMeet = document.getElementById('btn-new-meeting');

        if (orgNav) {
          orgNav.appendChild(btn);
        } else if (orgBtn) {
          orgBtn.parentNode.insertBefore(btn, orgBtn.nextSibling);
        } else if (orgMeet) {
          orgMeet.parentNode.insertBefore(btn, orgMeet.nextSibling);
        }
      }, 1000);
    }

    // ─── Open / Close ────────────────────────────────────────────────

    openModal() {
      document.getElementById('cal-sync-modal').style.display = 'flex';
    }

    closeModal() {
      document.getElementById('cal-sync-modal').style.display = 'none';
    }

    // ─── Export ──────────────────────────────────────────────────────

    getMeetings(todayOnly = false) {
      let meetings = [];
      try {
        meetings = JSON.parse(localStorage.getItem('wren_meetings') || '[]');
      } catch (e) {}

      if (todayOnly) {
        const today = new Date().toDateString();
        meetings = meetings.filter(m => new Date(m.date || m.created).toDateString() === today);
      }
      return meetings;
    }

    exportAll() {
      const meetings = this.getMeetings(false);
      const statusEl = document.getElementById('cal-export-status');
      if (!meetings.length) {
        if (statusEl) statusEl.textContent = '⚠️ No meetings found.';
        return;
      }
      this.downloadICS(meetings, 'wren-all-meetings.ics');
      if (statusEl) statusEl.textContent = `✅ Exported ${meetings.length} meeting(s)`;
    }

    exportToday() {
      const meetings = this.getMeetings(true);
      const statusEl = document.getElementById('cal-export-status');
      if (!meetings.length) {
        if (statusEl) statusEl.textContent = '⚠️ No meetings scheduled today.';
        return;
      }
      this.downloadICS(meetings, 'wren-today.ics');
      if (statusEl) statusEl.textContent = `✅ Exported ${meetings.length} meeting(s) for today`;
    }

    downloadICS(meetings, filename) {
      const content = this.generateICS(meetings);
      const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }

    generateICS(meetings) {
      const lines = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//Wren//Meeting Notes//EN',
        'CALSCALE:GREGORIAN',
        'METHOD:PUBLISH',
        'X-WR-CALNAME:Wren Meetings',
        'X-WR-TIMEZONE:UTC'
      ];

      meetings.forEach(m => {
        const uid      = `${m.id || Date.now()}@wren.app`;
        const dtStart  = this.toICSDatetime(m.date, m.time || m.startTime, 0);
        const dtEnd    = this.toICSDatetime(m.date, m.time || m.startTime, m.duration || 60);
        const dtstamp  = this.toICSDatetimeRaw(new Date(m.created || Date.now()));

        // Build description from agenda + attendees
        const parts = [];
        if (m.agenda)     parts.push('Agenda: ' + m.agenda);
        if (m.attendees?.length) {
          const names = m.attendees
            .map(a => (typeof a === 'string' ? a : a.name || a.email || ''))
            .filter(Boolean).join(', ');
          if (names) parts.push('Attendees: ' + names);
        }
        const description = parts.join('\\n');

        lines.push('BEGIN:VEVENT');
        lines.push(`UID:${uid}`);
        lines.push(`DTSTAMP:${dtstamp}`);
        lines.push(`DTSTART:${dtStart}`);
        lines.push(`DTEND:${dtEnd}`);
        lines.push(`SUMMARY:${this.escICS(m.title || 'Wren Meeting')}`);
        if (description) lines.push(`DESCRIPTION:${this.escICS(description)}`);
        if (m.location)  lines.push(`LOCATION:${this.escICS(m.location)}`);
        lines.push('END:VEVENT');
      });

      lines.push('END:VCALENDAR');
      return lines.join('\r\n');
    }

    toICSDatetime(dateStr, timeStr, addMinutes) {
      let d = dateStr ? new Date(dateStr) : new Date();
      if (timeStr) {
        const [h, m] = this.parseTime(timeStr);
        d.setHours(h, m, 0, 0);
      }
      if (addMinutes) d = new Date(d.getTime() + addMinutes * 60000);
      return this.toICSDatetimeRaw(d);
    }

    toICSDatetimeRaw(date) {
      return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    }

    parseTime(timeStr) {
      if (!timeStr) return [9, 0];
      const m = timeStr.match(/(\d+):(\d+)\s*(AM|PM)?/i);
      if (!m) return [9, 0];
      let h = parseInt(m[1], 10);
      const min = parseInt(m[2], 10);
      const ampm = (m[3] || '').toUpperCase();
      if (ampm === 'PM' && h < 12) h += 12;
      if (ampm === 'AM' && h === 12) h = 0;
      return [h, min];
    }

    escICS(str) {
      if (!str) return '';
      return String(str)
        .replace(/\\/g, '\\\\')
        .replace(/;/g, '\\;')
        .replace(/,/g, '\\,')
        .replace(/\n/g, '\\n')
        .replace(/\r/g, '');
    }

    // ─── ICS File Import ─────────────────────────────────────────────

    importFromFile(file) {
      const resultEl = document.getElementById('cal-ics-result');
      if (resultEl) {
        resultEl.style.display = 'block';
        resultEl.className     = 'cal-import-result';
        resultEl.textContent   = '⏳ Parsing file…';
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const events  = this.parseICS(e.target.result);
          const created = this.createMeetingsFromEvents(events);
          if (resultEl) {
            resultEl.className = `cal-import-result ${created > 0 ? 'success' : ''}`;
            resultEl.textContent = created > 0
              ? `✅ Imported ${created} event(s) as meeting notes`
              : `ℹ️ No new events found (${events.length} parsed — may already exist)`;
          }
        } catch (err) {
          console.error('[CalSync] ICS parse error:', err);
          if (resultEl) {
            resultEl.className   = 'cal-import-result error';
            resultEl.textContent = '❌ Could not parse file. Please use a valid .ics file.';
          }
        }
      };
      reader.onerror = () => {
        if (resultEl) {
          resultEl.className   = 'cal-import-result error';
          resultEl.textContent = '❌ Could not read file.';
        }
      };
      reader.readAsText(file);

      // Reset input so same file can be re-selected
      document.getElementById('cal-ics-input').value = '';
    }

    parseICS(raw) {
      // Normalize line endings, unfold continuation lines
      const content  = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
      const unfolded = content.replace(/\n[ \t]/g, '');
      const lines    = unfolded.split('\n');

      const events = [];
      let cur = null;

      lines.forEach(line => {
        if (line === 'BEGIN:VEVENT') {
          cur = {};
        } else if (line === 'END:VEVENT' && cur) {
          events.push(cur);
          cur = null;
        } else if (cur) {
          const sep   = line.indexOf(':');
          if (sep === -1) return;
          const prop  = line.slice(0, sep).toUpperCase();   // e.g. DTSTART;TZID=...
          const val   = line.slice(sep + 1).trim();
          const key   = prop.split(';')[0];                 // strip params

          if (key === 'SUMMARY')                           cur.title       = this.unescICS(val);
          else if (key === 'DTSTART')                      cur.dtstart     = val;
          else if (key === 'DTEND')                        cur.dtend       = val;
          else if (key === 'DESCRIPTION')                  cur.description = this.unescICS(val).replace(/\\n/g, '\n');
          else if (key === 'LOCATION')                     cur.location    = this.unescICS(val);
          else if (key === 'UID')                          cur.uid         = val;
          else if (key === 'ORGANIZER')                    cur.organizer   = val;
        }
      });

      return events;
    }

    unescICS(str) {
      return str
        .replace(/\\,/g, ',')
        .replace(/\\;/g, ';')
        .replace(/\\\\/g, '\\')
        .replace(/\\n/g, '\n');
    }

    parseICSDate(dtStr) {
      if (!dtStr) return new Date();
      // Strip TZID param if present (e.g., "TZID=America/New_York:20240101T090000")
      const raw   = dtStr.includes(':') ? dtStr.split(':').pop() : dtStr;
      const clean = raw.replace('Z', '');

      if (clean.includes('T')) {
        const [datePart, timePart] = clean.split('T');
        const y = datePart.slice(0, 4), mo = datePart.slice(4, 6), d = datePart.slice(6, 8);
        const h = timePart.slice(0, 2), m  = timePart.slice(2, 4);
        return new Date(`${y}-${mo}-${d}T${h}:${m}:00`);
      } else {
        const y = clean.slice(0, 4), mo = clean.slice(4, 6), d = clean.slice(6, 8);
        return new Date(`${y}-${mo}-${d}`);
      }
    }

    createMeetingsFromEvents(events) {
      if (!events.length) return 0;

      let existing = [];
      try {
        existing = JSON.parse(localStorage.getItem('wren_meetings') || '[]');
      } catch (e) {}

      const existingUids = new Set(existing.map(m => m.uid || ''));
      let created = 0;

      events.forEach(ev => {
        const uid = ev.uid || '';
        if (uid && existingUids.has(uid)) return; // skip duplicates

        const startDate  = this.parseICSDate(ev.dtstart);
        const endDate    = ev.dtend ? this.parseICSDate(ev.dtend) : null;
        const durationMin = endDate
          ? Math.max(1, Math.round((endDate - startDate) / 60000))
          : 60;

        const dateStr = startDate.toISOString().split('T')[0];
        const timeStr = startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        const meeting = {
          id:        `cal_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          uid,
          title:     ev.title     || 'Imported Event',
          date:      dateStr,
          time:      timeStr,
          duration:  durationMin,
          location:  ev.location  || '',
          agenda:    ev.description || '',
          attendees: [],
          actionItems: [],
          source:    'ics-import',
          created:   new Date().toISOString(),
          modified:  new Date().toISOString()
        };

        existing.push(meeting);
        if (uid) existingUids.add(uid);
        created++;
      });

      if (created > 0) {
        localStorage.setItem('wren_meetings', JSON.stringify(existing));

        // Attempt to refresh meetings UI
        try {
          if (window.meetingNotes?.loadMeetings)     window.meetingNotes.loadMeetings();
          else if (window.loadMeetings)              window.loadMeetings();
        } catch (e) {}
      }

      return created;
    }

    // ─── Google Calendar OAuth ────────────────────────────────────────

    startGoogleAuth() {
      const clientId = localStorage.getItem('wren_google_client_id');

      if (!clientId) {
        // Show setup instructions + client ID input
        ['gcal-setup-box', 'gcal-clientid-section'].forEach(id => {
          const el = document.getElementById(id);
          if (el) el.style.display = 'block';
        });
        document.getElementById('gcal-clientid-input')?.focus();
        return;
      }

      // Construct OAuth URL (implicit flow — no backend needed)
      const redirectUri = window.location.origin + window.location.pathname;
      const scope       = 'https://www.googleapis.com/auth/calendar.readonly';
      const url = 'https://accounts.google.com/o/oauth2/v2/auth?' +
        `client_id=${encodeURIComponent(clientId)}` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}` +
        `&response_type=token` +
        `&scope=${encodeURIComponent(scope)}` +
        `&prompt=consent`;

      window.location.href = url;
    }

    disconnectGoogle() {
      this.googleToken  = null;
      this.googleExpiry = 0;
      localStorage.removeItem('wren_google_token');
      localStorage.removeItem('wren_google_expiry');
      this.updateGCalUI(false);
      this.showToast('Google Calendar disconnected', '#6b7280');
    }

    updateGCalUI(connected) {
      const badge         = document.getElementById('gcal-status-badge');
      const connectRow    = document.getElementById('gcal-connect-row');
      const connectedPanel= document.getElementById('gcal-connected-panel');

      if (badge) {
        badge.textContent = connected ? '✓ Connected' : 'Not connected';
        badge.className   = `cal-status-badge ${connected ? 'connected' : 'disconnected'}`;
      }
      if (connectRow)     connectRow.style.display      = connected ? 'none'  : 'flex';
      if (connectedPanel) connectedPanel.style.display  = connected ? 'flex'  : 'none';
    }

    async importFromGoogle() {
      if (!this.googleToken) {
        this.showToast('Please connect Google Calendar first', '#f59e0b');
        return;
      }

      // Check if token is still valid
      if (this.googleExpiry <= Date.now()) {
        this.disconnectGoogle();
        this.showToast('Session expired — please reconnect Google Calendar', '#ef4444');
        return;
      }

      const statusEl = document.getElementById('gcal-import-status');
      if (statusEl) statusEl.textContent = '⏳ Fetching events from Google Calendar…';

      try {
        const now    = new Date().toISOString();
        const future = new Date(Date.now() + 7 * 86400000).toISOString();

        const res = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/primary/events` +
          `?timeMin=${encodeURIComponent(now)}` +
          `&timeMax=${encodeURIComponent(future)}` +
          `&singleEvents=true&orderBy=startTime&maxResults=50`,
          { headers: { Authorization: `Bearer ${this.googleToken}` } }
        );

        if (!res.ok) {
          if (res.status === 401) {
            this.disconnectGoogle();
            if (statusEl) statusEl.textContent = '❌ Session expired. Please reconnect.';
            return;
          }
          throw new Error(`HTTP ${res.status}`);
        }

        const data = await res.json();
        const events = (data.items || []).map(item => ({
          uid:         (item.id || '') + '@gcal',
          title:       item.summary   || 'Google Event',
          dtstart:     item.start?.dateTime || item.start?.date || '',
          dtend:       item.end?.dateTime   || item.end?.date   || '',
          description: item.description || '',
          location:    item.location   || ''
        }));

        const created = this.createMeetingsFromEvents(events);

        if (statusEl) {
          statusEl.textContent = created > 0
            ? `✅ Imported ${created} event(s) as meeting notes`
            : `ℹ️ No new events (${events.length} fetched — all may already exist)`;
        }

      } catch (err) {
        console.error('[CalSync] Google import error:', err);
        if (statusEl) statusEl.textContent = '❌ Import failed — please try again.';
      }
    }

    // ─── Helpers ─────────────────────────────────────────────────────

    showToast(msg, bg = '#4F46E5') {
      const toast = document.createElement('div');
      toast.className = 'wren-success-toast';
      toast.style.background  = bg;
      toast.style.boxShadow   = `0 8px 24px ${bg}55`;
      toast.textContent = msg;
      document.body.appendChild(toast);
      setTimeout(() => toast.remove(), 3500);
    }

    googleSVG(size = 20) {
      return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
      </svg>`;
    }
  }

  // ─── Init ──────────────────────────────────────────────────────────

  function init() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        window.calendarSync = new CalendarSync();
      });
    } else {
      window.calendarSync = new CalendarSync();
    }
  }

  init();
})();
