/* ============================================
   AUTH.JS — Supabase Authentication
   Plain global script, no ES modules
   ============================================ */

const SUPABASE_URL  = '__SUPABASE_URL__';
const SUPABASE_ANON = '__SUPABASE_ANON__';

window.__sbClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

/* ============================================
   AuthManager
   ============================================ */
class AuthManager {
  constructor() {
    this.currentUser = null;
    this._listeners  = [];

    window.__sbClient.auth.getSession().then(({ data: { session } }) => {
      this._setUser(session?.user ?? null);
    });

    window.__sbClient.auth.onAuthStateChange((_event, session) => {
      this._setUser(session?.user ?? null);
    });
  }

  _setUser(user) {
    this.currentUser = user;
    this._listeners.forEach(fn => fn(user));
    this._updateUI(user);
  }

  onChange(fn) {
    this._listeners.push(fn);
  }

  get isLoggedIn() { return !!this.currentUser; }
  get userId()     { return this.currentUser?.id ?? null; }
  get userEmail()  { return this.currentUser?.email ?? ''; }

  async signUp(email, password, displayName) {
    const { data, error } = await window.__sbClient.auth.signUp({
      email,
      password,
      options: { data: { display_name: displayName } },
    });
    if (error) throw error;
    return data;
  }

  async signIn(email, password) {
    const { data, error } = await window.__sbClient.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  }

  async signInMagicLink(email) {
    const { error } = await window.__sbClient.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    });
    if (error) throw error;
  }

  async signInOAuth(provider) {
    const { error } = await window.__sbClient.auth.signInWithOAuth({
      provider,
      options: { redirectTo: window.location.origin },
    });
    if (error) throw error;
  }

  async signOut() {
    const { error } = await window.__sbClient.auth.signOut();
    if (error) throw error;
  }

  async resetPassword(email) {
    const { error } = await window.__sbClient.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
    });
    if (error) throw error;
  }

  async getProfile() {
    if (!this.userId) return null;
    const { data, error } = await _supabase
      .from('profiles')
      .select('*')
      .eq('id', this.userId)
      .single();
    if (error) throw error;
    return data;
  }

  async updateProfile(updates) {
    if (!this.userId) return;
    const { error } = await _supabase
      .from('profiles')
      .update(updates)
      .eq('id', this.userId);
    if (error) throw error;
  }

  _updateUI(user) {
    const authModal    = document.getElementById('auth-modal');
    const appContainer = document.getElementById('app');
    const userEmail    = document.getElementById('auth-user-email');
    const signOutBtn   = document.getElementById('sign-out-btn');

    if (!authModal || !appContainer) return;

    if (!user) {
      authModal.style.display    = 'flex';
      appContainer.style.display = 'none';
    } else {
      authModal.style.display    = 'none';
      appContainer.style.display = 'flex';
      if (userEmail) userEmail.textContent = user.email;
    }

    if (signOutBtn) {
      signOutBtn.onclick = () => this.signOut();
    }
  }

  injectAuthModal() {
    if (document.getElementById('auth-modal')) return;

    const modal = document.createElement('div');
    modal.id = 'auth-modal';
    modal.innerHTML = `
      <div class="auth-card">
        <div class="auth-logo">📝</div>
        <h1 class="auth-title">Simple Notes</h1>
        <p class="auth-subtitle">Privacy-first notes, now in the cloud</p>

        <div class="auth-tabs">
          <button class="auth-tab active" data-tab="signin">Sign In</button>
          <button class="auth-tab"        data-tab="signup">Sign Up</button>
        </div>

        <form id="auth-form" class="auth-form" autocomplete="on">
          <div id="displayname-wrap" class="auth-field" style="display:none">
            <label>Display Name</label>
            <input id="auth-displayname" type="text" placeholder="Your name" autocomplete="name">
          </div>
          <div class="auth-field">
            <label>Email</label>
            <input id="auth-email" type="email" placeholder="you@example.com" autocomplete="email" required>
          </div>
          <div class="auth-field">
            <label>Password</label>
            <input id="auth-password" type="password" placeholder="••••••••" autocomplete="current-password" required>
          </div>
          <p id="auth-error" class="auth-error" style="display:none"></p>
          <button id="auth-submit" type="submit" class="auth-btn-primary">Sign In</button>
        </form>

        <div class="auth-divider"><span>or</span></div>

        <button id="magic-link-btn" class="auth-btn-secondary">✉️ Email Magic Link</button>
        <button id="google-btn"     class="auth-btn-secondary">🔵 Continue with Google</button>

        <p class="auth-footer">
          <button id="forgot-password-btn" class="auth-link">Forgot password?</button>
        </p>
      </div>
    `;
    document.body.prepend(modal);
    this._bindAuthModal();
  }

  _bindAuthModal() {
    let mode = 'signin';

    const get = id => document.getElementById(id);
    const err = msg => {
      const el = get('auth-error');
      el.textContent   = msg;
      el.style.display = msg ? 'block' : 'none';
    };

    document.querySelectorAll('.auth-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        mode = tab.dataset.tab;
        document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        get('displayname-wrap').style.display = mode === 'signup' ? 'block' : 'none';
        get('auth-submit').textContent        = mode === 'signup' ? 'Create Account' : 'Sign In';
        get('auth-password').autocomplete     = mode === 'signup' ? 'new-password' : 'current-password';
        err('');
      });
    });

    get('auth-form').addEventListener('submit', async e => {
      e.preventDefault();
      const email    = get('auth-email').value.trim();
      const password = get('auth-password').value;
      const name     = get('auth-displayname').value.trim();
      const btn      = get('auth-submit');

      btn.disabled    = true;
      btn.textContent = '…';
      err('');

      try {
        if (mode === 'signup') {
          await this.signUp(email, password, name);
          err('Check your email to confirm your account ✉️');
        } else {
          await this.signIn(email, password);
        }
      } catch (e) {
        err(e.message);
      } finally {
        btn.disabled    = false;
        btn.textContent = mode === 'signup' ? 'Create Account' : 'Sign In';
      }
    });

    get('magic-link-btn').addEventListener('click', async () => {
      const email = get('auth-email').value.trim();
      if (!email) { err('Enter your email first'); return; }
      try {
        await this.signInMagicLink(email);
        err('Magic link sent! Check your inbox ✉️');
      } catch (e) { err(e.message); }
    });

    get('google-btn').addEventListener('click', () => {
      this.signInOAuth('google').catch(e => err(e.message));
    });

    get('forgot-password-btn').addEventListener('click', async () => {
      const email = get('auth-email').value.trim();
      if (!email) { err('Enter your email first'); return; }
      try {
        await this.resetPassword(email);
        err('Password reset email sent ✉️');
      } catch (e) { err(e.message); }
    });
  }
}

window.auth = new AuthManager();
window.auth.injectAuthModal();
