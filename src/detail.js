import fs from 'node:fs';
import path from 'node:path';
import MarkdownIt from 'markdown-it';
import { parseSkillFrontmatter } from './scanner.js';

const markdown = new MarkdownIt({ html: false, linkify: false, breaks: false });
markdown.validateLink = (url) => /^https?:\/\//i.test(url);
markdown.renderer.rules.image = (tokens, index) => markdown.utils.escapeHtml(tokens[index].content || tokens[index].attrGet('alt') || 'Image');

function readJson(filename) {
  try { return JSON.parse(fs.readFileSync(filename, 'utf8')); } catch { return null; }
}

function isInside(filename, directory) {
  const relative = path.relative(directory, filename);
  return relative === '' || (relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
}

function resolvedRoot(root) {
  const absolute = path.resolve(root.path);
  try { return fs.realpathSync(absolute); } catch { return absolute; }
}

function findUp(start, boundary, relativeName) {
  let current = start;
  while (isInside(current, boundary)) {
    const candidate = path.join(current, relativeName);
    if (fs.existsSync(candidate)) return candidate;
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return null;
}

function gitRemote(filename) {
  try {
    const config = fs.readFileSync(filename, 'utf8');
    const origin = /\[remote\s+"origin"\]([\s\S]*?)(?=\n\[|$)/.exec(config)?.[1];
    return /^\s*url\s*=\s*(.+)$/m.exec(origin || '')?.[1]?.trim() || null;
  } catch { return null; }
}

function webUrl(value) {
  if (typeof value !== 'string') return null;
  let url = value.trim();
  const ssh = /^git@([^:]+):(.+)$/.exec(url);
  if (ssh) url = `https://${ssh[1]}/${ssh[2]}`;
  try {
    const parsed = new URL(url);
    if (!['https:', 'http:'].includes(parsed.protocol)) return null;
    return parsed.href.replace(/\.git$/, '');
  } catch { return null; }
}

function authorName(author) {
  if (typeof author === 'string') return author.trim() || null;
  if (author && typeof author.name === 'string') return author.name.trim() || null;
  return null;
}

function claim(list, value, evidence, evidencePath, kind) {
  if (typeof value !== 'string' || !value.trim()) return;
  list.push({ value: value.trim(), evidence, path: evidencePath, kind });
}

function field(candidates, url = false) {
  const valid = candidates.map((entry) => url ? { ...entry, link: webUrl(entry.value) } : entry).filter((entry) => !url || entry.link);
  const selected = valid[0] || null;
  const distinct = new Set(valid.map((entry) => (entry.link || entry.value).toLowerCase().replace(/\/$/, '')));
  return { selected, evidence: valid, conflict: distinct.size > 1 };
}

export function getProvenance(skill, roots, frontmatter) {
  const authors = [];
  const repositories = [];
  const websites = [];
  const plugins = [];
  const canonicalDir = path.dirname(skill.resolvedPath);

  claim(authors, authorName(frontmatter.author), 'SKILL.md author', skill.resolvedPath, 'skill author');
  claim(authors, /Credits:\s*Original skill by\s+(@[\w-]+)/i.exec(frontmatter.description || '')?.[1], 'SKILL.md original-skill credit', skill.resolvedPath, 'original skill author');
  claim(repositories, frontmatter.repository || frontmatter.sourceUrl || frontmatter.source, 'SKILL.md repository', skill.resolvedPath, 'skill source');
  claim(websites, frontmatter.homepage || frontmatter.website || frontmatter.url, 'SKILL.md website', skill.resolvedPath, 'skill website');

  for (const root of roots) {
    const rootPath = resolvedRoot(root);
    if (!skill.locations.some((location) => location.rootId === root.id)) continue;
    if (root.scope === 'global' && isInside(skill.resolvedPath, rootPath)) {
      const relative = path.relative(rootPath, skill.resolvedPath).split(path.sep);
      if (relative.length === 2 && relative[1] === 'SKILL.md') {
        const lockPath = path.join(path.dirname(rootPath), '.skill-lock.json');
        const lock = readJson(lockPath)?.skills?.[relative[0]];
        if (lock?.sourceUrl) claim(repositories, lock.sourceUrl, 'Installed skill lockfile', lockPath, 'install source');
      }
    }
    if (root.id === 'plugins' || root.label?.toLowerCase().includes('plugin')) {
      const manifestPath = findUp(canonicalDir, rootPath, '.codex-plugin/plugin.json');
      const manifest = manifestPath && readJson(manifestPath);
      if (manifest) {
        plugins.push({ name: manifest.interface?.displayName || manifest.name || 'Unknown plugin', id: manifest.name || null, version: manifest.version || 'Unknown version', manifestPath });
        claim(authors, authorName(manifest.author), 'Plugin manifest author', manifestPath, 'plugin author');
        claim(repositories, manifest.repository, 'Plugin manifest repository', manifestPath, 'plugin source');
        claim(websites, manifest.homepage || manifest.interface?.websiteURL, 'Plugin manifest website', manifestPath, 'plugin website');
      }
    }
  }

  const packageRoot = roots.find((root) => skill.locations.some((location) => location.rootId === root.id) && isInside(canonicalDir, resolvedRoot(root)));
  const boundary = packageRoot ? resolvedRoot(packageRoot) : canonicalDir;
  const packagePath = findUp(canonicalDir, boundary, 'package.json');
  const packageInfo = packagePath && readJson(packagePath);
  if (packageInfo) {
    claim(authors, authorName(packageInfo.author), 'Package author', packagePath, 'package author');
    claim(repositories, typeof packageInfo.repository === 'string' ? packageInfo.repository : packageInfo.repository?.url, 'Package repository', packagePath, 'package source');
    claim(websites, packageInfo.homepage, 'Package homepage', packagePath, 'package website');
  }

  const readmePath = findUp(canonicalDir, boundary, 'README.md');
  if (readmePath) {
    try {
      const firstLines = fs.readFileSync(readmePath, 'utf8').split('\n').slice(0, 100).join('\n');
      claim(authors, /^(?:Author|Maintainer):\s*(.+)$/im.exec(firstLines)?.[1], 'README author line', readmePath, 'documented author');
      claim(repositories, /^(?:Repository|Source):\s*(https?:\/\/\S+)/im.exec(firstLines)?.[1], 'README source line', readmePath, 'documented source');
      claim(websites, /^Website:\s*(https?:\/\/\S+)/im.exec(firstLines)?.[1], 'README website line', readmePath, 'documented website');
    } catch { /* Unreadable README supplies no evidence. */ }
  }

  const gitConfigPath = findUp(canonicalDir, boundary, '.git/config');
  if (gitConfigPath) claim(repositories, gitRemote(gitConfigPath), 'Git origin remote', gitConfigPath, 'checkout source');

  return {
    author: field(authors),
    repository: field(repositories, true),
    website: field(websites, true),
    plugins,
    installed: skill.locations.map((location) => ({ ...location })),
  };
}

function firstSentence(text) {
  const first = text.trim().split(/(?<=[.!?])\s+/)[0] || '';
  if (first.length <= 360) return first;
  return `${first.slice(0, 357).trimEnd()}…`;
}

export function explainSkill(description, body) {
  const normalized = description.replace(/\s+/g, ' ').trim();
  const what = firstSentence(normalized) || 'This skill does not provide a description.';
  const when = /(?:Use when|Use for|Use this skill when|This skill should be used when|Triggers? when|Triggers? on|Invoke when)\s*:?[\s]+([^.!?]+[.!?]?)/i.exec(normalized)?.[0]
    || /(?:Trigger phrases?):\s*([^.!?]+[.!?]?)/i.exec(normalized)?.[0]
    || null;
  const section = /^#{1,3}\s+(?:When to use|Use cases|Triggers?)\s*\n([\s\S]*?)(?=^#{1,3}\s|$)/im.exec(body)?.[1] || '';
  const bullets = section.split('\n').map((line) => /^\s*[-*]\s+(.+)/.exec(line)?.[1]?.trim()).filter(Boolean).slice(0, 5);
  const triggerText = /(?:Triggers? on|Trigger phrases?):\s*([^.!?]+)/i.exec(normalized)?.[1] || '';
  const quoted = [...triggerText.matchAll(/["“]([^"”]+)["”]/g)].map((match) => match[1]).slice(0, 5);
  return { what, when, useCases: bullets.length ? bullets : quoted };
}

export function getSkillDetail(skill, roots) {
  const content = fs.readFileSync(skill.resolvedPath, 'utf8');
  const { fields, body } = parseSkillFrontmatter(content);
  return {
    ...skill,
    explanation: explainSkill(skill.description, body),
    provenance: getProvenance(skill, roots, fields),
    instructionsHtml: markdown.render(body),
    rawContent: content,
  };
}
