import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';

const ignoredDirectories = new Set(['.git', 'node_modules', '.next', 'dist', 'build', '__pycache__']);

export function defaultRoots() {
  const home = os.homedir();
  return [
    { id: 'global', label: 'Global skills', scope: 'global', path: path.join(home, '.agents/skills') },
    { id: 'claude', label: 'Claude Code skills', scope: 'claude', path: path.join(home, '.claude/skills') },
    { id: 'codex', label: 'Codex skills', scope: 'codex', path: path.join(home, '.codex/skills') },
    { id: 'plugins', label: 'Codex plugins', scope: 'codex', path: path.join(home, '.codex/plugins/cache') },
  ];
}

export function configuredRoots(env = process.env) {
  if (!env.SKILLS_DASHBOARD_ROOTS) return defaultRoots();
  let roots;
  try {
    roots = JSON.parse(env.SKILLS_DASHBOARD_ROOTS);
  } catch {
    throw new Error('SKILLS_DASHBOARD_ROOTS must be a JSON array of root objects.');
  }
  if (!Array.isArray(roots) || roots.some((root) => !root || typeof root.path !== 'string' || !root.path || typeof root.id !== 'string' || !root.id || !['global', 'codex', 'claude'].includes(root.scope)) || new Set(roots.map((root) => root.id)).size !== roots.length) {
    throw new Error('Each scan root needs a unique string id, path, and scope (global, codex, or claude).');
  }
  return roots.map((root) => ({
    id: String(root.id),
    label: String(root.label || root.id),
    scope: root.scope,
    path: path.resolve(root.path.replace(/^~(?=\/|$)/, os.homedir())),
  }));
}

function scalar(value) {
  const trimmed = value.trim();
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    try { return JSON.parse(trimmed); } catch { return trimmed.slice(1, -1); }
  }
  if (trimmed.startsWith("'") && trimmed.endsWith("'")) return trimmed.slice(1, -1).replaceAll("''", "'");
  return trimmed;
}

export function parseSkillFrontmatter(content) {
  const normalized = content.replace(/^\uFEFF/, '').replaceAll('\r\n', '\n');
  const lines = normalized.split('\n');
  if (lines[0]?.trim() !== '---') throw new Error('Missing frontmatter');
  const end = lines.findIndex((line, index) => index > 0 && line.trim() === '---');
  if (end < 0) throw new Error('Unclosed frontmatter');

  const fields = {};
  for (let i = 1; i < end; i += 1) {
    const match = /^([\w-]+):(?:\s*(.*))?$/.exec(lines[i]);
    if (!match) continue;
    const [, key, raw = ''] = match;
    if (raw === '|' || raw === '>' || /^[|>][+-]$/.test(raw)) {
      const block = [];
      let minIndent = Infinity;
      while (i + 1 < end && (lines[i + 1].trim() === '' || /^\s/.test(lines[i + 1]))) {
        const line = lines[++i];
        block.push(line);
        if (line.trim()) minIndent = Math.min(minIndent, line.match(/^\s*/)[0].length);
      }
      const text = block.map((line) => line.slice(Math.min(line.length, minIndent === Infinity ? 0 : minIndent)));
      fields[key] = raw.startsWith('>') ? text.join(' ').replace(/\s+/g, ' ').trim() : text.join('\n').trim();
    } else {
      fields[key] = scalar(raw);
    }
  }
  if (typeof fields.name !== 'string' || !fields.name.trim()) throw new Error('Missing skill name in frontmatter');
  return { fields, body: lines.slice(end + 1).join('\n').trim() };
}

export function parseSkillMetadata(content) {
  const { fields } = parseSkillFrontmatter(content);
  return { name: fields.name.trim(), description: typeof fields.description === 'string' ? fields.description.trim() : '' };
}

function issue(pathname, root, reason) {
  return { path: pathname, rootId: root.id, scope: root.scope, reason };
}

export function scanInventory(roots = configuredRoots()) {
  const skills = new Map();
  const issues = [];
  const rootStatus = [];
  const visitedIssues = new Set();

  for (const root of roots) {
    const absoluteRoot = path.resolve(root.path.replace(/^~(?=\/|$)/, os.homedir()));
    const rootInfo = { id: root.id, label: root.label || root.id, scope: root.scope, path: absoluteRoot, status: 'ok' };
    rootStatus.push(rootInfo);
    if (!fs.existsSync(absoluteRoot)) {
      rootInfo.status = 'missing';
      issues.push(issue(absoluteRoot, root, 'Scan root is missing'));
      continue;
    }

    function addIssue(pathname, reason) {
      const key = `${root.id}:${pathname}:${reason}`;
      if (!visitedIssues.has(key)) {
        visitedIssues.add(key);
        issues.push(issue(pathname, root, reason));
      }
    }

    function visit(directory, ancestors) {
      let resolved;
      try {
        resolved = fs.realpathSync(directory);
        if (ancestors.has(resolved)) return;
      } catch (error) {
        addIssue(directory, error.code === 'ENOENT' ? 'Broken link' : `Cannot resolve: ${error.message}`);
        return;
      }

      let entries;
      try {
        entries = fs.readdirSync(directory, { withFileTypes: true });
      } catch (error) {
        addIssue(directory, `Cannot read directory: ${error.message}`);
        return;
      }

      const nextAncestors = new Set(ancestors);
      nextAncestors.add(resolved);
      for (const entry of entries) {
        if (ignoredDirectories.has(entry.name)) continue;
        const pathname = path.join(directory, entry.name);
        let stats;
        try {
          stats = fs.statSync(pathname);
        } catch (error) {
          if (entry.isSymbolicLink()) addIssue(pathname, error.code === 'ENOENT' ? 'Broken link' : `Cannot follow link: ${error.message}`);
          else addIssue(pathname, `Cannot read: ${error.message}`);
          continue;
        }
        if (stats.isDirectory()) {
          visit(pathname, nextAncestors);
        } else if (entry.name === 'SKILL.md' && stats.isFile()) {
          try {
            const canonicalPath = fs.realpathSync(pathname);
            const content = fs.readFileSync(pathname, 'utf8');
            const metadata = parseSkillMetadata(content);
            let skill = skills.get(canonicalPath);
            if (!skill) {
              skill = {
                id: crypto.createHash('sha256').update(canonicalPath).digest('hex').slice(0, 16),
                name: metadata.name,
                description: metadata.description,
                resolvedPath: canonicalPath,
                locations: [],
                scopes: [],
              };
              skills.set(canonicalPath, skill);
            }
            if (!skill.locations.some((location) => location.path === pathname)) {
              skill.locations.push({ path: pathname, rootId: root.id, rootLabel: rootInfo.label, scope: root.scope });
            }
            if (!skill.scopes.includes(root.scope)) skill.scopes.push(root.scope);
          } catch (error) {
            addIssue(pathname, `Invalid SKILL.md: ${error.message}`);
          }
        }
      }
    }

    visit(absoluteRoot, new Set());
  }

  const allSkills = [...skills.values()].sort((a, b) => a.name.localeCompare(b.name) || a.resolvedPath.localeCompare(b.resolvedPath));
  const counts = {
    all: allSkills.length,
    global: allSkills.filter((skill) => skill.scopes.includes('global')).length,
    codex: allSkills.filter((skill) => skill.scopes.includes('codex')).length,
    claude: allSkills.filter((skill) => skill.scopes.includes('claude')).length,
    issues: issues.length,
    installations: allSkills.reduce((sum, skill) => sum + skill.locations.length, 0),
  };
  return { scannedAt: new Date().toISOString(), roots: rootStatus, counts, skills: allSkills, issues };
}
