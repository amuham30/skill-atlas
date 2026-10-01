import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { scanInventory } from '../src/scanner.js';
import { getSkillDetail, explainSkill } from '../src/detail.js';

function fixture(t) {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-detail-'));
  t.after(() => fs.rmSync(base, { recursive: true, force: true }));
  return base;
}

function writeSkill(directory, frontmatter, body = '# Instructions') {
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(path.join(directory, 'SKILL.md'), `---\n${frontmatter}\n---\n${body}\n`);
}

test('uses explicit lockfile provenance and keeps conflicting claims visible', (t) => {
  const base = fixture(t);
  const rootPath = path.join(base, 'skills');
  writeSkill(path.join(rootPath, 'sample'), 'name: sample\ndescription: Help with examples.\nrepository: https://example.com/first', '# Use');
  fs.writeFileSync(path.join(base, '.skill-lock.json'), JSON.stringify({ skills: { sample: { sourceUrl: 'https://example.com/second' } } }));
  const roots = [{ id: 'global', label: 'Global', scope: 'global', path: rootPath }];
  const detail = getSkillDetail(scanInventory(roots).skills[0], roots);
  assert.equal(detail.provenance.repository.selected.value, 'https://example.com/first');
  assert.equal(detail.provenance.repository.conflict, true);
  assert.equal(detail.provenance.repository.evidence.length, 2);
  assert.equal(detail.provenance.author.selected, null);
});

test('reads plugin author and version without treating repository owner as author', (t) => {
  const base = fixture(t);
  const rootPath = path.join(base, 'cache');
  const plugin = path.join(rootPath, 'provider', 'widget', '1.2.3');
  writeSkill(path.join(plugin, 'skills', 'widget'), 'name: widget\ndescription: Build widgets.');
  fs.mkdirSync(path.join(plugin, '.codex-plugin'));
  fs.writeFileSync(path.join(plugin, '.codex-plugin', 'plugin.json'), JSON.stringify({ name: 'widget', version: '1.2.3', author: { name: 'Widget Authors' }, interface: { displayName: 'Widget Plugin' }, repository: 'https://github.com/company/widget' }));
  const roots = [{ id: 'plugins', label: 'Codex plugins', scope: 'codex', path: rootPath }];
  const detail = getSkillDetail(scanInventory(roots).skills[0], roots);
  assert.equal(detail.provenance.author.selected.value, 'Widget Authors');
  assert.equal(detail.provenance.author.selected.kind, 'plugin author');
  assert.deepEqual(detail.provenance.plugins.map((item) => [item.name, item.id, item.version]), [['Widget Plugin', 'widget', '1.2.3']]);
});

test('renders untrusted Markdown without executable HTML, unsafe links, or images', (t) => {
  const base = fixture(t);
  writeSkill(path.join(base, 'untrusted'), 'name: untrusted\ndescription: Show instructions.', '<script>alert(1)</script>\n\n[bad](javascript:alert(1)) [good](https://example.com) ![remote](https://example.com/a.png)');
  const roots = [{ id: 'global', label: 'Global', scope: 'global', path: base }];
  const detail = getSkillDetail(scanInventory(roots).skills[0], roots);
  assert.match(detail.instructionsHtml, /&lt;script&gt;/);
  assert.doesNotMatch(detail.instructionsHtml, /<script|href="javascript:|<img/i);
  assert.match(detail.instructionsHtml, /href="https:\/\/example.com"/);
});

test('uses documented trigger wording for when-to-use guidance', () => {
  const explanation = explainSkill('Charts for React. Triggers when working with dashboards or chart themes.', '# Usage');
  assert.equal(explanation.what, 'Charts for React.');
  assert.match(explanation.when, /Triggers when working with dashboards/);
});
