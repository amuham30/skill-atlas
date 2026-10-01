# Skill Atlas

A local, read-only catalog of installed skills. Phase 3 adds task search, inferred categories, author and source browsing, plugin filtering, and sorting. Automatic updates and visual examples follow in later phases in [roadmap.md](./docs/roadmap.md).

## Run

Requires Node.js 20 or later. From this directory:

```bash
npm start
```

Open <http://127.0.0.1:4173>. The server binds only to `127.0.0.1`. It scans skill folders when the catalog or a detail page loads; reload the page to rescan until Phase 4. Run checks with `npm test`.

## Project layout

- `docs/` — the product prompt and phased roadmap.
- `public/` — the catalog and detail-page interface.
- `src/` — the local server, skill scanner, and detail/provenance logic.
- `test/` — focused scanner and detail tests.

## Scan roots

The defaults are `~/.agents/skills` (Global), `~/.claude/skills` (Claude Code), `~/.codex/skills` (Codex), and `~/.codex/plugins/cache` (Codex plugins). Override them with `SKILLS_DASHBOARD_ROOTS`, a JSON array. For example:

```bash
SKILLS_DASHBOARD_ROOTS='[{"id":"demo","label":"Demo skills","scope":"global","path":"/absolute/path/to/skills"}]' npm start
```

Each root needs a unique `id`, a `path`, and a `scope` of `global`, `codex`, or `claude`. `label` is optional. The environment variable replaces all defaults; include the defaults in the JSON if you want to add a root alongside them. Set `PORT` to change the server port.

The scanner searches nested folders for `SKILL.md`, follows symlinks, and uses the resolved file path as the unique skill identity. One skill can therefore appear in multiple agent menus while remaining one unique record. Broken links, missing roots, unreadable files, and invalid skill files appear under Needs attention. The app never writes to skill folders.

## Detail pages and provenance

Select a skill name to open its detail page. The short explanation and use cases come from the installed description and explicit instructions. Expand **Read complete SKILL.md** for rendered instructions, or **View raw file** to see the original text and frontmatter. The page shows every installation path, the resolved file path, and copy buttons.

Provenance uses explicit local evidence, in this order: `SKILL.md` frontmatter or original-skill credit; the installed skill lockfile; a Codex plugin manifest; nearby `package.json` and README metadata; then the checkout's Git origin. When records disagree, the page shows the selected value and all evidence. A plugin manifest author is labeled as a *plugin author*; it does not prove who wrote each individual skill. Unsupported author, repository, or website fields show **Unknown**. Paths stay local to this dashboard. Only `http` and `https` source links are clickable; raw HTML and remote images inside skill Markdown are disabled.

## Search and browsing

The catalog searches names, documented descriptions and use cases, inferred categories, authors, source details, and full `SKILL.md` text. Name and use-case matches rank above matches found only in full instructions. Each result shows the field that matched; instruction-only matches include a short excerpt. Search, agent menus, category, author, plugin, and source type filters work together. The result count shows unique skills and the installation paths they represent. Sort by best match, name, or source. The current browse state stays in the URL and survives a visit to a skill detail page.

Categories are **inferred** from skill names, descriptions, and documented use cases using the rules in `src/discovery.js`. When those provide no reliable signal, the skill goes in **Other / unclassified**. Author and original source facts are taken from explicit local evidence. **Unknown** remains a visible author and source group. The plugin filter uses the plugin's display name when its manifest provides one.

## Current limits

Counts are unique skills per menu; the installation-path total counts all visible paths, including links. Automatic open-page updates are planned for Phase 4, and visual examples for Phase 5. Markdown links to relative reference files appear as text because the dashboard does not currently serve those files.
