import { selectSkills } from './search.js';

const collections = [
  { id: 'all', label: 'All skills', description: 'All unique skills found across your installations.' },
  { id: 'global', label: 'Global', description: 'Skills in the shared global collection.' },
  { id: 'codex', label: 'Codex', description: 'Skills available through Codex or an installed Codex plugin.' },
  { id: 'claude', label: 'Claude Code', description: 'Skills available through Claude Code, including shared links.' },
  { id: 'issues', label: 'Needs attention', description: 'Broken links, invalid skills, or folders the scanner cannot read.' },
];

const params = new URLSearchParams(location.search);
const state = {
  view: collections.some((collection) => collection.id === params.get('view')) ? params.get('view') : 'all',
  query: params.get('q') || '',
  category: params.get('category') || '',
  author: params.get('author') || '',
  plugin: params.get('plugin') || '',
  source: params.get('source') || '',
  sort: ['name', 'relevance', 'source'].includes(params.get('sort')) ? params.get('sort') : (params.get('q') ? 'relevance' : 'name'),
};

const elements = {
  nav: document.getElementById('navigation'), list: document.getElementById('skill-list'),
  status: document.getElementById('status-message'), title: document.getElementById('collection-title'),
  description: document.getElementById('collection-description'), collectionCount: document.getElementById('collection-count'),
  totalSkills: document.getElementById('total-skills'), totalInstallations: document.getElementById('total-installations'),
  totalIssues: document.getElementById('total-issues'), scanTime: document.getElementById('scan-time'),
  controls: document.getElementById('discovery-controls'), search: document.getElementById('search-input'),
  categories: document.getElementById('category-chips'), author: document.getElementById('author-filter'),
  plugin: document.getElementById('plugin-filter'), source: document.getElementById('source-filter'),
  sort: document.getElementById('sort-select'), summary: document.getElementById('results-summary'),
  clear: document.getElementById('clear-filters'),
};

let inventory = null;

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function syncUrl() {
  const next = new URLSearchParams();
  if (state.view !== 'all') next.set('view', state.view);
  if (state.query) next.set('q', state.query);
  for (const key of ['category', 'author', 'plugin', 'source']) if (state[key]) next.set(key, state[key]);
  if (state.sort !== (state.query ? 'relevance' : 'name')) next.set('sort', state.sort);
  history.replaceState(null, '', `/${next.size ? `?${next}` : ''}`);
}

function matched(view = state.view, category = state.category) {
  return selectSkills(inventory.skills, { ...state, view, category });
}

function renderNavigation() {
  elements.nav.replaceChildren();
  for (const collection of collections) {
    const count = !inventory ? '—' : collection.id === 'issues' ? inventory.issues.length : matched(collection.id).length;
    const button = element('button', `nav-item${collection.id === state.view ? ' active' : ''}`);
    button.type = 'button';
    button.dataset.collection = collection.id;
    button.setAttribute('aria-current', collection.id === state.view ? 'page' : 'false');
    const icon = element('span', `nav-icon icon-${collection.id}`);
    icon.setAttribute('aria-hidden', 'true');
    button.append(icon, element('span', 'nav-name', collection.label), element('span', 'nav-count', String(count)));
    button.addEventListener('click', () => {
      state.view = collection.id;
      syncUrl();
      render();
      elements.title.scrollIntoView({ block: 'nearest' });
    });
    elements.nav.append(button);
  }
}

function fillSelect(select, values, selected, allLabel) {
  select.replaceChildren(new Option(allLabel, ''));
  for (const value of values) select.add(new Option(value, value));
  select.value = selected;
}

function renderFilterOptions() {
  const authors = [...new Set(inventory.skills.map((skill) => skill.author))].sort((a, b) => a === 'Unknown' ? 1 : b === 'Unknown' ? -1 : a.localeCompare(b));
  const plugins = [...new Set(inventory.skills.flatMap((skill) => skill.pluginNames))].sort((a, b) => a.localeCompare(b));
  const sources = [...new Map(inventory.skills.map((skill) => [skill.sourceType.id, skill.sourceType.label])).entries()].sort((a, b) => a[1].localeCompare(b[1]));
  fillSelect(elements.author, authors, state.author, 'All authors');
  fillSelect(elements.plugin, plugins, state.plugin, 'All plugins');
  elements.source.replaceChildren(new Option('All sources', ''));
  for (const [id, label] of sources) elements.source.add(new Option(label, id));
  elements.source.value = state.source;
  elements.sort.value = state.sort;
  elements.search.value = state.query;
}

function renderCategories() {
  elements.categories.replaceChildren();
  const base = matched(state.view, '');
  const counts = new Map();
  for (const { skill } of base) counts.set(skill.category.id, (counts.get(skill.category.id) || 0) + 1);
  const categories = [...new Map(inventory.skills.map((skill) => [skill.category.id, skill.category.label])).entries()]
    .sort((a, b) => (counts.get(b[0]) || 0) - (counts.get(a[0]) || 0) || a[1].localeCompare(b[1]));
  for (const [id, label] of [['', 'All categories'], ...categories]) {
    const count = id ? counts.get(id) || 0 : base.length;
    const button = element('button', `category-chip${state.category === id ? ' selected' : ''}`, `${label} · ${count}`);
    button.type = 'button';
    button.setAttribute('aria-pressed', String(state.category === id));
    button.disabled = count === 0 && state.category !== id;
    button.addEventListener('click', () => {
      state.category = id;
      syncUrl();
      render();
    });
    elements.categories.append(button);
  }
}

function createSkillRow(skill, index, match) {
  const row = element('article', 'skill-row');
  const number = element('span', 'row-number', String(index + 1).padStart(2, '0'));
  number.setAttribute('aria-hidden', 'true');
  const body = element('div', 'row-body');
  const title = element('h3', 'skill-name');
  const link = element('a', 'skill-link', skill.name);
  const detailParams = new URLSearchParams({ from: state.view, return: location.search || '?view=all' });
  link.href = `/skill/${skill.id}?${detailParams}`;
  title.append(link);
  body.append(title);
  const description = element('p', 'skill-description', skill.description || 'No description in SKILL.md');
  if (skill.description.length > 240) {
    description.classList.add('clamped');
    const toggle = element('button', 'description-toggle', 'Read full description');
    toggle.type = 'button';
    toggle.setAttribute('aria-expanded', 'false');
    toggle.addEventListener('click', () => {
      const expanded = !description.classList.toggle('clamped');
      toggle.textContent = expanded ? 'Show less' : 'Read full description';
      toggle.setAttribute('aria-expanded', String(expanded));
    });
    body.append(description, toggle);
  } else body.append(description);
  const labels = element('div', 'row-labels');
  for (const scope of skill.scopes) labels.append(element('span', `scope scope-${scope}`, scope === 'claude' ? 'Claude Code' : scope === 'codex' ? 'Codex' : 'Global'));
  labels.append(element('span', 'category-label', `${skill.category.label} · inferred`));
  body.append(labels, element('p', 'row-source', `${skill.author}${skill.authorKind === 'plugin author' ? ' (plugin author)' : ''} · ${skill.sourceType.label}`));
  if (match?.reason) body.append(element('p', 'match-reason', `Matched ${match.reason}${match.snippet ? `: “…${match.snippet}…”` : ''}`));
  const detail = element('details', 'locations');
  detail.append(element('summary', '', `${skill.locations.length} ${skill.locations.length === 1 ? 'location' : 'locations'}`));
  const list = element('ul');
  for (const location of skill.locations) {
    const item = element('li');
    item.append(element('span', 'location-root', location.rootLabel), element('code', '', location.path));
    list.append(item);
  }
  detail.append(list);
  row.append(number, body, detail);
  return row;
}

function createIssueRow(problem) {
  const row = element('article', 'issue-row');
  const mark = element('span', 'issue-mark', '!');
  mark.setAttribute('aria-hidden', 'true');
  const body = element('div');
  body.append(element('h3', 'issue-name', problem.path.split('/').pop()), element('p', 'issue-reason', problem.reason), element('code', 'issue-path', problem.path));
  row.append(mark, body);
  return row;
}

function render() {
  renderNavigation();
  const collection = collections.find((item) => item.id === state.view);
  elements.title.textContent = collection.label;
  elements.description.textContent = collection.description;
  elements.controls.hidden = state.view === 'issues';
  elements.list.replaceChildren();
  if (!inventory) return;
  if (state.view === 'issues') {
    elements.collectionCount.textContent = `${inventory.issues.length} issues`;
    if (!inventory.issues.length) elements.list.append(element('p', 'empty-state', 'Everything looks good. No entries need attention.'));
    else for (const issue of inventory.issues) elements.list.append(createIssueRow(issue));
    return;
  }
  renderCategories();
  const records = matched();
  const paths = records.reduce((total, entry) => total + entry.skill.locations.length, 0);
  elements.collectionCount.textContent = `${records.length} ${records.length === 1 ? 'skill' : 'skills'} · ${paths} ${paths === 1 ? 'path' : 'paths'}`;
  elements.summary.textContent = `${records.length} matching unique ${records.length === 1 ? 'skill' : 'skills'} across ${paths} installation ${paths === 1 ? 'path' : 'paths'}`;
  elements.clear.hidden = !state.query && !state.category && !state.author && !state.plugin && !state.source;
  if (!records.length) {
    const empty = element('div', 'empty-state');
    empty.append(element('strong', '', 'No skills match these filters.'), element('p', '', 'Try a broader task phrase or clear one of the filters.'));
    const clear = element('button', 'empty-clear', 'Clear filters');
    clear.type = 'button';
    clear.addEventListener('click', clearFilters);
    empty.append(clear);
    elements.list.append(empty);
  } else {
    const fragment = document.createDocumentFragment();
    records.forEach((record, index) => fragment.append(createSkillRow(record.skill, index, record)));
    elements.list.append(fragment);
  }
}

function clearFilters() {
  Object.assign(state, { query: '', category: '', author: '', plugin: '', source: '', sort: 'name' });
  renderFilterOptions();
  syncUrl();
  render();
  elements.search.focus();
}

function changeFilter(key, value) {
  state[key] = value;
  syncUrl();
  render();
}

function handleSearch(event) {
  const wasEmpty = !state.query;
  state.query = event.target.value.trimStart();
  if (wasEmpty && state.query && state.sort === 'name') state.sort = 'relevance';
  if (!state.query && state.sort === 'relevance') state.sort = 'name';
  elements.sort.value = state.sort;
  syncUrl();
  render();
}

async function loadInventory() {
  try {
    const response = await fetch('/api/inventory', { cache: 'no-store' });
    if (!response.ok) throw new Error(`Inventory request failed (${response.status})`);
    inventory = await response.json();
    elements.totalSkills.textContent = inventory.counts.all;
    elements.totalInstallations.textContent = inventory.counts.installations;
    elements.totalIssues.textContent = inventory.counts.issues;
    elements.scanTime.textContent = `Last scanned ${new Date(inventory.scannedAt).toLocaleString()}`;
    const missing = inventory.roots.filter((root) => root.status !== 'ok');
    if (missing.length) {
      elements.status.className = 'status-message status-warning';
      elements.status.textContent = `${missing.length} scan ${missing.length === 1 ? 'folder is' : 'folders are'} unavailable. See Needs attention for details.`;
    } else elements.status.hidden = true;
    renderFilterOptions();
    render();
  } catch (error) {
    elements.status.className = 'status-message status-error';
    elements.status.textContent = `Could not load the inventory: ${error.message}. Reload the page to try again.`;
    elements.scanTime.textContent = 'Inventory unavailable';
  }
}

elements.search.addEventListener('input', handleSearch);
for (const key of ['author', 'plugin', 'source']) elements[key].addEventListener('change', (event) => changeFilter(key, event.target.value));
elements.sort.addEventListener('change', (event) => changeFilter('sort', event.target.value));
elements.clear.addEventListener('click', clearFilters);
renderNavigation();
loadInventory();
