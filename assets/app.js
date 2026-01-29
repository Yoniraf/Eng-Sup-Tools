(async function () {
  const toolsUrl = new URL('./assets/tools.json', location.href).toString();
  const UI_KEY = 'teamToolbox_ui_v1';
  const THEME_KEY = 'teamToolbox_theme_v1';
  const APP_URL = new URL(location.href);
  const DESKTOP_PROXY_BASE_URL = APP_URL.searchParams.get('proxyBaseUrl') || '';
  const DESKTOP_USE_PROXY = APP_URL.searchParams.get('useProxy') || (DESKTOP_PROXY_BASE_URL ? '1' : '');

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
    toggleSidebar: document.getElementById('toggle-sidebar'),
    toggleTopbar: document.getElementById('toggle-topbar'),
    toggleTheme: document.getElementById('toggle-theme'),
  };

  let tools = [];
  let activeId = null;
  let currentTheme = 'dark';

  setFavicon(new URL('./assets/favicon.png', location.href).toString());

  // Cache iframes per tool so switching tools keeps their state.
  const framesById = new Map();
  const loadedById = new Set();

  function getQueryTool() {
    const u = new URL(location.href);
    return u.searchParams.get('tool');
  }

  function setQueryTool(id) {
    const u = new URL(location.href);
    u.searchParams.set('tool', id);
    history.pushState({}, '', u.toString());
  }

  function resolveToolPath(path) {
    // Resolve relative to the current page.
    return new URL(path, location.href).toString();
  }

  function decorateToolUrl(tool, absoluteUrl) {
    // Desktop app can pass a local proxy via query params on the toolbox URL.
    // If present, auto-configure the SyncApp ERP API Runner tool iframe so it "just works".
    if (!DESKTOP_PROXY_BASE_URL) return absoluteUrl;
    const p = String(tool && tool.path ? tool.path : '');
    const isRunner = (tool && tool.id === 'syncapp-erp-api-runner') || p.includes('syncapp-erp-api-runner.html');
    if (!isRunner) return absoluteUrl;
    try {
      const u = new URL(absoluteUrl);
      if (DESKTOP_USE_PROXY) u.searchParams.set('useProxy', DESKTOP_USE_PROXY);
      u.searchParams.set('proxyBaseUrl', DESKTOP_PROXY_BASE_URL);
      u.searchParams.set('theme', currentTheme);
      return u.toString();
    } catch {
      return absoluteUrl;
    }
  }

  function decorateThemeParam(absoluteUrl) {
    try {
      const u = new URL(absoluteUrl);
      u.searchParams.set('theme', currentTheme);
      return u.toString();
    } catch {
      return absoluteUrl;
    }
  }

  function buildToolUrl(tool) {
    const baseUrl = decorateToolUrl(tool, resolveToolPath(tool.path));
    return decorateThemeParam(baseUrl);
  }

  function iconFor(tool) {
    const name = (tool.title || tool.id || '?').trim();
    const parts = name.split(/\s+/).filter(Boolean);
    const a = (parts[0] || '?')[0] || '?';
    const b = (parts[1] || '')[0] || (parts[0] || '?')[1] || '';
    return (a + b).toUpperCase();
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
      a.href = buildToolUrl(tool);
      a.target = '_blank';
      a.rel = 'noopener';
      a.title = tool.title;

      a.addEventListener('click', (e) => {
        // Allow normal new-tab behavior if modifier keys are used / middle click.
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
    const absolute = buildToolUrl(tool);
    els.openNewTab.href = absolute;
    els.openNewTab.setAttribute('aria-label', `Open ${tool.title} in new tab`);
    document.title = `${tool.title} — Team Toolbox`;

    // Hide all frames; show/create current tool frame.
    let frame = framesById.get(tool.id);
    if (!frame) {
      frame = document.createElement('iframe');
      frame.title = tool.title;
      frame.dataset.toolId = tool.id;
      frame.src = absolute;

      frame.addEventListener('load', () => {
        loadedById.add(tool.id);
        if (activeId === tool.id) {
          els.loading.style.display = 'none';
        }
        try {
          frame.contentWindow?.postMessage({ type: 'tool-theme', theme: currentTheme }, '*');
          const docEl = frame.contentDocument?.documentElement;
          if (docEl?.dataset) docEl.dataset.theme = currentTheme;
        } catch { /* ignore */ }
      });

      framesById.set(tool.id, frame);
      els.frameHost.appendChild(frame);
    }

    framesById.forEach((f) => (f.style.display = 'none'));

    // Show loading only if the frame hasn't completed its first load yet.
    if (!loadedById.has(tool.id)) {
      els.loading.style.display = 'flex';
    } else {
      els.loading.style.display = 'none';
    }

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

  // --- UI: collapsible sidebar & topbar -----------------------------------
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
    // Toggle icon direction
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
  function isValidTheme(t) {
    return t === 'dark' || t === 'light';
  }

  function getInitialTheme() {
    const fromQuery = String(APP_URL.searchParams.get('theme') || '').toLowerCase();
    if (isValidTheme(fromQuery)) return fromQuery;
    try {
      const raw = localStorage.getItem(THEME_KEY);
      const v = String(raw || '').toLowerCase();
      return isValidTheme(v) ? v : 'dark';
    } catch {
      return 'dark';
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

  function updateThemeToggleLabel(theme) {
    if (!els.toggleTheme) return;
    els.toggleTheme.textContent = `Theme: ${theme === 'light' ? 'Light' : 'Dark'}`;
    els.toggleTheme.setAttribute('aria-pressed', theme === 'light' ? 'true' : 'false');
  }

  function broadcastThemeToFrames() {
    framesById.forEach((frame) => {
      try {
        frame.contentWindow?.postMessage({ type: 'tool-theme', theme: currentTheme }, '*');
        const docEl = frame.contentDocument?.documentElement;
        if (docEl?.dataset) docEl.dataset.theme = currentTheme;
      } catch { /* ignore */ }
    });
  }

  function applyTheme(theme) {
    currentTheme = isValidTheme(theme) ? theme : 'dark';
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

  // --- Search filtering ----------------------------------------------------
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

  if (els.search) {
    els.search.addEventListener('input', () => {
      render(filterTools(els.search.value));
    });
  }

  // Copy link
  if (els.copyLink) {
    els.copyLink.addEventListener('click', async () => {
      const u = new URL(location.href);
      u.searchParams.set('tool', activeId || '');
      try {
        await navigator.clipboard.writeText(u.toString());
        els.copyLink.textContent = 'Copied';
        setTimeout(() => (els.copyLink.textContent = 'Copy link'), 900);
      } catch {
        // fallback
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
    if (!res.ok) throw new Error(`Failed to load tools.json (${res.status})`);
    const data = await res.json();
    tools = data.tools || [];
    if (!tools.length) throw new Error('tools.json has no tools');
    els.build.textContent = data.build || 'local';

    applyUiState();
    render(tools);

    const requested = getQueryTool();
    activate(requested && tools.some(t => t.id === requested) ? requested : tools[0].id, true);
  }

  // Init
  try {
    applyTheme(getInitialTheme());
    await loadTools();
  } catch (err) {
    console.error(err);
    document.body.innerHTML = `<pre style="padding:16px;color:#e5e7eb;background:#0b1220;">Failed to load dashboard.\n\n${String(err)}</pre>`;
  }
})();
