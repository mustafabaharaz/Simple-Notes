/* ============================================
   ORG-LAYOUT-PATCH.JS v3
   Moves #btn-new-meeting + #org-contacts-btn
   from .org-sidebar-footer to right after
   #org-nav (the Meetings/Actions/Reports nav).
   Additive only — zero core edits.
   ============================================ */

(function orgLayoutPatch() {

  /* ------------------------------------------
     CSS
  ------------------------------------------ */

  const style = document.createElement('style');
  style.id = 'org-layout-patch-style';
  style.textContent = `
    /* Wrapper injected right after #org-nav */
    #org-quick-actions-wrapper {
      display: flex;
      flex-direction: column;
      gap: 6px;
      padding: 8px 12px 4px;
    }

    /* Make moved buttons full-width */
    #org-quick-actions-wrapper > button {
      width: 100%;
      box-sizing: border-box;
    }

    /* Hide the now-empty footer so it leaves no gap */
    .org-sidebar-footer:empty {
      display: none;
    }
  `;
  document.head.appendChild(style);

  /* ------------------------------------------
     PATCH FUNCTION
  ------------------------------------------ */

  function patch() {
    // Both buttons must exist
    const newMeetingBtn = document.getElementById('btn-new-meeting');
    const contactsBtn   = document.getElementById('org-contacts-btn');
    const orgNav        = document.getElementById('org-nav');

    if (!newMeetingBtn || !contactsBtn || !orgNav) return false;

    // Already done?
    if (document.getElementById('org-quick-actions-wrapper')) return true;

    // Build wrapper and insert right after #org-nav
    const wrapper = document.createElement('div');
    wrapper.id = 'org-quick-actions-wrapper';
    orgNav.insertAdjacentElement('afterend', wrapper);

    // Move the buttons into the wrapper
    wrapper.appendChild(newMeetingBtn);
    wrapper.appendChild(contactsBtn);

    console.log('✅ org-layout-patch v3: buttons moved after #org-nav');
    return true;
  }

  /* ------------------------------------------
     POLLING — runs until it works or times out
  ------------------------------------------ */

  let attempts = 0;

  function tryPatch() {
    if (patch()) return;           // success
    if (++attempts < 60) setTimeout(tryPatch, 300); // retry for up to 18s
  }

  // Run on DOMContentLoaded
  document.addEventListener('DOMContentLoaded', tryPatch);

  // Re-run whenever org mode is activated (workspace toggle)
  document.addEventListener('workspaceChanged', () => {
    // Reset so the patch can run again if org mode is toggled off/on
    const existing = document.getElementById('org-quick-actions-wrapper');
    if (existing) existing.remove();
    attempts = 0;
    setTimeout(tryPatch, 100);
  });

  // Catch pages that are already loaded
  if (document.readyState !== 'loading') tryPatch();

  console.log('✅ org-layout-patch.js v3 loaded');
})();
