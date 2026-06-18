import { state } from './state.js';
import { socket } from './socket.js';
import { tagManager } from './tags.js';
import { renderNotes, renderQuickTags, sendNote, captureDraftTimestamp, updateDraftDisplay } from './notes.js';
import { updateClock, updateTimerMenuVisibility, updateSessionMenuVisibility, startTimer, stopTimer, resetTimer } from './timer.js';
import { renderSessionList, renderRecentSessions, selectSession } from './sessions.js';
import {
    closeSidebarFn,
    toggleColorPicker,
    updateColorSelection,
    toggleOverflow,
    toggleExportMenu,
    toggleFpsModal,
    toggleTagsModal,
    toggleShareLinkModal,
    toggleNewSessionModal,
    renderModalTags,
    exportFn,
    themeToggleFn
} from './ui.js';

/**
 * Bind all DOM event listeners.
 * Call this once during initialization after the DOM is ready.
 */
export function bindDomEvents() {
    // Color picker buttons
    document.querySelectorAll('.color-opt').forEach(opt => opt.onclick = () => updateColorSelection(opt.dataset.color));
    document.querySelectorAll('.sheet-color-opt').forEach(opt => opt.onclick = () => { updateColorSelection(opt.dataset.color); toggleColorPicker(false); });

    const mobileColorToggle = document.getElementById('mobile-color-toggle');
    if (mobileColorToggle) {
        mobileColorToggle.onclick = () => {
            const popup = document.getElementById('color-picker-popup');
            const isOpen = !popup.classList.contains('open');
            toggleColorPicker(isOpen);
            mobileColorToggle.setAttribute('aria-expanded', isOpen.toString());
        };
    }

    // Backdrop closes all modals/sidebar
    const backdrop = document.getElementById('bottom-sheet-backdrop');
    if (backdrop) {
        backdrop.onclick = () => {
            closeSidebarFn();
            toggleFpsModal(false);
            toggleTagsModal(false);
            toggleShareLinkModal(false);
            toggleNewSessionModal(false);
        };
    }

    // Quick tags toggle
    const quickTagsToggle = document.getElementById('quick-tags-toggle');
    const inputArea = document.getElementById('input-area');
    if (quickTagsToggle && inputArea) {
        quickTagsToggle.addEventListener('click', () => {
            inputArea.classList.toggle('show-quicktags');
        });
    }

    // Esc key closes all open modals, menus, popups, and sidebar
    document.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape') return;

        // Clear search filter on Esc
        const searchInput = document.getElementById('session-search');
        if (searchInput && document.activeElement === searchInput && state.sessionSearchFilter) {
            state.sessionSearchFilter = '';
            searchInput.value = '';
            renderSessionList(window.lastSessions || []);
            return;
        }

        // Don't intercept Esc inside inputs/textarea (e.g. edit area handles its own Esc)
        if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;

        closeSidebarFn();
        toggleFpsModal(false);
        toggleTagsModal(false);
        toggleShareLinkModal(false);
        toggleNewSessionModal(false);
        toggleOverflow(false);
        toggleExportMenu(false);
        toggleColorPicker(false);

        // Close timer warning modal
        const timerModal = document.getElementById('timer-warning-modal');
        if (timerModal) {
            timerModal.style.display = 'none';
            timerModal.setAttribute('aria-hidden', 'true');
        }

        // Close quick tags bar
        const qa = document.getElementById('input-area');
        if (qa) qa.classList.remove('show-quicktags');
    });

    // Close menus if clicking anywhere else
    document.addEventListener('click', (e) => {
        const overflowMenu = document.getElementById('overflow-menu');
        const overflowToggle = document.getElementById('overflow-menu-toggle');
        if (overflowMenu && overflowMenu.classList.contains('open') && !overflowMenu.contains(e.target) && !overflowToggle.contains(e.target)) {
            toggleOverflow(false);
        }

        const colorPopup = document.getElementById('color-picker-popup');
        const colorToggle = document.getElementById('mobile-color-toggle');
        if (colorPopup && colorPopup.classList.contains('open') && !colorPopup.contains(e.target) && !colorToggle.contains(e.target)) {
            toggleColorPicker(false);
        }

        const exportMenu = document.getElementById('export-menu');
        const exportBtn = document.getElementById('export-btn');
        if (exportMenu && exportMenu.classList.contains('open') && !exportMenu.contains(e.target) && !exportBtn.contains(e.target)) {
            toggleExportMenu(false);
        }

        const tagsModal = document.getElementById('tags-modal');
        const menuEditTags = document.getElementById('menu-edit-tags');
        if (tagsModal && tagsModal.classList.contains('open') && !tagsModal.contains(e.target) && !menuEditTags.contains(e.target)) {
            toggleTagsModal(false);
        }
    });

    // New session buttons
    const handleNewSession = () => {
        closeSidebarFn();
        toggleNewSessionModal(true);
    };

    const newSessionBtn = document.getElementById('new-session-btn');
    if (newSessionBtn) newSessionBtn.onclick = handleNewSession;

    const newSessionBtnMobile = document.getElementById('new-session-btn-mobile');
    if (newSessionBtnMobile) newSessionBtnMobile.onclick = handleNewSession;

    const newSessionBtnEmpty = document.getElementById('new-session-btn-empty');
    if (newSessionBtnEmpty) newSessionBtnEmpty.onclick = handleNewSession;

    // Send note button
    const sendNoteBtn = document.getElementById('send-note-btn');
    if (sendNoteBtn) sendNoteBtn.onclick = sendNote;

    // Note input
    const noteInput = document.getElementById('note-input');
    if (noteInput) {
        noteInput.onkeypress = (e) => {
            if (e.key === 'Enter') {
                sendNote();
            }
        };
        noteInput.oninput = (e) => {
            if (e.target.value.length > 0) {
                if (state.draftResetTimeout) { clearTimeout(state.draftResetTimeout); state.draftResetTimeout = null; }
                captureDraftTimestamp();
            } else if (!state.draftResetTimeout) {
                state.draftResetTimeout = setTimeout(() => { state.activeDraftTimestamp = null; state.draftResetTimeout = null; updateDraftDisplay(); }, 500);
            }
        };
    }

    // Sidebar open
    const sidebarOpen = document.getElementById('sidebar-open');
    if (sidebarOpen) {
        sidebarOpen.onclick = () => {
            const sidebar = document.getElementById('sidebar');
            const backdrop = document.getElementById('bottom-sheet-backdrop');
            if (sidebar) sidebar.classList.add('open');
            if (backdrop) {
                backdrop.classList.add('open');
                backdrop.style.display = 'block';
                backdrop.style.opacity = '1';
            }
        };
    }

    // Close sidebar button
    const closeSidebarBtn = document.getElementById('close-sidebar');
    if (closeSidebarBtn) closeSidebarBtn.onclick = closeSidebarFn;

    // Manage sessions toggle
    const manageSessionsBtn = document.getElementById('manage-sessions-btn');
    if (manageSessionsBtn) {
        manageSessionsBtn.onclick = () => {
            const sidebar = document.getElementById('sidebar');
            const isManaging = sidebar.classList.toggle('managing');
            manageSessionsBtn.classList.toggle('active', isManaging);
            manageSessionsBtn.textContent = isManaging ? 'Done' : '✎ Edit';
        };
    }

    // Session search
    const sessionSearch = document.getElementById('session-search');
    if (sessionSearch) {
        sessionSearch.oninput = (e) => {
            state.sessionSearchFilter = e.target.value.trim();
            renderSessionList(window.lastSessions || []);
        };
    }

    // Overflow menu toggle
    const overflowMenuToggle = document.getElementById('overflow-menu-toggle');
    if (overflowMenuToggle) {
        overflowMenuToggle.onclick = () => {
            const menu = document.getElementById('overflow-menu');
            const isOpen = !menu.classList.contains('open');
            toggleOverflow(isOpen);
            overflowMenuToggle.setAttribute('aria-expanded', isOpen.toString());
        };
    }

    // Theme toggle (in overflow menu)
    const menuThemeToggle = document.getElementById('menu-theme-toggle');
    if (menuThemeToggle) {
        menuThemeToggle.onclick = () => { themeToggleFn(!document.body.classList.contains('dark-mode')); toggleOverflow(false); };
    }

    // Logout
    const menuLogout = document.getElementById('menu-logout');
    if (menuLogout) {
        menuLogout.onclick = () => {
            if (confirm('Are you sure you want to logout?')) {
                toggleOverflow(false);
                window.location.href = '/logout';
            }
        };
    }

    // Export menu items (in overflow menu)
    const menuExportReaper = document.getElementById('menu-export-reaper');
    if (menuExportReaper) {
        menuExportReaper.onclick = () => { exportFn('reaper'); toggleOverflow(false); };
    }

    const menuExportAudition = document.getElementById('menu-export-audition');
    if (menuExportAudition) {
        menuExportAudition.onclick = () => { exportFn('audition'); toggleOverflow(false); };
    }

    const menuExportEdl = document.getElementById('menu-export-edl');
    if (menuExportEdl) {
        menuExportEdl.onclick = () => {
            toggleOverflow(false);
            toggleFpsModal(true);
        };
    }

    // Share link
    const menuShareLink = document.getElementById('menu-share-link');
    if (menuShareLink) {
        menuShareLink.onclick = async () => {
            if (!state.currentSessionId) return;
            try {
                toggleOverflow(false);
                const res = await fetch(`/api/sessions/${state.currentSessionId}/guest-token`, { method: 'POST' });
                const { token } = await res.json();
                const guestUrl = `${window.location.origin}/?token=${token}#\/guest\/${token}`;
                await navigator.clipboard.writeText(guestUrl);
                toggleShareLinkModal(true, guestUrl);
            } catch (e) {
                console.error('Error sharing guest link:', e);
                alert('Failed to generate guest link.');
            }
        };
    }

    // Timer menu handlers
    const menuTimerStart = document.getElementById('menu-timer-start');
    if (menuTimerStart) {
        menuTimerStart.onclick = () => { startTimer(); toggleOverflow(false); };
    }

    const menuTimerStop = document.getElementById('menu-timer-stop');
    if (menuTimerStop) {
        menuTimerStop.onclick = () => { stopTimer(); toggleOverflow(false); };
    }

    const menuTimerReset = document.getElementById('menu-timer-reset');
    if (menuTimerReset) {
        menuTimerReset.onclick = () => { resetTimer(); toggleOverflow(false); };
    }

    // Timer warning modal dismiss
    const timerWarningOk = document.getElementById('timer-warning-ok');
    if (timerWarningOk) {
        timerWarningOk.onclick = () => {
            const modal = document.getElementById('timer-warning-modal');
            const backdrop = document.getElementById('bottom-sheet-backdrop');
            if (modal) {
                modal.style.display = 'none';
                modal.setAttribute('aria-hidden', 'true');
            }
            if (backdrop) {
                backdrop.style.display = 'none';
                backdrop.style.opacity = '0';
            }
        };
    }

    // Export button (desktop)
    const exportBtn = document.getElementById('export-btn');
    if (exportBtn) {
        exportBtn.onclick = (e) => {
            e.stopPropagation();
            const menu = document.getElementById('export-menu');
            toggleExportMenu(!menu.classList.contains('open'));
        };
    }

    // Export menu items
    document.querySelectorAll('#export-menu .menu-item').forEach(item => {
        item.onclick = (e) => {
            e.stopPropagation();
            const format = item.dataset.format;
            if (format === 'edl') {
                toggleFpsModal(true);
            } else {
                exportFn(format);
            }
            toggleExportMenu(false);
        };
    });

    // FPS options
    document.querySelectorAll('.fps-opt').forEach(btn => {
        btn.onclick = () => {
            const fps = btn.dataset.fps;
            localStorage.setItem('last_edl_fps', fps);
            exportFn('edl', fps);
            toggleFpsModal(false);
        };
    });

    // Cancel FPS
    const cancelFps = document.getElementById('cancel-fps');
    if (cancelFps) cancelFps.onclick = () => toggleFpsModal(false);

    // Tags modal buttons
    const menuEditTags = document.getElementById('menu-edit-tags');
    if (menuEditTags) {
        menuEditTags.onclick = () => {
            toggleTagsModal(true);
            toggleOverflow(false);
        };
    }

    const closeTagsModalBtn = document.getElementById('close-tags-modal');
    if (closeTagsModalBtn) closeTagsModalBtn.onclick = () => toggleTagsModal(false);

    // Share link modal
    const closeShareModalBtn = document.getElementById('close-share-modal');
    if (closeShareModalBtn) closeShareModalBtn.onclick = () => toggleShareLinkModal(false);

    // Create session button
    const createSessionBtn = document.getElementById('create-session-btn');
    if (createSessionBtn) {
        createSessionBtn.onclick = () => {
            const input = document.getElementById('new-session-name-input');
            const name = input?.value.trim();
            if (name) {
                socket.send('CREATE_SESSION', { name });
                toggleNewSessionModal(false);
            }
        };
    }

    // Cancel new session
    const cancelNewSessionBtn = document.getElementById('cancel-new-session-btn');
    if (cancelNewSessionBtn) cancelNewSessionBtn.onclick = () => toggleNewSessionModal(false);

    // Allow Enter key in the session name input to create
    const newSessionNameInput = document.getElementById('new-session-name-input');
    if (newSessionNameInput) {
        newSessionNameInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                createSessionBtn?.click();
            }
        });
    }

    // Share link URL input (click to copy)
    const shareLinkUrlInput = document.getElementById('share-link-url');
    if (shareLinkUrlInput) {
        shareLinkUrlInput.onclick = async () => {
            try {
                await navigator.clipboard.writeText(shareLinkUrlInput.value);
                shareLinkUrlInput.title = 'Copied!';
                setTimeout(() => { shareLinkUrlInput.title = 'Click to copy'; }, 1500);
            } catch (_) { /* silent */ }
        };
    }

    // Add tag button
    const addTagBtn = document.getElementById('add-tag-btn');
    const newTagInput = document.getElementById('new-tag-input');
    if (addTagBtn && newTagInput) {
        addTagBtn.onclick = () => {
            const val = newTagInput.value.trim();
            if (val && tagManager.addTag(val)) {
                newTagInput.value = '';
                renderModalTags();
                renderQuickTags();
            }
        };
        newTagInput.onkeypress = (e) => {
            if (e.key === 'Enter') addTagBtn.click();
        };
    }

    // Theme initialization (read from localStorage)
    themeToggleFn(localStorage.getItem('theme') === 'dark');

    // Hash change listener
    window.addEventListener('hashchange', () => {
        const guestMatch = window.location.hash.match(/#\/guest\/([a-zA-Z0-9-]+)/);
        const sessionMatch = window.location.hash.match(/#\/session\/(\d+)/);

        // If navigating away from a guest token URL, reset guest mode flags
        // so WebSocket reconnects send sessionId instead of guestToken.
        if (!guestMatch && !window.location.search.includes('token=')) {
            window.isGuestMode = false;
            window.guestToken = null;
        }

        if (sessionMatch && sessionMatch[1] !== state.currentSessionId?.toString()) {
            selectSession(sessionMatch[1], { renderQuickTags, closeSidebarFn });
        }
    });
}