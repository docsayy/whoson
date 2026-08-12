# Build validation

The assembled upgrade was tested in an isolated Vite project with:

```bash
npm run build
```

Result: successful TypeScript and production Vite build.

The upgrade produced page-level lazy chunks rather than one monolithic application bundle. The largest initial application JavaScript chunk in the isolated build was approximately 829 kB before gzip, compared with the previously reported approximately 1.77 MB single bundle. Excel parsing remains a separately loaded heavy chunk and is loaded only when needed by schedule pages.
