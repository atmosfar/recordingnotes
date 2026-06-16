let currentSessionId = null;
let currentSession = null;
let selectedColor = "";
let activeDraftTimestamp = null;
let draftResetTimeout = null;
let lastManualNoteContent = null;

class TagManager {
    constructor() {
        this.defaultTags = ['x Cut', '! Important', '< Retake', '? Question'];
        this.tags = this.loadTags();
    }

    loadTags() {
        const stored = localStorage.getItem('quick_tags');
        if (stored) {
            try {
                return JSON.parse(stored);
            } catch (e) {
                return this.defaultTags;
            }
        }
        return this.defaultTags;
    }

    saveTags() {
        localStorage.setItem('quick_tags', JSON.stringify(this.tags));
    }

    addTag(text) {
        const trimmed = text.trim();
        if (trimmed && !this.tags.includes(trimmed)) {
            this.tags.push(trimmed);
            this.saveTags();
            return true;
        }
        return false;
    }

    removeTag(text) {
        const index = this.tags.indexOf(text);
        if (index !== -1) {
            this.tags.splice(index, 1);
            this.saveTags();
            return true;
        }
        return false;
    }

    getTags() {
        return this.tags;
    }
}

const tagManager = new TagManager();

class SocketManager {
    constructor() {
        this.ws = null;
        this.reconnectInterval = 1000;
        this.maxReconnectInterval = 30000;
        this.listeners = new Map();
        this.connect();
    }

    connect() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        let url = `${protocol}//${window.location.host}`;
        if (window.isGuestMode && window.guestToken) {
            url += `?token=${window.guestToken}`;
        }
        this.ws = new WebSocket(url);

        this.ws.onopen = () => {
            console.log('WebSocket connected');
            this.reconnectInterval = 1000;
            
            if (window.isGuestMode && window.guestToken) {
                this.send('JOIN_SESSION', { guestToken: window.guestToken });
            } else {
                // Initial data fetch
                this.send('GET_SESSIONS');

                // Re-join session if we were in one
                if (currentSessionId) {
                    this.send('JOIN_SESSION', { sessionId: currentSessionId });
                }
            }
        };

        this.ws.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data);
                this.emit(message.type, message);
            } catch (e) {
                console.error('Error parsing WebSocket message:', e);
            }
        };

        this.ws.onclose = () => {
            console.log('WebSocket disconnected. Reconnecting...');
            setTimeout(() => this.connect(), this.reconnectInterval);
            this.reconnectInterval = Math.min(this.reconnectInterval * 2, this.maxReconnectInterval);
        };

        this.ws.onerror = (error) => {
            console.error('WebSocket error:', error);
            this.ws.close();
        };
    }

    send(type, payload = {}) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({ type, ...payload }));
        } else {
            console.warn('WebSocket not connected. Message dropped:', type);
        }
    }

    on(type, callback) {
        if (!this.listeners.has(type)) {
            this.listeners.set(type, new Set());
        }
        this.listeners.get(type).add(callback);
    }

    off(type, callback) {
        if (this.listeners.has(type)) {
            this.listeners.get(type).delete(callback);
        }
    }

    emit(type, data) {
        if (this.listeners.has(type)) {
            this.listeners.get(type).forEach(cb => cb(data));
        }
    }
}

const socket = new SocketManager();

/**
 * Formats duration in seconds to HH:MM:SS.s or HH:MM:SS.mmm
 */
function formatDuration(seconds, precision = 0) {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    const hh = hrs.toString().padStart(2, '0');
    const mm = mins.toString().padStart(2, '0');
    const ss = precision > 0 
        ? secs.toFixed(precision).padStart(precision + 3, '0')
        : Math.floor(secs).toString().padStart(2, '0');

    return `${hh}:${mm}:${ss}`;
}

/**
 * Compares two timestamps (UTC milliseconds). Simple numeric comparison.
 * Returns -1 if t1 < t2, 1 if t1 > t2, 0 if equal.
 */
function compareTimestamps(t1, t2) {
    if (t1 < t2) return -1;
    if (t1 > t2) return 1;
    return 0;
}

/**
 * Display a note's timestamp in the appropriate format based on session mode.
 * Clock mode: convert UTC ms to local HH:MM:SS
 * Timer mode: elapsed seconds from session start
 */
function displayTimestamp(note, session) {
    const ts = note.timestamp_ms;
    if (!session) return formatDuration(ts / 1000, 1);

    if (session.timestamp_mode === 'timer') {
        const elapsedMs = session.elapsed_ms || 0;
        const sessionStartMs = session.started_at ? new Date(session.started_at).getTime() : 0;
        if (!sessionStartMs) {
            // Timer never started or reset — fall back to clock display
            const localDate = new Date(ts);
            const hrs = localDate.getHours();
            const mins = localDate.getMinutes();
            const secs = localDate.getSeconds() + localDate.getMilliseconds() / 1000;
            const totalSeconds = (hrs * 3600) + (mins * 60) + secs;
            return formatDuration(totalSeconds, 1);
        }
        // Total timer position at note capture = accumulated elapsed + time into current run
        const totalMs = elapsedMs + (ts - sessionStartMs);
        return formatDuration(totalMs / 1000, 1);
    } else {
        // Clock mode: convert UTC ms to local time
        const localDate = new Date(ts);
        const hrs = localDate.getHours();
        const mins = localDate.getMinutes();
        const secs = localDate.getSeconds() + localDate.getMilliseconds() / 1000;
        const totalSeconds = (hrs * 3600) + (mins * 60) + secs;
        return formatDuration(totalSeconds, 1);
    }
}

function captureDraftTimestamp() {
    if (activeDraftTimestamp !== null) return;
    // Block draft timestamp capture when timer is stopped
    if (currentSession && currentSession.timestamp_mode === 'timer' && !currentSession.started_at) {
        return;
    }
    if (currentSession && currentSession.started_at) {
        // Timer mode: store as sessionStartMs + elapsed ms
        activeDraftTimestamp = Date.now();
    } else {
        // Clock mode: store as Date.now() (UTC ms)
        activeDraftTimestamp = Date.now();
    }
    updateDraftDisplay();
}

function updateDraftDisplay() {
    const displayEl = document.getElementById('draft-timestamp-display');
    if (!displayEl) return;
    if (activeDraftTimestamp !== null) {
        // Create a pseudo-note object for displayTimestamp
        const pseudoNote = { timestamp_ms: activeDraftTimestamp };
        displayEl.textContent = displayTimestamp(pseudoNote, currentSession);
        displayEl.style.display = 'block';
    } else {
        displayEl.style.display = 'none';
    }
}

function renderQuickTags() {
    const list = document.getElementById('quick-tags-list');
    if (!list) return;
    list.innerHTML = '';
    tagManager.getTags().forEach(tag => {
        const btn = document.createElement('button');
        btn.className = 'tag-btn';
        btn.textContent = tag;
        btn.setAttribute('aria-label', `Quick tag: ${tag}`);
        btn.onclick = () => {
            const timestamp = Date.now();
            socket.send('CREATE_NOTE', {
                payload: { content: tag, timestamp, color: selectedColor }
            });
        };
        list.appendChild(btn);
    });
}

// UI State Management
function updateRecordingState() {
    if (document.body.classList.contains('session-not-found')) {
        document.body.classList.add('recording');
        return;
    }
    const isRecording = currentSession && currentSession.started_at && !currentSession.stopped_at;
    document.body.classList.toggle('recording', !!isRecording);

    // Update input state
    const input = document.getElementById('note-input');
    const inputArea = document.getElementById('input-area');
    if (input) {
        const isTimerStopped = currentSession
            && currentSession.timestamp_mode === 'timer'
            && !currentSession.started_at;

        if (isTimerStopped) {
            input.placeholder = 'Timer stopped — start timer to add notes';
            input.disabled = true;
        } else if (!isRecording) {
            input.disabled = false;
            if (window.innerWidth <= 768) {
                input.placeholder = "Type a note";
            } else {
                input.placeholder = "Type a note and press Enter...";
            }
        } else {
            input.disabled = false;
            if (window.innerWidth <= 768) {
                input.placeholder = "Type a note";
            } else {
                input.placeholder = "Type a note and press Enter...";
            }
        }
    }
}

function updateClock() {
    const clockEl = document.getElementById('live-clock');
    if (!clockEl) return;

    const infoEl = document.getElementById('session-info');
    const headerTitle = document.getElementById('header-session-title');

    if (currentSession) {
        if (currentSession.timestamp_mode === 'timer') {
            const elapsedMs = currentSession.elapsed_ms || 0;

            if (currentSession.started_at && !currentSession.stopped_at) {
                // Timer running: elapsed + current run
                const currentRunStart = new Date(currentSession.started_at).getTime();
                const totalMs = elapsedMs + (Date.now() - currentRunStart);
                clockEl.textContent = formatDuration(totalMs / 1000, 1);
                if (infoEl) infoEl.textContent = `🔴 RECORDING: ${currentSession.name}`;
            } else if (elapsedMs > 0) {
                // Timer stopped: show accumulated time
                clockEl.textContent = formatDuration(elapsedMs / 1000, 1);
                if (infoEl) infoEl.textContent = `FINISHED: ${currentSession.name}`;
            } else {
                // Timer never started
                clockEl.textContent = '00:00:00';
                if (infoEl) infoEl.textContent = currentSession.name;
            }
        } else {
            // Clock mode: time-of-day
            const now = new Date();
            const ssm = (now.getHours() * 3600) + (now.getMinutes() * 60) + now.getSeconds() + (now.getMilliseconds() / 1000);
            clockEl.textContent = formatDuration(ssm, 1);
            if (infoEl) infoEl.textContent = currentSession.name;
        }
        if (headerTitle && headerTitle.textContent !== currentSession.name) headerTitle.textContent = currentSession.name;
    } else {
        // No session selected
        const now = new Date();
        const ssm = (now.getHours() * 3600) + (now.getMinutes() * 60) + now.getSeconds() + (now.getMilliseconds() / 1000);
        clockEl.textContent = formatDuration(ssm, 1);
        const headerTitle = document.getElementById('header-session-title');
        if (headerTitle && headerTitle.textContent !== "") headerTitle.textContent = "";
        if (infoEl) infoEl.textContent = "No Session";
    }
    updateRecordingState();
}

// Initial clock call
setInterval(updateClock, 100);

// Timer Control Functions
function updateTimerMenuVisibility() {
    const startBtn = document.getElementById('menu-timer-start');
    const stopBtn = document.getElementById('menu-timer-stop');
    const resetBtn = document.getElementById('menu-timer-reset');

    if (!startBtn || !stopBtn || !resetBtn) return;

    if (!currentSession || window.isGuestMode) {
        startBtn.style.display = 'none';
        stopBtn.style.display = 'none';
        resetBtn.style.display = 'none';
        return;
    }

    const isTimer = currentSession.timestamp_mode === 'timer';
    const isRunning = isTimer && currentSession.started_at && !currentSession.stopped_at;
    const hasElapsed = isTimer && (currentSession.started_at || (currentSession.elapsed_ms || 0) > 0);
    // Show Start for timer mode (stopped/never started) AND clock mode (to allow switching)
    const canStart = !isRunning;

    startBtn.style.display = canStart ? 'flex' : 'none';
    stopBtn.style.display = isRunning ? 'flex' : 'none';
    resetBtn.style.display = hasElapsed ? 'flex' : 'none';
}

function updateSessionMenuVisibility() {
    const items = ['menu-share-link', 'menu-export-reaper', 'menu-export-audition', 'menu-export-edl'];
    const show = !!(currentSessionId && !window.isGuestMode);
    items.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = show ? 'flex' : 'none';
    });
}

async function startTimer() {
    if (!currentSessionId) return;
    try {
        const res = await fetch(`/api/sessions/${currentSessionId}/timer/start`, { method: 'POST' });
        if (res.ok) {
            const data = await res.json();
            Object.assign(currentSession, data.session);
            updateClock();
            updateTimerMenuVisibility();
        }
    } catch (err) {
        console.error('startTimer error:', err);
    }
}

async function stopTimer() {
    if (!currentSessionId) return;
    try {
        const res = await fetch(`/api/sessions/${currentSessionId}/timer/stop`, { method: 'POST' });
        if (res.ok) {
            const data = await res.json();
            Object.assign(currentSession, data.session);
            updateClock();
            updateTimerMenuVisibility();
        }
    } catch (err) {
        console.error('stopTimer error:', err);
    }
}

async function resetTimer() {
    if (!currentSessionId) return;
    try {
        const res = await fetch(`/api/sessions/${currentSessionId}/timer/reset`, { method: 'POST' });
        if (res.ok) {
            const data = await res.json();
            Object.assign(currentSession, data.session);
            updateClock();
            updateTimerMenuVisibility();
        } else {
            const data = await res.json();
            showTimerResetWarning(data.error);
        }
    } catch (err) {
        console.error('resetTimer error:', err);
    }
}

function showTimerResetWarning(message) {
    const modal = document.getElementById('timer-warning-modal');
    const msgEl = document.getElementById('timer-warning-message');
    if (!modal || !msgEl) return;
    msgEl.textContent = message;
    modal.style.display = 'block';
    modal.setAttribute('aria-hidden', 'false');
    document.getElementById('timer-warning-ok').focus();
}

function renderSessionList(sessions) {
    const list = document.getElementById('session-list');
    if (!list) return;

    // Prioritized Sorting:
    // 1. Recording (started_at && !stopped_at)
    // 2. Creation date (DESC)
    const sortedSessions = [...sessions].sort((a, b) => {
        const aRecording = a.started_at && !a.stopped_at;
        const bRecording = b.started_at && !b.stopped_at;
        if (aRecording && !bRecording) return -1;
        if (!aRecording && bRecording) return 1;

        // Fallback to creation date DESC
        return new Date(b.created_at) - new Date(a.created_at);
    });

    list.setAttribute('role', 'list');
    list.innerHTML = '';
    sortedSessions.forEach(session => {
        const item = document.createElement('div');
        item.className = 'session-item';
        item.setAttribute('role', 'listitem');
        item.setAttribute('tabindex', '0');
        if (session.id.toString() === currentSessionId?.toString()) {
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

async function renameSession(id, oldName) {
    const newName = prompt('Enter new session name:', oldName);
    if (!newName || newName === oldName) return;

    socket.send('UPDATE_SESSION', { sessionId: id, name: newName });
}

async function deleteSession(id) {
    if (!confirm('Are you sure you want to delete this session and all its notes? This cannot be undone.')) return;

    socket.send('DELETE_SESSION', { sessionId: id });

    if (currentSessionId?.toString() === id.toString()) {
        currentSessionId = null;
        currentSession = null;
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
    }
}

async function selectSession(id) {
    currentSessionId = id;
    window.location.hash = `#/session/${id}`;
    renderSessionList(window.lastSessions || []);
    
    const stream = document.getElementById('note-stream');
    if (stream) stream.innerHTML = '';

    renderQuickTags();

    // Join the WebSocket room for this session (this now triggers SESSION_DATA push)
    socket.send('JOIN_SESSION', { sessionId: id });
    
    closeSidebarFn();
}

function renderNotes(notes) {
    const stream = document.getElementById('note-stream');
    if (!stream) return;
    
    if (notes.length > 0) {
        const emptyMsg = stream.querySelector('.empty-state');
        if (emptyMsg) emptyMsg.remove();
    } else {
        stream.innerHTML = '<div class="empty-state">No notes yet.</div>';
    }

    const editingNoteId = document.querySelector('.note.editing')?.dataset.noteId;
    const existingNotes = Array.from(stream.querySelectorAll('.note'));

    notes.forEach(note => {
        if (note.id.toString() === editingNoteId) return;
        const existingEl = existingNotes.find(n => n.dataset.noteId === note.id.toString());
        
        if (existingEl) {
            const contentEl = existingEl.querySelector('.content');
            if (contentEl && contentEl.textContent !== note.content) contentEl.textContent = note.content;
            if (note.color) {
                existingEl.style.borderLeft = `4px solid ${note.color}`;
                existingEl.style.backgroundColor = note.color + '15';
            }
        } else {
            const div = document.createElement('div');
            div.className = 'note';
            div.setAttribute('role', 'article');
            div.dataset.noteId = note.id;
            div.dataset.timestamp = note.timestamp_ms; // Store for sorting
            if (note.color) {
                div.style.borderLeft = `4px solid ${note.color}`;
                div.style.backgroundColor = note.color + '15';
            }
            
            // Build DOM with createElement/textContent to avoid XSS from note.content
            const timestampSpan = document.createElement('span');
            timestampSpan.className = 'timestamp';
            timestampSpan.textContent = displayTimestamp(note, currentSession);
            timestampSpan.setAttribute('aria-label', `Timestamp: ${displayTimestamp(note, currentSession)}`);

            const contentWrapper = document.createElement('div');
            contentWrapper.className = 'content-wrapper';

            const contentSpan = document.createElement('span');
            contentSpan.className = 'content';
            contentSpan.textContent = note.content;
            contentSpan.setAttribute('aria-label', 'Note content');

            const editArea = document.createElement('textarea');
            editArea.className = 'edit-area';
            editArea.setAttribute('aria-label', 'Edit note content');
            editArea.rows = 1;

            contentWrapper.appendChild(contentSpan);
            contentWrapper.appendChild(editArea);

            const actionsDiv = document.createElement('div');
            actionsDiv.className = 'note-actions';
            actionsDiv.innerHTML = `
                <button class="edit-btn" title="Edit Note" aria-label="Edit note">Edit</button>
                <button class="delete-btn" title="Delete Note" aria-label="Delete note">Delete</button>
                <button class="save-btn" title="Save" aria-label="Save note">Save</button>
                <button class="cancel-btn" title="Cancel" aria-label="Cancel editing">Cancel</button>
                <button class="confirm-del-btn" title="Confirm Delete" aria-label="Confirm delete">Confirm Del.</button>
            `;

            div.appendChild(timestampSpan);
            div.appendChild(contentWrapper);
            div.appendChild(actionsDiv);

            // Button handlers
            div.querySelector('.edit-btn').onclick = () => toggleEditMode(div, true);
            div.querySelector('.delete-btn').onclick = () => showDeleteConfirm(div);
            div.querySelector('.save-btn').onclick = () => saveEdit(div);
            div.querySelector('.cancel-btn').onclick = () => toggleEditMode(div, false);
            div.querySelector('.confirm-del-btn').onclick = () => deleteNote(div);

            // Long-press to enter edit mode (mobile)
            let longPressTimer = null;
            let longPressTriggered = false;

            const startLongPress = (e) => {
                if (window.innerWidth > 768) return;
                if (div.classList.contains('editing')) return;
                if (e.target.closest('.note-actions')) return;
                longPressTriggered = false;
                longPressTimer = setTimeout(() => {
                    longPressTriggered = true;
                    toggleEditMode(div, true);
                }, 500);
            };

            const cancelLongPress = () => {
                clearTimeout(longPressTimer);
                longPressTimer = null;
            };

            div.addEventListener('touchstart', startLongPress, { passive: true });
            div.addEventListener('touchend', (e) => {
                cancelLongPress();
            });
            div.addEventListener('touchmove', cancelLongPress, { passive: true });
            div.addEventListener('mousedown', startLongPress);
            div.addEventListener('mouseup', (e) => {
                if (!longPressTriggered) cancelLongPress();
            });
            div.addEventListener('mousemove', cancelLongPress);

            // Find correct insertion point
            const currentNotes = Array.from(stream.querySelectorAll('.note'));
            const nextNote = currentNotes.find(existingNote => {
                const existingTs = parseFloat(existingNote.dataset.timestamp);
                return compareTimestamps(note.timestamp_ms, existingTs) === -1;
            });

            if (nextNote) {
                stream.insertBefore(div, nextNote);
            } else {
                stream.appendChild(div);
            }
            
            stream.scrollTop = stream.scrollHeight;
        }
    });
}

function toggleEditMode(noteEl, editing) {
    const wrapper = noteEl.querySelector('.content-wrapper');
    const span = noteEl.querySelector('.content');
    const ta = noteEl.querySelector('.edit-area');

    if (editing) {
        noteEl.classList.add('editing');
        noteEl.classList.remove('delete-confirm');

        // Copy computed font styles from span to textarea for pixel-perfect match
        const cs = getComputedStyle(span);
        ta.style.fontFamily = cs.fontFamily;
        ta.style.fontSize = cs.fontSize;
        ta.style.lineHeight = cs.lineHeight;
        ta.style.letterSpacing = cs.letterSpacing;

        // Lock wrapper size to prevent layout shift
        const rect = wrapper.getBoundingClientRect();
        wrapper.style.width = rect.width + 'px';
        wrapper.style.minHeight = rect.height + 'px';

        ta.value = span.textContent;
        autosizeEditArea(ta);

        ta.onkeydown = (e) => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveEdit(noteEl); }
            else if (e.key === 'Escape') toggleEditMode(noteEl, false);
        };
        ta.oninput = () => autosizeEditArea(ta);

        ta.focus();
    } else {
        noteEl.classList.remove('editing');
        noteEl.classList.remove('delete-confirm');

        // Copy value back to span
        span.textContent = ta.value;

        // Unlock wrapper
        wrapper.style.width = '';
        wrapper.style.minHeight = '';
    }
}

function autosizeEditArea(ta) {
    ta.style.height = '0px';
    ta.style.height = ta.scrollHeight + 'px';
}

async function saveEdit(noteEl) {
    const noteId = noteEl.dataset.noteId;
    const ta = noteEl.querySelector('.edit-area');
    if (!ta) return;
    const newContent = ta.value.trim();
    if (!newContent) return;

    socket.send('UPDATE_NOTE', { noteId, content: newContent });
    toggleEditMode(noteEl, false);
}

function showDeleteConfirm(noteEl) {
    noteEl.classList.add('delete-confirm');
}

function deleteNote(noteEl) {
    const noteId = noteEl.dataset.noteId;
    socket.send('DELETE_NOTE', { noteId });
    noteEl.remove();
}

async function sendNote() {
    const input = document.getElementById('note-input');
    if (!input || input.disabled) return;
    let content = input.value.trim();
    
    // Repeat last note if input is empty
    if (!content && lastManualNoteContent) {
        content = lastManualNoteContent;
    }

    if (!content || !currentSessionId) return;

    // Save for next repeat
    lastManualNoteContent = content;

    const timestamp = activeDraftTimestamp !== null ? activeDraftTimestamp : Date.now();

    socket.send('CREATE_NOTE', {
        payload: { content, timestamp, color: selectedColor }
    });
    
    input.value = '';
    activeDraftTimestamp = null;
    if (draftResetTimeout) { clearTimeout(draftResetTimeout); draftResetTimeout = null; }
    updateDraftDisplay();
}

function updateColorSelection(color) {
    selectedColor = color;
    document.querySelectorAll('.color-opt, .sheet-color-opt').forEach(o => o.classList.toggle('selected', o.dataset.color === color));
    const toggle = document.getElementById('mobile-color-toggle');
    if (toggle) toggle.style.setProperty('--selected-color', color || '');
}

function toggleColorPicker(open) {
    const popup = document.getElementById('color-picker-popup');
    if (popup) popup.classList.toggle('open', open);
}

function toggleOverflow(open) {
    const menu = document.getElementById('overflow-menu');
    if (menu) menu.classList.toggle('open', open);
}

const closeSidebarFn = () => {
    const sidebar = document.getElementById('sidebar');
    const backdrop = document.getElementById('bottom-sheet-backdrop');
    if (sidebar) sidebar.classList.remove('open');
    if (backdrop) backdrop.classList.remove('open');
};

async function init() {
    const sunPath = '<path d="M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zM2 13h2c.55 0 1-.45 1-1s-.45-1-1-1H2c-.55 0-1 .45-1 1s.45 1 1 1zm18 0h2c.55 0 1-.45 1-1s-.45-1-1-1h-2c-.55 0-1 .45-1 1s.45 1 1 1zM11 2v2c0 .55.45 1 1 1s1-.45 1-1V2c0-.55-.45-1-1-1s-1 .45-1 1zm0 18v2c0 .55.45 1 1 1s1-.45 1-1v-2c0-.55-.45-1-1-1s-1 .45-1 1zM5.99 4.58c-.39-.39-1.03-.39-1.41 0s-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0s.39-1.03 0-1.41L5.99 4.58zm12.37 12.37c-.39-.39-1.03-.39-1.41 0s-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0s.39-1.03 0-1.41l-1.06-1.06zm1.06-12.37c-.39-.39-1.03-.39-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06c.39-.39.39-1.03 0-1.41zm-12.37 12.37c-.39-.39-1.03-.39-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06c.39-.39.39-1.03 0-1.41zm-12.37 12.37c-.39-.39-1.03-.39-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06c.39-.39.39-1.03 0-1.41z"/>';
    const moonPath = '<path d="M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9 9-4.03 9-9c0-.46-.04-.92-.1-1.36-.98 1.37-2.58 2.26-4.4 2.26-3.03 0-5.5-2.47-5.5-5.5 0-1.82.89-3.42 2.26-4.4-.44-.06-.9-.1-1.36-.1z"/>';

    const urlParams = new URLSearchParams(window.location.search);
    const queryToken = urlParams.get('token');
    const guestMatch = window.location.hash.match(/#\/guest\/([a-zA-Z0-9-]+)/);
    const sessionMatch = window.location.hash.match(/#\/session\/(\d+)/);

    const effectiveGuestToken = guestMatch ? guestMatch[1] : queryToken;

    if (effectiveGuestToken) {
        window.isGuestMode = true;
        window.guestToken = effectiveGuestToken;
        document.body.classList.add('guest-mode');
    } else if (sessionMatch) {
        currentSessionId = sessionMatch[1];
        selectSession(sessionMatch[1]);
    }

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

    const quickTagsToggle = document.getElementById('quick-tags-toggle');
    const inputArea = document.getElementById('input-area');
    if (quickTagsToggle && inputArea) {
        quickTagsToggle.addEventListener('click', () => {
            inputArea.classList.toggle('show-quicktags');
        });
    }

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
    
    const handleNewSession = () => {
        closeSidebarFn();
        toggleNewSessionModal(true);
    };

    const toggleNewSessionModal = (open) => {
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
    };

    socket.on('SESSION_CREATED', (data) => {
        // Auto-select if we created it in this tab
        selectSession(data.id);
    });

    const newSessionBtn = document.getElementById('new-session-btn');
    if (newSessionBtn) newSessionBtn.onclick = handleNewSession;

    const newSessionBtnMobile = document.getElementById('new-session-btn-mobile');
    if (newSessionBtnMobile) newSessionBtnMobile.onclick = handleNewSession;
    
    const sendNoteBtn = document.getElementById('send-note-btn');
    if (sendNoteBtn) sendNoteBtn.onclick = sendNote;

    const noteInput = document.getElementById('note-input');
    if (noteInput) {
        noteInput.onkeypress = (e) => {
            if (e.key === 'Enter') {
                sendNote();
            }
        };
        noteInput.oninput = (e) => {
            if (e.target.value.length > 0) {
                if (draftResetTimeout) { clearTimeout(draftResetTimeout); draftResetTimeout = null; }
                captureDraftTimestamp();
            } else if (!draftResetTimeout) {
                draftResetTimeout = setTimeout(() => { activeDraftTimestamp = null; draftResetTimeout = null; updateDraftDisplay(); }, 500);
            }
        };
    }

    const sidebarOpen = document.getElementById('sidebar-open');
    if (sidebarOpen) {
        sidebarOpen.onclick = () => {
            const sidebar = document.getElementById('sidebar');
            const backdrop = document.getElementById('bottom-sheet-backdrop');
            if (sidebar) sidebar.classList.add('open');
            if (backdrop) backdrop.classList.add('open');
        };
    }
    
    const closeSidebarBtn = document.getElementById('close-sidebar');
    if (closeSidebarBtn) closeSidebarBtn.onclick = closeSidebarFn;

    const manageSessionsBtn = document.getElementById('manage-sessions-btn');
    if (manageSessionsBtn) {
        manageSessionsBtn.onclick = () => {
            const sidebar = document.getElementById('sidebar');
            const isManaging = sidebar.classList.toggle('managing');
            manageSessionsBtn.classList.toggle('active', isManaging);
            manageSessionsBtn.textContent = isManaging ? 'Done' : '✎ Edit';
        };
    }

    const overflowMenuToggle = document.getElementById('overflow-menu-toggle');
    if (overflowMenuToggle) {
        overflowMenuToggle.onclick = () => {
            const menu = document.getElementById('overflow-menu');
            const isOpen = !menu.classList.contains('open');
            toggleOverflow(isOpen);
            overflowMenuToggle.setAttribute('aria-expanded', isOpen.toString());
        };
    }
    
    const themeToggleFn = (isDark) => {
        document.body.classList.toggle('dark-mode', isDark);
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
        const path = isDark ? sunPath : moonPath;
        const desktopIcon = document.getElementById('theme-icon');
        const mobileIcon = document.getElementById('mobile-theme-icon');
        if (desktopIcon) desktopIcon.innerHTML = path;
        if (mobileIcon) mobileIcon.innerHTML = path;
    };

    const menuThemeToggle = document.getElementById('menu-theme-toggle');
    if (menuThemeToggle) {
        menuThemeToggle.onclick = () => { themeToggleFn(!document.body.classList.contains('dark-mode')); toggleOverflow(false); };
    }

    const menuLogout = document.getElementById('menu-logout');
    if (menuLogout) {
        menuLogout.onclick = () => {
            if (confirm('Are you sure you want to logout?')) {
                toggleOverflow(false);
                window.location.href = '/logout';
            }
        };
    }

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

    const menuShareLink = document.getElementById('menu-share-link');
    if (menuShareLink) {
        menuShareLink.onclick = async () => {
            if (!currentSessionId) return;
            try {
                toggleOverflow(false);
                const res = await fetch(`/api/sessions/${currentSessionId}/guest-token`, { method: 'POST' });
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
            if (modal) {
                modal.style.display = 'none';
                modal.setAttribute('aria-hidden', 'true');
            }
        };
    }

    const exportFn = (format = 'reaper', fps = '') => {
        if (!currentSessionId) return;
        let url = `/api/sessions/${currentSessionId}/export?format=${format}`;
        if (fps) url += `&fps=${fps}`;
        if (window.guestToken) url += `&token=${window.guestToken}`;
        window.location.href = url;
    };
    
    const toggleExportMenu = (open) => {
        const menu = document.getElementById('export-menu');
        if (menu) menu.classList.toggle('open', open);
    };

    const toggleFpsModal = (open) => {
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
    };

    const exportBtn = document.getElementById('export-btn');
    if (exportBtn) {
        exportBtn.onclick = (e) => {
            e.stopPropagation();
            const menu = document.getElementById('export-menu');
            toggleExportMenu(!menu.classList.contains('open'));
        };
    }

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

    document.querySelectorAll('.fps-opt').forEach(btn => {
        btn.onclick = () => {
            const fps = btn.dataset.fps;
            localStorage.setItem('last_edl_fps', fps);
            exportFn('edl', fps);
            toggleFpsModal(false);
        };
    });

    const cancelFps = document.getElementById('cancel-fps');
    if (cancelFps) cancelFps.onclick = () => toggleFpsModal(false);

    const toggleTagsModal = (open) => {
        const modal = document.getElementById('tags-modal');
        const backdrop = document.getElementById('bottom-sheet-backdrop');
        if (modal) modal.classList.toggle('open', open);
        if (backdrop) {
            backdrop.style.display = open ? 'block' : 'none';
            backdrop.style.opacity = open ? '1' : '0';
        }
        if (open) renderModalTags();
    };

    const toggleShareLinkModal = (open, url) => {
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
    };

    const renderModalTags = () => {
        const list = document.getElementById('modal-tags-list');
        if (!list) return;
        list.setAttribute('role', 'list');
        list.innerHTML = '';
        tagManager.getTags().forEach(tag => {
            const item = document.createElement('div');
            item.className = 'modal-tag-item';
            item.setAttribute('role', 'listitem');
            item.innerHTML = `
                <span>${tag}</span>
                <button class="delete-tag-btn" title="Delete tag" aria-label="Delete tag: ${tag}">×</button>
            `;
            item.querySelector('.delete-tag-btn').onclick = () => {
                tagManager.removeTag(tag);
                renderModalTags();
                renderQuickTags();
            };
            list.appendChild(item);
        });
    };

    const menuEditTags = document.getElementById('menu-edit-tags');
    if (menuEditTags) {
        menuEditTags.onclick = () => {
            toggleTagsModal(true);
            toggleOverflow(false);
        };
    }

    const closeTagsModalBtn = document.getElementById('close-tags-modal');
    if (closeTagsModalBtn) closeTagsModalBtn.onclick = () => toggleTagsModal(false);

    const closeShareModalBtn = document.getElementById('close-share-modal');
    if (closeShareModalBtn) closeShareModalBtn.onclick = () => toggleShareLinkModal(false);

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

    themeToggleFn(localStorage.getItem('theme') === 'dark');

    socket.on('SESSION_DATA', (data) => {
        console.log('Received session data via WebSocket');
        const { session, notes } = data;
        
        document.body.classList.remove('session-not-found');
        currentSession = session;
        currentSessionId = session.id;
        
        const headerTitle = document.getElementById('header-session-title');
        if (headerTitle && headerTitle.textContent !== currentSession.name) headerTitle.textContent = currentSession.name;
        
        document.getElementById('input-area').style.display = 'block';

        updateSessionMenuVisibility();

        const menuEditTags = document.getElementById('menu-edit-tags');
        if (menuEditTags) {
            menuEditTags.style.display = window.isGuestMode ? 'none' : 'flex';
        }

        const menuLogout = document.getElementById('menu-logout');
        if (menuLogout) {
            menuLogout.style.display = window.isGuestMode ? 'none' : 'flex';
        }
        
        renderQuickTags();
        renderNotes(notes);
        updateClock();
        updateTimerMenuVisibility();
    });

    socket.on('ERROR', (data) => {
        if (data.code === 404) {
            console.error('Session not found error from server');
            currentSessionId = null;
            currentSession = null;
            document.body.classList.add('session-not-found');
            document.body.classList.add('recording');
            document.getElementById('note-stream').innerHTML = '<div class="empty-state">Session not found.</div>';
            updateSessionMenuVisibility();

            const headerTitle = document.getElementById('header-session-title');
            if (headerTitle && headerTitle.textContent !== "") headerTitle.textContent = "";
            const infoEl = document.getElementById('session-info');
            if (infoEl) infoEl.textContent = "No Session";
            updateTimerMenuVisibility();
        }
    });

    // WebSocket Event Listeners
    socket.on('SESSION_LIST_UPDATE', (data) => {
        console.log('Session list updated via WebSocket');
        if (data.sessions) {
            window.lastSessions = data.sessions;
            renderSessionList(data.sessions);
            
            // Sync current session metadata if active
            if (currentSessionId) {
                const updated = data.sessions.find(s => s.id.toString() === currentSessionId.toString());
                if (updated) {
                    currentSession = updated;
                    const headerTitle = document.getElementById('header-session-title');
                    if (headerTitle && headerTitle.textContent !== updated.name) {
                        console.log('Updating header title to:', updated.name);
                        headerTitle.textContent = updated.name;
                    }
                    updateClock();
                    updateTimerMenuVisibility();
                } else {
                    // It was deleted (should be handled by SESSION_DELETED but as a fallback)
                    currentSession = null;
                    currentSessionId = null;
                    const headerTitle = document.getElementById('header-session-title');
                    if (headerTitle && headerTitle.textContent !== "") headerTitle.textContent = "";
                    updateSessionMenuVisibility();
                }
            }
        }
    });

    socket.on('SESSION_DELETED', (data) => {
        console.log('Session deleted via WebSocket:', data.sessionId);
        if (currentSessionId?.toString() === data.sessionId.toString()) {
            currentSessionId = null;
            currentSession = null;
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
        }
    });

    socket.on('NOTE_UPDATE', (data) => {
        if (data.sessionId.toString() === currentSessionId?.toString()) {
            console.log('Notes updated via WebSocket');
            if (data.notes) {
                renderNotes(data.notes);
            }
        }
    });

    socket.on('NOTE_DELETED', (data) => {
        if (data.sessionId?.toString() !== currentSessionId?.toString()) return;
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
        if (data.sessionId.toString() === currentSessionId?.toString()) {
            console.log('Session status updated via WebSocket');
            currentSession.status = data.status;
            if (data.status === 'active') {
                currentSession.started_at = currentSession.started_at || new Date().toISOString();
                currentSession.stopped_at = null;
            } else if (data.status === 'completed') {
                currentSession.stopped_at = new Date().toISOString();
            }
            updateClock();
            updateTimerMenuVisibility();
        }
    });

    socket.on('SESSION_UPDATE', (data) => {
        if (data.session.id.toString() === currentSessionId?.toString()) {
            console.log('Session updated via WebSocket');
            currentSession = data.session;
            updateClock();
            updateTimerMenuVisibility();
        }
    });
}

window.addEventListener('hashchange', () => {
    const guestMatch = window.location.hash.match(/#\/guest\/([a-zA-Z0-9-]+)/);
    const sessionMatch = window.location.hash.match(/#\/session\/(\d+)/);

    // If navigating away from a guest token URL, reset guest mode flags
    // so WebSocket reconnects send sessionId instead of guestToken.
    if (!guestMatch && !window.location.search.includes('token=')) {
        window.isGuestMode = false;
        window.guestToken = null;
    }

    if (sessionMatch && sessionMatch[1] !== currentSessionId?.toString()) {
        selectSession(sessionMatch[1]);
    }
});

init();
