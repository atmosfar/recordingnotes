# Plan: UI Tidying & Mobile Refinement

## Phase 1: CSS Refactoring & Clean Template
- [~] Task: Create `public/style.css` and migrate all styles from `index.html`
- [ ] Task: Link `public/style.css` in `index.html` and remove the `<style>` block
- [ ] Task: Re-organize the HTML structure in `index.html` to move the RecNotes heading to the sidebar
- [ ] Task: Conductor - User Manual Verification 'CSS Refactoring & Clean Template' (Protocol in workflow.md)

## Phase 2: Mobile Header & Navigation
- [ ] Task: Reinstate the hamburger menu icon and ensure it correctly toggles the `.open` class on `#sidebar`
- [ ] Task: Update the mobile header to show only the session name and timer
- [ ] Task: Implement the vertical "..." menu button and its dropdown container
- [ ] Task: Move theme toggle and export button into the "..." menu with icon + text labels
- [ ] Task: Implement the "Recording" red top-bar indicator in CSS
- [ ] Task: Conductor - User Manual Verification 'Mobile Header & Navigation' (Protocol in workflow.md)

## Phase 3: Layout Fixes & Polish
- [ ] Task: Fix note stream spacing (add margin/padding between timestamp and content)
- [ ] Task: Fix Edit button wrapping issue (ensure it stays on the far-right using absolute positioning or flexbox)
- [ ] Task: Truncate input placeholder to "Type a note" on mobile via CSS or JS
- [ ] Task: Apply final styling polish to the overflow menu and sidebar branding
- [ ] Task: Conductor - User Manual Verification 'Layout Fixes & Polish' (Protocol in workflow.md)
