import { state } from './state.js';
import { socket } from './socket.js';
import { tagManager } from './tags.js';
import { renderQuickTags } from './notes.js';

/**
 * Close the sidebar and backdrop.
 */
export function closeSidebarFn() {
    const sidebar = document.getElementById('sidebar');
    const backdrop = document.getElementById('bottom-sheet-backdrop');
    if (sidebar) sidebar.classList.remove('open');
    if (backdrop) {
        backdrop.classList.remove('open');
        backdrop.style.display = 'none';
        backdrop.style.opacity = '0';
    }
}

/**
 * Update the selected color and sync UI indicators.
 */
export function updateColorSelection(color) {
    state.selectedColor = color;
    document.querySelectorAll('.color-opt, .sheet-color-opt').forEach(o => o.classList.toggle('selected', o.dataset.color === color));
    const toggle = document.getElementById('mobile-color-toggle');
    if (toggle) toggle.style.setProperty('--selected-color', color || '');
}

/**
 * Toggle the color picker popup.
 */
export function toggleColorPicker(open) {
    const popup = document.getElementById('color-picker-popup');
    if (popup) popup.classList.toggle('open', open);
}

/**
 * Toggle the overflow menu.
 */
export function toggleOverflow(open) {
    const menu = document.getElementById('overflow-menu');
    if (menu) menu.classList.toggle('open', open);
}

/**
 * Toggle the export format menu.
 */
export function toggleExportMenu(open) {
    const menu = document.getElementById('export-menu');
    if (menu) menu.classList.toggle('open', open);
}

/**
 * Toggle the FPS selection modal (for EDL export).
 */
export function toggleFpsModal(open) {
    const modal = document.getElementById('fps-modal');
    const backdrop = document.getElementById('bottom-sheet-backdrop');
    if (modal) modal.classList.toggle('open', open);
    if (backdrop) {
        backdrop.style.display = open ? 'block' : 'none';
        backdrop.style.opacity = open ? '1' : '0';
    }

    if (open) {
        const lastFps = localStorage.getItem('last_edl_fps');
        if (lastFps) {
            document.querySelectorAll('.fps-opt').forEach(btn => {
                btn.classList.toggle('selected', btn.dataset.fps === lastFps);
            });
        }
    }
}

/**
 * Toggle the timezone selection modal (for clock-mode export).
 * @param {boolean} open
 * @param {string} format - export format (reaper/audition/edl)
 */
export function toggleTimezoneModal(open, format) {
    const modal = document.getElementById('timezone-modal');
    const backdrop = document.getElementById('bottom-sheet-backdrop');
    if (modal) modal.classList.toggle('open', open);
    if (backdrop) {
        backdrop.style.display = open ? 'block' : 'none';
        backdrop.style.opacity = open ? '1' : '0';
    }

    if (open) {
        state.pendingExportFormat = format;
        // Set timezone labels with actual timezone names
        const localLabel = document.getElementById('local-timezone-label');
        const serverLabel = document.getElementById('server-timezone-label');
        try {
            const clientTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
            if (localLabel) localLabel.textContent = `Local (${clientTz})`;
        } catch {
            if (localLabel) localLabel.textContent = 'Local timezone';
        }
        if (serverLabel) serverLabel.textContent = `Server (${state.exportTimezone})`;
        // Restore last chosen timezone
        const lastTz = localStorage.getItem('last_export_timezone');
        const radios = document.querySelectorAll('#timezone-modal input[name="export-timezone"]');
        if (lastTz) {
            radios.forEach(r => r.checked = r.value === lastTz);
        } else {
            // Default to server timezone
            radios.forEach(r => r.checked = r.value === 'server');
        }
    }
}

/**
 * Toggle the tags editing modal.
 */
export function toggleTagsModal(open) {
    const modal = document.getElementById('tags-modal');
    const backdrop = document.getElementById('bottom-sheet-backdrop');
    if (modal) modal.classList.toggle('open', open);
    if (backdrop) {
        backdrop.style.display = open ? 'block' : 'none';
        backdrop.style.opacity = open ? '1' : '0';
    }
    if (open) renderModalTags();
}

/**
 * Toggle the share link modal.
 */
export function toggleShareLinkModal(open, url) {
    const modal = document.getElementById('share-link-modal');
    const backdrop = document.getElementById('bottom-sheet-backdrop');
    const messageEl = document.getElementById('share-link-message');
    const urlInput = document.getElementById('share-link-url');
    const qrContainer = document.getElementById('qr-code-container');
    if (modal) modal.classList.toggle('open', open);
    if (backdrop) {
        backdrop.style.display = open ? 'block' : 'none';
        backdrop.style.opacity = open ? '1' : '0';
    }
    if (open && url) {
        messageEl.textContent = 'Link copied to clipboard!';
        urlInput.value = url;
        qrContainer.innerHTML = '';
        QrCreator.render({
            text: url,
            radius: 0,
            ecLevel: 'M',
            fill: '#000000',
            background: '#ffffff',
            size: 200
        }, qrContainer);
    }
}

/**
 * Toggle the new session creation modal.
 */
export function toggleNewSessionModal(open) {
    const modal = document.getElementById('new-session-modal');
    const backdrop = document.getElementById('bottom-sheet-backdrop');
    const input = document.getElementById('new-session-name-input');
    if (modal) modal.classList.toggle('open', open);
    if (backdrop) {
        backdrop.style.display = open ? 'block' : 'none';
        backdrop.style.opacity = open ? '1' : '0';
    }
    if (open && input) {
        input.value = '';
        input.focus();
    }
}

/**
 * Toggle the connection lost modal.
 */
export function toggleConnectionLostModal(open) {
    const modal = document.getElementById('connection-lost-modal');
    const backdrop = document.getElementById('bottom-sheet-backdrop');
    if (modal) modal.classList.toggle('open', open);
    if (backdrop) {
        backdrop.style.display = open ? 'block' : 'none';
        backdrop.style.opacity = open ? '1' : '0';
    }
}

// Track which tag is being colored
let pendingTagText = null;

/**
 * Render the tags list inside the tags modal.
 */
export function renderModalTags() {
    const list = document.getElementById('modal-tags-list');
    if (!list) return;
    list.setAttribute('role', 'list');
    list.innerHTML = '';
    tagManager.getTags().forEach((tagObj, index) => {
        const tag = tagObj.text;
        const color = tagObj.color || '';
        const item = document.createElement('div');
        item.className = 'modal-tag-item';
        item.setAttribute('role', 'listitem');

        const span = document.createElement('span');
        span.textContent = tag;
        if (color) {
            span.style.borderLeft = `3px solid ${color}`;
            span.style.paddingLeft = '8px';
        }
        item.appendChild(span);

        // Reorder buttons (up/down arrows)
        const reorderGroup = document.createElement('div');
        reorderGroup.className = 'tag-reorder-btns';

        const upBtn = document.createElement('button');
        upBtn.className = 'reorder-btn';
        upBtn.title = 'Move up';
        upBtn.setAttribute('aria-label', `Move ${tag} up`);
        upBtn.textContent = '↑';
        if (index === 0) upBtn.disabled = true;
        upBtn.onclick = () => {
            tagManager.moveTag(index, index - 1);
            renderModalTags();
            renderQuickTags();
        };
        reorderGroup.appendChild(upBtn);

        const downBtn = document.createElement('button');
        downBtn.className = 'reorder-btn';
        downBtn.title = 'Move down';
        downBtn.setAttribute('aria-label', `Move ${tag} down`);
        downBtn.textContent = '↓';
        if (index === tagManager.getTags().length - 1) downBtn.disabled = true;
        downBtn.onclick = () => {
            tagManager.moveTag(index, index + 1);
            renderModalTags();
            renderQuickTags();
        };
        reorderGroup.appendChild(downBtn);
        item.appendChild(reorderGroup);

        // Color picker button
        const colorBtn = document.createElement('button');
        colorBtn.className = 'tag-color-btn';
        colorBtn.title = 'Change color';
        colorBtn.setAttribute('aria-label', `Change color for tag: ${tag}`);
        if (color) {
            colorBtn.style.backgroundColor = color;
        } else {
            colorBtn.textContent = '×';
            colorBtn.style.fontSize = '14px';
            colorBtn.style.lineHeight = '1';
        }
        colorBtn.onclick = (e) => {
            e.stopPropagation();
            pendingTagText = tag;
            toggleTagColorModal(true);
        };
        item.appendChild(colorBtn);

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-tag-btn';
        deleteBtn.title = 'Delete tag';
        deleteBtn.setAttribute('aria-label', `Delete tag: ${tag}`);
        deleteBtn.textContent = '×';
        deleteBtn.onclick = () => {
            tagManager.removeTag(tag);
            renderModalTags();
            renderQuickTags();
        };
        item.appendChild(deleteBtn);
        list.appendChild(item);
    });
}

/**
 * Toggle the tag color picker modal.
 */
export function toggleTagColorModal(open) {
    const modal = document.getElementById('tag-color-picker');
    const backdrop = document.getElementById('bottom-sheet-backdrop');
    if (modal) modal.classList.toggle('open', open);
    if (backdrop) {
        backdrop.style.display = open ? 'block' : 'none';
        backdrop.style.opacity = open ? '1' : '0';
    }
    if (open) {
        // Highlight current color
        const currentTag = tagManager.getTags().find(t => t.text === pendingTagText);
        const currentColor = currentTag ? (currentTag.color || '') : '';
        document.querySelectorAll('#tag-color-options .sheet-color-opt').forEach(opt => {
            opt.classList.toggle('selected', opt.dataset.color === currentColor);
        });
    }
}

/**
 * Set the color for a pending tag.
 */
export function setTagColor(color) {
    if (pendingTagText) {
        tagManager.updateTagColor(pendingTagText, color);
        renderModalTags();
        renderQuickTags();
    }
    toggleTagColorModal(false);
    pendingTagText = null;
}

/**
 * Trigger export download for the current session.
 * @param {string} format - export format (reaper/audition/edl)
 * @param {string} [fps=''] - framerate for EDL
 * @param {string} [timezone=''] - 'local', 'server', or IANA timezone name
 */
export function exportFn(format = 'reaper', fps = '', timezone = '') {
    if (!state.currentSessionId) return;
    let url = `/api/sessions/${state.currentSessionId}/export?format=${format}`;
    if (fps) url += `&fps=${fps}`;
    if (timezone === 'local') {
        url += '&timezone=local';
        // Pass the client's IANA timezone
        try {
            const clientTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
            url += `&clientTimezone=${encodeURIComponent(clientTz)}`;
        } catch {
            url += '&clientTimezone=UTC';
        }
    } else if (timezone === 'server') {
        url += `&timezone=${encodeURIComponent(state.exportTimezone)}`;
    } else if (timezone) {
        url += `&timezone=${encodeURIComponent(timezone)}`;
    }
    if (window.guestToken) url += `&token=${window.guestToken}`;
    window.location.href = url;
}

/**
 * Start the export flow: if clock mode, show timezone modal; otherwise export directly.
 * @param {string} format - export format
 * @param {string} [fps=''] - framerate for EDL
 */
export function startExport(format, fps = '') {
    if (!state.currentSessionId) return;
    const session = state.currentSession;
    const isClockMode = session && session.timestamp_mode === 'clock';

    if (isClockMode) {
        // Store fps for later use (EDL flow: FPS modal -> timezone modal)
        if (fps) state.pendingExportFps = fps;
        toggleTimezoneModal(true, format);
    } else {
        // Timer mode: export directly, no timezone needed
        exportFn(format, fps);
        toggleFpsModal(false);
    }
}

/**
 * Toggle dark/light theme.
 */
export function themeToggleFn(isDark) {
    const sunPath = '<path d="M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zM2 13h2c.55 0 1-.45 1-1s-.45-1-1-1H2c-.55 0-1 .45-1 1s.45 1 1 1zm18 0h2c.55 0 1-.45 1-1s-.45-1-1-1h-2c-.55 0-1 .45-1 1s.45 1 1 1zM11 2v2c0 .55.45 1 1 1s1-.45 1-1V2c0-.55-.45-1-1-1s-1 .45-1 1zm0 18v2c0 .55.45 1 1 1s1-.45 1-1v-2c0-.55-.45-1-1-1s-1 .45-1 1zM5.99 4.58c-.39-.39-1.03-.39-1.41 0s-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0s.39-1.03 0-1.41L5.99 4.58zm12.37 12.37c-.39-.39-1.03-.39-1.41 0s-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0s.39-1.03 0-1.41l-1.06-1.06zm1.06-12.37c-.39-.39-1.03-.39-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06c.39-.39.39 1.03 0-1.41zm-12.37 12.37c-.39-.39-1.03-.39-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06c.39-.39.39 1.03 0-1.41zm-12.37 12.37c-.39-.39-1.03-.39-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06c.39-.39.39 1.03 0-1.41z"/>';
    const moonPath = '<path d="M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9 9-4.03 9-9c0-.46-.04-.92-.1-1.36-.98 1.37-2.58 2.26-4.4 2.26-3.03 0-5.5-2.47-5.5-5.5 0-1.82.89-3.42 2.26-4.4-.44-.06-.9-.1-1.36-.1z"/>';

    document.documentElement.classList.toggle('dark-mode', isDark);
    document.body.classList.toggle('dark-mode', isDark);
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    const criticalStyle = document.getElementById('dark-mode-critical');
    if (criticalStyle) criticalStyle.disabled = !isDark;
    const path = isDark ? sunPath : moonPath;
    const desktopIcon = document.getElementById('theme-icon');
    const mobileIcon = document.getElementById('mobile-theme-icon');
    if (desktopIcon) desktopIcon.innerHTML = path;
    if (mobileIcon) mobileIcon.innerHTML = path;
}
