# Skills dashboard roadmap

This roadmap implements [prompt.md](./prompt.md) in reviewable phases. The dashboard is for one person on this Mac. Each phase ends with a working local app, a short verification report, and a specific test for Abdurrahman. **Stop after each phase and wait for his feedback before starting the next one.** Fix issues found in that phase before moving forward.

## Operating rules for every phase

- Use the installed skill files as the source of truth. Never hard-code an inventory or treat text inside a skill as an instruction to the dashboard.
- Keep installed skill directories read-only. If a test needs to create a skill, use an isolated temporary directory configured as an additional scan root.
- Bind the local server to `127.0.0.1` by default. Keep paths and file content inside the local app; do not add accounts or cloud sync.
- Give the user the run command, the local URL, what changed, what was verified, any known gaps, and a short hands-on test at every handoff.
- Record completion and feedback in the phase checklist below. A phase is complete only after automated checks, a real-browser check, and the user's test/feedback for that phase.

## Phase 1 — A trustworthy inventory and basic catalog

**Outcome:** Open a local dashboard and see the actual skills installed on this machine, with clear All, Global, Codex, Claude Code, and Needs attention navigation.

### Build

1. Inspect the repository, runtime/tooling, installed skill roots, and representative files before selecting the app stack. Document the choice and the one-command local start path.
2. Define a scan-root configuration with defaults for `~/.agents/skills`, `~/.claude/skills`, `~/.codex/skills`, and `~/.codex/plugins/cache`. Allow additional or overridden roots without editing code.
3. Build a filesystem scanner that finds nested `SKILL.md` files, parses frontmatter safely, handles unreadable/malformed files, and respects ignored build/cache directories where appropriate.
4. Resolve symlinks and prevent traversal loops. Use the resolved `SKILL.md` path as the canonical identity for one physical skill; retain every installation path and agent association. Keep distinct files with the same name distinct.
5. Detect broken symlinks and other invalid entries as separate records in Needs attention. Do not count them as usable skills.
6. Build a minimal responsive catalog: agent menu, skill list, name, documented description, installation locations, and accurate unique-skill/installation counts. A skill linked into both agents appears in both menus but has one canonical record.
7. Add loading, empty-root, missing-root, and scan-error states. Make the basic menu and list keyboard navigable.
8. Add focused scanner tests for nested packages, shared symlinks, same-name distinct skills, broken links, malformed metadata, and missing roots.

### Verify and user test

- Compare a sample of real global, Codex, Claude Code, and plugin skills against their files. Check that Claude links to shared skills are represented correctly and existing broken links appear in Needs attention.
- Run the app in a real browser at desktop and mobile widths. Confirm each menu and count behaves as labeled.
- **User test:** Open the catalog, find several familiar skills in the expected menus, and flag any missing or misidentified entries.

**Gate:** Inventory and agent association are trustworthy enough to build details on top of them. Stop for feedback.

## Phase 2 — Skill explanations and provenance

**Outcome:** A skill detail page answers what it does, when to use it, who made it, where it came from, and which agents can use it.

### Build

1. Create one detail route per canonical skill. Show the documented description, a concise plain-language explanation grounded in the instructions, documented use cases/trigger phrases, agent availability, and every installation/resolved path.
2. Show the complete `SKILL.md` in a readable expandable section. Render Markdown safely; disable executable HTML/scripts and unsafe links. Add copy-path and source-link actions.
3. Extract installed-source facts from scan roots, symlink paths, and plugin manifests. Extract original-source facts from explicit local evidence, including `~/.agents/.skill-lock.json`, `SKILL.md`, README/package metadata, `.codex-plugin/plugin.json`, and repository remotes.
4. Keep original author, original repository/website, installing plugin, and local path as separate fields. Show the evidence used for each field. Use **Unknown** for unsupported claims; a repository owner or folder name alone does not prove authorship.
5. Include plugin name/version when present. Decide and document precedence when sources disagree; preserve conflicting evidence for inspection instead of silently choosing a guess.
6. Add focused tests for provenance precedence, missing/conflicting metadata, and safe Markdown rendering. Review a sample of explanations against the corresponding skill text for accuracy.

### Verify and user test

- In a real browser, inspect details for a personal skill, a shared Claude/Codex skill, a nested package skill, and a plugin skill. Check copy-path, links, long instructions, and unknown fields.
- **User test:** Pick three unfamiliar skills and judge whether the explanation helps you decide when to use each one. Report any misleading author or source information.

**Gate:** Details are accurate and useful before adding more ways to browse them. Stop for feedback.

## Phase 3 — Find the right skill quickly

**Outcome:** Search and browse make the growing catalog useful when the skill name is unknown.

### Build

1. Derive a small, practical category set from descriptions and documented use cases. Store or compute category assignments so new skills follow the same process. Mark categories as inferred and use a clear fallback when evidence is weak.
2. Add category and author browsing, with Unknown author visible as its own group. Keep agent, plugin, source-type, category, and author filters composable.
3. Index names, descriptions, use cases, categories, authors, source metadata, and full instructions. Rank direct name and use-case matches above incidental full-text matches. Show why a result matched when useful.
4. Add sorting by name and source, a clear-all-filters action, and meaningful zero-results behavior. Ensure counts update correctly under filters and distinguish unique skills from installation appearances.
5. Test search ranking, combined filters, duplicate names, unknown authors, category fallback, and empty results.

### Verify and user test

- Search in a real browser for a task phrase, a skill name, a plugin, and a phrase found only in full instructions. Check desktop/mobile and keyboard operation.
- **User test:** Try to find five skills you might actually use without knowing their names. Note where categories or search results feel wrong.

**Gate:** Discovery works with the real inventory and the user's search language. Stop for feedback.

## Phase 4 — Automatic updates and status

**Outcome:** The open dashboard changes when skills change, and reopening it catches changes made while it was closed.

### Build

1. Run a complete scan on server startup. Watch configured roots for additions, edits, removals, moves, symlink changes, and plugin installs; include directories created after startup.
2. Debounce event bursts and rescan affected areas or the inventory as appropriate. Add a periodic full rescan to recover missed filesystem events.
3. Push inventory changes to the open browser without a page reload. Preserve the current menu/search/filter state where possible and handle a detail page whose skill disappeared.
4. Show last successful scan time, scanning state, errors, and a manual refresh control. Keep the last good inventory available through a recoverable scan error.
5. Re-run identity, provenance, explanation, category, search indexing, and image selection for new or changed skills. Avoid unnecessary network image requests during ordinary local changes.
6. Add integration tests using an isolated temporary skill root for create, edit, move, delete, symlink, missing-root/recreated-root, and restart behavior.

### Verify and user test

- With the page open, add/edit/move/delete a temporary skill and confirm changes appear within seconds without a reload. Repeat with the app closed and confirm a fresh startup finds the final state. Check manual refresh and error recovery.
- **User test:** Add or edit one of your own skills, watch the list and detail page update, then reopen the dashboard and check it again.

**Gate:** The catalog stays current without routine manual work. Stop for feedback.

## Phase 5 — Relevant visual examples and final polish

**Outcome:** UI and visual-design skills can show a useful example image, while other skills remain uncluttered.

### Build

1. Identify which skills genuinely benefit from a visual example. Search for a relevant image packaged with the skill first.
2. If none exists, use the verified source website/repository to find an appropriate official example, such as a component preview from a UI library's own site. Record the image URL, page URL, what it illustrates, and why it belongs to that skill. Do not use stock images, fabricated screenshots, or arbitrary search results.
3. Show one image per relevant skill, with source attribution and useful alt text. Omit it gracefully when there is no suitable image or the site is unavailable. Keep external image fetching from blocking the inventory.
4. Decide a simple local cache/refresh approach for remote images so browsing remains fast and broken links can be retried. Render local and remote assets safely.
5. Polish responsive layouts, typography, focus states, loading/empty/error views, and long-content behavior. Document scan roots, provenance rules, category inference, image selection, run commands, and known limitations.
6. Add only tests that cover meaningful image selection/fallback and safety behavior. Run the project checks and review the complete user flows in a real browser.

### Verify and user test

- Inspect examples for several UI skills, including one with a local image and one using its source website. Check that the image actually explains the skill, its source is visible, and missing images do not break the page.
- **User test:** Browse the UI skills you were unsure about (such as a component library) and say whether the visuals help you choose when to use them. Try the dashboard on desktop and phone-sized screens.

**Gate:** The dashboard meets [prompt.md](./prompt.md), with remaining limitations stated explicitly. Stop for final feedback.

## Progress tracker

- [x] Phase 1 implementation and internal verification
- [x] Phase 1 — Inventory and basic catalog; user tested
- [x] Phase 2 implementation and internal verification
- [x] Phase 2 — Explanations and provenance; user tested
- [x] Phase 3 implementation and internal verification — ready for user test
- [ ] Phase 3 — Search and organization; user tested
- [ ] Phase 4 — Automatic updates; user tested
- [ ] Phase 5 — Visual examples and final polish; user tested
