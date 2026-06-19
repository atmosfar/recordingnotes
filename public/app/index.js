import { state } from './state.js';
import { socket } from './socket.js';
import { tagManager } from './tags.js';
import { renderNotes, renderQuickTags } from './notes.js';
import { updateClock, updateTimerMenuVisibility, updateSessionMenuVisibility } from './timer.js';
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
import { registerSocketListeners } from './events.js';
import { bindDomEvents } from './dom.js';

/**
 * Main entry point for the modular application.
 * Replaces the monolithic `app.js`.
 */
async function init() {
    const urlParams = new URLSearchParams(window.location.search);
    const queryToken = urlParams.get('token');
    const guestMatch = window.location.hash.match(/#\/guest\/([a-zA-Z0-9-]+)/);
    const sessionMatch = window.location.hash.match(/#\/session\/(\d+)/);

    const effectiveGuestToken = guestMatch ? guestMatch[1] : queryToken;

    if (effectiveGuestToken) {
        window.isGuestMode = true;
        window.guestToken = effectiveGuestToken;
        document.body.classList.add('guest-mode');
        // Hide welcome message immediately — it has no place in guest mode
        const welcomeMsg = document.getElementById('welcome-message');
        if (welcomeMsg) welcomeMsg.remove();
        // Show connecting message while waiting for WebSocket
        const connectingMsg = document.getElementById('connecting-message');
        if (connectingMsg) connectingMsg.style.display = 'block';
    } else if (sessionMatch) {
        state.currentSessionId = sessionMatch[1];
        // Show connecting message while waiting for WebSocket
        const connectingMsg = document.getElementById('connecting-message');
        if (connectingMsg) connectingMsg.style.display = 'block';
        // Wait for WebSocket to be ready before joining to avoid dropped messages
        socket.ready.then(() => selectSession(sessionMatch[1], { renderQuickTags, closeSidebarFn }));
    }

    // Fetch sessions via REST API for immediate display (mobile recent sessions)
    // WebSocket will update the list once connected
    if (!window.isGuestMode) {
        fetch('/api/sessions')
            .then(res => res.json())
            .then(sessions => {
                window.lastSessions = sessions;
                renderSessionList(sessions);
                renderRecentSessions(sessions);
            })
            .catch(err => console.error('Failed to fetch sessions:', err));
    }

    // Register all WebSocket event handlers
    registerSocketListeners();

    // Bind all DOM event listeners
    bindDomEvents();
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
