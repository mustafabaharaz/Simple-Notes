/**
 * reminders.js
 * Phase 7 — Local/browser-based reminders with Web Notifications
 * Wren — Your always-on secretary
 *
 * Features:
 *   - Set reminders on any open note via toolbar button
 *   - Quick presets: 15 min / 30 min / 1 hour / Tomorrow
 *   - Web Notifications API for desktop alerts (permission requested on first set)
 *   - In-app toast fallback (always fires)
 *   - localStorage persistence (wren_reminders)
 *   - Checker runs every 30s
 *   - Integrates with Mission Control sidebar
 *
 * All additive — zero edits to existing files.
 */

(function () {
  'use strict';

  class RemindersSystem {
    constructor() {
      this.reminders = [];
      this._pendingNoteId    = null;
      this._pendingNoteTitle = null;
      this.load();
      this.init();
    }

    // ─── Persistence ─────────────────────────────────────────────────

    load() {
      try {
        this.reminders = JSON.parse(localStorage.getItem('wren_reminders') || '[]');
      } catch (e) {
        this.reminders = [];
      }
    }

    save() {
      localStorage.setItem('wren_reminders', JSON.stringify(this.reminders));
      // Refresh Mission Control if it's open
      try { window.missionControl?.refresh(); } catch (e) {}
    }

    // ─── Init ─────────────────────────────────────────────────────────

    init() {
      this.injectModal();
      this.watchToolbar();
      this.startChecker();
      console.log('✅ Reminders system loaded');
    }

    // ─── Modal HTML ──────────────────────────────────────────────────

    injectModal() {
      const overlay = document.createElement('div');
      overlay.id    = 'reminder-modal-overlay';
      overlay.className = 'reminder-modal-overlay';
      overlay.style.display = 'none';
      overlay.innerHTML = `
        <div class="reminder-modal" role="dialog" aria-modal="true" aria-label="Set Reminder">
          <div class="reminder-modal-title">⏰ Set Reminder</div>
          <div class="reminder-note-chip" id="reminder-note-chip">📝 Current note</div>

          <div class="reminder-field">
            <label>Quick options</label>
            <div class="reminder-quick-row">
              <button class="reminder-quick-btn" data-offset-min="15">In 15 min</button>
              <button class="reminder-quick-btn" data-offset-min="30">In 30 min</button>
              <button class="reminder-quick-btn" data-offset-min="60">In 1 hour</button>
              <button class="reminder-quick-btn" data-offset-min="480">In 8 hours</button>
              <button class="reminder-quick-btn" data-offset-min="1440">Tomorrow</button>
            </div>
          </div>

          <div class="reminder-field">
            <label>Custom date &amp; time</label>
            <input type="datetime-local" id="reminder-dt-input" />
          </div>

          <div class="reminder-field">
            <label>Message <span style="font-weight:400;text-transform:none;letter-spacing:0">(optional)</span></label>
            <input type="text" id="reminder-msg-input" placeholder="What do you need to do?" maxlength="200" />
          </div>

          <div class="reminder-modal-actions">
            <button class="reminder-save-btn"   id="reminder-save-btn">⏰ Set Reminder</button>
            <button class="reminder-cancel-btn" id="reminder-cancel-btn">Cancel</button>
          </div>
        </div>
      `;
      document.body.appendChild(overlay);

      // Bind modal events
      document.getElementById('reminder-cancel-btn')
        ?.addEventListener('click', () => this.closeModal());

      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) this.closeModal();
      });

      document.getElementById('reminder-save-btn')
        ?.addEventListener('click', () => this.saveFromModal());

      // Quick preset buttons
      overlay.querySelectorAll('.reminder-quick-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const mins = parseInt(btn.dataset.offsetMin, 10);
          const dt = new Date(Date.now() + mins * 60000);
          const input = document.getElementById('reminder-dt-input');
          if (input) input.value = this.toLocalInputValue(dt);

          // Highlight active
          overlay.querySelectorAll('.reminder-quick-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
        });
      });

      // Set default datetime to +1 hour
      this.resetModalDefaults();
    }

    resetModalDefaults() {
      const dtInput = document.getElementById('reminder-dt-input');
      if (dtInput) {
        dtInput.value = this.toLocalInputValue(new Date(Date.now() + 3600000));
      }
      const msgInput = document.getElementById('reminder-msg-input');
      if (msgInput) msgInput.value = '';

      // Remove active from quick buttons
      document.querySelectorAll('.reminder-quick-btn').forEach(b => b.classList.remove('active'));
    }

    toLocalInputValue(date) {
      // datetime-local needs format: YYYY-MM-DDTHH:MM
      const offset = date.getTimezoneOffset() * 60000;
      return new Date(date.getTime() - offset).toISOString().slice(0, 16);
    }

    // ─── Toolbar Button ──────────────────────────────────────────────

    watchToolbar() {
      // Inject on initial load
      setTimeout(() => this.tryInjectToolbarButton(), 800);
      setTimeout(() => this.tryInjectToolbarButton(), 2500);

      // Watch for toolbar visibility changes
      const toolbar = document.getElementById('unified-toolbar');
      if (toolbar) {
        const obs = new MutationObserver(() => this.tryInjectToolbarButton());
        obs.observe(toolbar, { attributes: true, attributeFilter: ['style', 'class'] });
      }

      // Also watch for note open via note-title changes
      const titleEl = document.getElementById('note-title');
      if (titleEl) {
        const obs2 = new MutationObserver(() => this.updateToolbarButtonState());
        obs2.observe(titleEl, { attributes: true, attributeFilter: ['value'] });
      }
    }

    tryInjectToolbarButton() {
      if (document.getElementById('reminder-toolbar-btn')) {
        this.updateToolbarButtonState();
        return;
      }

      const toolbar = document.getElementById('unified-toolbar');
      if (!toolbar) return;
      if (toolbar.style.display === 'none') return;

      const btn = document.createElement('button');
      btn.id = 'reminder-toolbar-btn';
      btn.className = 'reminder-toolbar-btn';
      btn.title = 'Set a reminder for this note';
      btn.innerHTML = '⏰ Remind';
      btn.addEventListener('click', () => this.openModal());
      toolbar.appendChild(btn);

      this.updateToolbarButtonState();
    }

    updateToolbarButtonState() {
      const btn = document.getElementById('reminder-toolbar-btn');
      if (!btn) return;

      const noteId = this.getCurrentNoteId();
      if (!noteId) return;

      const hasReminder = this.reminders.some(r => r.noteId === noteId && !r.fired);
      btn.classList.toggle('has-reminder', hasReminder);
      btn.title = hasReminder
        ? 'This note has a reminder — click to add another'
        : 'Set a reminder for this note';
    }

    getCurrentNoteId() {
      try {
        return window.app?.currentNote?.id || null;
      } catch (e) { return null; }
    }

    getCurrentNoteTitle() {
      try {
        return window.app?.currentNote?.title || document.getElementById('note-title')?.value || 'Untitled';
      } catch (e) { return 'Untitled'; }
    }

    // ─── Modal Open / Close ──────────────────────────────────────────

    openModal(noteId = null, noteTitle = null) {
      // If not provided, pick up current note
      this._pendingNoteId    = noteId    || this.getCurrentNoteId();
      this._pendingNoteTitle = noteTitle || this.getCurrentNoteTitle();

      const chip = document.getElementById('reminder-note-chip');
      if (chip) {
        chip.textContent = this._pendingNoteTitle
          ? `📝 ${this._pendingNoteTitle}`
          : 'General reminder (no note)';
      }

      this.resetModalDefaults();

      const overlay = document.getElementById('reminder-modal-overlay');
      if (overlay) overlay.style.display = 'flex';

      // Request permission now that user has initiated
      if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
      }

      document.getElementById('reminder-dt-input')?.focus();
    }

    closeModal() {
      const overlay = document.getElementById('reminder-modal-overlay');
      if (overlay) overlay.style.display = 'none';
    }

    saveFromModal() {
      const dtInput  = document.getElementById('reminder-dt-input');
      const msgInput = document.getElementById('reminder-msg-input');

      if (!dtInput?.value) {
        dtInput?.focus();
        return;
      }

      const datetime = new Date(dtInput.value).toISOString();

      if (new Date(datetime) <= new Date()) {
        alert('Please choose a future date and time.');
        dtInput.focus();
        return;
      }

      const message = msgInput?.value?.trim() || '';

      this.addReminder(
        this._pendingNoteId,
        this._pendingNoteTitle,
        datetime,
        message
      );

      this.closeModal();
    }

    // ─── CRUD ─────────────────────────────────────────────────────────

    addReminder(noteId, noteTitle, datetime, message) {
      const reminder = {
        id:         `rem_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        noteId:     noteId    || null,
        noteTitle:  noteTitle || 'General',
        datetime,
        message:    message   || '',
        fired:      false,
        created:    new Date().toISOString()
      };

      this.reminders.push(reminder);
      this.save();
      this.updateToolbarButtonState();
      this.showSetConfirmToast(datetime);
    }

    deleteReminder(id) {
      this.reminders = this.reminders.filter(r => r.id !== id);
      this.save();
      this.updateToolbarButtonState();
    }

    // ─── Checker ─────────────────────────────────────────────────────

    startChecker() {
      this.checkNow();
      setInterval(() => this.checkNow(), 30000); // every 30 seconds
    }

    checkNow() {
      const now = Date.now();
      let changed = false;

      this.reminders.forEach(r => {
        if (!r.fired && new Date(r.datetime).getTime() <= now) {
          this.fireReminder(r);
          r.fired = true;
          changed = true;
        }
      });

      if (changed) {
        this.save();
        this.updateToolbarButtonState();
      }
    }

    fireReminder(reminder) {
      // 1. Web Notification
      if ('Notification' in window && Notification.permission === 'granted') {
        const notif = new Notification('⏰ Wren Reminder', {
          body: reminder.message || `Review: ${reminder.noteTitle}`,
          icon: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192"%3E%3Crect fill="%234F46E5" width="192" height="192" rx="48"/%3E%3Ctext x="96" y="140" font-size="100" text-anchor="middle" fill="white"%3E%F0%9F%90%A6%3C/text%3E%3C/svg%3E',
          tag: `wren-rem-${reminder.id}`
        });
        notif.onclick = () => {
          window.focus();
          this.navigateToNote(reminder.noteId);
          notif.close();
        };
      }

      // 2. In-app toast (always shows)
      this.showReminderToast(reminder);
    }

    navigateToNote(noteId) {
      if (!noteId) return;
      try {
        if (typeof storage !== 'undefined' && typeof app !== 'undefined') {
          const note = storage.getNotes().find(n => n.id === noteId);
          if (note && app.openNote) app.openNote(note);
        }
      } catch (e) {}
    }

    // ─── Toasts ──────────────────────────────────────────────────────

    showReminderToast(reminder) {
      const toast = document.createElement('div');
      toast.className = 'reminder-toast';
      toast.innerHTML = `
        <span class="reminder-toast-icon">⏰</span>
        <div class="reminder-toast-body">
          <div class="reminder-toast-title">Reminder</div>
          <div class="reminder-toast-msg">${this.esc(reminder.message || reminder.noteTitle || 'Check your notes')}</div>
        </div>
        <button class="reminder-toast-close" title="Dismiss">✕</button>
      `;

      toast.querySelector('.reminder-toast-close').addEventListener('click', () => toast.remove());

      toast.querySelector('.reminder-toast-body').addEventListener('click', () => {
        this.navigateToNote(reminder.noteId);
        toast.remove();
      });
      toast.querySelector('.reminder-toast-body').style.cursor = 'pointer';

      document.body.appendChild(toast);
      setTimeout(() => { if (toast.parentNode) toast.remove(); }, 10000);
    }

    showSetConfirmToast(datetime) {
      const dt = new Date(datetime);
      const now = new Date();
      let label;
      if (dt.toDateString() === now.toDateString()) {
        label = 'Today at ' + dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      } else {
        label = dt.toLocaleDateString([], { month: 'short', day: 'numeric' }) +
                ' at ' + dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }

      const toast = document.createElement('div');
      toast.className = 'wren-success-toast';
      toast.style.background = '#10b981';
      toast.style.boxShadow  = '0 8px 24px rgba(16,185,129,0.3)';
      toast.textContent = `✅ Reminder set for ${label}`;
      document.body.appendChild(toast);
      setTimeout(() => toast.remove(), 3500);
    }

    // ─── Utils ───────────────────────────────────────────────────────

    esc(str) {
      if (str === null || str === undefined) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
    }
  }

  // ─── Init ──────────────────────────────────────────────────────────

  function init() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        window.remindersSystem = new RemindersSystem();
      });
    } else {
      window.remindersSystem = new RemindersSystem();
    }
  }

  init();
})();
