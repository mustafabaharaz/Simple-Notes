/* ============================================================
   SHARE.JS — Wren Share System
   Web Share API (mobile) + WhatsApp + iMessage/SMS + Group Email
   Wren Phase 3 — Additive file, zero core edits
   ============================================================ */

class WrenShare {
  constructor() {
    this.currentShareData = null;
    this._injectModal();
    // Wait for DOM + app to be fully ready before injecting buttons
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this._initButtons());
    } else {
      setTimeout(() => this._initButtons(), 600);
    }
    console.log('📤 Wren Share System initialized');
  }

  // ── Content Formatters ──────────────────────────────────────

  /**
   * Strip HTML tags and normalise whitespace for plain-text sharing.
   */
  _stripHtml(html) {
    const tmp = document.createElement('div');
    tmp.innerHTML = html || '';
    return (tmp.textContent || tmp.innerText || '').replace(/\n{3,}/g, '\n\n').trim();
  }

  _divider(len = 40) {
    return '─'.repeat(Math.min(len, 40));
  }

  _dateStr(ts) {
    return new Date(ts || Date.now()).toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
  }

  formatNote(note) {
    const title   = note.title || 'Untitled Note';
    const content = this._stripHtml(note.content);
    const tags    = note.tags && note.tags.length ? `Tags: ${note.tags.join(', ')}\n` : '';
    const text    = `${title}\n${this._divider(title.length)}\n${this._dateStr(note.modified || note.created)}\n${tags}\n${content}`;
    return { title: `📝 ${title}`, text, subject: `Note: ${title}` };
  }

  formatMeetingNote(note) {
    const title   = note.title || 'Meeting Notes';
    const content = this._stripHtml(note.content);
    const text    = `MEETING NOTES\n${this._divider()}\nTitle: ${title}\nDate:  ${this._dateStr(note.modified || note.created)}\n\n${content}`;
    return { title: `📋 ${title}`, text, subject: `Meeting Notes: ${title}` };
  }

  formatActionItems(note) {
    const title   = note.title || 'Action Items';
    const content = this._stripHtml(note.content);
    const text    = `ACTION ITEMS\n${this._divider()}\nFrom: ${title}\nDate: ${this._dateStr()}\n\n${content}`;
    return { title: `✅ Action Items — ${title}`, text, subject: `Action Items: ${title}` };
  }

  formatReport(rawHtml, reportTitle) {
    const title   = reportTitle || 'Activity Report';
    const content = this._stripHtml(rawHtml);
    const date    = this._dateStr();
    const text    = `${title.toUpperCase()}\n${this._divider()}\nGenerated: ${date}\n\n${content}`;
    return { title: `📊 ${title}`, text, subject: `${title} — ${date}` };
  }

  // ── Main Share Entry Point ───────────────────────────────────

  async share(type, payload) {
    let shareData;
    switch (type) {
      case 'meeting':      shareData = this.formatMeetingNote(payload); break;
      case 'action-items': shareData = this.formatActionItems(payload); break;
      case 'report':       shareData = this.formatReport(payload.html, payload.title); break;
      default:             shareData = this.formatNote(payload);
    }

    this.currentShareData = shareData;

    // Try native Web Share API first — perfect for mobile (shows WhatsApp,
    // iMessage, mail, Telegram, Signal — whatever the device has installed).
    if (navigator.share) {
      try {
        await navigator.share({ title: shareData.title, text: shareData.text });
        return;
      } catch (err) {
        if (err.name === 'AbortError') return; // user cancelled — do nothing
        // Any other error: fall through to our custom modal
      }
    }

    // Desktop fallback: our custom share sheet
    this._openModal(shareData);
  }

  // ── Modal Injection ─────────────────────────────────────────

  _injectModal() {
    if (document.getElementById('share-modal-overlay')) return;

    const overlay = document.createElement('div');
    overlay.id = 'share-modal-overlay';
    overlay.className = 'share-modal-overlay';
    overlay.style.display = 'none';
    overlay.innerHTML = `
      <div class="share-modal" role="dialog" aria-modal="true" aria-label="Share">
        <div class="share-modal-header">
          <h3>📤 Share</h3>
          <button class="share-modal-close" id="share-modal-close" aria-label="Close">✕</button>
        </div>

        <div class="share-modal-preview" id="share-preview-text" aria-label="Content preview"></div>

        <div class="share-modal-section-label">Share via</div>
        <div class="share-options-grid">
          <button class="share-option-btn opt-whatsapp" id="share-whatsapp">
            <span class="share-option-icon">💬</span>
            WhatsApp
          </button>
          <button class="share-option-btn opt-sms" id="share-sms">
            <span class="share-option-icon">✉️</span>
            iMessage / SMS
          </button>
          <button class="share-option-btn opt-email" id="share-email-direct">
            <span class="share-option-icon">📧</span>
            Email App
          </button>
          <button class="share-option-btn opt-copy" id="share-copy">
            <span class="share-option-icon">📋</span>
            Copy Text
          </button>
        </div>

        <div class="share-email-section">
          <h4>📧 Email a Contact Group</h4>
          <div class="contact-group-select-row">
            <select class="contact-group-select" id="share-group-select" aria-label="Select contact group">
              <option value="">— Select a group —</option>
            </select>
            <button class="btn-send-group-email" id="btn-send-group-email">Send</button>
          </div>
          <button class="btn-manage-groups" id="btn-manage-groups-from-share">
            ⚙️ Manage Groups
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    this._bindModalEvents();
  }

  _bindModalEvents() {
    document.getElementById('share-modal-close')
      .addEventListener('click', () => this._closeModal());

    document.getElementById('share-modal-overlay')
      .addEventListener('click', e => {
        if (e.target.id === 'share-modal-overlay') this._closeModal();
      });

    document.getElementById('share-whatsapp')
      .addEventListener('click', () => this._viaWhatsApp());

    document.getElementById('share-sms')
      .addEventListener('click', () => this._viaSMS());

    document.getElementById('share-email-direct')
      .addEventListener('click', () => this._viaEmailDirect());

    document.getElementById('share-copy')
      .addEventListener('click', () => this._viaCopy());

    document.getElementById('btn-send-group-email')
      .addEventListener('click', () => this._viaGroupEmail());

    document.getElementById('btn-manage-groups-from-share')
      .addEventListener('click', () => {
        this._closeModal();
        if (typeof contacts !== 'undefined') contacts.openModal();
      });
  }

  _openModal(shareData) {
    const preview = document.getElementById('share-preview-text');
    const text    = shareData.text;
    preview.textContent = text.length > 320 ? text.slice(0, 320) + '…' : text;
    this.refreshGroupSelect();
    document.getElementById('share-modal-overlay').style.display = 'flex';
  }

  _closeModal() {
    document.getElementById('share-modal-overlay').style.display = 'none';
  }

  /** Called by contacts.js after groups change so the select stays fresh */
  refreshGroupSelect() {
    const select = document.getElementById('share-group-select');
    if (!select || typeof contacts === 'undefined') return;
    const groups = contacts.getGroups();
    select.innerHTML = '<option value="">— Select a group —</option>' +
      groups.map(g =>
        `<option value="${g.id}">${this._esc(g.name)} (${g.emails.length})</option>`
      ).join('');
  }

  // ── Share Methods ────────────────────────────────────────────

  _viaWhatsApp() {
    if (!this.currentShareData) return;
    window.open(`https://wa.me/?text=${encodeURIComponent(this.currentShareData.text)}`, '_blank');
    this._closeModal();
  }

  _viaSMS() {
    if (!this.currentShareData) return;
    // sms: scheme works on iOS (iMessage) and Android (Messages)
    window.location.href = `sms:?body=${encodeURIComponent(this.currentShareData.text)}`;
    this._closeModal();
  }

  _viaEmailDirect() {
    if (!this.currentShareData) return;
    const { subject, text } = this.currentShareData;
    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`;
    this._closeModal();
  }

  async _viaCopy() {
    if (!this.currentShareData) return;
    try {
      await navigator.clipboard.writeText(this.currentShareData.text);
      this._toast('Copied to clipboard ✓');
      this._closeModal();
    } catch {
      // Fallback for older browsers / non-HTTPS
      const ta = document.createElement('textarea');
      ta.value = this.currentShareData.text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      this._toast('Copied to clipboard ✓');
      this._closeModal();
    }
  }

  _viaGroupEmail() {
    if (!this.currentShareData || typeof contacts === 'undefined') return;
    const groupId = document.getElementById('share-group-select').value;
    if (!groupId) { this._toast('Please select a contact group', 'error'); return; }
    const { subject, text } = this.currentShareData;
    const link = contacts.buildMailtoLink(groupId, subject, text);
    if (!link) { this._toast('Group has no valid email addresses', 'error'); return; }
    window.location.href = link;
    this._closeModal();
  }

  // ── Button Injection into existing UI ───────────────────────

  _initButtons() {
    this._addEditorShareButton();

    // Watch for Phase 2 team panels being added to the DOM
    const observer = new MutationObserver(() => this._injectTeamPanelButtons());
    observer.observe(document.body, { childList: true, subtree: true });
    this._injectTeamPanelButtons();
  }

  _addEditorShareButton() {
    const toolbar = document.querySelector('.editor-toolbar');
    if (!toolbar || document.getElementById('editor-share-btn')) return;

    const btn = document.createElement('button');
    btn.id = 'editor-share-btn';
    btn.className = 'share-btn toolbar-share-btn';
    btn.title = 'Share this note (Ctrl+Shift+S)';
    btn.innerHTML = `<span class="share-btn-icon">📤</span> Share`;
    btn.addEventListener('click', () => this._shareCurrentNote());
    toolbar.appendChild(btn);

    // Keyboard shortcut: Ctrl/Cmd + Shift + S
    document.addEventListener('keydown', e => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        this._shareCurrentNote();
      }
    });
  }

  _injectTeamPanelButtons() {
    // Meeting containers (Phase 2)
    document.querySelectorAll(
      '.meeting-notes-container, .meeting-summary, [data-panel="meeting"]'
    ).forEach(el => {
      if (el.querySelector('.wren-share-injected')) return;
      const btn = this._makeBtn('Share Meeting Notes', () => {
        const title = el.querySelector('h2,h3,[class*="title"]')?.textContent || 'Meeting Notes';
        this.share('meeting', { title, content: el.innerHTML, modified: Date.now() });
      });
      el.prepend(btn);
    });

    // Action items panel (Phase 2)
    document.querySelectorAll(
      '.action-items-panel, #action-items-panel, [data-panel="action-items"]'
    ).forEach(el => {
      if (el.querySelector('.wren-share-injected')) return;
      const btn = this._makeBtn('Share Action Items', () => {
        const title = el.querySelector('h2,h3,[class*="title"]')?.textContent || 'Action Items';
        this.share('action-items', { title, content: el.innerHTML, modified: Date.now() });
      });
      const hdr = el.querySelector('.panel-header, h3, h4');
      hdr ? hdr.after(btn) : el.prepend(btn);
    });

    // Activity report output (Phase 2)
    document.querySelectorAll(
      '.activity-report-output, #activity-report-output, .report-editor, [data-panel="report"]'
    ).forEach(el => {
      if (el.querySelector('.wren-share-injected')) return;
      const btn = this._makeBtn('Share Report', () => {
        const title = el.querySelector('h2,h3,[class*="title"]')?.textContent || 'Activity Report';
        this.share('report', { html: el.innerHTML, title });
      });
      el.prepend(btn);
    });
  }

  _makeBtn(label, onClick) {
    const btn = document.createElement('button');
    btn.className = 'share-btn wren-share-injected';
    btn.style.margin = '0 0 10px 0';
    btn.innerHTML = `<span class="share-btn-icon">📤</span> ${label}`;
    btn.addEventListener('click', onClick);
    return btn;
  }

  _shareCurrentNote() {
    const note = (typeof app !== 'undefined' && app.currentNote) ? app.currentNote : null;
    if (!note) { this._toast('Open a note first', 'error'); return; }

    const isMeeting =
      note.template === 'meeting' ||
      (Array.isArray(note.tags) && note.tags.includes('meeting')) ||
      (typeof note.content === 'string' && note.content.toLowerCase().includes('attendees'));

    this.share(isMeeting ? 'meeting' : 'note', note);
  }

  // ── Tiny helpers ─────────────────────────────────────────────

  _toast(msg, type = 'success') {
    if (typeof showToast === 'function') showToast(msg, type);
  }

  _esc(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }
}

// ── Global instance ───────────────────────────────────────────
const wrenShare = new WrenShare();
console.log('✅ Share system loaded');
