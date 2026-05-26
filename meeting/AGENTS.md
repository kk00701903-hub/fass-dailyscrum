# Lite Website Project (React + lovable-tagger)

This is the Lite-mode scaffold: a minimal Vite + React project wired with
`lovable-tagger` so the visual editor can anchor edits to JSX elements via
`data-lov-*` attributes.

- Write the page as JSX in `src/App.tsx`; mount it from `src/main.tsx`.
- `index.html` is a thin shell that only loads `/src/main.tsx`; do not inline
  page markup there — `componentTagger` cannot tag raw HTML.
- Tailwind v4 is wired up via `@tailwindcss/vite` and `src/index.css`
  (already imported by `src/main.tsx`). Use built-in utility classes
  (`bg-blue-500`, `text-white`, `p-4`, `grid`, `flex`, etc.) freely. Do NOT
  create `tailwind.config.ts`; custom colors must be registered in
  `@theme inline` inside `src/index.css` before their utilities (`bg-*`,
  `text-*`, `border-*`) become valid.
- Keep the tree small (one or two components, no router, no global state
  libraries).
- The shared publisher runs `vite build --mode development` so lovable tags
  survive into the deployed dist; commits the project; uploads the full zip.
