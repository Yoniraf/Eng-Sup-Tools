(async function () {
  const toolsUrl = new URL('./assets/tools.json', location.href).toString();

  const els = {
    list: document.getElementById('tool-list'),
    group: document.getElementById('tool-group'),
    frame: document.getElementById('tool-frame'),
    loading: document.getElementById('loading'),
    currentName: document.getElementById('current-name'),
    currentDesc: document.getElementById('current-desc'),
    openNewTab: document.getElementById('open-new-tab'),
    copyLink: document.getElementById('copy-link'),
    search: document.getElementById('search'),
    build: document.getElementById('build-pill'),
  };

  let tools = [];
  let activeId = null;

  function getQueryTool() {
    const u = new URL(location.href);
    return u.searchParams.get('tool');
  }

  function setQueryTool(id) {
    const u = new URL(location.href);
    u.searchParams.set('tool', id);
    history.replaceState({}, '', u);
  }

  function iconFor(tool) {
    // Simple emoji fallback. Keep it text-only (no external icon dependency).
    return tool.icon || '🧰';
  }

  function render(list) {
    els.list.innerHTML = '';
    list.forEach(tool => {
      const li = document.createElement('li');
      li.className = 'tool-item';
      li.dataset.toolId = tool.id;

      const a = document.createElement('a');
      a.href = tool.path;
      a.title = 'Open in dashboard (right-click for new tab)';

      a.addEventListener('click', (e) => {
        // Preserve normal behavior for ctrl/cmd click (open in new tab)
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
      if (tags.childNodes.length) meta.appendChild(tags);

      a.appendChild(icon);
      a.appendChild(meta);
      li.appendChild(a);
      els.list.appendChild(li);
    });

    updateActiveStyles();
  }

  function updateActiveStyles() {
    document.querySelectorAll('.tool-item').forEach(li => {
      li.classList.toggle('active', li.dataset.toolId === activeId);
    });
  }

  function resolveToolPath(path) {
    // Make relative paths robust under GitHub Pages subpaths.
    return new URL(path, location.href).toString();
  }

  function setViewer(tool) {
    els.currentName.textContent = tool.title;
    els.currentDesc.textContent = tool.description || '';
    const absolute = resolveToolPath(tool.path);

    els.openNewTab.href = absolute;
    els.openNewTab.setAttribute('aria-label', `Open ${tool.title} in new tab`);

    els.loading.style.display = 'flex';
    els.frame.src = absolute;
  }

  function activate(id, updateUrl) {
    const tool = tools.find(t => t.id === id);
    if (!tool) return;

    activeId = id;
    updateActiveStyles();

    if (updateUrl) setQueryTool(id);
    setViewer(tool);
  }

  async function loadTools() {
    const res = await fetch(toolsUrl, { cache: 'no-store' });
    if (!res.ok) throw new Error(`Failed to load tools.json (${res.status})`);
    const data = await res.json();
    tools = data.tools || [];
    if (!tools.length) throw new Error('tools.json has no tools');
    els.build.textContent = data.build || 'local';

    render(tools);

    // Deep link support
    const requested = getQueryTool();
    activate(requested && tools.some(t => t.id === requested) ? requested : tools[0].id, true);
  }

  // Viewer load state
  els.frame.addEventListener('load', () => {
    els.loading.style.display = 'none';
  });

  // Copy link
  els.copyLink.addEventListener('click', async () => {
    const u = new URL(location.href);
    u.searchParams.set('tool', activeId || '');
    try {
      await navigator.clipboard.writeText(u.toString());
      els.copyLink.textContent = 'Copied ✅';
      setTimeout(() => (els.copyLink.textContent = 'Copy link'), 1200);
    } catch {
      // Fallback
      prompt('Copy this link:', u.toString());
    }
  });

  // Search/filter
  els.search.addEventListener('input', () => {
    const q = els.search.value.trim().toLowerCase();
    if (!q) return render(tools);

    const filtered = tools.filter(t => {
      const hay = `${t.title} ${t.description || ''} ${(t.tags || []).join(' ')}`.toLowerCase();
      return hay.includes(q);
    });

    render(filtered);

    // If the active tool is not in filtered list, don't change it automatically.
    updateActiveStyles();
  });

  // React to back/forward navigation
  window.addEventListener('popstate', () => {
    const requested = getQueryTool();
    if (requested && tools.some(t => t.id === requested)) {
      activate(requested, false);
    }
  });

  // Init
  try {
    await loadTools();
  } catch (err) {
    console.error(err);
    document.body.innerHTML = `<pre style="padding:16px;color:#e5e7eb;background:#0b1220;">Failed to load dashboard.\n\n${String(err)}</pre>`;
  }
})();