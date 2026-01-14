# Plan: Mobile UI Refinement

## Phase 1: Mobile Viewport Height Fix [checkpoint: 08524a2]
- [x] Task: Update `public/style.css` mobile media query to use `dvh` (Dynamic Viewport Height) for main containers to ensure bottom-row visibility on Firefox Android. [08524a2]
- [x] Task: Conductor - User Manual Verification 'Phase 1: Mobile Viewport Height Fix' (Protocol in workflow.md) [08524a2]

## Phase 2: Sidebar Button Stability [checkpoint: 7e6ab14]
- [x] Task: Update `public/style.css` mobile media query to apply a consistent `min-height` to `.sidebar-top-actions .action-btn` to prevent height fluctuation when icons are toggled. [72467b4]
- [x] Task: Conductor - User Manual Verification 'Phase 2: Sidebar Button Stability' (Protocol in workflow.md) [7e6ab14]

## Phase 3: Theme Icon Synchronization [checkpoint: 9843e3a]
- [x] Task: Update `public/app.js` logic to ensure the SVG icon in the mobile kebab menu correctly toggles between Sun and Moon based on the active theme. [36b70a6]
- [x] Task: Conductor - User Manual Verification 'Phase 3: Theme Icon Synchronization' (Protocol in workflow.md) [9843e3a]

## Phase 4: Layout Refinements [checkpoint: a568351]
- [x] Task: Align `#header-session-title` to the left on mobile to prevent overlap with the live clock. [b4a01b4]
- [x] Task: Ensure note action icons occupy zero width when hidden on mobile, allowing content to wrap naturally. [b4a01b4]
- [x] Task: Conductor - User Manual Verification 'Phase 4: Layout Refinements' (Protocol in workflow.md) [a568351]
