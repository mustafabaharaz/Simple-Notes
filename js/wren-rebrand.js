/* ============================================================
   WREN-REBRAND.JS — "Simple Notes" → "Wren" UI patch
   Wren Phase 3 — Additive file, zero core edits
   ============================================================ */

(function () {
  const BRAND = {
    name:     'Wren',
    tagline:  'Nothing slips past a Wren.',
    icon:     ' ',
    old:      'Simple Notes',
    color:    '#007AFF'
  };

  function patch() {
    // 1. Browser tab title
    if (document.title.includes(BRAND.old)) {
      document.title = document.title.replace(new RegExp(BRAND.old, 'g'), BRAND.name);
    }

    // 2. Sidebar logo name
    const logoName = document.querySelector('.app-logo-name');
    if (logoName) logoName.textContent = BRAND.name;

    // 3. Sidebar tagline
    const tagline = document.querySelector('.app-logo-tagline');
    if (tagline) tagline.textContent = BRAND.tagline;

    // 4. Sidebar logo icon → bird
    // Logo image is set directly in index.html — no override needed

    // 5. Loading screen text
    const loadingP = document.querySelector('#loading-screen p');
    if (loadingP && loadingP.textContent.includes(BRAND.old)) {
      loadingP.textContent = `Loading ${BRAND.name}...`;
    }

    // 6. Meta description tag
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) {
      metaDesc.content = metaDesc.content.replace(new RegExp(BRAND.old, 'g'), BRAND.name);
    }

    // 7. Any remaining visible text in the hero / welcome screen
    [
      '.hero-badge',
      '.hero-title',
      '.hero-subtitle',
      '.welcome-hero h1',
      '.welcome-hero p'
    ].forEach(sel => {
      const el = document.querySelector(sel);
      if (el && el.innerHTML.includes(BRAND.old)) {
        el.innerHTML = el.innerHTML.replace(new RegExp(BRAND.old, 'g'), BRAND.name);
      }
    });

    // 8. Replace browser favicon with bird emoji SVG
    _setFavicon();

    console.log(`🐦 Wren: rebranded UI from "${BRAND.old}"`);
  }

  function _setFavicon() {
    // Remove any existing favicons
    document.querySelectorAll("link[rel*='icon']").forEach(l => l.remove());

    const link = document.createElement('link');
    link.rel  = 'icon';
    link.type = 'image/svg+xml';
    link.href = `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='85'>🐦</text></svg>`;
    document.head.appendChild(link);
  }

  // Re-patch the title if something else sets it back (e.g. app.js sets
  // document.title when opening a note — we want "Wren — Note Title")
  function _watchTitle() {
    let lastTitle = document.title;
    const obs = new MutationObserver(() => {
      if (document.title !== lastTitle) {
        lastTitle = document.title;
        if (!document.title.startsWith(BRAND.name)) {
          document.title = `${BRAND.name} — ${document.title.replace(BRAND.old + ' — ', '').replace(BRAND.old, '').trim()}`;
          lastTitle = document.title;
        }
      }
    });
    obs.observe(document.querySelector('title') || document.head, {
      childList: true,
      characterData: true,
      subtree: true
    });
  }

  // Run
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { patch(); _watchTitle(); });
  } else {
    patch();
    _watchTitle();
  }
})();

console.log('✅ Wren rebrand loaded');
