import { state } from './state.js';
import { socket } from './socket.js';
import { updateSessionMenuVisibility } from './timer.js';

/**
 * Render the recent sessions list (mobile welcome area).
 */
export function renderRecentSessions(sessions) {
    const container = document.getElementById('recent-sessions-list');
    const emptyMsg = document.getElementById('empty-state-message');
    const newSessionBtn = document.getElementById('new-session-btn-empty');
    const welcomeMsg = document.getElementById('welcome-message');
    if (!container) return;

    // Hide recent sessions list, button, and welcome when a session is selected
    if (state.currentSessionId) {
        container.classList.add('hidden');
        if (emptyMsg) emptyMsg.classList.add('hidden');
        if (newSessionBtn) newSessionBtn.classList.add('hidden');
        if (welcomeMsg) welcomeMsg.classList.add('hidden');
        return;
    }

    // Only show recent sessions list and button on mobile
    const isMobile = window.innerWidth <= 768;
    if (isMobile && welcomeMsg) welcomeMsg.classList.remove('hidden');

    // Update empty state message and button based on whether sessions exist
    if (sessions.length === 0) {
        if (emptyMsg) {
            emptyMsg.textContent = 'Create a session to start taking notes.';
            if (isMobile) emptyMsg.classList.remove('hidden');
            else emptyMsg.classList.add('hidden');
        }
        if (newSessionBtn && isMobile) {
            newSessionBtn.classList.remove('hidden');
        } else if (newSessionBtn) {
            newSessionBtn.classList.add('hidden');
        }
        container.classList.add('hidden');
        container.innerHTML = '';
        return;
    }

    // Sessions exist
    if (emptyMsg) {
        emptyMsg.textContent = 'Select a session to start taking notes.';
        if (isMobile) emptyMsg.classList.remove('hidden');
        else emptyMsg.classList.add('hidden');
    }
    if (newSessionBtn) newSessionBtn.classList.add('hidden');

    // Sort: recording first, then by created_at DESC
    const sorted = [...sessions].sort((a, b) => {
        const aRecording = a.started_at && !a.stopped_at;
        const bRecording = b.started_at && !b.stopped_at;
        if (aRecording && !bRecording) return -1;
        if (!aRecording && bRecording) return 1;
        return new Date(b.created_at) - new Date(a.created_at);
    });

    // Limit to 10
    const recent = sorted.slice(0, 10);

    if (recent.length === 0) {
        container.classList.add('hidden');
        container.innerHTML = '';
        return;
    }

    container.classList.remove('hidden');
    container.innerHTML = '';

    recent.forEach(session => {
        const item = document.createElement('div');
        item.className = 'recent-session-item';
        item.setAttribute('role', 'button');
        item.setAttribute('tabindex', '0');
        item.setAttribute('aria-label', `Open session: ${session.name}`);
        item.onclick = () => selectSession(session.id);

        // Time (left)
        const timeSpan = document.createElement('span');
        timeSpan.className = 'recent-session-time';
        const createdDate = new Date(session.created_at);
        const now = new Date();
        const isToday = createdDate.toDateString() === now.toDateString();
        if (isToday) {
            const hrs = createdDate.getHours();
            const mins = createdDate.getMinutes().toString().padStart(2, '0');
            timeSpan.textContent = `${hrs}:${mins}`;
        } else {
            timeSpan.textContent = createdDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
        }
        item.appendChild(timeSpan);

        // Name (center, flex-grow with ellipsis)
        const nameSpan = document.createElement('span');
        nameSpan.className = 'recent-session-name';
        nameSpan.textContent = session.name;
        item.appendChild(nameSpan);

        // Indicators (right: recording dot + user count)
        const indicators = document.createElement('div');
        indicators.className = 'recent-session-indicators';

        const isRecording = session.started_at && !session.stopped_at;
        if (isRecording) {
            const dot = document.createElement('span');
            dot.className = 'recording-dot';
            dot.setAttribute('role', 'status');
            dot.setAttribute('aria-label', 'Recording active');
            indicators.appendChild(dot);
        }

        if (session.active_users > 0) {
            const userCount = document.createElement('span');
            userCount.className = 'recent-user-count';
            userCount.setAttribute('role', 'status');
            userCount.setAttribute('aria-label', `${session.active_users} users connected`);
            userCount.innerHTML = `
                <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor" aria-hidden="true">
                    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                </svg>
                ${session.active_users}
            `;
            indicators.appendChild(userCount);
        }

        item.appendChild(indicators);
        container.appendChild(item);
    });
}

/**
 * Render the full session list in the sidebar.
 */
export function renderSessionList(sessions) {
    const list = document.getElementById('session-list');
    if (!list) return;

    // Apply search filter (case-insensitive, name only)
    let filtered = sessions;
    if (state.sessionSearchFilter) {
        const q = state.sessionSearchFilter.toLowerCase();
        filtered = sessions.filter(s => s.name.toLowerCase().includes(q));
    }

    // Prioritized Sorting:
    // 1. Recording (started_at && !stopped_at)
    // 2. Creation date (DESC)
    const sortedSessions = [...filtered].sort((a, b) => {
        const aRecording = a.started_at && !a.stopped_at;
        const bRecording = b.started_at && !b.stopped_at;
        if (aRecording && !bRecording) return -1;
        if (!aRecording && bRecording) return 1;

        // Fallback to creation date DESC
        return new Date(b.created_at) - new Date(a.created_at);
    });

    list.setAttribute('role', 'list');
    list.innerHTML = '';

    if (sortedSessions.length === 0 && state.sessionSearchFilter) {
        const noResults = document.createElement('div');
        noResults.className = 'empty-state';
        noResults.textContent = 'No matching sessions';
        list.appendChild(noResults);
        return;
    }

    sortedSessions.forEach(session => {
        const item = document.createElement('div');
        item.className = 'session-item';
        item.setAttribute('role', 'listitem');
        item.setAttribute('tabindex', '0');
        if (session.id.toString() === state.currentSessionId?.toString()) {
            item.classList.add('active');
            item.setAttribute('aria-current', 'true');
            // Use setTimeout to ensure the DOM has updated before scrolling
            setTimeout(() => item.scrollIntoView({ block: 'nearest' }), 0);
        }

        const nameSpan = document.createElement('span');
        nameSpan.className = 'session-name';
        nameSpan.textContent = session.name;
        nameSpan.setAttribute('role', 'button');
        nameSpan.setAttribute('tabindex', '0');
        nameSpan.setAttribute('aria-label', `Open session: ${session.name}`);
        nameSpan.onclick = () => selectSession(session.id);
        item.appendChild(nameSpan);

        const indicators = document.createElement('div');
        indicators.className = 'session-indicators';

        if (session.started_at && !session.stopped_at) {
            indicators.innerHTML += `<span class="recording-dot" role="status" aria-label="Recording active"></span>`;
        }

        if (session.active_users > 0) {
            indicators.innerHTML += `
                <span class="user-count" role="status" aria-label="${session.active_users} users connected">
                    <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor" aria-hidden="true">
                        <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                    </svg>
                    ${session.active_users}
                </span>
            `;
        }
        item.appendChild(indicators);

        const actions = document.createElement('div');
        actions.className = 'session-actions';
        actions.innerHTML = `
            <button class="sess-edit-btn" title="Rename" aria-label="Rename session">✎</button>
            <button class="sess-delete-btn" title="Delete" aria-label="Delete session">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <polyline points="3 6 5 3 19 3 21 6"></polyline>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                </svg>
            </button>
        `;

        actions.querySelector('.sess-edit-btn').onclick = (e) => {
            e.stopPropagation();
            renameSession(session.id, session.name);
        };

        actions.querySelector('.sess-delete-btn').onclick = (e) => {
            e.stopPropagation();
            deleteSession(session.id);
        };

        item.appendChild(actions);
        list.appendChild(item);
    });
}

/**
 * Rename a session via WebSocket.
 */
export async function renameSession(id, oldName) {
    const newName = prompt('Enter new session name:', oldName);
    if (!newName || newName === oldName) return;

    socket.send('UPDATE_SESSION', { sessionId: id, name: newName });
}

/**
 * Delete a session via WebSocket.
 */
export async function deleteSession(id) {
    if (!confirm('Are you sure you want to delete this session and all its notes? This cannot be undone.')) return;

    socket.send('DELETE_SESSION', { sessionId: id });

    if (state.currentSessionId?.toString() === id.toString()) {
        state.currentSessionId = null;
        state.currentSession = null;
        window.location.hash = '';
        document.getElementById('note-stream').innerHTML = '<div class="empty-state">Select a session to start taking notes.</div>';
        document.getElementById('input-area').style.display = 'none';
        const exportBtn = document.getElementById('export-btn');
        if (exportBtn) exportBtn.disabled = true;
        const mobileExportBtn = document.getElementById('mobile-export-btn');
        if (mobileExportBtn) mobileExportBtn.disabled = true;
        const headerTitle = document.getElementById('header-session-title');
        if (headerTitle && headerTitle.textContent !== "") headerTitle.textContent = "";
        updateSessionMenuVisibility();
        renderRecentSessions(window.lastSessions || []);
    }
}

/**
 * Select a session: update state, hash, join WebSocket room.
 * Note: renderQuickTags and closeSidebarFn are called here but defined elsewhere.
 * They're invoked via function references passed at init time to avoid circular deps.
 */
export async function selectSession(id, { renderQuickTags, closeSidebarFn } = {}) {
    state.currentSessionId = id;
    window.location.hash = `#/session/${id}`;
    renderSessionList(window.lastSessions || []);
    renderRecentSessions([]); // Hide recent sessions when one is selected

    const stream = document.getElementById('note-stream');
    if (stream) stream.innerHTML = '';

    if (renderQuickTags) renderQuickTags();

    // Join the WebSocket room for this session (this now triggers SESSION_DATA push)
    socket.send('JOIN_SESSION', { sessionId: id });

    if (closeSidebarFn) closeSidebarFn();
}
