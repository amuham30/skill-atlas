function normalize(value) { return String(value || '').toLocaleLowerCase(); }
const taskWords = new Set(['a', 'an', 'the', 'my', 'me', 'i', 'to', 'for', 'with', 'on', 'in', 'of', 'how', 'do', 'does', 'can', 'need', 'want', 'make', 'create', 'write', 'find', 'show', 'help', 'use', 'using']);

export function matchSkill(skill, query) {
  const phrase = normalize(query).trim();
  if (!phrase) return { score: 0, reason: null };
  const rawTokens = [...new Set(phrase.match(/[\p{L}\p{N}]+/gu) || [])];
  const specificTokens = rawTokens.filter((token) => !taskWords.has(token));
  const tokens = specificTokens.length ? specificTokens : rawTokens;
  if (!tokens.length) return { score: 0, reason: null };
  const fields = [
    ['name', skill.name, 42], ['use case', skill.searchFields?.useCases, 30],
    ['description', skill.description, 23], ['category', skill.category?.label, 15],
    ['author', skill.author, 13], ['source', `${skill.sourceName || ''} ${skill.searchFields?.source || ''}`, 11],
    ['instructions', skill.searchFields?.fullText, 2],
  ].map(([name, value, weight]) => ({ name, value: normalize(value), weight }));
  let score = 0;
  const reasons = new Map();
  for (const token of tokens) {
    const best = fields.find((field) => field.value.includes(token));
    if (!best) return null;
    score += best.weight;
    reasons.set(best.name, (reasons.get(best.name) || 0) + best.weight);
  }
  for (const field of fields) if (field.value.includes(phrase)) score += field.weight * 2;
  const reason = [...reasons].sort((a, b) => b[1] - a[1])[0]?.[0] || 'instructions';
  const value = fields.find((field) => field.name === reason)?.value || '';
  const at = Math.max(0, value.indexOf(tokens[0]) - 55);
  return { score, reason, snippet: reason === 'instructions' ? value.slice(at, at + 150).replace(/\s+/g, ' ').trim() : null };
}

export function selectSkills(skills, filters = {}) {
  const results = [];
  for (const skill of skills) {
    if (filters.view && filters.view !== 'all' && !skill.scopes.includes(filters.view)) continue;
    if (filters.category && skill.category.id !== filters.category) continue;
    if (filters.author && skill.author !== filters.author) continue;
    if (filters.plugin && !skill.pluginNames.includes(filters.plugin)) continue;
    if (filters.source && skill.sourceType.id !== filters.source) continue;
    const match = matchSkill(skill, filters.query);
    if (match) results.push({ skill, ...match });
  }
  const alphabetic = (a, b) => a.skill.name.localeCompare(b.skill.name) || a.skill.id.localeCompare(b.skill.id);
  if (filters.sort === 'source') results.sort((a, b) => a.skill.sourceName.localeCompare(b.skill.sourceName) || alphabetic(a, b));
  else if (filters.sort === 'relevance' && filters.query?.trim()) results.sort((a, b) => b.score - a.score || alphabetic(a, b));
  else results.sort(alphabetic);
  return results;
}
