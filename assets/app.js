(async function () {
  const toolsUrl = new URL('./assets/tools.json', location.href).toString();
  const UI_KEY = 'teamToolbox_ui_v1';

  const els = {
    app: document.querySelector('.app'),
    list: document.getElementById('tool-list'),
    group: document.getElementById('tool-group'),
    frameHost: document.getElementById('frame-host'),
    loading: document.getElementById('loading'),
    currentName: document.getElementById('current-name'),
    currentDesc: document.getElementById('current-desc'),
    openNewTab: document.getElementById('open-new-tab'),
    copyLink: document.getElementById('copy-link'),
    search: document.getElementById('search'),
    build: document.getElementById('build-pill'),
    toggleSidebar: document.getElementById('toggle-sidebar'),
    toggleTopbar: document.getElementById('toggle-topbar'),
  };

  let tools = [];
  let activeId = null;

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

  function iconFor(tool) {
    const name = (tool.title || tool.id || '?').trim();
    const parts = name.split(/\s+/).filter(Boolean);
    const a = (parts[0] || '?')[0] || '?';
    const b = (parts[1] || '')[0] || (parts[0] || '?')[1] || '';
    return (a + b).toUpperCase();
  }

  function updateActiveStyles() {
    const items = els.list.querySelectorAll('a.tool-item');
    items.forEach(a => {
      a.classList.toggle('active', a.dataset.id === activeId);
    });
  }

  function render(list) {
    els.list.innerHTML = '';
    list.forEach(tool => {
      const a = document.createElement('a');
      a.href = resolveToolPath(tool.path);
      a.target = '_blank';
      a.rel = 'noopener';
      a.dataset.id = tool.id;
      a.className = 'tool-item';
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

      els.list.appendChild(a);
    });

    updateActiveStyles();
  }

  function setViewer(tool) {
    els.currentName.textContent = tool.title;
    els.currentDesc.textContent = tool.description || '';

    const absolute = resolveToolPath(tool.path);
    els.openNewTab.href = absolute;
    els.openNewTab.setAttribute('aria-label', `Open ${tool.title} in new tab`);

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
    await loadTools();
  } catch (err) {
    console.error(err);
    document.body.innerHTML = `<pre style="padding:16px;color:#e5e7eb;background:#0b1220;">Failed to load dashboard.\n\n${String(err)}</pre>`;
  }
})();