# Repository Guidelines

## Project Structure & Module Organization
EclipseTab is a React + TypeScript browser extension (Vite, Manifest V3).

- `src/` application code.
- `src/components/` UI modules (for example `Dock/`, `ZenShelf/`, `Modal/`).
- `src/context/` global state providers (`ThemeContext`, `SpacesContext`, `DockContext`).
- `src/hooks/` reusable logic (`useDragAndDrop`, `useWallpaperStorage`, etc.).
- `src/utils/` storage, drag, animation, and browser helper utilities.
- `src/constants/` static config (gradients, layout, search engines).
- `src/styles/` global styles and CSS variables.
- `src/assets/` icons and static assets.
- `public/manifest.json` extension manifest.
- `dist/` build output; do not hand-edit generated files.

## Build, Test, and Development Commands
- `npm install` installs dependencies.
- `npm run dev` starts the Vite dev server for local UI iteration.
- `npm run build` runs TypeScript checks (`tsc`) and creates a production build in `dist/`.
- `npm run preview` serves the built app for pre-release verification.

For extension testing, load `dist/` in `chrome://extensions` (Developer mode) or Firefox temporary add-ons.

## Coding Style & Naming Conventions
- Use TypeScript with strict typing (`tsconfig.json` has `strict: true`).
- Follow existing formatting: 2-space indentation, semicolons, single quotes.
- Components and contexts: PascalCase filenames (`Dock.tsx`, `ThemeContext.tsx`).
- Hooks: `useXxx` camelCase (`useSearchSuggestions.ts`).
- CSS Modules: `ComponentName.module.css`.
- Shared constants/utilities/types: camelCase file names (`layout.ts`, `storage.ts`).

## Testing Guidelines
There is no automated test framework configured yet. Minimum required validation for each PR:

- Run `npm run build` with zero type errors.
- Manually smoke test affected flows in the extension UI (Dock edit/drag, space switch, Zen Shelf interactions, settings persistence).
- Re-test permissions-related changes via `public/manifest.json` behavior (search suggestions and optional host permissions).

## Commit & Pull Request Guidelines
Current history uses short, descriptive one-line subjects (often Chinese), usually feature-first (for example Dock/Searcher/回收站/版本更新).

- Keep commits focused and atomic; use concise subjects.
- Preferred format: `<scope>: <change>` (e.g., `Dock: 修复 Firefox 宽度动画`).
- Avoid committing generated release archives (`*.zip`, `*.crx`, `*.pem`) unless doing an explicit release task.

PRs should include:

- What changed and why.
- Affected modules/paths.
- Manual verification steps and results.
- Screenshots/GIFs for UI-visible changes.
- Linked issue/task when available.
