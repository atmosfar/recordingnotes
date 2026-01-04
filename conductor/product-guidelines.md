# Product Guidelines (Minimalist)

## Design Philosophy
- **Function over Form:** Prioritize a working, reliable stream over complex UI components. Use standard HTML elements.
- **Zero Build Step:** The code should run directly in the browser and Node without needing compilers (Babel, TypeScript), bundlers (Vite, Webpack), or CSS processors.
- **Single-File Components:** Keep logic grouped logically but avoid deep directory nesting.

## Visual Priorities
- **The Clock:** A large, readable session timer at the top of the interface.
- **Readability:** High contrast text for the note stream.

## Workflow
- **Keep it Simple:** No complex state management. Use the browser's native capabilities.
- **Direct SQL:** All database interactions should be written in clear, readable SQL strings.