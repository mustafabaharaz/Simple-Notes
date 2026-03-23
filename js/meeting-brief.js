/* ============================================
   MEETING-BRIEF.JS — Pre-Meeting Brief Composer
   Phase 5 — Additive only, zero core edits
   Hotfix2: reads _liveData from meetingNotes
            WA icon button (no text)
   ============================================ */

class MeetingBrief {
  constructor() {
    this.init();
  }

  init() {
    this.watchForMeetingEditor();
    console.log('✅ MeetingBrief initialized');
  }

  watchForMeetingEditor() {
    const observer = new MutationObserver(() => {
      const footer = document.querySelector('.meeting-editor-footer');
      if (!footer || footer.dataset.briefBound) return;
      footer.dataset.briefBound = 'true';
      this.injectButton(footer);
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  injectButton(footer) {
    const btn = document.createElement('button');
    btn.className   = 'meeting-brief-btn';
    btn.id          = 'meeting-send-brief';
    btn.title       = 'Compose and send pre-meeting brief';
    btn.textContent = '📋 Send Brief';
    const reportBtn = footer.querySelector('#meeting-generate-report');
    reportBtn ? footer.insertBefore(btn, reportBtn) : footer.appendChild(btn);
    btn.addEventListener('click', () => {
      const noteId = window.meetingNotes?.activeMeetingId;
      if (noteId) this.open(noteId);
    });
  }

  /* ------------------------------------------
     OPEN
     Strategy: use _liveData (in-memory, always
     current) — falls back to storage if editor
     not open. No DOM parsing needed.
  ------------------------------------------ */

  open(noteId) {
    const note = storage.getNote(noteId);
    if (!note) return;

    // *** The fix: read live in-memory data object ***
    const data = window.meetingNotes?._liveData
      || (() => { try { return JSON.parse(note.content||'{}'); } catch(e) { return {}; } })();

    // Log timestamp
    data.briefSentAt = new Date().toISOString();
    storage.updateNote(noteId, { content: JSON.stringify(data) });
    document.dispatchEvent(new CustomEvent('meetingDataChanged', { detail: { noteId } }));

    // Use live title from title input if available
    const titleEl = document.getElementById('meeting-title-input');
    const title   = titleEl?.value?.trim() || note.title;

    const briefText = this.compose(title, data);

    document.getElementById('brief-modal')?.remove();

    const modal = document.createElement('div');
    modal.id        = 'brief-modal';
    modal.className = 'phase5-modal-overlay';
    modal.innerHTML = `
      <div class="phase5-modal">
        <div class="phase5-modal-header">
          <div class="phase5-modal-title">📋 Pre-Meeting Brief</div>
          <button class="phase5-modal-close" id="brief-close-btn">✕</button>
        </div>
        <div class="phase5-modal-subtitle">
          Edit as needed, then share. Attendees don't need the app.
        </div>
        <textarea class="phase5-modal-textarea" id="brief-textarea"
                  spellcheck="true">${this.escRaw(briefText)}</textarea>
        <div class="phase5-modal-footer">
          <span class="phase5-sent-badge">
            📤 Brief logged at ${this.fmtTime(data.briefSentAt)}
          </span>
          <div class="phase5-modal-actions">
            <button class="phase5-btn-secondary" id="brief-copy-btn">⎘ Copy</button>
            <button class="phase5-btn-whatsapp"  id="brief-whatsapp-btn" title="Send via WhatsApp">
              <!-- WhatsApp SVG icon -->
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-label="WhatsApp">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
            </button>
            <button class="phase5-btn-primary" id="brief-share-btn">↗ Share</button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    this.bindModalEvents(modal, note, title);
  }

  bindModalEvents(modal, note, title) {
    modal.querySelector('#brief-close-btn').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
    const onKey = (e) => { if (e.key === 'Escape') { modal.remove(); document.removeEventListener('keydown', onKey); } };
    document.addEventListener('keydown', onKey);

    const getText = () => modal.querySelector('#brief-textarea').value;

    modal.querySelector('#brief-copy-btn').addEventListener('click', () => {
      navigator.clipboard.writeText(getText())
        .then(() => showToast('⎘ Brief copied to clipboard'))
        .catch(() => showToast('⚠ Copy failed'));
    });

    modal.querySelector('#brief-whatsapp-btn').addEventListener('click', () => {
      window.open('https://wa.me/?text=' + encodeURIComponent(getText()), '_blank', 'noopener');
    });

    modal.querySelector('#brief-share-btn').addEventListener('click', () => {
      const text = getText();
      if (navigator.share) { navigator.share({ title, text }).catch(() => {}); }
      else { navigator.clipboard.writeText(text).then(() => showToast('⎘ Copied')).catch(() => {}); }
    });
  }

  /* ------------------------------------------
     COMPOSE
  ------------------------------------------ */

  compose(title, data) {
    const dateStr   = data.date
      ? new Date(data.date+'T12:00:00').toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric'})
      : '';
    const timeStr   = data.time || '';
    const attendees = (data.attendees || []).join(', ') || '—';

    const agendaLines = (data.agendaItems || [])
      .filter(i => i.title && i.title.trim())
      .map((item, idx) => `  ${idx+1}. ${item.title.trim()}`)
      .join('\n') || '  — No agenda items set yet';

    const dateLine  = dateStr ? `Date:      ${dateStr}` : '';
    const timeLine  = timeStr ? `Time:      ${timeStr}` : '';
    const metaBlock = [dateLine, timeLine, `Attendees: ${attendees}`].filter(Boolean).join('\n');

    return `Hi all,

Just a quick heads-up ahead of our upcoming meeting.

${title}
${metaBlock}

AGENDA
${agendaLines}

Please come prepared to discuss the above. Reply if you'd like to add anything before we meet.

See you then,
[Your name]`;
  }

  fmtTime(iso) {
    try { return new Date(iso).toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'}); }
    catch(e) { return ''; }
  }

  escRaw(str) { return String(str||''); }
}

document.addEventListener('DOMContentLoaded', () => { window.meetingBrief = new MeetingBrief(); });
console.log('✅ meeting-brief.js loaded');
