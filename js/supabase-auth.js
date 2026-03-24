/**
 * supabase-auth.js
 * Phase 8 — Supabase Authentication
 * Wren — Your always-on secretary
 *
 * Providers: Google OAuth, Email + Password
 * - Injects sign-in button into sidebar header
 * - Manages session persistence
 * - Exposes window.wrenAuth for other modules
 * - Fires 'wren:auth-change' event on state changes
 *
 * All additive — zero edits to existing files.
 */

(function () {
  'use strict';

  const SUPABASE_URL  = 'https://bxiaqpgfqyqfunthrzso.supabase.co';
  const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ4aWFxcGdmcXlxZnVudGhyenNvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzMTU4MjYsImV4cCI6MjA4OTg5MTgyNn0.wrV2XWFAT28erFobauYSGVs1cJXRJ7_GdJxRI9cOXks';

  // ─── Wait for Supabase SDK ────────────────────────────────

  function waitForSupabase(cb, tries = 0) {
    if (window.supabase?.createClient) return cb();
    if (tries > 40) return console.error('[Auth] Supabase SDK not loaded');
    setTimeout(() => waitForSupabase(cb, tries + 1), 150);
  }

  // ─── Main class ───────────────────────────────────────────

  class WrenAuth {
    constructor(supabaseClient) {
      this.sb       = supabaseClient;
      this.session  = null;
      this.user     = null;
      this.profile  = null;
      this.isSignUp = false;
      this.init();
    }

    async init() {
      // Get current session
      const { data: { session } } = await this.sb.auth.getSession();
      await this.setSession(session);

      // Listen for auth changes
      this.sb.auth.onAuthStateChange(async (_event, session) => {
        await this.setSession(session);
      });

      this.injectUI();
      this.injectModal();
      this.checkInviteCode();
      console.log('✅ Wren Auth loaded');
    }

    // ─── Session ─────────────────────────────────────────────

    async setSession(session) {
      this.session = session;
      this.user    = session?.user || null;

      if (this.user) {
        await this.loadProfile();
      } else {
        this.profile = null;
      }

      this.updateUI();
      this.fireEvent('wren:auth-change', { user: this.user, profile: this.profile });
    }

    async loadProfile() {
      if (!this.user) return;
      try {
        const { data } = await this.sb
          .from('profiles')
          .select('*')
          .eq('id', this.user.id)
          .single();
        this.profile = data;
      } catch (e) {
        this.profile = null;
      }
    }

    isLoggedIn()   { return !!this.user; }
    isPro()        { return this.profile?.plan === 'team' || this.profile?.plan === 'pro'; }
    getEmail()     { return this.user?.email || ''; }
    getAvatarUrl() { return this.user?.user_metadata?.avatar_url || ''; }
    getDisplayName() {
      return this.user?.user_metadata?.full_name ||
             this.user?.user_metadata?.name ||
             this.getEmail().split('@')[0] ||
             'User';
    }

    // ─── Sign in / up ─────────────────────────────────────────

    async signInGoogle() {
      this.setAuthLoading(true);
      const { error } = await this.sb.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin + window.location.pathname,
          scopes: 'https://www.googleapis.com/auth/calendar.readonly'
        }
      });
      if (error) this.showAuthError(error.message);
      this.setAuthLoading(false);
    }

    async signInEmail(email, password) {
      this.setAuthLoading(true);
      this.clearAuthError();

      const fn = this.isSignUp ? 'signUp' : 'signInWithPassword';
      const { error } = await this.sb.auth[fn]({ email, password });

      if (error) {
        this.showAuthError(error.message);
      } else {
        this.closeModal();
        if (this.isSignUp) {
          this.showToast('✅ Account created! Check your email to confirm.', '#10b981');
        }
      }
      this.setAuthLoading(false);
    }

    async signOut() {
      await this.sb.auth.signOut();
      this.closeDropdown();
      this.showToast('Signed out', '#6b7280');
      // Fire sync cleanup
      this.fireEvent('wren:signed-out', {});
    }

    // ─── Invite code → upgrade plan ──────────────────────────

    checkInviteCode() {
      const params = new URLSearchParams(window.location.search);
      const code   = params.get('invite');
      if (code) {
        localStorage.setItem('wren_pending_invite', code.toUpperCase());
        // Clean URL
        history.replaceState(null, '', window.location.pathname);
      }
    }

    async redeemInviteCode(code) {
      const VALID = new Set([
        'WREN-UW7W','EARLY-6TPU','PLY-XVVO','BIRD-UYK3',
        'NEST-DIG4','WREN-O565','EARLY-OERK','PLY-2LFX',
        'BIRD-45GW','NEST-KCXJ','WREN-2XGS','EARLY-A8AI',
        'PLY-KMJT','BIRD-0IKY','NEST-TM3E','WREN-3RPK',
        'EARLY-QIGR','PLY-6QX9','BIRD-3N10','NEST-L2W9'
      ]);

      const upper = (code || '').trim().toUpperCase();
      if (!VALID.has(upper)) return false;

      if (!this.user) return false;

      try {
        await this.sb.from('profiles')
          .update({ plan: 'team', invite_code: upper })
          .eq('id', this.user.id);

        await this.loadProfile();
        this.updateUI();
        localStorage.removeItem('wren_pending_invite');
        this.fireEvent('wren:plan-upgraded', { plan: 'team' });
        return true;
      } catch (e) {
        return false;
      }
    }

    // ─── UI Injection ─────────────────────────────────────────

    injectUI() {
      // Find the sidebar header and inject auth area below it
      const sidebarHeader = document.querySelector('.sidebar-header');
      if (!sidebarHeader) {
        setTimeout(() => this.injectUI(), 600);
        return;
      }

      if (document.getElementById('auth-header-area')) return;

      const area = document.createElement('div');
      area.id        = 'auth-header-area';
      area.className = 'auth-header-area';
      sidebarHeader.insertAdjacentElement('afterend', area);

      // Offline banner
      const banner = document.createElement('div');
      banner.id        = 'offline-banner';
      banner.className = 'offline-banner';
      banner.textContent = '⚠️ Offline — changes saved locally';
      area.insertAdjacentElement('afterend', banner);

      window.addEventListener('online',  () => banner.classList.remove('visible'));
      window.addEventListener('offline', () => banner.classList.add('visible'));
      if (!navigator.onLine) banner.classList.add('visible');

      this.updateUI();
    }

    updateUI() {
      const area = document.getElementById('auth-header-area');
      if (!area) return;

      area.innerHTML = '';

      if (!this.user) {
        // Signed out — sign in button
        const btn = document.createElement('button');
        btn.className            = 'auth-signin-btn';
        btn.innerHTML            = '☁️ Sign in to sync';
        btn.style.width          = '100%';
        btn.style.justifyContent = 'center';
        btn.addEventListener('click', () => this.openModal());
        area.appendChild(btn);
      } else {
        // Signed in — single button: avatar + name + sign out hint
        const avatarUrl = this.getAvatarUrl();
        const initial   = this.getDisplayName().charAt(0).toUpperCase();
        const name      = this.getDisplayName();

        const btn = document.createElement('button');
        btn.className = 'auth-signin-btn';
        btn.style.cssText = 'width:100%;justify-content:center;background:transparent;border:1px solid var(--color-border);color:var(--color-text-secondary);gap:7px;';
        btn.title = 'Click to sign out';
        btn.addEventListener('click', () => this.signOut());
        area.appendChild(btn);

        // Set innerHTML after appending to avoid template literal issues with esc()
        const avatarHTML = avatarUrl
          ? '<img src="' + this.esc(avatarUrl) + '" alt="">'
          : initial;
        btn.innerHTML =
          '<div class="auth-avatar" style="width:18px;height:18px;font-size:9px;flex-shrink:0">' + avatarHTML + '</div>' +
          '<span style="flex:1;text-align:left;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:110px">' + this.esc(name) + '</span>' +
          '<span style="font-size:10px;opacity:0.45;flex-shrink:0">Sign out</span>';

        // Sync indicator
        const syncEl = document.createElement('div');
        syncEl.id        = 'sync-indicator';
        syncEl.className = 'sync-indicator';
        syncEl.innerHTML = '☁️ Ready';
        syncEl.style.cssText = 'justify-content:center;width:100%;';
        area.appendChild(syncEl);
      }
    }

    toggleDropdown(anchor) {
      const existing = document.getElementById('auth-account-dropdown');
      if (existing) { existing.remove(); return; }

      const dropdown = document.createElement('div');
      dropdown.id        = 'auth-account-dropdown';
      dropdown.className = 'auth-account-dropdown';

      const plan = this.profile?.plan || 'free';
      dropdown.innerHTML = `
        <div class="auth-dropdown-header">
          <div class="auth-dropdown-email">${this.esc(this.getEmail())}</div>
          <div class="auth-dropdown-plan ${plan}">
            ${plan === 'team' ? '✦ Team' : 'Free'}
          </div>
        </div>
        ${!this.isPro() ? `
          <button class="auth-dropdown-item" id="dd-upgrade">
            ✦ Upgrade to Team
          </button>
        ` : ''}
        <button class="auth-dropdown-item" id="dd-sync-now">
          🔄 Sync now
        </button>
        <button class="auth-dropdown-item danger" id="dd-signout">
          ↩ Sign out
        </button>
      `;

      anchor.style.position = 'relative';
      anchor.appendChild(dropdown);

      dropdown.querySelector('#dd-signout')
        ?.addEventListener('click', () => this.signOut());
      dropdown.querySelector('#dd-sync-now')
        ?.addEventListener('click', () => {
          this.closeDropdown();
          this.fireEvent('wren:sync-requested', {});
        });
      dropdown.querySelector('#dd-upgrade')
        ?.addEventListener('click', () => {
          this.closeDropdown();
          window.wrenPaywall?.show('cloud-sync');
        });

      // Close on outside click
      setTimeout(() => {
        document.addEventListener('click', function close(e) {
          if (!dropdown.contains(e.target)) {
            dropdown.remove();
            document.removeEventListener('click', close);
          }
        });
      }, 0);
    }

    closeDropdown() {
      document.getElementById('auth-account-dropdown')?.remove();
    }

    // ─── Modal ────────────────────────────────────────────────

    injectModal() {
      const overlay = document.createElement('div');
      overlay.id        = 'auth-modal-overlay';
      overlay.className = 'auth-modal-overlay';
      overlay.style.display = 'none';

      overlay.innerHTML = `
        <div class="auth-modal" style="position:relative">
          <button class="auth-close-btn" id="auth-close-btn">✕</button>

          <div class="auth-modal-header">
            <div class="auth-modal-bird">🐦</div>
            <div class="auth-modal-title" id="auth-modal-title">Sign in to Wren</div>
            <div class="auth-modal-sub">Sync your notes across all devices</div>
          </div>

          <div class="auth-modal-body">

            <!-- OAuth -->
            <button class="auth-oauth-btn" id="auth-google-btn">
              <svg class="auth-oauth-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Continue with Google
            </button>

            <div class="auth-divider">or</div>

            <!-- Email tabs: Sign In / Sign Up -->
            <div class="auth-tabs">
              <button class="auth-tab active" id="auth-tab-signin">Sign in</button>
              <button class="auth-tab" id="auth-tab-signup">Create account</button>
            </div>

            <div class="auth-panel active" id="auth-email-panel">
              <div class="auth-field">
                <label>Email</label>
                <input type="email" id="auth-email-input" class="auth-input"
                  placeholder="you@example.com" autocomplete="email">
              </div>
              <div class="auth-field">
                <label>Password</label>
                <input type="password" id="auth-password-input" class="auth-input"
                  placeholder="••••••••" autocomplete="current-password">
              </div>

              <div class="auth-error" id="auth-error"></div>

              <button class="auth-submit-btn" id="auth-submit-btn">
                Sign in
              </button>

              <div class="auth-toggle" id="auth-toggle-text">
                Don't have an account? <a id="auth-toggle-link">Create one →</a>
              </div>
            </div>

          </div>
        </div>
      `;

      document.body.appendChild(overlay);
      this.bindModalEvents(overlay);
    }

    bindModalEvents(overlay) {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) this.closeModal();
      });
      overlay.querySelector('#auth-close-btn')
        ?.addEventListener('click', () => this.closeModal());

      overlay.querySelector('#auth-google-btn')
        ?.addEventListener('click', () => this.signInGoogle());

      overlay.querySelector('#auth-submit-btn')
        ?.addEventListener('click', () => this.handleEmailSubmit());

      ['auth-email-input', 'auth-password-input'].forEach(id => {
        overlay.querySelector(`#${id}`)
          ?.addEventListener('keydown', e => {
            if (e.key === 'Enter') this.handleEmailSubmit();
          });
      });

      // Tab toggle
      overlay.querySelector('#auth-tab-signin')?.addEventListener('click', () => {
        this.isSignUp = false;
        this.updateModalMode(overlay);
      });
      overlay.querySelector('#auth-tab-signup')?.addEventListener('click', () => {
        this.isSignUp = true;
        this.updateModalMode(overlay);
      });
      overlay.querySelector('#auth-toggle-link')?.addEventListener('click', () => {
        this.isSignUp = !this.isSignUp;
        this.updateModalMode(overlay);
      });
    }

    updateModalMode(overlay) {
      const title       = overlay.querySelector('#auth-modal-title');
      const submitBtn   = overlay.querySelector('#auth-submit-btn');
      const toggleText  = overlay.querySelector('#auth-toggle-text');
      const pwInput     = overlay.querySelector('#auth-password-input');
      const tabSignIn   = overlay.querySelector('#auth-tab-signin');
      const tabSignUp   = overlay.querySelector('#auth-tab-signup');

      tabSignIn?.classList.toggle('active',  !this.isSignUp);
      tabSignUp?.classList.toggle('active',   this.isSignUp);

      if (this.isSignUp) {
        if (title)      title.textContent = 'Create your account';
        if (submitBtn)  submitBtn.textContent = 'Create account';
        if (pwInput)    pwInput.setAttribute('autocomplete', 'new-password');
        if (toggleText) toggleText.innerHTML = `Already have an account? <a id="auth-toggle-link">Sign in →</a>`;
      } else {
        if (title)      title.textContent = 'Sign in to Wren';
        if (submitBtn)  submitBtn.textContent = 'Sign in';
        if (pwInput)    pwInput.setAttribute('autocomplete', 'current-password');
        if (toggleText) toggleText.innerHTML = `Don't have an account? <a id="auth-toggle-link">Create one →</a>`;
      }

      // Re-bind toggle link after innerHTML replacement
      overlay.querySelector('#auth-toggle-link')?.addEventListener('click', () => {
        this.isSignUp = !this.isSignUp;
        this.updateModalMode(overlay);
      });

      this.clearAuthError();
    }

    handleEmailSubmit() {
      const email    = document.getElementById('auth-email-input')?.value?.trim();
      const password = document.getElementById('auth-password-input')?.value;
      if (!email || !password) return;
      this.signInEmail(email, password);
    }

    openModal() {
      const overlay = document.getElementById('auth-modal-overlay');
      if (overlay) {
        overlay.style.display = 'flex';
        setTimeout(() => document.getElementById('auth-email-input')?.focus(), 100);
      }

      // Check for pending invite code to redeem after sign-in
      const pending = localStorage.getItem('wren_pending_invite');
      if (pending) {
        const sub = document.querySelector('#auth-modal-overlay .auth-modal-sub');
        if (sub) sub.textContent = `Sign in to activate your invite code: ${pending}`;
      }
    }

    closeModal() {
      const overlay = document.getElementById('auth-modal-overlay');
      if (overlay) overlay.style.display = 'none';
    }

    // ─── Auth loading / error state ──────────────────────────

    setAuthLoading(on) {
      const btn = document.getElementById('auth-submit-btn');
      if (btn) {
        btn.disabled     = on;
        btn.textContent  = on ? '…' : (this.isSignUp ? 'Create account' : 'Sign in');
      }
      const googleBtn = document.getElementById('auth-google-btn');
      if (googleBtn) googleBtn.disabled = on;
    }

    showAuthError(msg) {
      const el = document.getElementById('auth-error');
      if (el) { el.textContent = msg; el.classList.add('visible'); }
    }

    clearAuthError() {
      const el = document.getElementById('auth-error');
      if (el) { el.textContent = ''; el.classList.remove('visible'); }
    }

    // ─── Sync indicator ──────────────────────────────────────

    setSyncStatus(status, msg) {
      const el = document.getElementById('sync-indicator');
      if (!el) return;
      el.className = `sync-indicator ${status}`;
      const icons = { syncing: '<span class="sync-spin">⟳</span>', synced: '☁️', error: '⚠️', offline: '○' };
      el.innerHTML = `${icons[status] || '☁️'} ${msg}`;
    }

    // ─── Helpers ─────────────────────────────────────────────

    showToast(msg, bg = '#4F46E5') {
      const toast = document.createElement('div');
      toast.className          = 'wren-success-toast';
      toast.style.background   = bg;
      toast.style.boxShadow    = `0 8px 24px ${bg}55`;
      toast.textContent        = msg;
      document.body.appendChild(toast);
      setTimeout(() => toast.remove(), 3500);
    }

    fireEvent(name, detail) {
      document.dispatchEvent(new CustomEvent(name, { detail }));
    }

    esc(str) {
      if (!str) return '';
      return String(str)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }
  }

  // ─── Init ──────────────────────────────────────────────────

  function boot() {
    waitForSupabase(() => {
      const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON);
      window.wrenAuth = new WrenAuth(sb);
      window._wrenSupabase = sb; // shared client for other modules
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
