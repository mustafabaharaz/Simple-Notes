/* ============================================================
   HOTFIX-PHASE4E.JS — People directory in Contacts modal
   Additive only — zero modifications to any existing file
   ============================================================
   Shows everyone saved via the attendee chip popover (wren_people)
   inside the Contacts modal as a "People" tab alongside "Groups".
   From the People tab you can:
     - Edit a person's email / phone
     - Add them directly to any existing contact group
     - Remove them from the directory
   ============================================================ */

(function () {
  'use strict';

  const PEOPLE_KEY = 'wren_people';

  /* ── People store (mirrors hotfix-phase4b) ── */
  const people = {
    load () {
      try { return JSON.parse(localStorage.getItem(PEOPLE_KEY) || '{}'); }
      catch { return {}; }
    },
    save (data) {
      try { localStorage.setItem(PEOPLE_KEY, JSON.stringify(data)); }
      catch { /* quota */ }
    },
    getAll () {
      const raw = this.load();
      return Object.entries(raw).map(([name, info]) => ({ name, ...info }));
    },
    set (name, info) {
      const all = this.load();
      all[name] = { ...(all[name] || {}), ...info };
      this.save(all);
    },
    remove (name) {
      const all = this.load();
      delete all[name];
      this.save(all);
    }
  };

  /* ── contacts instance resolver (same as 4d) ── */
  function getContacts () {
    if (window.contacts && typeof window.contacts.getGroups === 'function') return window.contacts;
    try { if (typeof contacts !== 'undefined' && contacts) return contacts; } catch {}
    return null;
  }

  /* ──────────────────────────────────────────────────────────
     STYLES
  ────────────────────────────────────────────────────────── */

  function injectStyles () {
    if (document.getElementById('hf4e-styles')) return;
    const s = document.createElement('style');
    s.id = 'hf4e-styles';
    s.textContent = `
      /* Tab bar inside contacts modal */
      .hf4e-tab-bar {
        display: flex;
        gap: 0;
        border-bottom: 1.5px solid var(--color-border);
        margin: -20px -24px 20px;
        padding: 0 24px;
      }
      .hf4e-tab {
        padding: 10px 18px;
        font-size: 13px;
        font-weight: 600;
        color: var(--color-text-secondary);
        border: none;
        background: none;
        cursor: pointer;
        border-bottom: 2.5px solid transparent;
        margin-bottom: -1.5px;
        transition: color .15s, border-color .15s;
      }
      .hf4e-tab.active {
        color: var(--color-primary);
        border-bottom-color: var(--color-primary);
      }
      .hf4e-tab:hover:not(.active) { color: var(--color-text-primary); }

      /* Panel visibility */
      .hf4e-panel { display: none; }
      .hf4e-panel.active { display: block; }

      /* People list */
      .hf4e-people-list {
        display: flex;
        flex-direction: column;
        gap: 8px;
        margin-bottom: 16px;
      }
      .hf4e-person-card {
        border: 1.5px solid var(--color-border);
        border-radius: 10px;
        overflow: hidden;
        transition: border-color .2s;
      }
      .hf4e-person-card:hover { border-color: var(--color-primary); }

      .hf4e-person-header {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 10px 14px;
        background: var(--color-bg-secondary);
      }
      .hf4e-person-avatar {
        width: 32px; height: 32px;
        border-radius: 50%;
        background: linear-gradient(135deg, #10b981, #059669);
        color: white;
        font-size: 12px;
        font-weight: 700;
        display: flex; align-items: center; justify-content: center;
        flex-shrink: 0;
      }
      .hf4e-person-name {
        flex: 1;
        font-size: 14px;
        font-weight: 700;
        color: var(--color-text-primary);
      }
      .hf4e-person-actions {
        display: flex; gap: 6px;
      }
      .hf4e-btn-sm {
        padding: 4px 10px;
        border: none; border-radius: 6px;
        font-size: 12px; font-weight: 600;
        cursor: pointer; transition: all .15s;
      }
      .hf4e-btn-edit {
        background: rgba(99,102,241,.1);
        color: var(--color-primary);
      }
      .hf4e-btn-edit:hover { background: rgba(99,102,241,.2); }
      .hf4e-btn-remove {
        background: rgba(239,68,68,.1);
        color: #ef4444;
      }
      .hf4e-btn-remove:hover { background: rgba(239,68,68,.2); }

      .hf4e-person-details {
        padding: 8px 14px 10px;
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        align-items: center;
      }
      .hf4e-detail-chip {
        display: inline-flex; align-items: center; gap: 5px;
        padding: 3px 10px;
        background: var(--color-bg-secondary);
        border: 1px solid var(--color-border);
        border-radius: 20px;
        font-size: 12px;
        color: var(--color-text-secondary);
      }
      .hf4e-detail-chip.email { border-color: rgba(99,102,241,.3); color: var(--color-primary); }
      .hf4e-detail-chip.phone { border-color: rgba(16,185,129,.3); color: #059669; }

      /* Add to group row */
      .hf4e-add-to-group-row {
        padding: 0 14px 12px;
        display: flex; gap: 8px; align-items: center;
      }
      .hf4e-group-select {
        flex: 1;
        padding: 6px 10px;
        border: 1.5px solid var(--color-border);
        border-radius: 7px;
        font-size: 13px;
        color: var(--color-text-primary);
        background: var(--color-surface);
        font-family: inherit;
        cursor: pointer;
      }
      .hf4e-group-select:focus { outline: none; border-color: var(--color-primary); }
      .hf4e-btn-add-to-group {
        padding: 6px 14px;
        background: linear-gradient(135deg, var(--color-primary), #7c3aed);
        color: white; border: none; border-radius: 7px;
        font-size: 12px; font-weight: 600; cursor: pointer;
        white-space: nowrap; transition: all .2s;
      }
      .hf4e-btn-add-to-group:hover { opacity: .9; transform: translateY(-1px); }

      /* Inline edit form */
      .hf4e-person-edit-form {
        padding: 10px 14px 12px;
        border-top: 1px solid var(--color-border);
        display: flex; flex-direction: column; gap: 8px;
      }
      .hf4e-edit-row {
        display: flex; gap: 8px; align-items: center;
      }
      .hf4e-edit-row label {
        font-size: 11px; font-weight: 700;
        text-transform: uppercase; letter-spacing: .06em;
        color: var(--color-text-secondary);
        min-width: 44px;
      }
      .hf4e-edit-row input {
        flex: 1; padding: 6px 10px;
        border: 1.5px solid var(--color-border);
        border-radius: 7px; font-size: 13px;
        color: var(--color-text-primary);
        background: var(--color-bg-secondary);
        font-family: inherit; transition: border-color .2s;
      }
      .hf4e-edit-row input:focus {
        outline: none; border-color: var(--color-primary);
        box-shadow: 0 0 0 3px rgba(99,102,241,.1);
      }
      .hf4e-edit-actions { display: flex; gap: 6px; justify-content: flex-end; }
      .hf4e-btn-save-edit {
        padding: 6px 14px;
        background: linear-gradient(135deg, var(--color-primary), #7c3aed);
        color: white; border: none; border-radius: 7px;
        font-size: 12px; font-weight: 600; cursor: pointer;
      }
      .hf4e-btn-cancel-edit {
        padding: 6px 12px;
        background: var(--color-bg-secondary);
        color: var(--color-text-secondary);
        border: 1.5px solid var(--color-border);
        border-radius: 7px; font-size: 12px; font-weight: 600; cursor: pointer;
      }

      /* Empty state */
      .hf4e-empty {
        text-align: center;
        padding: 32px 16px;
        color: var(--color-text-secondary);
        font-size: 13px;
        line-height: 1.6;
      }
      .hf4e-empty-icon { font-size: 36px; margin-bottom: 10px; display: block; }

      /* Dark mode */
      [data-theme="dark"] .hf4e-group-select {
        background: #1a1a1a; border-color: rgba(64,64,64,.5); color: #e5e5e5;
      }
      [data-theme="dark"] .hf4e-edit-row input {
        background: #111; border-color: rgba(64,64,64,.5); color: #e5e5e5;
      }
      [data-theme="dark"] .hf4e-person-header {
        background: #111;
      }
    `;
    document.head.appendChild(s);
  }

  /* ──────────────────────────────────────────────────────────
     PATCH CONTACTS MODAL
     Called once after contacts.openModal() runs
  ────────────────────────────────────────────────────────── */

  function patchContactsModal () {
    const body = document.querySelector('.contacts-modal-body');
    if (!body || body.querySelector('.hf4e-tab-bar')) return; /* already patched */

    /* ── 1. Wrap existing content in a Groups panel ── */
    const existing = Array.from(body.children);
    const groupsPanel = document.createElement('div');
    groupsPanel.className = 'hf4e-panel active';
    groupsPanel.id = 'hf4e-groups-panel';
    existing.forEach(el => groupsPanel.appendChild(el));
    body.appendChild(groupsPanel);

    /* ── 2. Build People panel ── */
    const peoplePanel = document.createElement('div');
    peoplePanel.className = 'hf4e-panel';
    peoplePanel.id = 'hf4e-people-panel';
    body.insertBefore(peoplePanel, groupsPanel); /* insert before so tab order is natural */

    /* ── 3. Build tab bar ── */
    const tabBar = document.createElement('div');
    tabBar.className = 'hf4e-tab-bar';
    tabBar.innerHTML = `
      <button class="hf4e-tab active" data-panel="hf4e-groups-panel">👥 Groups</button>
      <button class="hf4e-tab"        data-panel="hf4e-people-panel">👤 People</button>
    `;
    body.insertBefore(tabBar, body.firstChild);

    /* Tab switching */
    tabBar.querySelectorAll('.hf4e-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        tabBar.querySelectorAll('.hf4e-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        body.querySelectorAll('.hf4e-panel').forEach(p => p.classList.remove('active'));
        document.getElementById(tab.dataset.panel).classList.add('active');
        if (tab.dataset.panel === 'hf4e-people-panel') renderPeoplePanel(peoplePanel);
      });
    });
  }

  /* ──────────────────────────────────────────────────────────
     RENDER PEOPLE PANEL
  ────────────────────────────────────────────────────────── */

  function renderPeoplePanel (panel) {
    panel.innerHTML = '';
    const list = people.getAll();

    if (!list.length) {
      panel.innerHTML = `
        <div class="hf4e-empty">
          <span class="hf4e-empty-icon">👤</span>
          No people saved yet.<br>
          Add attendees to a meeting and click their chip to save contact info —
          they'll appear here automatically.
        </div>
      `;
      return;
    }

    const container = document.createElement('div');
    container.className = 'hf4e-people-list';

    list.forEach(person => {
      const card = buildPersonCard(person, panel);
      container.appendChild(card);
    });

    panel.appendChild(container);
  }

  function buildPersonCard (person, panel) {
    const { name, email = '', phone = '' } = person;
    const initials = name.split(' ').map(w => w[0] || '').join('').slice(0, 2).toUpperCase();

    const card = document.createElement('div');
    card.className = 'hf4e-person-card';
    card.dataset.name = name;

    /* Header */
    const header = document.createElement('div');
    header.className = 'hf4e-person-header';
    header.innerHTML = `
      <div class="hf4e-person-avatar">${_esc(initials)}</div>
      <span class="hf4e-person-name">${_esc(name)}</span>
      <div class="hf4e-person-actions">
        <button class="hf4e-btn-sm hf4e-btn-edit">Edit</button>
        <button class="hf4e-btn-sm hf4e-btn-remove">Remove</button>
      </div>
    `;
    card.appendChild(header);

    /* Details */
    const details = document.createElement('div');
    details.className = 'hf4e-person-details';
    if (email) details.innerHTML += `<span class="hf4e-detail-chip email">✉️ ${_esc(email)}</span>`;
    if (phone) details.innerHTML += `<span class="hf4e-detail-chip phone">📞 ${_esc(phone)}</span>`;
    if (!email && !phone) {
      details.innerHTML = `<span style="font-size:12px;color:var(--color-text-secondary);font-style:italic;">No contact info yet — click Edit to add</span>`;
    }
    card.appendChild(details);

    /* Add to group row */
    const c = getContacts();
    const groups = c ? c.getGroups() : [];
    if (groups.length && email) {
      const addRow = document.createElement('div');
      addRow.className = 'hf4e-add-to-group-row';
      addRow.innerHTML = `
        <select class="hf4e-group-select">
          <option value="">Add to group…</option>
          ${groups.map(g => `<option value="${g.id}">${_esc(g.name)}</option>`).join('')}
        </select>
        <button class="hf4e-btn-add-to-group">Add →</button>
      `;
      addRow.querySelector('.hf4e-btn-add-to-group').addEventListener('click', () => {
        const sel = addRow.querySelector('.hf4e-group-select');
        const groupId = sel.value;
        if (!groupId) { showToast('Select a group first', 'warning'); return; }
        if (!c) { showToast('Contact groups not ready', 'error'); return; }

        const group = c.getGroup(groupId);
        if (!group) return;

        if (group.emails.includes(email)) {
          showToast(`${name} is already in ${group.name}`, 'info');
          return;
        }

        c.updateGroup(groupId, group.name, [...group.emails, email].join(', '));
        if (typeof c.refreshGroupSelect === 'function') c.refreshGroupSelect();
        showToast(`✓ ${name} added to ${group.name}`);
        sel.value = '';
      });
      card.appendChild(addRow);
    } else if (groups.length && !email) {
      const hint = document.createElement('p');
      hint.style.cssText = 'font-size:11px;color:var(--color-text-secondary);padding:0 14px 10px;margin:0;font-style:italic;';
      hint.textContent = 'Add an email address to assign this person to a group.';
      card.appendChild(hint);
    }

    /* Edit form (hidden by default) */
    const editForm = document.createElement('div');
    editForm.className = 'hf4e-person-edit-form';
    editForm.style.display = 'none';
    editForm.innerHTML = `
      <div class="hf4e-edit-row">
        <label>Email</label>
        <input type="email" class="hf4e-email-input" value="${_esc(email)}" placeholder="alice@example.com">
      </div>
      <div class="hf4e-edit-row">
        <label>Phone</label>
        <input type="tel" class="hf4e-phone-input" value="${_esc(phone)}" placeholder="+1 555 000 0000">
      </div>
      <div class="hf4e-edit-actions">
        <button class="hf4e-btn-cancel-edit">Cancel</button>
        <button class="hf4e-btn-save-edit">Save</button>
      </div>
    `;
    card.appendChild(editForm);

    /* Edit button */
    header.querySelector('.hf4e-btn-edit').addEventListener('click', () => {
      const open = editForm.style.display !== 'none';
      editForm.style.display = open ? 'none' : 'flex';
      if (!open) editForm.querySelector('.hf4e-email-input').focus();
    });

    /* Save edit */
    editForm.querySelector('.hf4e-btn-save-edit').addEventListener('click', () => {
      const newEmail = editForm.querySelector('.hf4e-email-input').value.trim();
      const newPhone = editForm.querySelector('.hf4e-phone-input').value.trim();
      people.set(name, { email: newEmail, phone: newPhone });
      showToast(`✓ ${name} updated`);
      /* Re-render the panel to reflect new data */
      renderPeoplePanel(panel);
    });

    /* Cancel edit */
    editForm.querySelector('.hf4e-btn-cancel-edit').addEventListener('click', () => {
      editForm.style.display = 'none';
    });

    /* Remove */
    header.querySelector('.hf4e-btn-remove').addEventListener('click', () => {
      if (!confirm(`Remove ${name} from your people directory?\nThis won't affect contact groups.`)) return;
      people.remove(name);
      showToast(`${name} removed`);
      renderPeoplePanel(panel);
    });

    return card;
  }

  /* ──────────────────────────────────────────────────────────
     INTERCEPT openModal — patch the modal each time it opens
  ────────────────────────────────────────────────────────── */

  function hookOpenModal () {
    /* Try patching the live instance (handles both window.contacts
       and the bare `contacts` identifier) */
    const c = getContacts();
    if (!c || c.__hf4e_patched) return;
    c.__hf4e_patched = true;

    const origOpen = c.openModal.bind(c);
    c.openModal = function () {
      origOpen();
      /* One tick delay lets contacts.js render its groups list first */
      setTimeout(patchContactsModal, 0);
    };

    console.log('✅ Fix: contacts.openModal patched with People tab');
  }

  /* ──────────────────────────────────────────────────────────
     UTIL
  ────────────────────────────────────────────────────────── */

  function _esc (s) {
    const d = document.createElement('div');
    d.textContent = s || '';
    return d.innerHTML;
  }

  /* ──────────────────────────────────────────────────────────
     INIT
  ────────────────────────────────────────────────────────── */

  function applyAll () {
    injectStyles();
    hookOpenModal();
    console.log('✅ hotfix-phase4e.js — People directory ready');
  }

  if (document.readyState === 'complete') {
    setTimeout(applyAll, 800);
  } else {
    window.addEventListener('load', () => setTimeout(applyAll, 800));
  }

})();
