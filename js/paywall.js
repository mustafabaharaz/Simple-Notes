/**
 * paywall.js
 * Phase 8 — Paywall (Cloud Sync gating)
 * Wren — Your always-on secretary
 *
 * - Local mode is always free, always works
 * - Cloud sync requires Team plan
 * - Invite code redeems Team plan for free
 * - Paywall modal shown when trying to use gated features
 *
 * All additive — zero edits to existing files.
 */

(function () {
  'use strict';

  class Paywall {
    constructor() {
      this.init();
    }

    init() {
      this.injectModal();
      this.checkPendingUpgrade();
      console.log('✅ Paywall loaded');
    }

    // ─── Check ────────────────────────────────────────────────

    isUnlocked() {
      return window.wrenAuth?.isPro?.() || false;
    }

    // Called by other modules before triggering a gated feature
    gate(feature, onAllowed) {
      if (!window.wrenAuth?.isLoggedIn()) {
        // Not signed in — show auth modal first
        window.wrenAuth?.openModal();
        return false;
      }
      if (this.isUnlocked()) {
        onAllowed?.();
        return true;
      }
      // Signed in but on free plan — show paywall
      this.show(feature);
      return false;
    }

    // ─── Pending upgrade (from invite code in URL) ────────────

    checkPendingUpgrade() {
      document.addEventListener('wren:auth-change', async (e) => {
        const { user } = e.detail;
        if (!user) return;

        const pending = localStorage.getItem('wren_pending_invite');
        if (pending && window.wrenAuth?.redeemInviteCode) {
          const ok = await window.wrenAuth.redeemInviteCode(pending);
          if (ok) {
            window.wrenAuth.showToast('✦ Team plan activated! Cloud sync enabled.', '#4F46E5');
          } else {
            window.wrenAuth.showToast('⚠️ Invite code not recognized', '#f59e0b');
            localStorage.removeItem('wren_pending_invite');
          }
        }
      });
    }

    // ─── Modal ────────────────────────────────────────────────

    injectModal() {
      const overlay = document.createElement('div');
      overlay.id        = 'paywall-modal-overlay';
      overlay.className = 'paywall-modal-overlay';
      overlay.style.display = 'none';

      overlay.innerHTML = `
        <div class="paywall-modal">
          <div class="paywall-modal-top">
            <div class="paywall-icon">☁️</div>
            <div class="paywall-title">Cloud sync is a Team feature</div>
            <p class="paywall-desc">
              Your notes are safe locally. Upgrade to Team to sync
              across devices, collaborate, and unlock cloud backup.
            </p>
          </div>

          <div class="paywall-modal-body">

            <ul class="paywall-features">
              <li><span class="paywall-check">✓</span> Sync notes across all your devices</li>
              <li><span class="paywall-check">✓</span> Cloud backup — never lose a note</li>
              <li><span class="paywall-check">✓</span> Shared meeting notes with your team</li>
              <li><span class="paywall-check">✓</span> Team action item board</li>
              <li><span class="paywall-check">✓</span> Google Calendar integration</li>
            </ul>

            <div class="paywall-price-row">
              <span class="paywall-price">$12</span>
              <span class="paywall-period">/ person / month</span>
              <span class="paywall-early">6 months free with invite</span>
            </div>

            <button class="paywall-upgrade-btn" id="paywall-upgrade-btn">
              Upgrade to Team →
            </button>

            <!-- Invite code entry -->
            <div class="paywall-invite-section">
              <div class="paywall-invite-label">Have an invite code?</div>
              <div class="paywall-invite-row">
                <input type="text" id="paywall-invite-input"
                  class="paywall-invite-input"
                  placeholder="e.g. WREN-UW7W"
                  autocomplete="off"
                  style="letter-spacing:0.06em;text-transform:uppercase">
                <button class="paywall-invite-btn" id="paywall-invite-btn">
                  Redeem
                </button>
              </div>
              <div id="paywall-invite-error"
                style="display:none;font-size:12px;color:#ef4444;margin-top:6px"></div>
            </div>

            <div class="paywall-dismiss" id="paywall-dismiss">
              Continue with local mode (free forever)
            </div>

          </div>
        </div>
      `;

      document.body.appendChild(overlay);
      this.bindModalEvents(overlay);
    }

    bindModalEvents(overlay) {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) this.hide();
      });

      overlay.querySelector('#paywall-dismiss')
        ?.addEventListener('click', () => this.hide());

      overlay.querySelector('#paywall-upgrade-btn')
        ?.addEventListener('click', () => {
          window.open('https://plyconsulting.com/wren#pricing', '_blank');
        });

      // Invite code redemption
      overlay.querySelector('#paywall-invite-btn')
        ?.addEventListener('click', () => this.redeemCode());

      overlay.querySelector('#paywall-invite-input')
        ?.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') this.redeemCode();
        });

      // Auto-uppercase invite input
      overlay.querySelector('#paywall-invite-input')
        ?.addEventListener('input', (e) => {
          const pos = e.target.selectionStart;
          e.target.value = e.target.value.toUpperCase();
          e.target.setSelectionRange(pos, pos);
        });
    }

    async redeemCode() {
      const input  = document.getElementById('paywall-invite-input');
      const errEl  = document.getElementById('paywall-invite-error');
      const code   = (input?.value || '').trim().toUpperCase();

      if (!code) { input?.focus(); return; }

      if (!window.wrenAuth?.isLoggedIn()) {
        this.hide();
        window.wrenAuth?.openModal();
        localStorage.setItem('wren_pending_invite', code);
        return;
      }

      const btn = document.getElementById('paywall-invite-btn');
      if (btn) { btn.disabled = true; btn.textContent = '…'; }

      const ok = await window.wrenAuth?.redeemInviteCode(code);

      if (btn) { btn.disabled = false; btn.textContent = 'Redeem'; }

      if (ok) {
        this.hide();
        window.wrenAuth?.showToast('✦ Team plan activated! Cloud sync enabled.', '#4F46E5');
      } else {
        if (errEl) {
          errEl.textContent = 'Code not recognized or already used.';
          errEl.style.display = 'block';
        }
        if (input) input.style.borderColor = 'rgba(239,68,68,0.5)';
        setTimeout(() => {
          if (errEl) errEl.style.display = 'none';
          if (input) input.style.borderColor = '';
        }, 3000);
      }
    }

    show(feature = '') {
      const overlay = document.getElementById('paywall-modal-overlay');
      if (overlay) {
        overlay.style.display = 'flex';
        setTimeout(() => document.getElementById('paywall-invite-input')?.focus(), 200);
      }
    }

    hide() {
      const overlay = document.getElementById('paywall-modal-overlay');
      if (overlay) overlay.style.display = 'none';
    }
  }

  // ─── Init ──────────────────────────────────────────────────

  function init() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        window.wrenPaywall = new Paywall();
      });
    } else {
      window.wrenPaywall = new Paywall();
    }
  }

  init();
})();
