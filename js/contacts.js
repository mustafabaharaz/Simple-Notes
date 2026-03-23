/* ============================================================
   CONTACTS.JS — Contact Groups Manager
   Wren Phase 3 — Additive file, zero core edits
   ============================================================ */

class ContactGroupsManager {
  constructor() {
    this.STORAGE_KEY = 'wren_contact_groups';
    this.groups = this.load();
    this._injectModal();
    console.log('📇 Contact Groups Manager initialized');
  }

  // ── Persistence ──────────────────────────────────────────────

  load() {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      console.error('ContactGroups: load failed', e);
      return [];
    }
  }

  _save() {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.groups));
    } catch (e) {
      console.error('ContactGroups: save failed', e);
    }
  }

  // ── Public API ────────────────────────────────────────────────

  getGroups() {
    return this.groups;
  }

  getGroup(id) {
    return this.groups.find(g => g.id === id) || null;
  }

  createGroup(name, emailsRaw) {
    const group = {
      id: 'grp_' + Date.now(),
      name: name.trim(),
      emails: this._parseEmails(emailsRaw),
      created: new Date().toISOString()
    };
    this.groups.push(group);
    this._save();
    return group;
  }

  updateGroup(id, name, emailsRaw) {
    const group = this.getGroup(id);
    if (!group) return null;
    group.name = name.trim();
    group.emails = this._parseEmails(emailsRaw);
    group.modified = new Date().toISOString();
    this._save();
    return group;
  }

  deleteGroup(id) {
    this.groups = this.groups.filter(g => g.id !== id);
    this._save();
  }

  /**
   * Build a mailto: link for a group with pre-filled subject and body.
   * Multiple recipients are comma-separated in the `to` field —
   * most mail clients open a single compose window with all addresses.
   */
  buildMailtoLink(groupId, subject, body) {
    const group = this.getGroup(groupId);
    if (!group || group.emails.length === 0) return null;
    const to = group.emails.join(',');
    // URLSearchParams encodes + as space in some clients, so we encode manually
    const s = encodeURIComponent(subject);
    const b = encodeURIComponent(body);
    return `mailto:${encodeURIComponent(to)}?subject=${s}&body=${b}`;
  }

  // ── Helpers ───────────────────────────────────────────────────

  _parseEmails(raw) {
    return raw
      .split(/[,;\n\r]+/)
      .map(e => e.trim())
      .filter(e => e.length > 0 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
  }

  _escapeHtml(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  // ── Modal Injection ───────────────────────────────────────────

  _injectModal() {
    if (document.getElementById('contacts-modal-overlay')) return;

    const overlay = document.createElement('div');
    overlay.id = 'contacts-modal-overlay';
    overlay.className = 'contacts-modal-overlay';
    overlay.style.display = 'none';
    overlay.innerHTML = `
      <div class="contacts-modal" role="dialog" aria-modal="true" aria-label="Contact Groups">
        <div class="contacts-modal-header">
          <h3>👥 Contact Groups</h3>
          <button class="share-modal-close" id="contacts-modal-close" aria-label="Close">✕</button>
        </div>
        <div class="contacts-modal-body">
          <div id="contact-groups-list" class="contact-groups-list"></div>
          <button class="btn-new-group" id="btn-new-group">
            <span>＋</span> New Group
          </button>
          <div id="contact-group-form" class="add-group-form" style="display:none;">
            <h4 id="group-form-title">New Group</h4>
            <input type="hidden" id="editing-group-id" value="">
            <div class="wren-form-field">
              <label for="group-name-input">Group Name</label>
              <input type="text" id="group-name-input" placeholder="e.g. Team, Board, Family" autocomplete="off">
            </div>
            <div class="wren-form-field">
              <label for="group-emails-input">Email Addresses</label>
              <textarea id="group-emails-input" placeholder="alice@company.com, bob@company.com&#10;(comma, semicolon, or new line separated)"></textarea>
              <div class="wren-field-hint">Each valid email becomes a recipient when you send to this group</div>
            </div>
            <div class="wren-form-actions">
              <button class="btn-cancel-group" id="btn-cancel-group">Cancel</button>
              <button class="btn-save-group" id="btn-save-group">Save Group</button>
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    this._bindModalEvents();
  }

  _bindModalEvents() {
    document.getElementById('contacts-modal-close')
      .addEventListener('click', () => this.closeModal());

    document.getElementById('contacts-modal-overlay')
      .addEventListener('click', e => {
        if (e.target.id === 'contacts-modal-overlay') this.closeModal();
      });

    document.getElementById('btn-new-group')
      .addEventListener('click', () => this._showForm());

    document.getElementById('btn-cancel-group')
      .addEventListener('click', () => this._hideForm());

    document.getElementById('btn-save-group')
      .addEventListener('click', () => this._saveFromForm());

    // Allow Enter to submit in group name field
    document.getElementById('group-name-input')
      .addEventListener('keydown', e => {
        if (e.key === 'Enter') { e.preventDefault(); this._saveFromForm(); }
      });
  }

  // ── Modal Public Methods ──────────────────────────────────────

  openModal() {
    document.getElementById('contacts-modal-overlay').style.display = 'flex';
    this._renderGroups();
    this._hideForm();
  }

  closeModal() {
    document.getElementById('contacts-modal-overlay').style.display = 'none';
    this._hideForm();
  }

  // ── Form ──────────────────────────────────────────────────────

  _showForm(group = null) {
    document.getElementById('group-form-title').textContent = group ? 'Edit Group' : 'New Group';
    document.getElementById('editing-group-id').value = group ? group.id : '';
    document.getElementById('group-name-input').value = group ? group.name : '';
    document.getElementById('group-emails-input').value = group ? group.emails.join(', ') : '';
    document.getElementById('contact-group-form').style.display = 'block';
    document.getElementById('group-name-input').focus();
  }

  _hideForm() {
    document.getElementById('contact-group-form').style.display = 'none';
  }

  _saveFromForm() {
    const id      = document.getElementById('editing-group-id').value;
    const name    = document.getElementById('group-name-input').value.trim();
    const emailsRaw = document.getElementById('group-emails-input').value;

    if (!name) {
      this._toast('Please enter a group name', 'error'); return;
    }

    const parsed = this._parseEmails(emailsRaw);
    if (parsed.length === 0) {
      this._toast('No valid email addresses found', 'error'); return;
    }

    if (id) {
      this.updateGroup(id, name, emailsRaw);
      this._toast(`Group "${name}" updated ✓`);
    } else {
      this.createGroup(name, emailsRaw);
      this._toast(`Group "${name}" created ✓`);
    }

    this._hideForm();
    this._renderGroups();
    // Refresh any open share modal selects
    if (typeof wrenShare !== 'undefined') wrenShare.refreshGroupSelect();
  }

  // ── Render ────────────────────────────────────────────────────

  _renderGroups() {
    const container = document.getElementById('contact-groups-list');
    if (!container) return;

    if (this.groups.length === 0) {
      container.innerHTML = `
        <div class="contacts-empty">
          <span class="contacts-empty-icon">👥</span>
          <p>No contact groups yet.<br>Create one to send emails to multiple people at once.</p>
        </div>`;
      return;
    }

    container.innerHTML = this.groups.map(g => `
      <div class="contact-group-item" data-id="${g.id}">
        <div class="contact-group-item-header">
          <span class="contact-group-item-name">
            ${this._escapeHtml(g.name)}
            <span class="contact-group-count">${g.emails.length}</span>
          </span>
          <div class="contact-group-actions">
            <button class="btn-group-action btn-group-edit"   data-id="${g.id}">Edit</button>
            <button class="btn-group-action btn-group-delete" data-id="${g.id}">Delete</button>
          </div>
        </div>
        <div class="contact-group-emails">
          ${g.emails.map(e => `<span class="contact-email-chip">${this._escapeHtml(e)}</span>`).join('')}
        </div>
      </div>
    `).join('');

    container.querySelectorAll('.btn-group-edit').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const g = this.getGroup(btn.dataset.id);
        if (g) this._showForm(g);
      });
    });

    container.querySelectorAll('.btn-group-delete').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const g = this.getGroup(btn.dataset.id);
        if (!g) return;
        if (confirm(`Delete group "${g.name}"? This cannot be undone.`)) {
          this.deleteGroup(btn.dataset.id);
          this._renderGroups();
          if (typeof wrenShare !== 'undefined') wrenShare.refreshGroupSelect();
          this._toast('Group deleted');
        }
      });
    });
  }

  _toast(msg, type = 'success') {
    if (typeof showToast === 'function') showToast(msg, type);
  }
}

// ── Global instance ───────────────────────────────────────────
const contacts = new ContactGroupsManager();
console.log('✅ Contacts loaded');
