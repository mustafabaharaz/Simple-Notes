/**
 * cloud-sync.js
 * Phase 8 — Cloud Sync via Supabase
 * Wren — Your always-on secretary
 *
 * - Syncs notes and meetings to Supabase on login
 * - Pushes changes on every save (debounced 2s)
 * - Pulls on login + manual "Sync now"
 * - Last-write-wins merge by modified timestamp
 * - Only active when user is logged in + on Team plan
 *
 * All additive — zero edits to existing files.
 */

(function () {
  'use strict';

  const DEBOUNCE_MS = 2000;

  class CloudSync {
    constructor() {
      this.sb         = null;
      this.userId     = null;
      this.pushTimer  = null;
      this.isSyncing  = false;
      this.init();
    }

    // ─── Init ─────────────────────────────────────────────────

    init() {
      // Wait for auth to be ready
      document.addEventListener('wren:auth-change', (e) => {
        const { user, profile } = e.detail;

        if (user && this.isPro(profile)) {
          this.sb     = window._wrenSupabase;
          this.userId = user.id;
          this.startSync();
        } else {
          this.userId = null;
          this.stopWatching();
          if (user && !this.isPro(profile)) {
            this.setSyncStatus('offline', 'Local only');
          }
        }
      });

      // Manual sync trigger
      document.addEventListener('wren:sync-requested', () => {
        if (this.userId) this.fullSync();
      });

      // Plan upgrade — start syncing immediately
      document.addEventListener('wren:plan-upgraded', () => {
        if (window.wrenAuth?.isLoggedIn()) {
          this.sb     = window._wrenSupabase;
          this.userId = window.wrenAuth?.user?.id;
          if (this.userId) this.startSync();
        }
      });

      // Sign out — stop watching
      document.addEventListener('wren:signed-out', () => {
        this.userId = null;
        this.stopWatching();
      });

      this.watchLocalChanges();
      console.log('✅ Cloud sync loaded');
    }

    isPro(profile) {
      return profile?.plan === 'team' || profile?.plan === 'pro';
    }

    // ─── Start / Stop ─────────────────────────────────────────

    async startSync() {
      if (!this.userId || !this.sb) return;
      this.setSyncStatus('syncing', 'Syncing…');

      // Check for pending invite code
      const pending = localStorage.getItem('wren_pending_invite');
      if (pending && window.wrenAuth?.redeemInviteCode) {
        const ok = await window.wrenAuth.redeemInviteCode(pending);
        if (ok) {
          window.wrenAuth.showToast('✦ Team plan activated! Cloud sync enabled.', '#4F46E5');
        }
      }

      await this.fullSync();
    }

    stopWatching() {
      clearTimeout(this.pushTimer);
    }

    // ─── Full sync (pull + push) ──────────────────────────────

    async fullSync() {
      if (this.isSyncing || !this.userId) return;
      this.isSyncing = true;
      this.setSyncStatus('syncing', 'Syncing…');

      try {
        await this.pullNotes();
        await this.pushAllNotes();
        await this.pullMeetings();
        await this.pushAllMeetings();
        this.setSyncStatus('synced', 'Synced');
        setTimeout(() => this.setSyncStatus('synced', '☁️ Up to date'), 2000);
      } catch (e) {
        console.error('[CloudSync] Sync error:', e);
        this.setSyncStatus('error', 'Sync failed');
      } finally {
        this.isSyncing = false;
      }
    }

    // ─── Notes ────────────────────────────────────────────────

    async pullNotes() {
      if (!this.userId) return;

      const { data, error } = await this.sb
        .from('notes')
        .select('*')
        .eq('user_id', this.userId);

      if (error) throw error;
      if (!data?.length) return;

      // Get local notes
      let local = [];
      try {
        if (typeof storage !== 'undefined') {
          local = storage.getNotes();
        } else {
          local = JSON.parse(localStorage.getItem('notes') || '[]');
        }
      } catch (e) { local = []; }

      const localMap = new Map(local.map(n => [n.id, n]));
      let changed = false;

      data.forEach(remote => {
        const localNote = localMap.get(remote.id);
        const remoteTime = new Date(remote.modified || remote.created || 0).getTime();
        const localTime  = localNote
          ? new Date(localNote.modified || localNote.created || 0).getTime()
          : 0;

        if (!localNote || remoteTime > localTime) {
          // Remote is newer — adopt it
          localMap.set(remote.id, {
            id:        remote.id,
            title:     remote.title     || '',
            content:   remote.content   || '',
            tags:      remote.tags      || [],
            folder_id: remote.folder_id || null,
            pinned:    remote.pinned    || false,
            encrypted: remote.encrypted || false,
            modified:  remote.modified,
            created:   remote.created
          });
          changed = true;
        }
      });

      if (changed) {
        const merged = Array.from(localMap.values());
        this.saveLocalNotes(merged);
        // Refresh UI
        try { window.app?.renderNotes?.(); } catch (e) {}
      }
    }

    async pushAllNotes() {
      if (!this.userId) return;
      const notes = this.getLocalNotes();
      if (!notes.length) return;

      const rows = notes.map(n => ({
        id:        n.id,
        user_id:   this.userId,
        title:     n.title     || '',
        content:   n.content   || '',
        tags:      n.tags      || [],
        folder_id: n.folder_id || null,
        pinned:    n.pinned    || false,
        encrypted: n.encrypted || false,
        modified:  n.modified  || new Date().toISOString(),
        created:   n.created   || new Date().toISOString()
      }));

      const { error } = await this.sb
        .from('notes')
        .upsert(rows, { onConflict: 'id' });

      if (error) throw error;
    }

    async pushNote(note) {
      if (!this.userId || !this.sb || !note?.id) return;
      clearTimeout(this.pushTimer);
      this.pushTimer = setTimeout(async () => {
        try {
          this.setSyncStatus('syncing', 'Saving…');
          await this.sb.from('notes').upsert({
            id:        note.id,
            user_id:   this.userId,
            title:     note.title     || '',
            content:   note.content   || '',
            tags:      note.tags      || [],
            folder_id: note.folder_id || null,
            pinned:    note.pinned    || false,
            encrypted: note.encrypted || false,
            modified:  new Date().toISOString(),
            created:   note.created   || new Date().toISOString()
          }, { onConflict: 'id' });
          this.setSyncStatus('synced', '☁️ Saved');
        } catch (e) {
          this.setSyncStatus('error', 'Save failed');
        }
      }, DEBOUNCE_MS);
    }

    async deleteNote(noteId) {
      if (!this.userId || !this.sb) return;
      try {
        await this.sb.from('notes').delete().eq('id', noteId).eq('user_id', this.userId);
      } catch (e) { /* non-critical */ }
    }

    // ─── Meetings ─────────────────────────────────────────────

    async pullMeetings() {
      if (!this.userId) return;

      const { data, error } = await this.sb
        .from('meetings')
        .select('*')
        .eq('user_id', this.userId);

      if (error) throw error;
      if (!data?.length) return;

      let local = [];
      try {
        local = JSON.parse(localStorage.getItem('wren_meetings') || '[]');
      } catch (e) { local = []; }

      const localMap = new Map(local.map(m => [m.id, m]));
      let changed = false;

      data.forEach(remote => {
        const remoteData = remote.data || {};
        const localMeeting = localMap.get(remote.id);
        const remoteTime = new Date(remote.modified || remote.created || 0).getTime();
        const localTime  = localMeeting
          ? new Date(localMeeting.modified || localMeeting.created || 0).getTime()
          : 0;

        if (!localMeeting || remoteTime > localTime) {
          localMap.set(remote.id, { id: remote.id, ...remoteData, modified: remote.modified });
          changed = true;
        }
      });

      if (changed) {
        localStorage.setItem('wren_meetings', JSON.stringify(Array.from(localMap.values())));
        try { window.meetingNotes?.loadMeetings?.(); } catch (e) {}
      }
    }

    async pushAllMeetings() {
      if (!this.userId) return;
      let meetings = [];
      try {
        meetings = JSON.parse(localStorage.getItem('wren_meetings') || '[]');
      } catch (e) { return; }
      if (!meetings.length) return;

      const rows = meetings.map(m => ({
        id:       m.id,
        user_id:  this.userId,
        data:     m,
        modified: m.modified || new Date().toISOString(),
        created:  m.created  || new Date().toISOString()
      }));

      const { error } = await this.sb
        .from('meetings')
        .upsert(rows, { onConflict: 'id' });

      if (error) throw error;
    }

    // ─── Watch local storage changes ──────────────────────────

    watchLocalChanges() {
      // Hook into app's saveNote if available
      const tryHook = () => {
        if (window.app?.saveNote) {
          const original = window.app.saveNote.bind(window.app);
          window.app.saveNote = () => {
            original();
            if (this.userId && window.app.currentNote) {
              this.pushNote(window.app.currentNote);
            }
          };
        }
      };
      setTimeout(tryHook, 1200);
      setTimeout(tryHook, 3000);

      // Also watch storage events (cross-tab)
      window.addEventListener('storage', (e) => {
        if (e.key === 'wren_meetings' && this.userId) {
          clearTimeout(this.pushTimer);
          this.pushTimer = setTimeout(() => this.pushAllMeetings(), DEBOUNCE_MS);
        }
      });
    }

    // ─── Local storage helpers ────────────────────────────────

    getLocalNotes() {
      try {
        if (typeof storage !== 'undefined') return storage.getNotes();
        return JSON.parse(localStorage.getItem('notes') || '[]');
      } catch (e) { return []; }
    }

    saveLocalNotes(notes) {
      try {
        if (typeof storage !== 'undefined' && storage.saveNotes) {
          storage.saveNotes(notes);
        } else {
          localStorage.setItem('notes', JSON.stringify(notes));
        }
      } catch (e) {}
    }

    // ─── Sync indicator ──────────────────────────────────────

    setSyncStatus(status, msg) {
      try { window.wrenAuth?.setSyncStatus(status, msg); } catch (e) {}
    }
  }

  // ─── Init ──────────────────────────────────────────────────

  function init() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        window.cloudSync = new CloudSync();
      });
    } else {
      window.cloudSync = new CloudSync();
    }
  }

  init();
})();
