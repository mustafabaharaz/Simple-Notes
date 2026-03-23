/* ============================================================
   HOTFIX-PHASE4D.JS — Phase 4 Fourth Pass
   Additive only — zero modifications to any existing file
   ============================================================
   Fix 1 — Contacts & Share "not ready": const scope fix
   Fix 2 — Remove duplicate org trash + folders from 4b
   ============================================================

   ROOT CAUSE (Contacts/Share):
   contacts.js  → `const contacts  = new ContactGroupsManager()`
   share.js     → `const wrenShare = new WrenShare()`

   `const` at the top level of a classic (non-module) script is
   accessible as a BARE IDENTIFIER from any other classic script
   (they all share the same global scope), but is NOT a property
   of `window`. So `window.contacts` is always undefined, but
   just writing `contacts` works fine — as long as we guard
   against ReferenceError with typeof first.
   ============================================================ */

(function () {
  'use strict';

  /* ──────────────────────────────────────────────────────────
     FIX 1 — Resolve instances via bare identifier
  ────────────────────────────────────────────────────────── */

  function getContacts () {
    /* 1. Already on window (set by a previous hotfix pass) */
    if (window.contacts && typeof window.contacts.openModal === 'function') {
      return window.contacts;
    }
    /* 2. Bare identifier — const in contacts.js, same global scope */
    try {
      /* eslint-disable no-undef */
      if (typeof contacts !== 'undefined' && contacts &&
          typeof contacts.openModal === 'function') {
        window.contacts = contacts; /* cache on window for future calls */
        return window.contacts;
      }
    } catch (e) { /* contacts not declared yet */ }

    /* 3. Last resort: re-instantiate from the class constructor */
    try {
      if (typeof ContactGroupsManager !== 'undefined') {
        window.contacts = new ContactGroupsManager();
        return window.contacts;
      }
    } catch (e) { console.warn('ContactGroupsManager init failed:', e); }

    return null;
  }

  function getShare () {
    if (window.wrenShare && typeof window.wrenShare.share === 'function') {
      return window.wrenShare;
    }
    try {
      if (typeof wrenShare !== 'undefined' && wrenShare &&
          typeof wrenShare.share === 'function') {
        window.wrenShare = wrenShare;
        return window.wrenShare;
      }
    } catch (e) { /* wrenShare not declared yet */ }

    try {
      if (typeof WrenShare !== 'undefined') {
        window.wrenShare = new WrenShare();
        return window.wrenShare;
      }
    } catch (e) { console.warn('WrenShare init failed:', e); }

    return null;
  }

  /* Re-wire the Contacts button in the org sidebar */
  function fix1_rewireContactsBtn () {
    const btn = document.getElementById('org-contacts-btn');
    if (!btn || btn.__hf4d_wired) return;
    btn.__hf4d_wired = true;

    btn.onclick = () => {
      const c = getContacts();
      if (c) {
        c.openModal();
      } else {
        showToast('Contacts not loaded — check the browser console', 'error');
        console.error('[Wren] ContactGroupsManager not found. ' +
          'Ensure js/contacts.js loads before js/hotfix-phase4d.js.');
      }
    };
    console.log('✅ Fix 1: Contacts button re-wired (bare-identifier resolver)');
  }

  /* Re-wire the Share button in the editor toolbar */
  function fix1_rewireShareBtn () {
    const btn = document.getElementById('editor-share-btn');
    if (!btn || btn.__hf4d_wired) return;
    btn.__hf4d_wired = true;

    btn.onclick = () => {
      const s = getShare();
      if (!s) {
        showToast('Share not loaded — check the browser console', 'error');
        console.error('[Wren] WrenShare not found. ' +
          'Ensure js/share.js loads before js/hotfix-phase4d.js.');
        return;
      }
      const note = typeof app !== 'undefined' && app.currentNote
        ? app.currentNote : null;
      if (!note) { showToast('Open a note first', 'error'); return; }
      s.share('note', note);
    };
    console.log('✅ Fix 1: Share button re-wired (bare-identifier resolver)');
  }

  /* ──────────────────────────────────────────────────────────
     FIX 2 — Remove duplicate org trash + folders from 4b
     hotfix-phase4b injected #org-folder-dropzones and
     #org-trash-section as brand-new elements. These clash with
     the real teleported ones from hotfix-phase4c. Remove them.
  ────────────────────────────────────────────────────────── */

  function fix2_removeDuplicates () {
    const ids = [
      'org-folder-dropzones',   /* fake folders from 4b */
      'org-trash-section',      /* fake trash from 4b   */
    ];

    let removed = 0;
    ids.forEach(id => {
      const el = document.getElementById(id);
      if (el) { el.remove(); removed++; }
    });

    if (removed > 0) {
      console.log(`✅ Fix 2: Removed ${removed} duplicate org element(s) from hotfix-phase4b`);
    }
  }

  /* ──────────────────────────────────────────────────────────
     INIT
  ────────────────────────────────────────────────────────── */

  function applyAll () {
    fix2_removeDuplicates();
    fix1_rewireContactsBtn();
    fix1_rewireShareBtn();

    /* Expose to window immediately for any late callers */
    getContacts();
    getShare();

    console.log('✅ hotfix-phase4d.js — all fixes applied');
  }

  if (document.readyState === 'complete') {
    setTimeout(applyAll, 700);
  } else {
    window.addEventListener('load', () => setTimeout(applyAll, 700));
  }

  /* If org sidebar appears after we run, re-wire then too */
  document.addEventListener('workspaceChanged', ({ detail }) => {
    if (detail && detail.workspace === 'org') {
      setTimeout(() => {
        fix1_rewireContactsBtn();
        fix2_removeDuplicates();
      }, 150);
    }
  });

})();
