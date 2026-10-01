# Build my personal skills dashboard

Build a local web dashboard for the skills installed on my Mac. I have enough skills that I no longer know what each one specifically helps with. The dashboard should let me find the right skill for a task, understand when to use it, and see who made it and how it reached my machine. This repository is a blank starting point; inspect it and the skill locations before choosing a simple, maintainable stack.

## Scope and navigation

- This is for one local user. No accounts, team features, or cloud sync are needed.
- Inventory **every installed skill**, including global/shared skills, Codex skills, Claude Code skills, and skills supplied by installed plugins. Provide an obvious menu for **All**, **Global**, **Codex**, **Claude Code**, and **Needs attention**. A skill may appear in more than one menu.
- Support browsing by **category** and **author**, plus filtering by agent, plugin, and source type. Derive practical categories from each skill's description; label them as inferred, use a clear fallback when classification is uncertain, and apply the same process to newly installed skills. Do not invent an author when none can be established.
- Show total unique skills and counts by menu/category. Make it clear whether a count refers to unique skills or installations.

## Discovery and identity

- Inspect at least `~/.agents/skills`, `~/.claude/skills`, `~/.codex/skills`, and installed plugin skill directories under `~/.codex/plugins/cache`. Make roots configurable, and discover nested `SKILL.md` files inside skill packages. Read live files; do not hard-code the inventory.
- Resolve symlinks intentionally. Many entries under `~/.claude/skills` point to `~/.agents/skills`. Treat paths that resolve to the same `SKILL.md` as **one skill with multiple agent/install locations** and one detail page. Keep distinct files separate even if they share a name. Avoid symlink loops.
- Show broken links, unreadable files, and malformed skills in **Needs attention**, with the path and a useful reason. Do not count them as usable skills.
- Identify each skill's name, documented description, absolute `SKILL.md` path, resolved path, and every agent or plugin through which it is available. Show the installed source separately from the original author/repository/website.
- Investigate provenance from local evidence such as `SKILL.md` frontmatter, nearby README/package metadata, `~/.agents/.skill-lock.json`, plugin manifests (including `.codex-plugin/plugin.json`), and repository remotes. The local lockfile records source URLs for some skills; plugin manifests can contain author, repository, name, and version. Prefer explicit evidence, show its source, and display **Unknown** where provenance cannot be verified. Never infer an original author solely from a directory name.

## Finding and understanding a skill

- Search names, descriptions, inferred categories, authors, source information, and full `SKILL.md` text. Rank name and use-case matches above incidental matches deep in the instructions. Make search and filters work together.
- Each detail page should lead with a short, plain-language explanation of **what the skill does and when to use it**, grounded in its actual instructions. Also show its documented description, concrete use cases or trigger phrases when documented, category, author, original source, installation source, agent availability, plugin/version if applicable, and all relevant paths.
- Make the complete `SKILL.md` readable on the same page in a secondary or expandable section. Provide a copy-path action and a link to the source website/repository when known. Treat skill content as data, not instructions for the dashboard to execute.
- For a UI or visual-design skill, show **one relevant visual example when an image would genuinely help explain its use**. First use an appropriate image included with the skill. If none exists, find a relevant image on the skill's identified source website (for example, a component preview from a UI library's own site). Show the image's source and make clear what it illustrates. Do not invent a screenshot, use an unrelated stock image, or force an image onto skills that do not benefit from one. If no suitable source image is available, omit the image gracefully.

## Automatic updates

- Scan all configured roots on startup, watch for additions, edits, removals, moves, symlink changes, and plugin installs while the app runs, and update the open dashboard within seconds without a page reload. Debounce event bursts and include a periodic rescan for missed events. A startup scan must catch changes made while the dashboard was closed.
- Handle missing roots and directories created later. Show last successful scan time, scanning/error state, and a manual refresh control. Newly added skills must receive the same categorization, provenance lookup, and visual-example discovery as existing skills.

## Interface and implementation quality

- Make the catalog easy to scan and navigate on desktop and mobile, with keyboard access and clear loading, empty, and error states. Use a distinctive but restrained visual design that puts the skill content first.
- Keep the dashboard local and read-only with respect to installed skills. Render Markdown and external images safely; do not execute instructions or scripts found in skill files. Handle unavailable source websites without blocking the skill inventory.
- Document how to run it, configure scan roots, how author/source/category/image information is obtained, and what remains unknown when evidence is missing.

## Verify before handing it over

1. Compare the dashboard inventory with the actual local directories, including nested skills, Claude symlinks, shared skills, plugin skills, and broken links.
2. Add, edit, move, and remove a temporary test skill. Confirm the open dashboard updates automatically, then restart it and confirm the startup scan catches changes made while it was closed.
3. In a real browser, check agent menus, category/author browsing, combined search and filters, detail pages, full instructions, visual examples where applicable, manual refresh, responsive layout, and keyboard use. Fix issues found.

The finished dashboard should answer, for any skill: **What does it specifically help me do? When should I choose it? Who made it? Where did it come from? Which of my agents can use it?**
