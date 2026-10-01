import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildDiscoveryInventory, inferCategory } from '../src/discovery.js';
import { matchSkill, selectSkills } from '../public/search.js';

function record(id, name, overrides = {}) {
  return {
    id, name, description: '', scopes: ['global'], locations: [{ path: `/skills/${id}` }],
    category: { id: 'code', label: 'Coding & architecture' }, author: 'Unknown',
    pluginNames: [], sourceType: { id: 'unknown', label: 'Unknown source' }, sourceName: 'Unknown',
    searchFields: { useCases: '', source: '', fullText: '' }, ...overrides,
  };
}

test('infers practical categories from names and falls back when evidence is weak', () => {
  assert.equal(inferCategory('tdd', 'Build code with tests').id, 'quality');
  assert.equal(inferCategory('plotting', 'Create visuals').id, 'data');
  assert.equal(inferCategory('bklit-ui', 'Create charts').id, 'design');
  assert.equal(inferCategory('unknown-name', 'Unrelated words').id, 'other');
});

test('ranks names and use cases above incidental instruction matches', () => {
  const skills = [
    record('instructions', 'general helper', { searchFields: { useCases: '', source: '', fullText: 'Create a chart using an example.' } }),
    record('use-case', 'data helper', { searchFields: { useCases: 'create a chart', source: '', fullText: '' } }),
    record('name', 'chart', { description: 'Create visual reports' }),
  ];
  assert.deepEqual(selectSkills(skills, { query: 'chart', sort: 'relevance' }).map(({ skill }) => skill.id), ['name', 'use-case', 'instructions']);
  assert.equal(matchSkill(skills[0], 'chart').reason, 'instructions');
  assert.equal(matchSkill(skills[0], 'not-here'), null);
});

test('ignores generic task words when a query contains a more specific term', () => {
  const skills = [
    record('grill', 'grilling', { description: 'Grill a plan or decision.' }),
    record('triage', 'triage', { description: 'Manage a workflow.', searchFields: { useCases: '', source: '', fullText: 'Ask someone to grill a plan.' } }),
  ];
  assert.deepEqual(selectSkills(skills, { query: 'grill my plan', sort: 'relevance' }).map(({ skill }) => skill.id), ['grill', 'triage']);
});

test('combines agent, category, author, plugin, and source filters while retaining duplicate names', () => {
  const skills = [
    record('a', 'Same name', { scopes: ['global', 'claude'], category: { id: 'design', label: 'Design & UI' }, author: 'Ada', pluginNames: ['tools'], sourceType: { id: 'plugin', label: 'Plugin' } }),
    record('b', 'Same name', { scopes: ['codex'], category: { id: 'design', label: 'Design & UI' }, author: 'Unknown' }),
    record('c', 'Different', { scopes: ['global'], author: 'Ada' }),
  ];
  assert.equal(selectSkills(skills, { query: 'same' }).length, 2);
  assert.deepEqual(selectSkills(skills, { view: 'claude', category: 'design', author: 'Ada', plugin: 'tools', source: 'plugin' }).map(({ skill }) => skill.id), ['a']);
  assert.deepEqual(selectSkills(skills, { author: 'Unknown' }).map(({ skill }) => skill.id), ['b']);
  assert.equal(selectSkills(skills, { query: 'missing' }).length, 0);
});

test('indexes a new skill from an isolated root, including full instructions', (t) => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-discovery-'));
  t.after(() => fs.rmSync(base, { recursive: true, force: true }));
  const directory = path.join(base, 'my-skill');
  fs.mkdirSync(directory);
  fs.writeFileSync(path.join(directory, 'SKILL.md'), '---\nname: plotting\ndescription: Plot data for reports.\nauthor: Example Author\n---\n# Instructions\nUse the special-histogram technique.\n');
  const inventory = buildDiscoveryInventory([{ id: 'global', label: 'Global', scope: 'global', path: base }]);
  assert.equal(inventory.skills.length, 1);
  assert.equal(inventory.skills[0].category.id, 'data');
  assert.equal(inventory.skills[0].author, 'Example Author');
  assert.equal(selectSkills(inventory.skills, { query: 'special-histogram' }).length, 1);
});
