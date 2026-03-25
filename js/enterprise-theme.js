/* ================================================================
   ENTERPRISE-THEME.JS — Phase 10
   Registers the Enterprise theme into the existing Phase 9
   ThemeManager and auto-suggests it when org mode activates.
   Additive — zero edits to any existing JS file.
   ================================================================ */

(function () {
  'use strict';

  const ENTERPRISE_THEME = {
    id:       'enterprise',
    name:     'Enterprise',
    subtitle: 'Org mode',
    mode:     'light',
    bg:       '#0a1628',
    accent:   '#2dd4bf',
    fonts: [
      'https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&display=swap',
    ],
  };

  /* ── Dismiss key — once dismissed, never show again per session ── */
  const DISMISS_KEY  = 'wren-enterprise-banner-dismissed';
  const APPLIED_KEY  = 'wren-theme';

  /* ─────────────────────────────────────────────────────────────
     1. Register Enterprise into the existing ThemeManager
        ThemeManager stores themes in window.WrenTheme — we wait
        for it to be ready then inject Enterprise into its registry.
  ───────────────────────────────────────────────────────────── */

  function registerTheme () {
    const tm = window.WrenTheme;
    if (!tm) return false;

    /* Already registered? */
    if (tm._enterpriseRegistered) return true;

    /* Inject into the internal THEMES map if accessible,
       otherwise monkey-patch setTheme to handle 'enterprise' */
    if (typeof tm._apply === 'function') {

      /* Wrap _apply to intercept 'enterprise' calls */
      const _originalApply = tm._apply.bind(tm);

      tm._apply = function (themeId, save) {
        if (themeId === 'enterprise') {
          const html = document.documentElement;
          html.removeAttribute('data-wren-theme');

          /* Snapshot user mode if first override */
          if (!this.userMode) {
            const current = html.getAttribute('data-theme') || 'light';
            this.userMode = current;
            localStorage.setItem('wren-user-mode', current);
          }

          /* Enterprise is always light mode for content area */
          html.setAttribute('data-theme', 'light');
          html.setAttribute('data-wren-theme', 'enterprise');

          /* Load DM Sans */
          ENTERPRISE_THEME.fonts.forEach(url => this._loadFont(url));

          this.current = 'enterprise';
          if (save) localStorage.setItem(APPLIED_KEY, 'enterprise');

          this._updatePickerUI();

          document.dispatchEvent(new CustomEvent('wren:theme-change', {
            detail: { themeId: 'enterprise', theme: ENTERPRISE_THEME }
          }));

          return;
        }
        _originalApply(themeId, save);
      };

      /* Inject into picker builder */
      const _originalBuildPickerHTML = tm._buildPickerHTML.bind(tm);

      tm._buildPickerHTML = function () {
        const existing = _originalBuildPickerHTML();

        /* Check if enterprise card already injected */
        if (existing.includes('data-theme-id="enterprise"')) return existing;

        const isActive = this.current === 'enterprise';
        const checkMark = isActive
          ? '<span class="wren-theme-check" aria-hidden="true">✓</span>'
          : '';

        const enterpriseCard = `
          <button
            class="wren-theme-card${isActive ? ' is-active' : ''}"
            data-theme-id="enterprise"
            type="button"
            title="Enterprise — Org mode"
            aria-pressed="${isActive}"
          >
            <span class="wren-theme-swatch" style="background-color:${ENTERPRISE_THEME.bg};">
              <span class="wren-theme-swatch-bar" style="background-color:${ENTERPRISE_THEME.accent};"></span>
              ${checkMark}
            </span>
            <span class="wren-theme-label">${ENTERPRISE_THEME.name}</span>
            <span class="wren-theme-sub">${ENTERPRISE_THEME.subtitle}</span>
          </button>`;

        /* Insert the enterprise card first in the picker */
        return existing.replace(
          '<div class="wren-theme-picker"',
          `<div class="wren-theme-picker"`
        ).replace(
          /(<button[^>]+data-theme-id="default")/,
          `${enterpriseCard}\n$1`
        );
      };

      /* Re-attach click handler for enterprise in _injectPicker */
      const _originalInjectPicker = tm._injectPicker.bind(tm);

      tm._injectPicker = function () {
        _originalInjectPicker();
        const body = document.querySelector('.settings-body');
        if (!body) return;
        body.querySelectorAll('.wren-theme-card[data-theme-id="enterprise"]').forEach(btn => {
          /* Remove duplicate listeners by replacing node */
          const fresh = btn.cloneNode(true);
          btn.replaceWith(fresh);
          fresh.addEventListener('click', () => {
            window.WrenTheme.setTheme('enterprise');
          });
        });
      };

      tm._enterpriseRegistered = true;
      return true;
    }

    return false;
  }

  /* ─────────────────────────────────────────────────────────────
     2. Auto-suggest banner when switching to org mode
  ───────────────────────────────────────────────────────────── */

  function showEnterpriseBanner () {
    /* Don't show if: already on enterprise, dismissed, or banner exists */
    if (localStorage.getItem(DISMISS_KEY) === 'true') return;
    if (localStorage.getItem(APPLIED_KEY) === 'enterprise') return;
    if (document.querySelector('.wren-enterprise-banner')) return;

    const banner = document.createElement('div');
    banner.className = 'wren-enterprise-banner';
    banner.innerHTML = `
      <div class="wren-ent-banner-dot"></div>
      <div class="wren-ent-banner-text">
        <div class="wren-ent-banner-title">Switch to Enterprise theme?</div>
        <div class="wren-ent-banner-sub">Designed for org &amp; meeting mode.</div>
      </div>
      <div class="wren-ent-banner-actions">
        <button class="wren-ent-btn-apply">Apply</button>
        <button class="wren-ent-btn-dismiss">Not now</button>
      </div>
    `;

    document.body.appendChild(banner);

    /* Apply */
    banner.querySelector('.wren-ent-btn-apply').addEventListener('click', () => {
      if (window.WrenTheme) window.WrenTheme.setTheme('enterprise');
      hideBanner(banner);
    });

    /* Dismiss */
    banner.querySelector('.wren-ent-btn-dismiss').addEventListener('click', () => {
      localStorage.setItem(DISMISS_KEY, 'true');
      hideBanner(banner);
    });

    /* Auto-hide after 8 seconds */
    setTimeout(() => {
      if (banner.parentNode) hideBanner(banner);
    }, 8000);
  }

  function hideBanner (banner) {
    if (!banner || !banner.parentNode) return;
    banner.classList.add('hiding');
    setTimeout(() => banner.remove(), 220);
  }

  /* When switching back to personal mode — hide banner if still showing */
  function hideEnterpriseBanner () {
    const banner = document.querySelector('.wren-enterprise-banner');
    if (banner) hideBanner(banner);
  }

  /* ─────────────────────────────────────────────────────────────
     3. Listen for workspaceChanged event
  ───────────────────────────────────────────────────────────── */

  document.addEventListener('workspaceChanged', ({ detail }) => {
    if (!detail) return;

    if (detail.workspace === 'org') {
      /* Small delay so org mode finishes rendering first */
      setTimeout(showEnterpriseBanner, 600);
    } else {
      hideEnterpriseBanner();
    }
  });

  /* ─────────────────────────────────────────────────────────────
     4. Boot — wait for WrenTheme to be ready
  ───────────────────────────────────────────────────────────── */

  function boot () {
    /* Try to register immediately */
    if (registerTheme()) {
      /* If enterprise was the last saved theme, re-apply it */
      if (localStorage.getItem(APPLIED_KEY) === 'enterprise') {
        window.WrenTheme.setTheme('enterprise', false);
      }
      return;
    }

    /* WrenTheme not ready yet — poll */
    let attempts = 0;
    const interval = setInterval(() => {
      attempts++;
      if (registerTheme()) {
        clearInterval(interval);
        if (localStorage.getItem(APPLIED_KEY) === 'enterprise') {
          window.WrenTheme.setTheme('enterprise', false);
        }
        return;
      }
      if (attempts > 40) clearInterval(interval); /* give up after 2s */
    }, 50);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  console.log('✅ Enterprise theme loaded');

})();


