# NPM Publishing Checklist

- [x] 1. CLI entry point — `bin/recordingnotes.cjs` so users can run `recordingnotes start` (or `npx recordingnotes`)
- [x] 2. `package.json` metadata — added `"bin"`, `"files"`, `"engines"`, `"repository"`, `"license"`, `"keywords"`, `"author"`
- [x] 3. `.npmignore` — exclude junk files (screenshots, test DBs, `archived/`, `conductor/`, `docs/`, old CSS, `_regions_markers.csv`, etc.)
- [x] 4. `README.md` — installation, usage, env config, guest links, exports
