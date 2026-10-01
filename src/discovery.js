import fs from 'node:fs';
import { scanInventory, parseSkillFrontmatter } from './scanner.js';
import { explainSkill, getProvenance } from './detail.js';

export const categories = [
  { id: 'design', label: 'Design & UI', nameTerms: /\b(ui|ux|design|brand|font|frontend|styling|component|visual|stitch|impeccable|emil)\b/i, terms: /\b(ui|ux|interface|frontend|front.end|design|styling|visual|brand|font|typograph\w*|component|layout|accessib\w*|responsive|website|web page|web app)\b/i },
  { id: 'motion', label: 'Motion & animation', nameTerms: /\b(animat\w*|motion|animejs)\b/i, terms: /\b(animat\w*|motion|transition|spring|gsap|anime\.js|framer motion)\b/i },
  { id: 'data', label: 'Data & charts', nameTerms: /\b(data|chart\w*|plot\w*|spreadsheet\w*|excel|clickhouse|analy\w*)\b/i, terms: /\b(data|analy\w*|chart\w*|plot\w*|visuali[sz]\w*|database|sql|spreadsheet\w*|excel|metric\w*|dashboard|clickhouse)\b/i },
  { id: 'code', label: 'Coding & architecture', nameTerms: /\b(code|coding|react|vercel|git|swift|turborepo|deploy|sonner|module\w*|implement)\b/i, terms: /\b(code|coding|developer|program\w*|react|next\.js|swift|javascript|typescript|api|module|architecture|refactor|repository|codebase|deploy|vercel|git|turborepo)\b/i },
  { id: 'quality', label: 'Testing & quality', nameTerms: /\b(test\w*|tdd|debug\w*|diagnos\w*|review|audit|quality|optimi[sz]\w*|guardrail\w*|pre.commit)\b/i, terms: /\b(test\w*|tdd|debug\w*|diagnos\w*|review|lint|performance|optimi[sz]\w*|bug|audit|security)\b/i },
  { id: 'writing', label: 'Writing & research', nameTerms: /\b(essay\w*|writ\w*|humaniz\w*|document\w*|research|wiki|letterhead)\b/i, terms: /\b(writ\w*|essay\w*|research|documentation|document\w*|prose|humaniz\w*|content|copywriting|wiki|citation)\b/i },
  { id: 'media', label: 'Media & presentations', nameTerms: /\b(image\w*|photo\w*|video|presentation\w*|slide\w*|pdf|mockup\w*|banner|pet\w*)\b/i, terms: /\b(image\w*|photo\w*|video|audio|slide\w*|presentation\w*|pdf|mockup\w*|poster|banner|graphic\w*|illustrat\w*|pet)\b/i },
  { id: 'workflow', label: 'Agents & workflow', nameTerms: /\b(skill\w*|plugin\w*|agent\w*|workflow|grill\w*|prototype|wizard|spec|ticket\w*|questionnaire|loop|retro|wait.what)\b/i, terms: /\b(agent\w*|skill\w*|plugin\w*|automation|workflow|tool|prompt|planning|elicitation|wizard|task)\b/i },
];

export const fallbackCategory = { id: 'other', label: 'Other / unclassified' };

function hits(pattern, text) {
  return pattern.test(text) ? 1 : 0;
}

export function inferCategory(name, description, useCases = []) {
  const named = String(name || '').replaceAll('-', ' ');
  const namePriority = ['motion', 'data', 'quality', 'writing', 'design', 'media', 'code', 'workflow'];
  const byName = namePriority.map((id) => categories.find((category) => category.id === id)).find((category) => category.nameTerms.test(named));
  if (byName) return { id: byName.id, label: byName.label, inferred: true };
  const documented = `${description || ''} ${useCases.join(' ')}`;
  const ranked = categories.map((category, order) => ({
    category,
    order,
    score: hits(category.terms, named) * 3 + hits(category.terms, documented),
  })).filter((entry) => entry.score > 0).sort((a, b) => b.score - a.score || a.order - b.order);
  return { ...(ranked[0]?.category || fallbackCategory), inferred: true };
}

export function sourceType(provenance) {
  if (provenance.plugins.length) return { id: 'plugin', label: 'Plugin' };
  const kind = provenance.repository.selected?.kind;
  if (kind === 'install source') return { id: 'installer', label: 'Skill installer' };
  if (kind === 'checkout source') return { id: 'git', label: 'Git checkout' };
  if (provenance.repository.selected || provenance.website.selected) return { id: 'documented', label: 'Documented source' };
  return { id: 'unknown', label: 'Unknown source' };
}

export function createDiscoveryRecord(skill, roots, content) {
  const { fields, body } = parseSkillFrontmatter(content);
  const explanation = explainSkill(skill.description, body);
  const provenance = getProvenance(skill, roots, fields);
  return {
    ...skill,
    category: inferCategory(skill.name, skill.description, explanation.useCases),
    author: provenance.author.selected?.value || 'Unknown',
    authorKind: provenance.author.selected?.kind || null,
    pluginNames: [...new Set(provenance.plugins.map((plugin) => plugin.name))],
    sourceType: sourceType(provenance),
    sourceName: provenance.repository.selected?.value || provenance.website.selected?.value || 'Unknown',
    searchFields: {
      useCases: [explanation.when, ...explanation.useCases].filter(Boolean).join(' '),
      fullText: content,
      source: [provenance.repository.selected?.value, provenance.website.selected?.value, ...provenance.plugins.map((plugin) => plugin.name)].filter(Boolean).join(' '),
    },
  };
}

export function buildDiscoveryInventory(roots) {
  const inventory = scanInventory(roots);
  inventory.skills = inventory.skills.map((skill) => {
    try {
      return createDiscoveryRecord(skill, roots, fs.readFileSync(skill.resolvedPath, 'utf8'));
    } catch (error) {
      inventory.issues.push({ path: skill.resolvedPath, rootId: skill.locations[0]?.rootId, scope: skill.scopes[0], reason: `Cannot index skill: ${error.message}` });
      return null;
    }
  }).filter(Boolean);
  inventory.counts.all = inventory.skills.length;
  inventory.counts.issues = inventory.issues.length;
  return inventory;
}
