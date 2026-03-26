/* ================================================================
   SIDEBAR-REDESIGN.JS — Phase 10 + Quickfixes
   ① Branded splash screen
   ② New Note + Search icon on one row
   ③ Folders panel: new folder inline, folder list
   ④ Trash panel: item list + recover + empty
   ⑤ Trash right-click context menu
   ⑥ Bottom bar: Profile | Settings | Break
   ⑦ Profile popup (signed in state)
   ⑧ Sign In → opens existing auth modal
   ⑨ Editor toolbar: Save tick + Encrypt + Delete moved in
   ⑩ Settings: Account / Sign Out section
   Additive — zero edits to existing files
   ================================================================ */

(function () {
  'use strict';

  /* ═══════════════════════════════════════════════════════════
     WREN CUSTOM DIALOG — replaces browser confirm() / prompt()
     ═══════════════════════════════════════════════════════════ */

  /* wrenConfirm({ title, body, icon, confirmText, danger })
     Returns a Promise<boolean> */
  function wrenConfirm ({ title = 'Are you sure?', body = '', icon = '⚠️',
                          confirmText = 'Confirm', danger = false } = {}) {
    return new Promise(resolve => {
      const backdrop = document.createElement('div');
      backdrop.className = 'wren-dialog-backdrop';
      backdrop.innerHTML = `
        <div class="wren-dialog" role="dialog" aria-modal="true">
          <div class="wren-dialog-icon">${icon}</div>
          <div class="wren-dialog-title">${escHtml(title)}</div>
          ${body ? `<div class="wren-dialog-body">${escHtml(body)}</div>` : ''}
          <div class="wren-dialog-actions">
            <button class="wren-dialog-btn wren-dialog-btn-cancel" id="wd-cancel">Cancel</button>
            <button class="wren-dialog-btn wren-dialog-btn-confirm${danger ? ' danger' : ''}" id="wd-confirm">${escHtml(confirmText)}</button>
          </div>
        </div>`;
      document.body.appendChild(backdrop);

      const cleanup = result => { backdrop.remove(); resolve(result); };

      backdrop.querySelector('#wd-confirm').addEventListener('click', () => cleanup(true));
      backdrop.querySelector('#wd-cancel').addEventListener('click',  () => cleanup(false));
      backdrop.addEventListener('click', e => { if (e.target === backdrop) cleanup(false); });
      document.addEventListener('keydown', function esc(e) {
        if (e.key === 'Escape') { cleanup(false); document.removeEventListener('keydown', esc); }
      });
      // Focus confirm so Enter works
      setTimeout(() => backdrop.querySelector('#wd-confirm')?.focus(), 50);
    });
  }

  /* wrenPrompt({ title, body, icon, placeholder, defaultValue, confirmText })
     Returns a Promise<string|null> */
  function wrenPrompt ({ title = '', body = '', icon = '✏️',
                         placeholder = '', defaultValue = '', confirmText = 'OK' } = {}) {
    return new Promise(resolve => {
      const backdrop = document.createElement('div');
      backdrop.className = 'wren-dialog-backdrop';
      backdrop.innerHTML = `
        <div class="wren-dialog" role="dialog" aria-modal="true">
          <div class="wren-dialog-icon">${icon}</div>
          <div class="wren-dialog-title">${escHtml(title)}</div>
          ${body ? `<div class="wren-dialog-body">${escHtml(body)}</div>` : ''}
          <input class="wren-dialog-input" id="wd-input"
                 placeholder="${escHtml(placeholder)}" value="${escHtml(defaultValue)}" autocomplete="off">
          <div class="wren-dialog-actions">
            <button class="wren-dialog-btn wren-dialog-btn-cancel" id="wd-cancel">Cancel</button>
            <button class="wren-dialog-btn wren-dialog-btn-confirm" id="wd-confirm">${escHtml(confirmText)}</button>
          </div>
        </div>`;
      document.body.appendChild(backdrop);

      const input = backdrop.querySelector('#wd-input');
      const cleanup = result => { backdrop.remove(); resolve(result); };

      backdrop.querySelector('#wd-confirm').addEventListener('click', () => cleanup(input.value || null));
      backdrop.querySelector('#wd-cancel').addEventListener('click',  () => cleanup(null));
      backdrop.addEventListener('click', e => { if (e.target === backdrop) cleanup(null); });
      input.addEventListener('keydown', e => {
        if (e.key === 'Enter')  cleanup(input.value || null);
        if (e.key === 'Escape') cleanup(null);
      });
      document.addEventListener('keydown', function esc(e) {
        if (e.key === 'Escape') { cleanup(null); document.removeEventListener('keydown', esc); }
      });
      setTimeout(() => { input.focus(); input.select(); }, 50);
    });
  }

  /* Expose helpers globally for use by dialog-patch.js and other modules */
  window.wrenConfirm = wrenConfirm;
  window.wrenPrompt  = wrenPrompt;
  /* Keep native confirm/prompt intact — dialog-patch.js patches each call site directly */
  window._nativeConfirm = window.confirm.bind(window);
  window._nativePrompt  = window.prompt.bind(window);

  /* ═══════════════════════════════════════════════════════════
     ① LOADING SPLASH — runs immediately, before DOMContentLoaded
     ═══════════════════════════════════════════════════════════ */
  (function upgradeSplash () {
    const screen = document.getElementById('loading-screen');
    if (!screen) return;
    screen.innerHTML = `
      <div class="wren-splash">
        <div class="wren-splash-logo-wrap">
          <img src="assets/icons/Wren_Corner_White.svg" alt="Wren" class="wren-splash-img"
               onerror="this.style.display='none'">
        </div>
        <div class="wren-splash-wordmark">Wren</div>
        <div class="wren-splash-tagline">Nothing slips past a wren</div>
        <div class="wren-splash-dots"><span></span><span></span><span></span></div>
      </div>`;
  })();

  /* ═══════════════════════════════════════════════════════════
     MAIN INIT — after DOM ready
     ═══════════════════════════════════════════════════════════ */
  function init () {
    buildSearchRow();
    buildUtilityBar();
    buildBottomBar();
    addEditorToolbarControls();
    addAccountSectionToSettings();
    updateBadges();
    syncAuthLabel();

    /* Live badge updates */
    observe('trash-count',       updateBadges);
    observe('user-folders-list', updateBadges);

    /* Live auth label / settings email sync */
    observe('auth-user-email', () => { syncAuthLabel(); syncSettingsAccountEmail(); });

    /* Wire toolbar controls each time toolbar becomes visible */
    const toolbar = document.getElementById('unified-toolbar');
    if (toolbar) {
      new MutationObserver(() => addEditorToolbarControls())
        .observe(toolbar, { attributes: true, attributeFilter: ['style'] });
    }

    /* Fix 3: org-mode white flash — permanently neuter org-welcome.js's showEmptyState
       and hide both screens immediately; CSS also kills #org-empty-state permanently */
    document.addEventListener('workspaceChanged', e => {
      if (e.detail?.workspace === 'org') {
        const welcome  = document.getElementById('welcome-screen');
        const oldOrgEs = document.getElementById('org-empty-state');
        if (welcome)  welcome.style.display  = 'none';
        if (oldOrgEs) oldOrgEs.style.display = 'none';
      }
    });

    /* Neuter orgWelcome.showEmptyState so it can't un-hide #org-empty-state */
    function neutraliseOldOrgWelcome () {
      if (window.orgWelcome && !window.orgWelcome.__neutralised) {
        window.orgWelcome.__neutralised = true;
        window.orgWelcome.showEmptyState = function () {
          // Do nothing — org-welcome-screen.js handles the empty state now
        };
      }
    }
    setTimeout(neutraliseOldOrgWelcome, 200);
    document.addEventListener('workspaceChanged', () => setTimeout(neutraliseOldOrgWelcome, 50));

    /* Watch save-status changes to mirror into toolbar tick */
    observe('save-status', mirrorSaveTick);

    /* Fix 1: ensure utility + bottom bars are direct children of .sidebar,
       not trapped inside personal-sidebar-content (which hides in org mode) */
    function rescueBars () {
      const personalContent = document.getElementById('personal-sidebar-content');
      const sidebar = document.querySelector('.sidebar');
      if (!personalContent || !sidebar) return;
      ['sidebar-utility-bar', 'sidebar-bottom-bar'].forEach(id => {
        const el = document.getElementById(id);
        if (el && personalContent.contains(el)) {
          sidebar.appendChild(el);
        }
      });
    }
    // Run now and also whenever org mode activates (in case wrapPersonalContent runs later)
    setTimeout(rescueBars, 300);
    document.addEventListener('workspaceChanged', () => setTimeout(rescueBars, 100));

    /* Fix 4: inject Contacts button into attendees section whenever meeting editor opens */
    document.addEventListener('meetingOpened', injectContactsIntoAttendees);
    document.addEventListener('workspaceChanged', () => setTimeout(injectContactsIntoAttendees, 400));
    /* Also observe main content for meeting editor being added */
    const mainEl = document.querySelector('.main-content');
    if (mainEl) {
      new MutationObserver(() => {
        if (document.getElementById('meeting-editor')) injectContactsIntoAttendees();
      }).observe(mainEl, { childList: true, subtree: true });
    }
  }

  /* ═══════════════════════════════════════════════════════════
     ② SEARCH ROW — icon next to New Note
     ═══════════════════════════════════════════════════════════ */
  function buildSearchRow () {
    if (document.getElementById('qa-search-btn')) return;
    const newNoteBtn = document.getElementById('new-note-btn');
    if (!newNoteBtn) return;

    /* Search icon button */
    const searchBtn = document.createElement('button');
    searchBtn.id = 'qa-search-btn';
    searchBtn.title = 'Search notes';
    searchBtn.innerHTML = '🔍';
    newNoteBtn.parentNode.insertBefore(searchBtn, newNoteBtn.nextSibling);

    /* Inline search bar (below the row) */
    const bar = document.createElement('div');
    bar.id = 'qa-search-bar';
    bar.innerHTML = `
      <input id="qa-search-input-inline" type="text"
             placeholder="Search notes…" autocomplete="off" spellcheck="false">
      <button id="qa-search-close" title="Close search">✕</button>`;
    newNoteBtn.closest('.quick-actions').insertAdjacentElement('afterend', bar);

    /* Wire search input to the real hidden search input */
    const realInput  = document.getElementById('search-input');
    const realClear  = document.getElementById('search-clear');
    const inlineInput = bar.querySelector('#qa-search-input-inline');

    searchBtn.addEventListener('click', () => {
      bar.classList.toggle('visible');
      if (bar.classList.contains('visible')) {
        inlineInput.focus();
        searchBtn.innerHTML = '✕';
      } else {
        closeSearch(inlineInput, realInput, realClear, searchBtn);
      }
    });

    bar.querySelector('#qa-search-close').addEventListener('click', () => {
      bar.classList.remove('visible');
      closeSearch(inlineInput, realInput, realClear, searchBtn);
    });

    inlineInput.addEventListener('input', () => {
      if (realInput) {
        realInput.value = inlineInput.value;
        realInput.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });

    inlineInput.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        bar.classList.remove('visible');
        closeSearch(inlineInput, realInput, realClear, searchBtn);
      }
    });
  }

  function closeSearch (inlineInput, realInput, realClear, searchBtn) {
    if (inlineInput) inlineInput.value = '';
    if (realInput) { realInput.value = ''; realInput.dispatchEvent(new Event('input', { bubbles: true })); }
    if (realClear) realClear.click();
    if (searchBtn) searchBtn.innerHTML = '🔍';
  }

  /* ═══════════════════════════════════════════════════════════
     ③ UTILITY BAR (Folders + Trash buttons)
     ═══════════════════════════════════════════════════════════ */
  function buildUtilityBar () {
    if (document.getElementById('sidebar-utility-bar')) return;
    const sidebar = document.querySelector('.sidebar');
    if (!sidebar) return;

    const bar = document.createElement('div');
    bar.id = 'sidebar-utility-bar';
    bar.className = 'sidebar-utility-bar';
    bar.innerHTML = `
      <button class="sub-btn" id="sub-folders-btn" title="Folders">
        <span class="sub-icon">📁</span>
        <span class="sub-label">Folders</span>
        <span class="sub-badge" id="sub-folders-badge" style="display:none"></span>
      </button>
      <button class="sub-btn" id="sub-trash-btn" title="Trash (right-click to empty)">
        <span class="sub-icon">🗑️</span>
        <span class="sub-label">Trash</span>
        <span class="sub-badge" id="sub-trash-badge" style="display:none"></span>
      </button>`;
    sidebar.appendChild(bar);

    document.getElementById('sub-folders-btn').addEventListener('click', () => togglePanel('folders'));
    document.getElementById('sub-trash-btn').addEventListener('click', () => togglePanel('trash'));

    /* Right-click on trash → context menu */
    document.getElementById('sub-trash-btn').addEventListener('contextmenu', e => {
      e.preventDefault();
      showTrashContextMenu(e.clientX, e.clientY);
    });
  }

  /* ─── Panels ─────────────────────────────────────────────── */
  function togglePanel (which) {
    const existing = document.getElementById('sidebar-panel-overlay');
    if (existing && existing.dataset.panel === which) {
      existing.remove();
      setBtnActive(which, false);
      return;
    }
    if (existing) { setBtnActive(existing.dataset.panel, false); existing.remove(); }

    const overlay = document.createElement('div');
    overlay.id = 'sidebar-panel-overlay';
    overlay.className = 'sidebar-panel-overlay';
    overlay.dataset.panel = which;

    if (which === 'folders') buildFoldersPanel(overlay);
    else                      buildTrashPanel(overlay);

    document.querySelector('.sidebar').appendChild(overlay);
    setBtnActive(which, true);

    setTimeout(() => {
      document.addEventListener('click', function outsideClose (e) {
        const btn = document.getElementById('sub-' + which + '-btn');
        if (!overlay.contains(e.target) && !btn?.contains(e.target)) {
          overlay.remove();
          setBtnActive(which, false);
          document.removeEventListener('click', outsideClose);
        }
      });
    }, 50);
  }

  function setBtnActive (which, on) {
    document.getElementById('sub-' + which + '-btn')?.classList.toggle('sub-btn-active', on);
  }

  /* ─── Folders panel ──────────────────────────────────────── */
  function buildFoldersPanel (overlay) {
    overlay.innerHTML = `
      <div class="sp-panel-header">
        <span class="sp-panel-title">📁 Folders</span>
      </div>
      <div class="sp-new-folder-row">
        <input class="sp-new-folder-input" id="sp-new-folder-input"
               placeholder="New folder name…" maxlength="40">
        <button class="sp-new-folder-add" id="sp-new-folder-add">+ Add</button>
      </div>
      <div class="sp-folder-list" id="sp-folder-list"></div>`;

    /* Populate folders from the real hidden section */
    refreshFolderList(overlay);

    /* Create new folder */
    const input = overlay.querySelector('#sp-new-folder-input');
    const addBtn = overlay.querySelector('#sp-new-folder-add');

    function doAdd () {
      const name = input.value.trim();
      if (!name) return;
      /* Call storage + app APIs directly — bypasses the prompt() in createNewFolder() */
      try {
        if (window.storage?.createFolder) {
          window.storage.createFolder(name);
          window.app?.renderFolders?.();
          window.app?.renderFolderDropdown?.();
          if (typeof showToast === 'function') showToast('\u{1F4C1} Folder "' + name + '" created!');
        }
      } catch (err) {
        console.warn('Folder create error:', err);
      }
      input.value = '';
      setTimeout(() => refreshFolderList(overlay), 150);
    }

    addBtn.addEventListener('click', doAdd);
    input.addEventListener('keydown', e => { if (e.key === 'Enter') doAdd(); });

    /* Re-sync when real folders list changes */
    const realFoldersList = document.getElementById('user-folders-list');
    if (realFoldersList) {
      new MutationObserver(() => refreshFolderList(overlay))
        .observe(realFoldersList, { childList: true, subtree: true });
    }
  }

  function refreshFolderList (overlay) {
    const container = overlay.querySelector('#sp-folder-list');
    if (!container) return;
    const realFolders = document.getElementById('user-folders-list');
    if (!realFolders) { container.innerHTML = '<div class="sp-empty-state">No folders yet</div>'; return; }

    const items = Array.from(realFolders.querySelectorAll('.folder-item'));
    if (items.length === 0) {
      container.innerHTML = '<div class="sp-empty-state">No folders yet</div>';
      return;
    }

    container.innerHTML = '';
    items.forEach(item => {
      const name     = item.querySelector('.folder-name')?.textContent || item.textContent.trim();
      const icon     = item.querySelector('.folder-icon')?.textContent || '📁';
      const count    = item.querySelector('.folder-count')?.textContent || '';
      const folderId = item.dataset.folderId;
      const div      = document.createElement('div');
      div.className  = 'sp-folder-item';
      div.innerHTML  = `<span>${icon}</span><span style="flex:1">${escHtml(name)}</span>${count ? `<span style="font-size:11px;color:var(--color-text-tertiary);margin-right:4px">${count}</span>` : ''}<button class="sp-folder-delete" title="Delete folder" data-folder-id="${escHtml(folderId || '')}">✕</button>`;
      // Click row → select folder
      div.addEventListener('click', e => {
        if (e.target.closest('.sp-folder-delete')) return;
        item.click();
      });
      // Click ✕ → delete folder
      div.querySelector('.sp-folder-delete').addEventListener('click', e => {
        e.stopPropagation();
        wrenConfirm({
          title: 'Delete "' + name + '"?',
          body: 'Notes inside will become Unfiled. This cannot be undone.',
          icon: '📁',
          confirmText: 'Delete',
          danger: true
        }).then(ok => {
          if (!ok) return;
          try {
            if (window.storage?.deleteFolder && folderId) {
              window.storage.deleteFolder(folderId);
              window.app?.renderFolders?.();
              window.app?.renderFolderDropdown?.();
              if (typeof showToast === 'function') showToast('🗑️ Folder deleted');
            }
          } catch (err) { console.warn('Delete folder error:', err); }
          setTimeout(() => refreshFolderList(overlay), 150);
        });
        return; // async from here
      });
      container.appendChild(div);
    });
  }

  /* ─── Trash panel ────────────────────────────────────────── */
  function buildTrashPanel (overlay) {
    overlay.innerHTML = `
      <div class="sp-panel-header">
        <span class="sp-panel-title">🗑️ Trash</span>
      </div>
      <div class="sp-trash-list" id="sp-trash-list"></div>
      <button class="sp-empty-trash-btn" id="sp-empty-trash-btn">🗑️ Empty Trash</button>`;

    refreshTrashList(overlay);

    overlay.querySelector('#sp-empty-trash-btn').addEventListener('click', () => {
      wrenConfirm({
        title: 'Empty Trash?',
        body: 'All trashed notes will be permanently deleted. This cannot be undone.',
        icon: '🗑️',
        confirmText: 'Empty Trash',
        danger: true
      }).then(ok => {
        if (!ok) return;
        const realEmptyBtn = document.getElementById('empty-trash-btn');
        if (realEmptyBtn) realEmptyBtn.click();
        setTimeout(() => refreshTrashList(overlay), 200);
      });
    });

    /* Sync when real trash changes */
    const realTrashList = document.getElementById('trash-list');
    if (realTrashList) {
      new MutationObserver(() => refreshTrashList(overlay))
        .observe(realTrashList, { childList: true, subtree: true });
    }
  }

  function refreshTrashList (overlay) {
    const container = overlay.querySelector('#sp-trash-list');
    if (!container) return;
    const realTrash = document.getElementById('trash-list');
    const items = realTrash ? Array.from(realTrash.querySelectorAll('.trash-item')) : [];

    if (items.length === 0) {
      container.innerHTML = '<div class="sp-empty-state">Trash is empty ✓</div>';
      return;
    }

    container.innerHTML = '';
    items.forEach(item => {
      const title = item.querySelector('.trash-item-title')?.textContent
                 || item.textContent.trim().split('\n')[0] || 'Untitled';
      const row   = document.createElement('div');
      row.className = 'sp-trash-item';
      row.innerHTML = `
        <span class="sp-trash-item-title">${escHtml(title)}</span>
        <button class="sp-trash-recover">↩ Recover</button>`;
      row.querySelector('.sp-trash-recover').addEventListener('click', e => {
        e.stopPropagation();
        /* Find restore button in the real item */
        const restoreBtn = item.querySelector('[data-action="restore"], .restore-btn, button');
        if (restoreBtn) restoreBtn.click();
        else item.click(); /* fallback: open/select it */
        setTimeout(() => refreshTrashList(overlay), 200);
      });
      container.appendChild(row);
    });
  }

  /* ─── Trash right-click context menu ─────────────────────── */
  function showTrashContextMenu (x, y) {
    removeById('trash-context-menu');
    const menu = document.createElement('div');
    menu.id = 'trash-context-menu';
    menu.innerHTML = `
      <div class="trash-ctx-item" id="tctx-open">📂 Open Trash</div>
      <div class="trash-ctx-item danger" id="tctx-empty">🗑️ Empty Trash</div>`;
    menu.style.left = x + 'px';
    menu.style.top  = y + 'px';
    document.body.appendChild(menu);

    /* Keep menu inside viewport */
    const rect = menu.getBoundingClientRect();
    if (rect.right > window.innerWidth)  menu.style.left = (x - rect.width) + 'px';
    if (rect.bottom > window.innerHeight) menu.style.top = (y - rect.height) + 'px';

    menu.querySelector('#tctx-open').addEventListener('click', () => {
      removeById('trash-context-menu');
      togglePanel('trash');
    });

    menu.querySelector('#tctx-empty').addEventListener('click', () => {
      removeById('trash-context-menu');
      wrenConfirm({
        title: 'Empty Trash?',
        body: 'All trashed notes will be permanently deleted. This cannot be undone.',
        icon: '🗑️',
        confirmText: 'Empty Trash',
        danger: true
      }).then(ok => {
        if (ok) document.getElementById('empty-trash-btn')?.click();
      });
    });

    setTimeout(() => {
      document.addEventListener('click', function closeCtx () {
        removeById('trash-context-menu');
        document.removeEventListener('click', closeCtx);
      });
    }, 30);
  }

  /* ═══════════════════════════════════════════════════════════
     ④ BOTTOM BAR
     ═══════════════════════════════════════════════════════════ */
  function buildBottomBar () {
    if (document.getElementById('sidebar-bottom-bar')) return;
    const sidebar = document.querySelector('.sidebar');
    if (!sidebar) return;

    const bar = document.createElement('div');
    bar.id = 'sidebar-bottom-bar';
    bar.className = 'sidebar-bottom-bar';
    bar.innerHTML = `
      <button class="sbb-btn" id="sbb-profile-btn" title="Profile / Sign In">
        <span class="sbb-icon">👤</span>
        <span class="sbb-label" id="sbb-profile-label">Sign In</span>
      </button>
      <button class="sbb-btn" id="sbb-settings-btn" title="Settings (Ctrl+,)">
        <span class="sbb-icon">⚙️</span>
        <span class="sbb-label">Settings</span>
      </button>
      <button class="sbb-btn" id="sbb-break-btn" title="Take a Break">
        <span class="sbb-icon">☕</span>
        <span class="sbb-label">Break</span>
      </button>`;
    sidebar.appendChild(bar);

    document.getElementById('sbb-settings-btn').addEventListener('click', () => {
      document.getElementById('settings-btn')?.click();
    });

    document.getElementById('sbb-break-btn').addEventListener('click', () => {
      document.getElementById('take-break-btn')?.click();
    });

    document.getElementById('sbb-profile-btn').addEventListener('click', () => {
      const email = getAuthEmail();
      if (email) {
        showProfilePopup(email);
      } else {
        /* Open the real auth modal (supabase-auth.js) */
        openAuthModal();
      }
    });
  }

  /* ─── Profile popup (signed in) ──────────────────────────── */
  function showProfilePopup (email) {
    if (removeById('sbb-profile-popup')) return; /* toggle off */
    const popup = document.createElement('div');
    popup.id = 'sbb-profile-popup';
    popup.className = 'profile-popup';
    popup.innerHTML = `
      <div class="profile-popup-inner">
        <div class="profile-popup-avatar">👤</div>
        <div class="profile-popup-email">${escHtml(email)}</div>
        <button class="profile-popup-signout" id="profile-signout-btn">Sign Out</button>
      </div>`;
    document.body.appendChild(popup);

    popup.querySelector('#profile-signout-btn').addEventListener('click', () => {
      popup.remove();
      document.getElementById('sign-out-btn')?.click();
    });

    setTimeout(() => {
      document.addEventListener('click', function closePopup (e) {
        const btn = document.getElementById('sbb-profile-btn');
        if (!popup.contains(e.target) && !btn?.contains(e.target)) {
          popup.remove();
          document.removeEventListener('click', closePopup);
        }
      });
    }, 60);
  }

  /* ─── Open auth modal (sign in / sign up) ─────────────────── */
  function openAuthModal () {
    /* Try wrenAuth (supabase-auth.js instance) */
    if (window.wrenAuth?.openModal) { window.wrenAuth.openModal(); return; }
    /* Fallback: click hidden sign-in button injected by supabase-auth.js */
    const btn = document.getElementById('auth-modal-overlay');
    if (btn) { btn.style.display = 'flex'; return; }
    /* Last resort: open settings so user can see account section */
    document.getElementById('settings-btn')?.click();
  }

  /* ═══════════════════════════════════════════════════════════
     ⑤ EDITOR TOOLBAR: Save tick + Encrypt + Delete
     ═══════════════════════════════════════════════════════════ */
  function addEditorToolbarControls () {
    const toolbar = document.getElementById('unified-toolbar');
    if (!toolbar || toolbar.style.display === 'none') return;
    if (document.getElementById('toolbar-save-tick')) return;

    const formattingSection = toolbar.querySelector('.toolbar-formatting');
    if (!formattingSection) return;

    /* ── Save tick ── */
    const tickEl = document.createElement('div');
    tickEl.id = 'toolbar-save-tick';
    tickEl.className = 'toolbar-save-tick';
    tickEl.innerHTML = `<span class="tick-icon">✓</span><span class="tick-text">Saved</span>`;
    formattingSection.appendChild(document.createElement('div')).className = 'toolbar-divider';
    formattingSection.appendChild(tickEl);

    /* Mirror existing save-status into tick */
    mirrorSaveTick();

    /* ── Encrypt ── */
    const dividerEnc = document.createElement('div');
    dividerEnc.className = 'toolbar-divider';
    const encBtn = document.createElement('button');
    encBtn.id = 'toolbar-encrypt-btn';
    encBtn.className = 'toolbar-btn';
    encBtn.title = 'Encrypt Note (Ctrl+E)';
    encBtn.textContent = '🔒';
    encBtn.addEventListener('click', () => {
      document.getElementById('encrypt-note-btn')?.click() ||
      document.getElementById('decrypt-note-btn')?.click();
    });
    formattingSection.appendChild(dividerEnc);
    formattingSection.appendChild(encBtn);

    /* ── Delete ── */
    const dividerDel = document.createElement('div');
    dividerDel.className = 'toolbar-divider';
    const delBtn = document.createElement('button');
    delBtn.id = 'toolbar-delete-btn';
    delBtn.className = 'toolbar-btn toolbar-delete';
    delBtn.title = 'Delete Note';
    delBtn.textContent = '🗑️';
    delBtn.addEventListener('click', () => {
      /* Call patched deleteCurrentNote directly (dialog-patch.js owns it) */
      if (window.app?.deleteCurrentNote) window.app.deleteCurrentNote();
      else document.getElementById('delete-note-btn')?.click();
    });
    formattingSection.appendChild(dividerDel);
    formattingSection.appendChild(delBtn);

    /* Sync encrypt/decrypt visibility */
    syncEncryptButton();
    observe('encrypt-note-btn', syncEncryptButton);
    observe('decrypt-note-btn', syncEncryptButton);
  }

  function syncEncryptButton () {
    const btn = document.getElementById('toolbar-encrypt-btn');
    if (!btn) return;
    const isEncrypted = document.getElementById('decrypt-note-btn')?.style.display !== 'none'
                     && getComputedStyle(document.getElementById('decrypt-note-btn')).display !== 'none';
    /* The real buttons are hidden by CSS; check their data state */
    const realDecrypt = document.getElementById('decrypt-note-btn');
    if (realDecrypt && realDecrypt.dataset.active === 'true') {
      btn.textContent = '🔓';
      btn.title = 'Decrypt Note';
    } else {
      btn.textContent = '🔒';
      btn.title = 'Encrypt Note (Ctrl+E)';
    }
  }

  function mirrorSaveTick () {
    const tickEl   = document.getElementById('toolbar-save-tick');
    if (!tickEl) return;
    const realStatus = document.getElementById('save-status');
    const text = realStatus?.textContent?.trim() || '✓ Saved';
    const isSaved = text.includes('Saved') || text.includes('✓');
    tickEl.classList.toggle('saved', isSaved);
    tickEl.querySelector('.tick-text').textContent = isSaved ? 'Saved' : 'Saving…';
    tickEl.querySelector('.tick-icon').textContent = isSaved ? '✓' : '…';
  }

  /* ═══════════════════════════════════════════════════════════
     ⑥ SETTINGS: Account / Sign Out section
     ═══════════════════════════════════════════════════════════ */
  function addAccountSectionToSettings () {
    if (document.getElementById('settings-account-section')) return;
    const settingsBody = document.querySelector('.settings-body');
    if (!settingsBody) return;

    const section = document.createElement('div');
    section.className = 'settings-section';
    section.id = 'settings-account-section';
    section.innerHTML = `
      <div class="settings-section-title">Account</div>
      <div class="settings-row">
        <div class="settings-label-group">
          <span class="settings-label" id="settings-account-email">Not signed in</span>
          <span class="settings-sublabel">Your Wren account</span>
        </div>
        <button id="settings-auth-action-btn" class="btn-settings">Sign In</button>
      </div>`;
    settingsBody.appendChild(section);

    document.getElementById('settings-auth-action-btn').addEventListener('click', () => {
      const email = getAuthEmail();
      if (email) {
        wrenConfirm({
          title: 'Sign out of Wren?',
          body: 'Your notes are saved locally and will still be here when you return.',
          icon: '👤',
          confirmText: 'Sign Out',
          danger: false
        }).then(ok => {
          if (!ok) return;
          document.getElementById('sign-out-btn')?.click();
          document.getElementById('settings-modal').style.display = 'none';
        });
      } else {
        document.getElementById('settings-modal').style.display = 'none';
        setTimeout(() => openAuthModal(), 150);
      }
    });

    syncSettingsAccountEmail();
  }

  function syncSettingsAccountEmail () {
    const emailEl  = document.getElementById('settings-account-email');
    const actionBtn = document.getElementById('settings-auth-action-btn');
    if (!emailEl || !actionBtn) return;
    const email = getAuthEmail();
    if (email) {
      emailEl.textContent = email;
      actionBtn.textContent = 'Sign Out';
      actionBtn.className = 'btn-settings btn-danger';
    } else {
      emailEl.textContent = 'Not signed in';
      actionBtn.textContent = 'Sign In';
      actionBtn.className = 'btn-settings';
    }
  }

  /* ═══════════════════════════════════════════════════════════
     ⑦ BADGE COUNTS
     ═══════════════════════════════════════════════════════════ */
  function updateBadges () {
    setBadge('sub-trash-badge',
      parseInt(document.getElementById('trash-count')?.textContent) || 0);

    const folderCount = document.getElementById('user-folders-list')
      ?.querySelectorAll('.folder-item').length || 0;
    setBadge('sub-folders-badge', folderCount);
  }

  function setBadge (id, count) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = count;
    el.style.display = count > 0 ? 'flex' : 'none';
  }

  /* ═══════════════════════════════════════════════════════════
     SYNC AUTH LABEL
     ═══════════════════════════════════════════════════════════ */
  function syncAuthLabel () {
    const label = document.getElementById('sbb-profile-label');
    if (!label) return;
    const email = getAuthEmail();
    if (email) {
      const name = email.split('@')[0];
      label.textContent = name.length > 9 ? name.slice(0, 9) + '…' : name;
    } else {
      label.textContent = 'Sign In';
    }
  }

  /* ═══════════════════════════════════════════════════════════
     FIX 4: CONTACTS BUTTON → ATTENDEES SECTION
     ═══════════════════════════════════════════════════════════ */
  function injectContactsIntoAttendees () {
    if (document.getElementById('attendee-contacts-btn')) return;
    const addRow = document.querySelector('.attendee-add-row');
    if (!addRow) return;

    const btn = document.createElement('button');
    btn.id = 'attendee-contacts-btn';
    btn.className = 'attendee-add-btn';
    btn.title = 'Open Contact Groups';
    btn.innerHTML = '👥';
    btn.style.cssText = 'background:transparent;border:1.5px solid var(--color-border);color:var(--color-text-secondary);margin-left:4px;flex-shrink:0;';

    btn.addEventListener('click', () => {
      const c = window.wrenContacts || window.contacts;
      if (c?.openModal) { c.openModal(); return; }
      // fallback: look for the modal directly
      const overlay = document.getElementById('contacts-modal-overlay');
      if (overlay) { overlay.style.display = 'flex'; return; }
      if (typeof showToast === 'function') showToast('Contacts not loaded yet', 'warning');
    });

    addRow.appendChild(btn);
  }

  /* ═══════════════════════════════════════════════════════════
     HELPERS
     ═══════════════════════════════════════════════════════════ */
  function getAuthEmail () {
    const email = document.getElementById('auth-user-email')?.textContent?.trim();
    return (email && email !== 'Loading…' && email.includes('@')) ? email : null;
  }

  function observe (id, cb) {
    const el = document.getElementById(id);
    if (!el) return;
    new MutationObserver(cb).observe(el, { childList: true, characterData: true, subtree: true, attributes: true });
  }

  function removeById (id) {
    const el = document.getElementById(id);
    if (el) { el.remove(); return true; }
    return false;
  }

  function escHtml (str) {
    return String(str)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  /* ── Boot ─────────────────────────────────────────────────── */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    setTimeout(init, 0);
  }

})();
