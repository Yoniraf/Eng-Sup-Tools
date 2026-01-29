// Production tool theme initializer. Visual-only: sets data-theme and updates JSONEditor theme if present.
(function () {
  function setFavicon(href) {
    try {
      const existing = document.querySelector('link[rel="icon"], link[rel="shortcut icon"]');
      const link = existing || document.createElement('link');
      link.rel = 'icon';
      link.type = 'image/png';
      link.href = href;
      if (!existing) document.head.appendChild(link);
    } catch { /* ignore */ }
  }

  function normalizeTheme(raw) {
    const v = String(raw || '').toLowerCase();
    return v === 'light' ? 'light' : 'dark';
  }

  const u = new URL(location.href);
  const theme = normalizeTheme(u.searchParams.get('theme') || 'dark');
  document.documentElement.dataset.theme = theme;

  setFavicon(new URL('../assets/favicon.png', location.href).toString());

  function applyJsonEditorTheme(nextTheme) {
    try {
      const hasJsonEditor = !!document.querySelector('link[href*="vanilla-jsoneditor"], .editor-container, .jse-menu, .jse-navigation-bar');
      if (!hasJsonEditor) return;

      const links = Array.from(document.querySelectorAll('link[rel="stylesheet"]'));
      const themeLink = links.find(l => (l.href || '').includes('vanilla-jsoneditor') && (l.href || '').includes('jse-theme-'));
      if (themeLink) {
        const wants = nextTheme === 'light' ? 'jse-theme-light.css' : 'jse-theme-dark.css';
        if (!themeLink.href.includes(wants)) {
          themeLink.href = themeLink.href.replace(/jse-theme-(dark|light)\.css/i, wants);
        }
      }

      const containers = Array.from(document.querySelectorAll('.editor-container'));
      containers.forEach((el) => {
        el.classList.toggle('jse-theme-dark', nextTheme === 'dark');
        el.classList.toggle('jse-theme-light', nextTheme === 'light');
      });
    } catch { /* ignore */ }
  }

  applyJsonEditorTheme(theme);

  window.addEventListener('message', (event) => {
    try {
      const data = event && event.data;
      if (!data || data.type !== 'tool-theme') return;
      const next = normalizeTheme(data.theme);
      document.documentElement.dataset.theme = next;
      applyJsonEditorTheme(next);
    } catch { /* ignore */ }
  });
})();
