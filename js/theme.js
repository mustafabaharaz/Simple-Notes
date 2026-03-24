/* ================================================================
   THEME.JS — Wren Theme Engine
   Phase 9: Full visual themes (colors + typography)
   Additive — zero edits to any existing JS files
   ================================================================ */

(function () {
  'use strict';

  /* ── Theme Registry ─────────────────────────────────────────── */

  const THEMES = {
    default: {
      id:       'default',
      name:     'Wren',
      subtitle: 'Original',
      mode:     null,            // null = restore user's own preference
      bg:       '#fafbfc',
      accent:   '#4F46E5',
      fonts:    [],
    },
    midnight: {
      id:       'midnight',
      name:     'Midnight',
      subtitle: 'Techy',
      mode:     'dark',
      bg:       '#0d0f14',
      accent:   '#00e5ff',
      fonts: [
        'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&display=swap',
      ],
    },
    arctic: {
      id:       'arctic',
      name:     'Arctic',
      subtitle: 'Sleek',
      mode:     'light',
      bg:       '#f0f7ff',
      accent:   '#0ea5e9',
      fonts: [
        'https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&display=swap',
      ],
    },
    obsidian: {
      id:       'obsidian',
      name:     'Obsidian',
      subtitle: 'Elegant',
      mode:     'dark',
      bg:       '#080706',
      accent:   '#c9a84c',
      fonts: [
        'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=Lato:wght@400;700&display=swap',
      ],
    },
    accessible: {
      id:       'accessible',
      name:     'Accessible',
      subtitle: 'Clear',
      mode:     'light',
      bg:       '#fef9f0',
      accent:   '#1a56db',
      fonts: [
        'https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:wght@400;700&display=swap',
      ],
    },
  };

  /* ── ThemeManager ───────────────────────────────────────────── */

  class ThemeManager {
    constructor () {
      /* The user's manual dark/light choice (before themes were applied) */
      this.userMode    = localStorage.getItem('wren-user-mode') || null;
      this.current     = localStorage.getItem('wren-theme')     || 'default';
      this.loadedFonts = new Set();

      /* Apply persisted theme immediately (before first paint if possible) */
      this._apply(this.current, false);

      /* Watch for the Settings modal opening so we can inject the picker */
      this._watchSettingsModal();
    }

    /* ── Public API ─────────────────────────────────────────── */

    /**
     * Switch to a theme by id.
     * Called by picker buttons AND available globally as WrenTheme.setTheme(id).
     */
    setTheme (themeId, save = true) {
      this._apply(themeId, save);
    }

    getTheme () {
      return this.current;
    }

    /* ── Internal ───────────────────────────────────────────── */

    _apply (themeId, save) {
      const theme = THEMES[themeId] || THEMES.default;
      const html  = document.documentElement;

      /* Remove previous Wren theme attribute */
      html.removeAttribute('data-wren-theme');

      if (themeId === 'default') {
        /* Restore the user's own dark/light preference */
        const savedMode = this.userMode || localStorage.getItem('wren-user-mode');
        if (savedMode) {
          html.setAttribute('data-theme', savedMode);
        }
        /* Clear any stored user-mode snapshot since we're back to default */
        /* (keep it in memory so they can go back to non-default and then
            return to default again cleanly) */
      } else {
        /* Snapshot the user's current mode the first time we override it */
        if (!this.userMode) {
          const currentMode = html.getAttribute('data-theme') || 'light';
          this.userMode = currentMode;
          localStorage.setItem('wren-user-mode', currentMode);
        }

        /* Apply the theme's required mode */
        if (theme.mode) {
          html.setAttribute('data-theme', theme.mode);
        }

        /* Mark the theme on the root element */
        html.setAttribute('data-wren-theme', themeId);
      }

      /* Load any Google Fonts this theme needs */
      theme.fonts.forEach(url => this._loadFont(url));

      this.current = themeId;
      if (save) localStorage.setItem('wren-theme', themeId);

      /* Sync picker UI if it's currently visible */
      this._updatePickerUI();

      /* Dispatch a custom event so other modules can react if needed */
      document.dispatchEvent(new CustomEvent('wren:theme-change', {
        detail: { themeId, theme }
      }));
    }

    _loadFont (url) {
      if (this.loadedFonts.has(url)) return;
      this.loadedFonts.add(url);
      const link  = document.createElement('link');
      link.rel    = 'stylesheet';
      link.href   = url;
      link.crossOrigin = 'anonymous';
      document.head.appendChild(link);
    }

    /* ── Settings modal injection ───────────────────────────── */

    _watchSettingsModal () {
      const tryObserve = () => {
        const modal = document.getElementById('settings-modal');
        if (!modal) {
          /* DOM not ready yet — retry shortly */
          setTimeout(tryObserve, 150);
          return;
        }

        const observer = new MutationObserver(() => {
          if (modal.classList.contains('is-open')) {
            /* Inject picker if not already there */
            if (!document.getElementById('wren-theme-section')) {
              this._injectPicker();
            }
          }
        });

        observer.observe(modal, {
          attributes:      true,
          attributeFilter: ['class'],
        });

        /* In case the modal is already open on page load */
        if (modal.classList.contains('is-open') &&
            !document.getElementById('wren-theme-section')) {
          this._injectPicker();
        }
      };

      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', tryObserve);
      } else {
        tryObserve();
      }
    }

    _buildPickerHTML () {
      const cards = Object.values(THEMES).map(t => {
        const isActive = this.current === t.id;
        const checkMark = isActive
          ? '<span class="wren-theme-check" aria-hidden="true">✓</span>'
          : '';

        return `
          <button
            class="wren-theme-card${isActive ? ' is-active' : ''}"
            data-theme-id="${t.id}"
            type="button"
            title="${t.name} — ${t.subtitle}"
            aria-pressed="${isActive}"
          >
            <span
              class="wren-theme-swatch"
              style="background-color:${t.bg};"
            >
              <span
                class="wren-theme-swatch-bar"
                style="background-color:${t.accent};"
              ></span>
              ${checkMark}
            </span>
            <span class="wren-theme-label">${t.name}</span>
            <span class="wren-theme-sub">${t.subtitle}</span>
          </button>`;
      }).join('');

      return `
        <div class="settings-section" id="wren-theme-section">
          <div class="settings-section-title">App Theme</div>
          <div class="wren-theme-picker" role="group" aria-label="Choose app theme">
            ${cards}
          </div>
        </div>`;
    }

    _injectPicker () {
      const body = document.querySelector('.settings-body');
      if (!body) return;

      /* Always build fresh HTML (removes stale state) */
      const existing = document.getElementById('wren-theme-section');
      if (existing) existing.remove();

      body.insertAdjacentHTML('afterbegin', this._buildPickerHTML());

      /* Attach click handlers to all newly created cards */
      body.querySelectorAll('.wren-theme-card').forEach(btn => {
        btn.addEventListener('click', () => {
          const themeId = btn.dataset.themeId;
          this.setTheme(themeId);
        });
      });
    }

    _updatePickerUI () {
      const cards = document.querySelectorAll('.wren-theme-card');
      if (!cards.length) return;

      cards.forEach(btn => {
        const isActive = btn.dataset.themeId === this.current;

        btn.classList.toggle('is-active', isActive);
        btn.setAttribute('aria-pressed', String(isActive));

        /* Update checkmark */
        const check   = btn.querySelector('.wren-theme-check');
        const swatch  = btn.querySelector('.wren-theme-swatch');

        if (isActive && !check && swatch) {
          swatch.insertAdjacentHTML(
            'beforeend',
            '<span class="wren-theme-check" aria-hidden="true">✓</span>'
          );
        } else if (!isActive && check) {
          check.remove();
        }
      });
    }
  }

  /* ── Bootstrap ──────────────────────────────────────────────── */

  window.WrenTheme = new ThemeManager();

})();
