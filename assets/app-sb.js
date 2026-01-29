(async function () {
  // SB-only entrypoint (visual changes only). Production is not touched.
  const toolsUrl = new URL('./assets/tools.sb.json', location.href).toString();
  const UI_KEY = 'teamToolbox_ui_v1';
  const THEME_KEY = 'teamToolbox_theme_v1';

  const APP_URL = new URL(location.href);

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

  const els = {
    app: document.querySelector('.app'),
    list: document.getElementById('tool-list'),
    group: document.getElementById('tool-group'),
    frameHost: document.getElementById('frame-host'),
    loading: document.getElementById('loading'),
    openNewTab: document.getElementById('open-new-tab'),
    copyLink: document.getElementById('copy-link'),
    search: document.getElementById('search'),
    build: document.getElementById('build-pill'),
    envWrap: document.getElementById('env-pill-wrap'),
    env: document.getElementById('env-pill'),
    toggleSidebar: document.getElementById('toggle-sidebar'),
    toggleTopbar: document.getElementById('toggle-topbar'),
    toggleTheme: document.getElementById('toggle-theme'),
  };

  const framesById = new Map();
  const loadedById = new Set();

  let tools = [];
  let activeId = null;
  let currentTheme = 'light';

  setFavicon(new URL('./assets/favicon.png', location.href).toString());

  function isValidTheme(t) {
    return t === 'dark' || t === 'light';
  }

  function getInitialTheme() {
    const fromQuery = String(APP_URL.searchParams.get('theme') || '').toLowerCase();
    if (isValidTheme(fromQuery)) return fromQuery;
    try {
      const raw = localStorage.getItem(THEME_KEY);
      const v = String(raw || '').toLowerCase();
      return isValidTheme(v) ? v : 'light';
    } catch {
      return 'light';
    }
  }

  function saveTheme(theme) {
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch { /* ignore */ }
  }

  function setQueryTheme(theme) {
    try {
      const u = new URL(location.href);
      u.searchParams.set('theme', theme);
      history.replaceState({}, '', u.toString());
    } catch { /* ignore */ }
  }

  function setQueryTool(id) {
    const u = new URL(location.href);
    u.searchParams.set('tool', id);
    history.pushState({}, '', u.toString());
  }

  function getQueryTool() {
    const u = new URL(location.href);
    return u.searchParams.get('tool');
  }

  function resolveToolPath(path) {
    return new URL(path, location.href).toString();
  }

  function decorateSbToolUrl(absoluteUrl) {
    try {
      const u = new URL(absoluteUrl);
      u.searchParams.set('env', 'sb');
      u.searchParams.set('theme', currentTheme);
      return u.toString();
    } catch {
      return absoluteUrl;
    }
  }

  function iconFor(tool) {
    const name = (tool.title || tool.id || '?').trim();
    const parts = name.split(/\s+/).filter(Boolean);
    const a = (parts[0] || '?')[0] || '?';
    const b = (parts[1] || '')[0] || (parts[0] || '?')[1] || '';
    return (a + b).toUpperCase();
  }

  function updateThemeToggleLabel(theme) {
    if (!els.toggleTheme) return;
    els.toggleTheme.textContent = `Theme: ${theme === 'light' ? 'Light' : 'Dark'}`;
    els.toggleTheme.setAttribute('aria-pressed', theme === 'light' ? 'true' : 'false');
  }

  function broadcastThemeToFrames() {
    framesById.forEach((frame) => {
      try {
        frame.contentWindow?.postMessage({ type: 'sb-theme', theme: currentTheme }, '*');
      } catch { /* ignore */ }
    });
  }

  // --- UI: collapsible sidebar & topbar (same behavior) ---------------------
  function loadUiState() {
    try {
      const raw = localStorage.getItem(UI_KEY);
      if (!raw) return { sidebarCollapsed: true, topbarCollapsed: true };
      const s = JSON.parse(raw);
      return {
        sidebarCollapsed: typeof s.sidebarCollapsed === 'boolean' ? s.sidebarCollapsed : true,
        topbarCollapsed: typeof s.topbarCollapsed === 'boolean' ? s.topbarCollapsed : true,
      };
    } catch {
      return { sidebarCollapsed: true, topbarCollapsed: true };
    }
  }

  function saveUiState(state) {
    try {
      localStorage.setItem(UI_KEY, JSON.stringify(state));
    } catch { /* ignore */ }
  }

  let uiState = loadUiState();

  function applyUiState() {
    els.app.classList.toggle('sidebar-collapsed', uiState.sidebarCollapsed);
    els.app.classList.toggle('topbar-collapsed', uiState.topbarCollapsed);
    if (els.toggleTopbar) els.toggleTopbar.textContent = uiState.topbarCollapsed ? '▾' : '▴';
  }

  function toggleSidebar() {
    uiState.sidebarCollapsed = !uiState.sidebarCollapsed;
    saveUiState(uiState);
    applyUiState();
  }

  function toggleTopbar() {
    uiState.topbarCollapsed = !uiState.topbarCollapsed;
    saveUiState(uiState);
    applyUiState();
  }

  if (els.toggleSidebar) els.toggleSidebar.addEventListener('click', toggleSidebar);
  if (els.toggleTopbar) els.toggleTopbar.addEventListener('click', toggleTopbar);

  // --- Theme ---------------------------------------------------------------
  function applyTheme(theme) {
    currentTheme = isValidTheme(theme) ? theme : 'light';
    document.documentElement.dataset.env = 'sb';
    document.documentElement.dataset.theme = currentTheme;
    setQueryTheme(currentTheme);
    updateThemeToggleLabel(currentTheme);
    broadcastThemeToFrames();
  }

  function toggleTheme() {
    const next = currentTheme === 'light' ? 'dark' : 'light';
    saveTheme(next);
    applyTheme(next);
  }

  if (els.toggleTheme) els.toggleTheme.addEventListener('click', toggleTheme);

  // --- Search --------------------------------------------------------------
  function filterTools(q) {
    const query = (q || '').trim().toLowerCase();
    if (!query) return tools;
    return tools.filter(t => {
      const hay = [
        t.id,
        t.title,
        t.description,
        ...(t.tags || []),
      ].filter(Boolean).join(' ').toLowerCase();
      return hay.includes(query);
    });
  }

  function updateActiveStyles() {
    const items = els.list.querySelectorAll('li.tool-item');
    items.forEach((li) => {
      const isActive = li.dataset.id === activeId;
      li.classList.toggle('active', isActive);
      const a = li.querySelector('a');
      if (a) {
        if (isActive) a.setAttribute('aria-current', 'page');
        else a.removeAttribute('aria-current');
      }
    });
  }

  function render(list) {
    els.list.innerHTML = '';
    list.forEach(tool => {
      const li = document.createElement('li');
      li.className = 'tool-item';
      li.dataset.id = tool.id;

      const a = document.createElement('a');
      a.href = decorateSbToolUrl(resolveToolPath(tool.path));
      a.target = '_blank';
      a.rel = 'noopener';
      a.title = tool.title;
      a.addEventListener('click', (e) => {
        if (e.ctrlKey || e.metaKey || e.shiftKey || e.button === 1) return;
        e.preventDefault();
        activate(tool.id, true);
      });

      const icon = document.createElement('div');
      icon.className = 'tool-icon';
      icon.textContent = iconFor(tool);

      const meta = document.createElement('div');
      meta.className = 'tool-meta';

      const name = document.createElement('div');
      name.className = 'name';
      name.textContent = tool.title;

      const desc = document.createElement('div');
      desc.className = 'desc';
      desc.textContent = tool.description || '';

      const tags = document.createElement('div');
      tags.className = 'tags';
      (tool.tags || []).slice(0, 5).forEach(t => {
        const s = document.createElement('span');
        s.className = 'tag';
        s.textContent = t;
        tags.appendChild(s);
      });

      meta.appendChild(name);
      meta.appendChild(desc);
      meta.appendChild(tags);

      a.appendChild(icon);
      a.appendChild(meta);
      li.appendChild(a);
      els.list.appendChild(li);
    });
    updateActiveStyles();
  }

  function setViewer(tool) {
    const absolute = decorateSbToolUrl(resolveToolPath(tool.path));
    els.openNewTab.href = absolute;
    els.openNewTab.setAttribute('aria-label', `Open ${tool.title} in new tab`);
    document.title = `${tool.title} — Team Toolbox (SB)`;

    let frame = framesById.get(tool.id);
    if (!frame) {
      frame = document.createElement('iframe');
      frame.title = tool.title;
      frame.dataset.toolId = tool.id;
      frame.src = absolute;
      frame.addEventListener('load', () => {
        loadedById.add(tool.id);
        try {
          frame.contentWindow?.postMessage({ type: 'sb-theme', theme: currentTheme }, '*');
        } catch { /* ignore */ }
        if (activeId === tool.id) els.loading.style.display = 'none';
      });
      framesById.set(tool.id, frame);
      els.frameHost.appendChild(frame);
    }

    framesById.forEach((f) => (f.style.display = 'none'));
    els.loading.style.display = loadedById.has(tool.id) ? 'none' : 'flex';
    frame.style.display = 'block';
  }

  function activate(id, updateUrl) {
    const tool = tools.find(t => t.id === id);
    if (!tool) return;
    activeId = id;
    updateActiveStyles();
    if (updateUrl) setQueryTool(id);
    setViewer(tool);
  }

  if (els.search) {
    els.search.addEventListener('input', () => render(filterTools(els.search.value)));
  }

  if (els.copyLink) {
    els.copyLink.addEventListener('click', async () => {
      const u = new URL(location.href);
      u.searchParams.set('tool', activeId || '');
      try {
        await navigator.clipboard.writeText(u.toString());
        els.copyLink.textContent = 'Copied';
        setTimeout(() => (els.copyLink.textContent = 'Copy link'), 900);
      } catch {
        prompt('Copy this link:', u.toString());
      }
    });
  }

  window.addEventListener('popstate', () => {
    const requested = getQueryTool();
    if (requested && tools.some(t => t.id === requested)) {
      activate(requested, false);
    }
  });

  async function loadTools() {
    const res = await fetch(toolsUrl, { cache: 'no-store' });
    if (!res.ok) throw new Error(`Failed to load tools.sb.json (${res.status})`);
    const data = await res.json();
    tools = data.tools || [];
    if (!tools.length) throw new Error('tools.sb.json has no tools');
    if (els.build) els.build.textContent = data.build || 'sb';
    if (els.envWrap) els.envWrap.style.display = '';
    if (els.env) els.env.textContent = 'sb';
    applyUiState();
    render(tools);
    const requested = getQueryTool();
    activate(requested && tools.some(t => t.id === requested) ? requested : tools[0].id, true);
  }

  try {
    applyTheme(getInitialTheme());
    await loadTools();
  } catch (err) {
    console.error(err);
    document.body.innerHTML = `<pre style="padding:16px;color:#e5e7eb;background:#0b1220;">Failed to load SB dashboard.\n\n${String(err)}</pre>`;
  }
})();

