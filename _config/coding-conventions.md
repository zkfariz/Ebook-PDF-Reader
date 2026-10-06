# Coding conventions

## `app/` layout (target)

```
app/
  src/
    main/          Electron main process: window, menus, file dialogs, data store, IPC handlers
    preload/       contextBridge API: the only bridge between the renderer and main
    renderer/
      reader/      ReaderAdapter interface + pdf/ and epub/ implementations
      features/    library/, bookmarks/, highlights/, search/, toc/, settings/
      ui/          shared components (Toolbar, Sidebar, Popup) + theme.css (tokens)
    shared/        types shared by main and renderer (data model, IPC channel names)
  tests/
  package.json
```

## Rules

- TypeScript strict mode. No `any` unless there is a comment explaining why.
- The UI never imports pdfjs or epub.js directly; it goes only through `ReaderAdapter`.
- All colours come from the CSS tokens in `theme.css`. Never hard-code a hex value in a component.
- IPC channel names live in `src/shared/ipc.ts`. Validate the arguments in main.
- Save data atomically: write to a temp file, then rename.
- Name things by feature; keep files under about 300 lines.
- Commit after each slice with a message like `S3: EPUB adapter (F01, F02)`.
