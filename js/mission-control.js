/**
 * mission-control.js
 * Phase 7 — Mission Control Sidebar
 * Wren — Your always-on secretary
 *
 * Collapsible right sidebar with:
 *   - Today's meetings/notes overview
 *   - Upcoming action items
 *   - Pending carry-forwards
 *   - Upcoming reminders
 *   - Recent activity feed
 *
 * Keyboard shortcut: Ctrl+Shift+M (or Cmd+Shift+M on Mac)
 * All additive — zero edits to existing files.
 */

(function () {
  'use strict';

  class MissionControl {
    constructor() {
      this.isOpen = false;
      this.refreshTimer = null;
      this.init();
    }

    init() {
      this.injectHTML();
      this.bindEvents();
      this.scheduleRefresh();
      console.log('✅ Mission Control loaded — Ctrl+Shift+M to open');
    }

    // ─── HTML Injection ──────────────────────────────────────────────

    injectHTML() {
      // Overlay (behind sidebar, click to close)
      const overlay = document.createElement('div');
      overlay.id = 'mc-overlay';
      overlay.className = 'mc-overlay';
      document.body.appendChild(overlay);

      // Toggle tab (visible on right edge)
      const toggleBtn = document.createElement('button');
      toggleBtn.id = 'mc-toggle-btn';
      toggleBtn.className = 'mc-toggle-btn';
      toggleBtn.setAttribute('title', 'Mission Control (Ctrl+Shift+M)');
      toggleBtn.innerHTML = `
        <span class="mc-toggle-icon">🎛️</span>
        <span class="mc-toggle-label">MC</span>
      `;
      document.body.appendChild(toggleBtn);

      // Sidebar
      const sidebar = document.createElement('aside');
      sidebar.id = 'mission-control-sidebar';
      sidebar.className = 'mission-control-sidebar';
      sidebar.setAttribute('aria-label', 'Mission Control');
      sidebar.innerHTML = `
        <div class="mc-header">
          <div class="mc-header-left">
            <span style="font-size:15px">🎛️</span>
            <span class="mc-header-title">Mission Control</span>
          </div>
          <button class="mc-close-btn" id="mc-close-btn" title="Close (Esc)">✕</button>
        </div>
        <div class="mc-date-bar" id="mc-date-bar"></div>
        <div class="mc-body" id="mc-body">
          <div style="padding:20px;text-align:center;color:var(--color-text-secondary);font-size:13px;">
            Loading…
          </div>
        </div>
      `;
      document.body.appendChild(sidebar);
    }

    // ─── Events ──────────────────────────────────────────────────────

    bindEvents() {
      document.getElementById('mc-toggle-btn')
        ?.addEventListener('click', () => this.toggle());

      document.getElementById('mc-close-btn')
        ?.addEventListener('click', () => this.close());

      document.getElementById('mc-overlay')
        ?.addEventListener('click', () => this.close());

      // Keyboard shortcut
      document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'M') {
          e.preventDefault();
          this.toggle();
        }
        if (e.key === 'Escape' && this.isOpen) {
          this.close();
        }
      });
    }

    // ─── Open / Close ────────────────────────────────────────────────

    toggle() {
      this.isOpen ? this.close() : this.open();
    }

    open() {
      this.isOpen = true;
      this.refresh();
      document.getElementById('mission-control-sidebar')?.classList.add('is-open');
      document.getElementById('mc-toggle-btn')?.classList.add('sidebar-open');
      document.getElementById('mc-overlay')?.classList.add('is-visible');
    }

    close() {
      this.isOpen = false;
      document.getElementById('mission-control-sidebar')?.classList.remove('is-open');
      document.getElementById('mc-toggle-btn')?.classList.remove('sidebar-open');
      document.getElementById('mc-overlay')?.classList.remove('is-visible');
    }

    scheduleRefresh() {
      // Refresh every 60s when open
      this.refreshTimer = setInterval(() => {
        if (this.isOpen) this.refresh();
      }, 60000);
    }

    // ─── Data Gathering ──────────────────────────────────────────────

    getTodayItems() {
      const today = new Date().toDateString();
      const items = [];

      // Notes modified today
      try {
        if (typeof storage !== 'undefined') {
          storage.getNotes().forEach(n => {
            const d = new Date(n.modified || n.created);
            if (d.toDateString() === today) {
              items.push({
                type: 'note',
                id: n.id,
                title: n.title || 'Untitled',
                time: d,
                raw: n
              });
            }
          });
        }
      } catch (e) { /* storage not ready */ }

      // Meetings scheduled today
      try {
        const meetings = JSON.parse(localStorage.getItem('wren_meetings') || '[]');
        meetings.forEach(m => {
          const d = new Date(m.date || m.created);
          if (d.toDateString() === today) {
            items.push({
              type: 'meeting',
              id: m.id,
              title: m.title || 'Meeting',
              time: new Date(m.date + (m.time ? 'T' + this.to24hStr(m.time) : '')),
              raw: m
            });
          }
        });
      } catch (e) {}

      items.sort((a, b) => new Date(b.time) - new Date(a.time));
      return items;
    }

    getActionItems() {
      const items = [];
      try {
        const meetings = JSON.parse(localStorage.getItem('wren_meetings') || '[]');
        meetings.forEach(m => {
          const actionList = m.actionItems || m.actions || [];
          actionList.forEach(a => {
            const text = typeof a === 'string' ? a : (a.text || a.content || '');
            const done = typeof a === 'object' ? (a.done || a.completed || a.checked) : false;
            if (text && !done) {
              items.push({
                text,
                meetingTitle: m.title || 'Meeting',
                meetingId: m.id,
                assignee: typeof a === 'object' ? (a.assignee || a.owner || '') : '',
                dueDate: typeof a === 'object' ? (a.dueDate || a.due || '') : ''
              });
            }
          });
        });
      } catch (e) {}
      return items;
    }

    getCarryForwards() {
      const items = [];
      try {
        const cf = JSON.parse(localStorage.getItem('wren_carry_forwards') || '[]');
        cf.forEach(item => {
          if (!item.resolved && !item.done) {
            items.push(item);
          }
        });
      } catch (e) {}
      return items;
    }

    getUpcomingReminders() {
      const items = [];
      try {
        const reminders = JSON.parse(localStorage.getItem('wren_reminders') || '[]');
        const now = Date.now();
        reminders.forEach(r => {
          if (!r.fired && new Date(r.datetime).getTime() > now) {
            items.push(r);
          }
        });
        items.sort((a, b) => new Date(a.datetime) - new Date(b.datetime));
      } catch (e) {}
      return items;
    }

    getActivityFeed() {
      const activities = [];
      try {
        if (typeof storage !== 'undefined') {
          storage.getNotes()
            .sort((a, b) => new Date(b.modified || b.created) - new Date(a.modified || a.created))
            .slice(0, 10)
            .forEach(n => {
              activities.push({
                time: new Date(n.modified || n.created),
                text: (n.title || 'Untitled') + ' — edited',
                noteId: n.id
              });
            });
        }
      } catch (e) {}
      return activities;
    }

    // ─── Render ──────────────────────────────────────────────────────

    refresh() {
      this.updateDateBar();

      const today     = this.getTodayItems();
      const actions   = this.getActionItems();
      const cfs       = this.getCarryForwards();
      const reminders = this.getUpcomingReminders();
      const activity  = this.getActivityFeed();

      const body = document.getElementById('mc-body');
      if (!body) return;

      body.innerHTML =
        this.renderSection('today',   '📅 Today',          today.length,     this.renderTodayItems(today))    +
        this.renderSection('actions', '✅ Action Items',   actions.length,   this.renderActionItems(actions), actions.length   ? 'badge-warning' : 'badge-zero') +
        this.renderSection('cf',      '↩ Carry‑Forwards',  cfs.length,       this.renderCFItems(cfs),        cfs.length       ? 'badge-warning' : 'badge-zero') +
        this.renderSection('remind',  '⏰ Reminders',      reminders.length, this.renderReminderItems(reminders)) +
        this.renderSection('activity','📋 Activity',       activity.length,  this.renderActivityItems(activity), 'badge-success', true);

      this.bindSectionHeaders(body);
      this.bindItemClicks(body);
      this.bindReminderDeletes(body);
    }

    renderSection(key, title, count, content, badgeClass = '', startCollapsed = false) {
      const collapsed = startCollapsed ? 'collapsed' : '';
      const bc = count > 0 ? badgeClass : 'badge-zero';
      return `
        <div class="mc-section ${collapsed}" data-mc-key="${this.esc(key)}">
          <div class="mc-section-header">
            <div class="mc-section-title">
              ${this.esc(title)}
              <span class="mc-section-badge ${bc}">${count}</span>
            </div>
            <span class="mc-section-chevron">▼</span>
          </div>
          <div class="mc-section-body">
            ${content || '<div class="mc-empty">Nothing here yet</div>'}
          </div>
        </div>
      `;
    }

    renderTodayItems(items) {
      if (!items.length) return '<div class="mc-empty">No activity today yet</div>';
      return items.map(item => `
        <div class="mc-item" data-note-id="${this.esc(item.id)}" data-item-type="${item.type}">
          <div class="mc-item-dot ${item.type === 'meeting' ? 'dot-warning' : ''}"></div>
          <div class="mc-item-content">
            <div class="mc-item-title">${this.esc(item.title)}</div>
            <div class="mc-item-meta">
              ${item.type === 'meeting' ? '📅 Meeting' : '📝 Note'}
              · ${this.formatTime(item.time)}
            </div>
          </div>
        </div>
      `).join('');
    }

    renderActionItems(items) {
      if (!items.length) return '<div class="mc-empty">All clear ✓</div>';
      return items.slice(0, 12).map(item => `
        <div class="mc-item">
          <div class="mc-item-dot dot-warning"></div>
          <div class="mc-item-content">
            <div class="mc-item-title">${this.esc(item.text)}</div>
            <div class="mc-item-meta">
              ${this.esc(item.meetingTitle)}
              ${item.assignee ? ' · ' + this.esc(item.assignee) : ''}
              ${item.dueDate  ? ' · Due ' + this.esc(item.dueDate) : ''}
            </div>
          </div>
        </div>
      `).join('');
    }

    renderCFItems(items) {
      if (!items.length) return '<div class="mc-empty">No pending carry-forwards</div>';
      return items.slice(0, 10).map(item => `
        <div class="mc-item">
          <div class="mc-item-dot dot-danger"></div>
          <div class="mc-item-content">
            <div class="mc-item-title">${this.esc(item.text || item.content || 'Item')}</div>
            <div class="mc-item-meta">From: ${this.esc(item.fromMeeting || item.source || 'Previous meeting')}</div>
          </div>
        </div>
      `).join('');
    }

    renderReminderItems(items) {
      if (!items.length) {
        return '<div class="mc-empty">No upcoming reminders</div>';
      }
      return items.slice(0, 8).map(r => `
        <div class="mc-reminder-item">
          <span class="mc-reminder-time">${this.formatShortDT(r.datetime)}</span>
          <span class="mc-reminder-text">${this.esc(r.message || r.noteTitle || 'Reminder')}</span>
          <button class="mc-reminder-delete" data-reminder-id="${this.esc(r.id)}" title="Delete">✕</button>
        </div>
      `).join('');
    }

    renderActivityItems(items) {
      if (!items.length) return '<div class="mc-empty">No recent activity</div>';
      return items.map(item => `
        <div class="mc-activity-item" data-note-id="${this.esc(item.noteId || '')}">
          <span class="mc-activity-time">${this.formatRel(item.time)}</span>
          <span class="mc-activity-text">${this.esc(item.text)}</span>
        </div>
      `).join('');
    }

    // ─── Interaction Binding ─────────────────────────────────────────

    bindSectionHeaders(body) {
      body.querySelectorAll('.mc-section-header').forEach(header => {
        header.addEventListener('click', () => {
          header.closest('.mc-section').classList.toggle('collapsed');
        });
      });
    }

    bindItemClicks(body) {
      body.querySelectorAll('.mc-item[data-note-id], .mc-activity-item[data-note-id]').forEach(el => {
        const noteId = el.dataset.noteId;
        if (!noteId) return;
        el.addEventListener('click', () => {
          this.openItem(noteId, el.dataset.itemType);
        });
      });
    }

    openItem(id, type) {
      try {
        if (type === 'meeting') {
          // Try to trigger meeting open
          const btn = document.getElementById('btn-new-meeting') || document.getElementById('workspace-toggle-btn');
          const meetings = JSON.parse(localStorage.getItem('wren_meetings') || '[]');
          const m = meetings.find(x => x.id === id);
          if (m && window.meetingNotes?.openMeeting) {
            window.meetingNotes.openMeeting(m);
          }
        } else {
          // Open note
          if (typeof storage !== 'undefined' && typeof app !== 'undefined') {
            const note = storage.getNotes().find(n => n.id === id);
            if (note && app.openNote) {
              app.openNote(note);
            }
          }
        }
      } catch (e) {}
      // Close sidebar on mobile
      if (window.innerWidth < 768) this.close();
    }

    bindReminderDeletes(body) {
      body.querySelectorAll('.mc-reminder-delete[data-reminder-id]').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const id = btn.dataset.reminderId;
          if (window.remindersSystem?.deleteReminder) {
            window.remindersSystem.deleteReminder(id);
          }
          this.refresh();
        });
      });
    }

    // ─── Date Bar ────────────────────────────────────────────────────

    updateDateBar() {
      const bar = document.getElementById('mc-date-bar');
      if (!bar) return;
      bar.textContent = new Date().toLocaleDateString('en-US', {
        weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
      });
    }

    // ─── Formatting Helpers ──────────────────────────────────────────

    formatTime(date) {
      return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    formatShortDT(datetime) {
      const d = new Date(datetime);
      const now = new Date();
      if (d.toDateString() === now.toDateString()) {
        return 'Today ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }
      const tomorrow = new Date(now.getTime() + 86400000);
      if (d.toDateString() === tomorrow.toDateString()) {
        return 'Tmrw ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }
      return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) +
             ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    formatRel(date) {
      const diffMs = Date.now() - new Date(date).getTime();
      const mins = Math.floor(diffMs / 60000);
      if (mins < 1)  return 'now';
      if (mins < 60) return mins + 'm';
      const hrs = Math.floor(mins / 60);
      if (hrs < 24)  return hrs + 'h';
      const days = Math.floor(hrs / 24);
      return days + 'd';
    }

    to24hStr(timeStr) {
      if (!timeStr) return '00:00:00';
      const m = timeStr.match(/(\d+):(\d+)\s*(AM|PM)?/i);
      if (!m) return '00:00:00';
      let h = parseInt(m[1]);
      const min = m[2];
      const ampm = (m[3] || '').toUpperCase();
      if (ampm === 'PM' && h < 12) h += 12;
      if (ampm === 'AM' && h === 12) h = 0;
      return `${String(h).padStart(2, '0')}:${min}:00`;
    }

    esc(str) {
      if (str === null || str === undefined) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    }
  }

  // ─── Init ──────────────────────────────────────────────────────────

  function init() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        window.missionControl = new MissionControl();
      });
    } else {
      window.missionControl = new MissionControl();
    }
  }

  init();
})();
