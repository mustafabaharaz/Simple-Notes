/* ============================================================
   HOTFIX-PHASE4F.JS — Share button in meeting reports
   Additive only — zero modifications to any existing file
   ============================================================ */

(function () {
  'use strict';

  const REPORT_SELECTORS = [
    '#activity-report-output',
    '.activity-report-output',
    '.report-editor',
    '[data-panel="report"]'
  ];

  function getShare () {
    if (window.wrenShare && typeof window.wrenShare.share === 'function') return window.wrenShare;
    try { if (typeof wrenShare !== 'undefined' && wrenShare) return wrenShare; } catch (e) {}
    try { if (typeof WrenShare !== 'undefined') { window.wrenShare = new WrenShare(); return window.wrenShare; } } catch (e) {}
    return null;
  }

  function injectShareButton (panel) {
    if (panel.querySelector('.hf4f-report-share-btn')) return;

    const header =
      panel.querySelector('.report-header, .report-title, h2, h3') ||
      panel.firstElementChild;

    const btn = document.createElement('button');
    btn.className = 'share-btn hf4f-report-share-btn';
    btn.style.cssText = 'margin: 0 0 14px 0; display: inline-flex;';
    btn.innerHTML = '<span class="share-btn-icon">📤</span> Share Report';

    btn.addEventListener('click', () => {
      const s = getShare();
      if (!s) { showToast('Share system not ready', 'error'); return; }
      const titleEl = panel.querySelector('h2, h3, .report-title, .meeting-title');
      const title = titleEl ? titleEl.textContent.trim() : 'Activity Report';
      s.share('report', { html: panel.innerHTML, title });
    });

    if (header && header.parentNode === panel) {
      panel.insertBefore(btn, header);
    } else {
      panel.prepend(btn);
    }
  }

  function isReportPanel (el) {
    if (!el || el.nodeType !== Node.ELEMENT_NODE) return false;
    return REPORT_SELECTORS.some(function(sel) {
      try { return el.matches(sel); } catch (e) { return false; }
    });
  }

  function scanForReportPanels (root) {
    if (isReportPanel(root)) injectShareButton(root);
    REPORT_SELECTORS.forEach(function(sel) {
      try {
        if (root.querySelectorAll) root.querySelectorAll(sel).forEach(injectShareButton);
      } catch (e) {}
    });
  }

  function startObserver () {
    var observer = new MutationObserver(function(mutations) {
      mutations.forEach(function(mutation) {
        mutation.addedNodes.forEach(function(node) {
          if (node.nodeType !== Node.ELEMENT_NODE) return;
          scanForReportPanels(node);
        });
      });
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  function hookReportEvent () {
    document.addEventListener('generateReportRequested', function() {
      setTimeout(function() { scanForReportPanels(document.body); }, 600);
    });
    document.addEventListener('click', function(e) {
      if (e.target.closest('#meeting-generate-report')) {
        setTimeout(function() { scanForReportPanels(document.body); }, 600);
      }
    });
  }

  function applyAll () {
    scanForReportPanels(document.body);
    startObserver();
    hookReportEvent();
    console.log('hotfix-phase4f.js loaded');
  }

  if (document.readyState === 'complete') {
    setTimeout(applyAll, 700);
  } else {
    window.addEventListener('load', function() { setTimeout(applyAll, 700); });
  }

})();
