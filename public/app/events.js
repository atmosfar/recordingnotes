import { state } from './state.js';
import { socket } from './socket.js';
import { renderNotes, renderQuickTags } from './notes.js';
import { updateClock, updateTimerMenuVisibility, updateSessionMenuVisibility } from './timer.js';
import { renderSessionList, renderRecentSessions, selectSession } from './sessions.js';
import { toggleExportMenu, closeSidebarFn } from './ui.js';

/**
 * Register all WebSocket event handlers.
 * Call this once during initialization.
 */
export function registerSocketListeners() {
    socket.on('SESSION_DATA', (data) => {
        const { session, notes } = data;

        document.body.classList.remove('session-not-found');
        // Hide connecting message
        const connectingMsg = document.getElementById('connecting-message');
        if (connectingMsg) connectingMsg.style.display = 'none';
        state.currentSession = session;
        state.currentSessionId = session.id;

        // Sync clientRunStart if timer is already running (page load/reconnect)
        if (session.timestamp_mode === 'timer' && session.started_at && !session.stopped_at) {
            state.clientRunStart = new Date(session.started_at).getTime();
        } else {
            state.clientRunStart = null;
        }

        const headerTitle = document.getElementById('header-session-title');
        if (headerTitle && headerTitle.textContent !== state.currentSession.name) headerTitle.textContent = state.currentSession.name;

        document.getElementById('input-area').style.display = 'block';

        updateSessionMenuVisibility();

        const menuEditTags = document.getElementById('menu-edit-tags');
        if (menuEditTags) {
            menuEditTags.style.display = 'flex';
        }

        const menuLogout = document.getElementById('menu-logout');
        if (menuLogout) {
            menuLogout.style.display = window.isGuestMode ? 'none' : 'flex';
        }

        renderQuickTags();
        renderNotes(notes);
        updateClock();
        updateTimerMenuVisibility();
        renderRecentSessions([]);
    });

    socket.on('ERROR', (data) => {
        if (data.code === 404) {
            console.error('Session not found error from server');
            state.currentSessionId = null;
            state.currentSession = null;
            state.clientRunStart = null;
            document.body.classList.add('session-not-found');
            document.body.classList.add('recording');
            document.getElementById('note-stream').innerHTML = '<div class="empty-state">Session not found.</div>';
            updateSessionMenuVisibility();

            const headerTitle = document.getElementById('header-session-title');
            if (headerTitle && headerTitle.textContent !== "") headerTitle.textContent = "";
            const infoEl = document.getElementById('session-info');
            if (infoEl) infoEl.textContent = "No Session";
            updateTimerMenuVisibility();
            renderRecentSessions(window.lastSessions || []);
        }
    });

    socket.on('SESSION_LIST_UPDATE', (data) => {
        if (data.sessions) {
            window.lastSessions = data.sessions;
            renderSessionList(data.sessions);
            renderRecentSessions(data.sessions);

            // Sync current session metadata if active
            if (state.currentSessionId) {
                const updated = data.sessions.find(s => s.id.toString() === state.currentSessionId.toString());
                if (updated) {
                    state.currentSession = updated;
                    if (updated.timestamp_mode === 'timer' && updated.started_at && !updated.stopped_at) {
                        if (!state.clientRunStart) {
                            state.clientRunStart = new Date(updated.started_at).getTime();
                        }
                    } else {
                        state.clientRunStart = null;
                    }
                    const headerTitle = document.getElementById('header-session-title');
                    if (headerTitle && headerTitle.textContent !== updated.name) {
                        headerTitle.textContent = updated.name;
                    }
                    updateClock();
                    updateTimerMenuVisibility();
                } else {
                    // It was deleted (should be handled by SESSION_DELETED but as a fallback)
                    state.currentSession = null;
                    state.currentSessionId = null;
                    state.clientRunStart = null;
                    const headerTitle = document.getElementById('header-session-title');
                    if (headerTitle && headerTitle.textContent !== "") headerTitle.textContent = "";
                    updateSessionMenuVisibility();
                }
            }
        }
    });

    socket.on('SESSION_DELETED', (data) => {
        if (state.currentSessionId?.toString() === data.sessionId.toString()) {
            state.currentSessionId = null;
            state.currentSession = null;
            state.clientRunStart = null;
            window.location.hash = '';
            const stream = document.getElementById('note-stream');
            if (stream) stream.innerHTML = '<div class="empty-state">This session has been deleted.</div>';
            const inputArea = document.getElementById('input-area');
            if (inputArea) inputArea.style.display = 'none';
            toggleExportMenu(false);

            updateSessionMenuVisibility();

            const headerTitle = document.getElementById('header-session-title');
            if (headerTitle && headerTitle.textContent !== "") headerTitle.textContent = "";
            updateTimerMenuVisibility();
            renderRecentSessions(window.lastSessions || []);
        }
    });

    socket.on('NOTE_UPDATE', (data) => {
        if (data.sessionId.toString() === state.currentSessionId?.toString()) {
            console.log('Notes updated via WebSocket');
            if (data.notes) {
                renderNotes(data.notes);
            }
        }
    });

    socket.on('NOTE_DELETED', (data) => {
        if (data.sessionId?.toString() !== state.currentSessionId?.toString()) return;
        console.log('Note deleted via WebSocket:', data.noteId);
        const noteEl = document.querySelector(`.note[data-note-id="${data.noteId}"]`);
        if (noteEl) {
            noteEl.remove();
            const stream = document.getElementById('note-stream');
            if (stream && stream.querySelectorAll('.note').length === 0) {
                stream.innerHTML = '<div class="empty-state">No notes yet.</div>';
            }
        }
    });

    socket.on('SESSION_STATUS_UPDATE', (data) => {
        if (data.sessionId.toString() === state.currentSessionId?.toString()) {
            console.log('Session status updated via WebSocket');
            state.currentSession.status = data.status;
            if (data.status === 'active') {
                state.currentSession.stopped_at = null;
            } else if (data.status === 'completed') {
                // stopped_at will be set correctly by SESSION_UPDATE
            }
            updateClock();
            updateTimerMenuVisibility();
        }
    });

    socket.on('SESSION_UPDATE', (data) => {
        if (data.session.id.toString() === state.currentSessionId?.toString()) {
            state.currentSession = data.session;
            // Only set clientRunStart from server if we don't already have one
            // (i.e., timer was started by another client, not us)
            if (data.session.timestamp_mode === 'timer' && data.session.started_at && !data.session.stopped_at) {
                if (!state.clientRunStart) {
                    // Timer started elsewhere; approximate so display isn't wrong
                    const serverStart = new Date(data.session.started_at).getTime();
                    state.clientRunStart = serverStart;
                }
                // If clientRunStart is already set, keep it (we started the timer here)
            } else {
                state.clientRunStart = null;
            }
            updateClock();
            updateTimerMenuVisibility();
        }
    });

    socket.on('SESSION_CREATED', (data) => {
        // Auto-select if we created it in this tab
        selectSession(data.id, { renderQuickTags, closeSidebarFn });
    });
}
