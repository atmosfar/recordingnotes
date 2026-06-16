# CSS Variable-Enablement Todo List

Goal: Move all hardcoded visual values into CSS custom properties so the design language can be swapped by editing only `:root` / `body.dark-mode` blocks.

File to edit: `public/style.css`

---

## Phase 1: Define New Variables in `:root` and `body.dark-mode`

Add these variables to both `:root` (light) and `body.dark-mode` (dark) blocks.

### Colors

- [x] `--color-white` — replace all `#fff` text uses
- [x] `--surface-muted` — replace `#eee` (light neutral surface)
- [x] `--surface-muted-dark` — replace `#8c8c8c` (dark neutral surface)
- [x] `--text-muted-dark` — replace `#333` standalone uses (not `--text-color`)
- [x] `--accent-green` — replace `#2ecc71` (save button, color-green swatch)
- [x] `--accent-blue` — replace `#3498db` (color-blue swatch)
- [x] `--text-tertiary` — replace `#999` (tertiary text)
- [x] `--primary-alpha-10` — replace `rgba(0, 123, 255, 0.1)` (active/hint backgrounds)

### Hover/Interaction Backgrounds

- [x] `--hover-bg` — replace `rgba(0,0,0,0.05)` / `rgba(255,255,255,0.05)` (light/dark)
- [x] `--hover-bg-strong` — replace `rgba(0,0,0,0.1)` / `rgba(255,255,255,0.1)` (light/dark)

### Box Shadows

- [x] `--shadow-sm` — replace `0 2px 5px rgba(0,0,0,0.1)`
- [x] `--shadow-md` — replace `0 2px 10px rgba(0,0,0,0.1)`
- [x] `--shadow-lg` — replace `0 4px 15px rgba(0,0,0,0.1)`
- [ ] `--shadow-sidebar` — replace `5px 0 15px rgba(0,0,0,0.1)`

### Border Radii

- [x] `--radius-sm` — replace `4px`
- [x] `--radius-md` — replace `6px`
- [x] `--radius-lg` — replace `8px`
- [x] `--radius-pill-half` — replace `10px`
- [x] `--radius-xl` — replace `12px`
- [x] `--radius-pill` — replace `20px`

### Typography

- [x] `--font-family` — replace system font stack in `body`
- [ ] `--font-mono` — replace `monospace`

### Sizing

- [x] `--sidebar-width` — replace `300px`
- [x] `--header-height` — replace `60px`
- [x] `--session-item-height` — replace `50px`
- [x] `--status-bar-height` — replace `3px`

---

## Phase 2: Replace Hardcoded Values Throughout the File

### Replace `--color-white` (`#fff`)

- [ ] `.sidebar-top-actions .action-btn` → `color: var(--color-white)`
- [ ] `.sidebar-top-actions #manage-sessions-btn.active` → `color: var(--color-white)`
- [ ] `button#new-session-btn` → `color: var(--color-white)`
- [ ] `button#send-note-btn, button#export-btn` → `color: var(--color-white)`
- [ ] `.fps-opt.selected` → `color: var(--color-white)`

### Replace `--surface-muted` / `--surface-muted-dark`

- [ ] `.sidebar-top-actions #manage-sessions-btn` → `background-color: var(--surface-muted)`
- [ ] `body.dark-mode .sidebar-top-actions #manage-sessions-btn` → `background-color: var(--surface-muted-dark)`
- [ ] `.color-none` → `background-color: var(--surface-muted)`
- [ ] `#mobile-color-toggle` fallback → `var(--selected-color, var(--surface-muted))`
- [ ] `body.dark-mode #mobile-color-toggle` fallback → `var(--selected-color, var(--surface-muted-dark))`

### Replace `--text-muted-dark`

- [ ] `.sidebar-top-actions #manage-sessions-btn` → `color: var(--text-muted-dark)`
- [ ] `body.dark-mode .sidebar-top-actions #manage-sessions-btn` → `color: var(--text-muted-dark)` (use existing dark text var)
- [ ] `#mobile-color-toggle` → `color: var(--text-muted-dark)`

### Replace `--accent-green`

- [ ] `.note-actions .save-btn` → `color: var(--accent-green)`
- [ ] `.color-green` → `background-color: var(--accent-green)`

### Replace `--accent-blue`

- [ ] `.color-blue` → `background-color: var(--accent-blue)`

### Replace `--text-tertiary`

- [ ] `.color-none::after` → `color: var(--text-tertiary)`

### Replace `--primary-alpha-10`

- [ ] `.session-item.active` → `background-color: var(--primary-alpha-10)`
- [ ] `.tag-btn:hover` → `background-color: var(--primary-alpha-10)`

### Replace `--hover-bg`

- [ ] `.session-item:hover` → `background-color: var(--hover-bg)`
- [ ] `body.dark-mode .session-item:hover` → `background-color: var(--hover-bg)`
- [ ] `.icon-btn:hover` → `background: var(--hover-bg)`
- [ ] `body.dark-mode .icon-btn:hover` → `background: var(--hover-bg)`
- [ ] `.note-actions button:hover` → `background-color: var(--hover-bg)`
- [ ] `.fps-opt:hover` → `background-color: var(--hover-bg)`
- [ ] `body.dark-mode .fps-opt:hover` → `background-color: var(--hover-bg)`
- [ ] `.menu-item:hover` → `background: var(--hover-bg)`
- [ ] `body.dark-mode .menu-item:hover` → `background: var(--hover-bg)`

### Replace `--hover-bg-strong`

- [ ] `.session-actions button:hover` → `background-color: var(--hover-bg-strong)`
- [ ] `.user-count` → `background-color: var(--hover-bg-strong)`
- [ ] `body.dark-mode .user-count` → `background-color: var(--hover-bg-strong)`

### Replace `--shadow-sm`

- [ ] `.sidebar-top-actions #manage-sessions-btn` → `box-shadow: var(--shadow-sm)`
- [ ] `.sidebar-top-actions .action-btn` (mobile) → `box-shadow: var(--shadow-sm)`
- [ ] `#mobile-color-toggle` → `box-shadow: var(--shadow-sm)`

### Replace `--shadow-md`

- [ ] `#draft-timestamp-display` → `box-shadow: var(--shadow-md)`

### Replace `--shadow-lg`

- [ ] `.palette-popup` → `box-shadow: var(--shadow-lg)`
- [ ] `#overflow-menu` → `box-shadow: var(--shadow-lg)`
- [ ] `.dropdown-menu` → `box-shadow: var(--shadow-lg)`

### Replace `--shadow-sidebar`

- [ ] `#sidebar` (mobile) → `box-shadow: var(--shadow-sidebar)`

### Replace `--radius-sm`

- [ ] `::-webkit-scrollbar-thumb` → `border-radius: var(--radius-sm)`
- [ ] `.note` → `border-radius: var(--radius-sm)`
- [ ] `.note textarea` → `border-radius: var(--radius-sm)`
- [ ] `.note-actions button` → `border-radius: var(--radius-sm)`
- [ ] `.session-actions button` → `border-radius: var(--radius-sm)`
- [ ] `#note-input` → `border-radius: var(--radius-sm)`
- [ ] `button#send-note-btn, button#export-btn` → `border-radius: var(--radius-sm)`

### Replace `--radius-md`

- [ ] `.dropdown-menu .menu-item` → `border-radius: var(--radius-md)`
- [ ] `#new-tag-input` → `border-radius: var(--radius-md)`
- [ ] `#share-link-url` → `border-radius: var(--radius-md)`

### Replace `--radius-lg`

- [ ] `.sidebar-top-actions .action-btn` → `border-radius: var(--radius-lg)`
- [ ] `button#new-session-btn` → `border-radius: var(--radius-lg)`
- [ ] `.fps-opt` → `border-radius: var(--radius-lg)`
- [ ] `.menu-item` → `border-radius: var(--radius-lg)`
- [ ] `.dropdown-menu` → `border-radius: var(--radius-lg)`
- [ ] `.tag-btn` → `border-radius: var(--radius-lg)`
- [ ] `.modal-tag-item` → `border-radius: var(--radius-lg)`

### Replace `--radius-pill-half`

- [ ] `.user-count` → `border-radius: var(--radius-pill-half)`

### Replace `--radius-xl`

- [ ] `.palette-popup` → `border-radius: var(--radius-xl)`
- [ ] `#overflow-menu` → `border-radius: var(--radius-xl)`

### Replace `--radius-pill`

- [ ] `#draft-timestamp-display` → `border-radius: var(--radius-pill)`

### Replace `--font-family`

- [ ] `body` → `font-family: var(--font-family)`

### Replace `--font-mono`

- [ ] `#live-clock` → `font-family: var(--font-mono)`
- [ ] `.note .timestamp` → `font-family: var(--font-mono)`
- [ ] `#draft-timestamp-display` → `font-family: var(--font-mono)`
- [ ] `#share-link-url` → `font-family: var(--font-mono)`

### Replace `--sidebar-width`

- [ ] `#sidebar` → `width: var(--sidebar-width)`

### Replace `--header-height`

- [ ] `header` → `height: var(--header-height)`
- [ ] `.sidebar-header` → `height: var(--header-height)`

### Replace `--session-item-height`

- [ ] `.session-item` → `height: var(--session-item-height)`
- [ ] `.session-item` (mobile) → `height: var(--session-item-height)`

### Replace `--status-bar-height`

- [ ] `body.recording::after` → `height: var(--status-bar-height)`

---

## Phase 3: Verification

- [x] Confirm no remaining hardcoded hex colors outside `:root` / `body.dark-mode` (except functional colors like `--recording-red`, `--error-yellow` which are already variables)
- [x] Confirm no remaining hardcoded `rgba()` shadows outside variable definitions
- [x] Confirm no remaining hardcoded `border-radius` pixel values outside variable definitions
- [ ] Test light mode renders correctly
- [ ] Test dark mode renders correctly
- [ ] Test mobile responsive view renders correctly
