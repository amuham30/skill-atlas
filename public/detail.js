const id = location.pathname.split('/').filter(Boolean).pop();
const from = new URLSearchParams(location.search).get('from');
const returnQuery = new URLSearchParams(location.search).get('return');
const views = new Map([['all', 'all skills'], ['global', 'global skills'], ['codex', 'Codex skills'], ['claude', 'Claude Code skills'], ['issues', 'needs attention']]);
const back = document.getElementById('back-link');
if (views.has(from)) {
  back.href = returnQuery?.startsWith('?') ? `/${returnQuery}` : `/?view=${encodeURIComponent(from)}`;
  back.textContent = `← Back to ${views.get(from)}`;
}

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function renderFact(containerId, label, field) {
  const container = document.getElementById(containerId);
  const fact = element('div', 'fact');
  fact.append(element('span', 'fact-label', label));
  if (!field.selected) {
    fact.append(element('span', 'fact-value fact-unknown', 'Unknown'));
  } else {
    const value = field.selected.link ? element('a', 'fact-value', field.selected.value) : element('span', 'fact-value', field.selected.value);
    if (field.selected.link) {
      value.href = field.selected.link;
      value.target = '_blank';
      value.rel = 'noopener noreferrer';
    }
    fact.append(value, element('small', 'fact-source', `From ${field.selected.evidence.toLowerCase()}${field.selected.kind === 'plugin author' ? ' · plugin author' : ''}`));
    if (field.conflict) fact.append(element('small', 'fact-conflict', 'Sources disagree; see evidence below.'));
  }
  container.append(fact);
}

function renderEvidence(provenance) {
  const container = document.getElementById('evidence-content');
  for (const [label, field] of [['Author', provenance.author], ['Repository', provenance.repository], ['Website', provenance.website]]) {
    for (const entry of field.evidence) {
      const item = element('div', 'evidence-item');
      item.append(element('strong', '', `${label}: ${entry.value}`), element('span', '', `${entry.evidence} · ${entry.kind}`), element('code', '', entry.path));
      container.append(item);
    }
  }
  if (!container.children.length) {
    container.append(element('p', 'panel-note', 'No author or original-source evidence found in local files.'));
  }
}

async function copyPath(button, pathname) {
  const original = button.textContent;
  try {
    const input = document.createElement('textarea');
    input.value = pathname;
    input.style.position = 'fixed';
    input.style.opacity = '0';
    document.body.append(input);
    input.select();
    let copied = document.execCommand('copy');
    input.remove();
    if (!copied && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(pathname);
      copied = true;
    }
    if (!copied) throw new Error('Clipboard unavailable');
    button.textContent = 'Copied';
  } catch {
    button.textContent = 'Copy failed';
  }
  setTimeout(() => { button.textContent = original; }, 4000);
}

function renderLocations(locations, resolvedPath) {
  document.getElementById('location-count').textContent = `${locations.length} ${locations.length === 1 ? 'path' : 'paths'} found for this skill.`;
  const container = document.getElementById('detail-locations');
  for (const location of locations) {
    const item = element('div', 'installation');
    const label = element('div', 'installation-label');
    label.append(element('strong', '', location.rootLabel), element('span', '', location.scope === 'claude' ? 'Claude Code' : location.scope === 'codex' ? 'Codex' : 'Global'));
    const pathRow = element('div', 'path-row');
    const button = element('button', 'copy-button', 'Copy path');
    button.type = 'button';
    button.setAttribute('aria-label', `Copy ${location.path}`);
    button.addEventListener('click', () => copyPath(button, location.path));
    pathRow.append(element('code', '', location.path), button);
    item.append(label, pathRow);
    container.append(item);
  }
  const resolved = element('div', 'installation resolved-installation');
  resolved.append(element('span', 'fact-label', 'Resolved SKILL.md path'));
  const resolvedRow = element('div', 'path-row');
  const button = element('button', 'copy-button', 'Copy path');
  button.type = 'button';
  button.setAttribute('aria-label', `Copy ${resolvedPath}`);
  button.addEventListener('click', () => copyPath(button, resolvedPath));
  resolvedRow.append(element('code', '', resolvedPath), button);
  resolved.append(resolvedRow);
  container.append(resolved);
}

function render(detail) {
  document.title = `${detail.name} · Skill Atlas`;
  document.getElementById('detail-name').textContent = detail.name;
  document.getElementById('detail-description').textContent = detail.description || 'No documented description.';
  const scopes = document.getElementById('detail-scopes');
  for (const scope of detail.scopes) scopes.append(element('span', `scope scope-${scope}`, scope === 'claude' ? 'Claude Code' : scope === 'codex' ? 'Codex' : 'Global'));
  document.getElementById('detail-what').textContent = detail.explanation.what;
  document.getElementById('detail-when').textContent = detail.explanation.when || 'No specific trigger is documented. Read the full instructions to judge when it fits.';
  if (detail.explanation.useCases.length) {
    document.getElementById('use-cases-wrap').hidden = false;
    const list = document.getElementById('detail-use-cases');
    for (const useCase of detail.explanation.useCases) list.append(element('li', '', useCase));
  }
  // The server uses markdown-it with raw HTML and remote images disabled.
  document.getElementById('instructions-content').innerHTML = detail.instructionsHtml;
  document.getElementById('raw-skill-content').textContent = detail.rawContent;
  renderFact('author-fact', 'Author', detail.provenance.author);
  renderFact('repository-fact', 'Source repository', detail.provenance.repository);
  renderFact('website-fact', 'Source website', detail.provenance.website);
  const pluginContainer = document.getElementById('plugin-fact');
  if (detail.provenance.plugins.length) {
    for (const plugin of detail.provenance.plugins) {
      const fact = element('div', 'fact');
      fact.append(element('span', 'fact-label', 'Installed plugin'), element('span', 'fact-value', `${plugin.name} · ${plugin.version}`), element('small', 'fact-source', plugin.manifestPath));
      pluginContainer.append(fact);
    }
  }
  renderEvidence(detail.provenance);
  renderLocations(detail.provenance.installed, detail.resolvedPath);
  document.getElementById('detail-status').hidden = true;
  document.getElementById('detail-content').hidden = false;
}

try {
  const response = await fetch(`/api/skills/${id}`, { cache: 'no-store' });
  if (!response.ok) throw new Error(response.status === 404 ? 'This skill is no longer in the inventory.' : `Request failed (${response.status}).`);
  render(await response.json());
} catch (error) {
  const status = document.getElementById('detail-status');
  status.classList.add('status-error');
  status.textContent = `Could not load this skill: ${error.message}`;
}
