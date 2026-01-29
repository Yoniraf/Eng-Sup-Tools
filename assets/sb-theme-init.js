// SB-only theme initializer for sb-tools/* pages.
// Visual-only: sets data-theme and updates JSONEditor theme if present.
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

  const u = new URL(location.href);
  const env = String(u.searchParams.get('env') || 'sb').toLowerCase();
  if (env !== 'sb' && env !== 'sandbox') return; // never affect production tools

  const theme = String(u.searchParams.get('theme') || 'light').toLowerCase() === 'dark' ? 'dark' : 'light';
  document.documentElement.dataset.env = 'sb';
  document.documentElement.dataset.theme = theme;

  setFavicon(new URL('../assets/favicon.png', location.href).toString());

  function applyJsonEditorTheme(nextTheme) {
    try {
      // Only apply on JSON Studio pages (vanilla-jsoneditor present).
      // Styling is handled via `assets/sb-tools.css`; this function only swaps editor theme assets.
      const hasJsonEditor = !!document.querySelector('link[href*="vanilla-jsoneditor"], .editor-container, .jse-menu, .jse-navigation-bar');
      if (!hasJsonEditor) return;

      // Switch vanilla-jsoneditor theme stylesheet if present
      const links = Array.from(document.querySelectorAll('link[rel="stylesheet"]'));
      const themeLink = links.find(l => (l.href || '').includes('vanilla-jsoneditor') && (l.href || '').includes('jse-theme-'));
      if (themeLink) {
        const wants = nextTheme === 'light' ? 'jse-theme-light.css' : 'jse-theme-dark.css';
        if (!themeLink.href.includes(wants)) {
          themeLink.href = themeLink.href.replace(/jse-theme-(dark|light)\.css/i, wants);
        }
      }

      // Toggle container classes if used
      const containers = Array.from(document.querySelectorAll('.editor-container'));
      containers.forEach((el) => {
        el.classList.toggle('jse-theme-dark', nextTheme === 'dark');
        el.classList.toggle('jse-theme-light', nextTheme === 'light');
      });
    } catch { /* ignore */ }
  }

  applyJsonEditorTheme(theme);

  // Live theme sync from sb.html (no reload = no state loss)
  window.addEventListener('message', (event) => {
    try {
      const data = event && event.data;
      if (!data || data.type !== 'sb-theme') return;
      const next = data.theme === 'dark' ? 'dark' : 'light';
      document.documentElement.dataset.theme = next;
      applyJsonEditorTheme(next);
    } catch { /* ignore */ }
  });
})();

