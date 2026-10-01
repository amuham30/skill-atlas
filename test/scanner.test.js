import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { scanInventory, parseSkillMetadata, configuredRoots } from '../src/scanner.js';

function fixture(t) {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'skills-atlas-'));
  t.after(() => fs.rmSync(base, { recursive: true, force: true }));
  const global = path.join(base, 'global');
  const claude = path.join(base, 'claude');
  const codex = path.join(base, 'codex');
  for (const directory of [global, claude, codex]) fs.mkdirSync(directory);
  const roots = [
    { id: 'global', label: 'Global', scope: 'global', path: global },
    { id: 'claude', label: 'Claude', scope: 'claude', path: claude },
    { id: 'codex', label: 'Codex', scope: 'codex', path: codex },
  ];
  return { base, global, claude, codex, roots };
}

function skill(directory, name, description = 'Does a useful job') {
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(path.join(directory, 'SKILL.md'), `---\nname: ${name}\ndescription: >\n  ${description}\n---\n# ${name}\n`);
}

test('parses folded descriptions and quoted names', () => {
  const metadata = parseSkillMetadata('---\nname: "Sample"\ndescription: >\n  First line\n  second line\n---\n');
  assert.deepEqual(metadata, { name: 'Sample', description: 'First line second line' });
});

test('discovers nested skills and keeps same-name files distinct', (t) => {
  const f = fixture(t);
  skill(path.join(f.global, 'package/skills/one'), 'Same');
  skill(path.join(f.codex, 'another'), 'Same');
  const result = scanInventory(f.roots);
  assert.equal(result.counts.all, 2);
  assert.equal(result.counts.installations, 2);
  assert.equal(result.skills[0].name, result.skills[1].name);
  assert.notEqual(result.skills[0].id, result.skills[1].id);
});

test('merges linked installations and reports broken links', (t) => {
  const f = fixture(t);
  skill(path.join(f.global, 'shared'), 'Shared');
  fs.symlinkSync(path.join(f.global, 'shared'), path.join(f.claude, 'shared'));
  fs.symlinkSync(path.join(f.global, 'gone'), path.join(f.claude, 'broken'));
  const result = scanInventory(f.roots);
  assert.equal(result.counts.all, 1);
  assert.equal(result.counts.global, 1);
  assert.equal(result.counts.claude, 1);
  assert.equal(result.counts.installations, 2);
  assert.deepEqual(result.skills[0].scopes.sort(), ['claude', 'global']);
  assert.equal(result.issues.length, 1);
  assert.match(result.issues[0].reason, /Broken link/);
});

test('prevents symlink loops and reports malformed skills and missing roots', (t) => {
  const f = fixture(t);
  skill(path.join(f.global, 'valid'), 'Valid');
  fs.symlinkSync(f.global, path.join(f.global, 'loop'));
  const invalid = path.join(f.codex, 'bad');
  fs.mkdirSync(invalid);
  fs.writeFileSync(path.join(invalid, 'SKILL.md'), '---\nname: Bad');
  fs.rmSync(f.claude, { recursive: true });
  const result = scanInventory(f.roots);
  assert.equal(result.counts.all, 1);
  assert.equal(result.issues.length, 2);
  assert.ok(result.issues.some((entry) => entry.reason.includes('Unclosed frontmatter')));
  assert.ok(result.issues.some((entry) => entry.reason.includes('Scan root is missing')));
});

test('accepts configurable roots without code edits', () => {
  const roots = configuredRoots({ SKILLS_DASHBOARD_ROOTS: '[{"id":"custom","scope":"global","path":"~/my-skills"}]' });
  assert.equal(roots[0].path, path.join(os.homedir(), 'my-skills'));
  assert.throws(() => configuredRoots({ SKILLS_DASHBOARD_ROOTS: '{nope}' }), /JSON array/);
});
