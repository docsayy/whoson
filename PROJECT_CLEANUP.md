# WhosOn project cleanup

This cleaned project intentionally excludes generated, duplicated, and obsolete
content that is not required to build or deploy WhosOn:

- `node_modules/` and `functions/node_modules/`
- `dist/`, `functions/lib/`, and `.firebase/`
- macOS `.DS_Store` metadata
- the historical `src-before-engine3-*` source snapshot
- old upgrade manifests and pre-engine backup configuration files
- unused notification, backup/restore, demo, and abandoned route source files

Run `npm install` after extracting the project. Use `npm run build` before every
deployment. Firebase Hosting and Cloudflare Pages must both be updated after a
frontend change.
