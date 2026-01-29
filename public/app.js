let currentSessionId = null;
let currentSession = null;
let selectedColor = "";
let activeDraftTimestamp = null;
let draftResetTimeout = null;

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
        this.ws = new WebSocket(`${protocol}//${window.location.host}`);

        this.ws.onopen = () => {
            console.log('WebSocket connected');
            this.reconnectInterval = 1000;
            
            // Initial data fetch
            this.send('GET_SESSIONS');

            // Re-join session if we were in one
            if (currentSessionId) {
                this.send('JOIN_SESSION', { sessionId: currentSessionId });
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
 * Compares two timestamps (seconds since midnight) with wrap-around detection.
 * Returns -1 if t1 < t2, 1 if t1 > t2, 0 if equal.
 * Heuristic: If the difference is > 12 hours (43200s), we assume a wrap-around occurred.
 */
function compareTimestamps(t1, t2) {
    const halfDay = 43200; 
    const diff = t1 - t2;

    if (Math.abs(diff) > halfDay) {
        // Wrap-around detected: the smaller value is actually "later"
        return diff > 0 ? -1 : 1;
    }

    if (diff < 0) return -1;
    if (diff > 0) return 1;
    return 0;
}

function getSecondsSinceMidnight() {
    const now = new Date();
    return (now.getUTCHours() * 3600) + (now.getUTCMinutes() * 60) + now.getUTCSeconds() + (now.getUTCMilliseconds() / 1000);
}

function captureDraftTimestamp() {
    if (activeDraftTimestamp !== null) return;
    if (currentSession && currentSession.started_at) {
        activeDraftTimestamp = (Date.now() - new Date(currentSession.started_at).getTime()) / 1000;
    } else {
        activeDraftTimestamp = getSecondsSinceMidnight();
    }
    updateDraftDisplay();
}

function updateDraftDisplay() {
    const displayEl = document.getElementById('draft-timestamp-display');
    if (!displayEl) return;
    if (activeDraftTimestamp !== null) {
        displayEl.textContent = formatDuration(activeDraftTimestamp, 1);
        displayEl.style.display = 'block';
    } else {
        displayEl.style.display = 'none';
    }
}

// UI State Management
function updateRecordingState() {
    if (document.body.classList.contains('session-not-found')) {
        document.body.classList.add('recording');
        return;
    }
    const isRecording = currentSession && currentSession.started_at && !currentSession.stopped_at;
    document.body.classList.toggle('recording', !!isRecording);
    
    // Update placeholders
    const input = document.getElementById('note-input');
    if (input) {
        if (window.innerWidth <= 768) {
            input.placeholder = "Type a note";
        } else {
            input.placeholder = "Type a note and press Enter...";
        }
    }
}

function updateClock() {
    const clockEl = document.getElementById('live-clock');
    if (!clockEl) return;

    const infoEl = document.getElementById('session-info');
    const headerTitle = document.getElementById('header-session-title');

    if (currentSession) {
        if (currentSession.started_at) {
            const start = new Date(currentSession.started_at).getTime();
            const end = currentSession.stopped_at ? new Date(currentSession.stopped_at).getTime() : Date.now();
            clockEl.textContent = formatDuration((end - start) / 1000, 1);
            
            const label = currentSession.stopped_at ? 'FINISHED' : '🔴 RECORDING';
            if (infoEl) infoEl.textContent = `${label}: ${currentSession.name}`;
        } else {
            // Manual mode / No start time: use local Time-of-Day for clock
            const now = new Date();
            const ssm = (now.getHours() * 3600) + (now.getMinutes() * 60) + now.getSeconds() + (now.getMilliseconds() / 1000);
            clockEl.textContent = formatDuration(ssm, 1);
            if (infoEl) infoEl.textContent = currentSession.name;
        }
        if (headerTitle) headerTitle.textContent = currentSession.name;
    } else {
        // No session selected
        const now = new Date();
        const ssm = (now.getHours() * 3600) + (now.getMinutes() * 60) + now.getSeconds() + (now.getMilliseconds() / 1000);
        clockEl.textContent = formatDuration(ssm, 1);
        const headerTitle = document.getElementById('header-session-title');
        if (headerTitle) headerTitle.textContent = "";
        if (infoEl) infoEl.textContent = "No Session";
    }
    updateRecordingState();
}

// Initial clock call
setInterval(updateClock, 100);

function renderSessionList(sessions) {
    const list = document.getElementById('session-list');
    if (!list) return;
    list.innerHTML = '';
    sessions.forEach(session => {
        const item = document.createElement('div');
        item.className = 'session-item';
        if (session.id.toString() === currentSessionId?.toString()) {
            item.classList.add('active');
            // Use setTimeout to ensure the DOM has updated before scrolling
            setTimeout(() => item.scrollIntoView({ block: 'nearest' }), 0);
        }
        
        const nameSpan = document.createElement('span');
        nameSpan.className = 'session-name';
        nameSpan.textContent = session.name;
        nameSpan.onclick = () => selectSession(session.id);
        item.appendChild(nameSpan);

        const actions = document.createElement('div');
        actions.className = 'session-actions';
        actions.innerHTML = `
            <button class="sess-edit-btn" title="Rename">✎</button>
            <button class="sess-delete-btn" title="Delete">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
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
        if (exportBtn) exportBtn.style.display = 'none';
        const mobileExportBtn = document.getElementById('mobile-export-btn');
        if (mobileExportBtn) mobileExportBtn.style.display = 'none';
        const headerTitle = document.getElementById('header-session-title');
        if (headerTitle) headerTitle.textContent = "";
    }
}

async function selectSession(id) {
    currentSessionId = id;
    window.location.hash = `#/session/${id}`;
    renderSessionList(window.lastSessions || []);
    
    const stream = document.getElementById('note-stream');
    if (stream) stream.innerHTML = '';

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
    } else if (stream.children.length === 0) {
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
            div.dataset.noteId = note.id;
            div.dataset.timestamp = note.timestamp; // Store for sorting
            if (note.color) {
                div.style.borderLeft = `4px solid ${note.color}`;
                div.style.backgroundColor = note.color + '15';
            }
            
            div.innerHTML = `
                <span class="timestamp">${formatDuration(note.timestamp, 1)}</span>
                <span class="content">${note.content}</span>
                <div class="note-actions">
                    <button class="edit-btn" title="Edit Note">✎</button>
                    <button class="delete-btn" title="Delete Note">
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="3 6 5 3 19 3 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                    </button>
                    <button class="save-btn" title="Save" style="display:none;">✓</button>
                    <button class="cancel-btn" title="Cancel" style="display:none;">✕</button>
                </div>
            `;

            div.querySelector('.edit-btn').onclick = () => toggleEditMode(div, true);
            div.querySelector('.delete-btn').onclick = () => deleteNote(div);
            div.querySelector('.cancel-btn').onclick = () => toggleEditMode(div, false);
            div.querySelector('.save-btn').onclick = () => saveEdit(div);
            div.onclick = () => {
                if (window.innerWidth <= 768 && !div.classList.contains('editing')) {
                    document.querySelectorAll('.note.reveal-actions').forEach(n => n !== div && n.classList.remove('reveal-actions'));
                    div.classList.toggle('reveal-actions');
                }
            };

            // Find correct insertion point
            const currentNotes = Array.from(stream.querySelectorAll('.note'));
            const nextNote = currentNotes.find(existingNote => {
                const existingTs = parseFloat(existingNote.dataset.timestamp);
                return compareTimestamps(note.timestamp, existingTs) === -1;
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
    const contentEl = noteEl.querySelector('.content');
    const actions = ['edit-btn', 'save-btn', 'cancel-btn', 'delete-btn'].map(c => noteEl.querySelector('.' + c));

    if (editing) {
        noteEl.classList.add('editing');
        noteEl.dataset.originalContent = contentEl.textContent;
        const textarea = document.createElement('textarea');
        textarea.value = contentEl.textContent;
        contentEl.replaceWith(textarea);
        
        textarea.oninput = () => { textarea.style.height = 'auto'; textarea.style.height = textarea.scrollHeight + 'px'; };
        textarea.onkeydown = (e) => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveEdit(noteEl); }
            else if (e.key === 'Escape') toggleEditMode(noteEl, false);
        };
        textarea.onblur = () => setTimeout(() => {
            if (noteEl.classList.contains('editing') && !document.activeElement.closest('.note-actions')) toggleEditMode(noteEl, false);
        }, 150);

        textarea.focus();
        textarea.oninput();
        actions[0].style.display = 'none'; // edit
        actions[1].style.display = 'inline-block'; // save
        actions[2].style.display = 'inline-block'; // cancel
        if (actions[3]) actions[3].style.display = 'none'; // delete
    } else {
        noteEl.classList.remove('editing');
        const span = document.createElement('span');
        span.className = 'content';
        span.textContent = noteEl.dataset.originalContent;
        noteEl.querySelector('textarea').replaceWith(span);
        actions[0].style.display = 'inline-block';
        actions[1].style.display = 'none';
        actions[2].style.display = 'none';
        if (actions[3]) actions[3].style.display = 'inline-block';
    }
}

async function saveEdit(noteEl) {
    const noteId = noteEl.dataset.noteId;
    const textarea = noteEl.querySelector('textarea');
    if (!textarea) return;
    const newContent = textarea.value.trim();
    if (!newContent) return;

    socket.send('UPDATE_NOTE', { noteId, content: newContent });
    
    noteEl.dataset.originalContent = newContent;
    toggleEditMode(noteEl, false);
}

async function deleteNote(noteEl) {
    const noteId = noteEl.dataset.noteId;
    if (!confirm('Are you sure you want to delete this note?')) return;

    socket.send('DELETE_NOTE', { noteId });
    noteEl.remove();
}

async function sendNote() {
    const input = document.getElementById('note-input');
    if (!input) return;
    const content = input.value.trim();
    if (!content || !currentSessionId) return;

    const timestamp = activeDraftTimestamp !== null ? activeDraftTimestamp : (currentSession?.started_at ? (Date.now() - new Date(currentSession.started_at).getTime()) / 1000 : getSecondsSinceMidnight());

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

    const match = window.location.hash.match(/#\/session\/(\d+)/);
    if (match) currentSessionId = match[1];

    if (match) selectSession(match[1]);

    document.querySelectorAll('.color-opt').forEach(opt => opt.onclick = () => updateColorSelection(opt.dataset.color));
    document.querySelectorAll('.sheet-color-opt').forEach(opt => opt.onclick = () => { updateColorSelection(opt.dataset.color); toggleColorPicker(false); });

    const mobileColorToggle = document.getElementById('mobile-color-toggle');
    if (mobileColorToggle) {
        mobileColorToggle.onclick = () => {
            const popup = document.getElementById('color-picker-popup');
            toggleColorPicker(!popup.classList.contains('open'));
        };
    }
    
    const backdrop = document.getElementById('bottom-sheet-backdrop');
    if (backdrop) {
        backdrop.onclick = () => { 
            closeSidebarFn();
        };
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
    });
    
    const handleNewSession = () => {
        const name = prompt('Enter session name:');
        if (name) {
            socket.send('CREATE_SESSION', { name });
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

    const menuToggle = document.getElementById('menu-toggle');
    if (menuToggle) {
        menuToggle.onclick = () => {
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
            toggleOverflow(!menu.classList.contains('open'));
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

    const themeToggleBtn = document.getElementById('theme-toggle');
    if (themeToggleBtn) themeToggleBtn.onclick = () => themeToggleFn(!document.body.classList.contains('dark-mode'));

    const mobileThemeToggle = document.getElementById('mobile-theme-toggle');
    if (mobileThemeToggle) {
        mobileThemeToggle.onclick = () => { themeToggleFn(!document.body.classList.contains('dark-mode')); toggleOverflow(false); };
    }
    
    const exportFn = () => currentSessionId && (window.location.href = `/api/sessions/${currentSessionId}/export`);
    const exportBtn = document.getElementById('export-btn');
    if (exportBtn) exportBtn.onclick = exportFn;

    const mobileExportBtn = document.getElementById('mobile-export-btn');
    if (mobileExportBtn) {
        mobileExportBtn.onclick = () => { exportFn(); toggleOverflow(false); };
    }

    themeToggleFn(localStorage.getItem('theme') === 'dark');

    socket.on('SESSION_DATA', (data) => {
        console.log('Received session data via WebSocket');
        const { session, notes } = data;
        
        document.body.classList.remove('session-not-found');
        currentSession = session;
        
        const headerTitle = document.getElementById('header-session-title');
        if (headerTitle) headerTitle.textContent = currentSession.name;
        
        document.getElementById('input-area').style.display = 'block';
        const exportBtn = document.getElementById('export-btn');
        if (exportBtn) exportBtn.style.display = 'block';
        const mobileExportBtn = document.getElementById('mobile-export-btn');
        if (mobileExportBtn) mobileExportBtn.style.display = 'flex';
        
        renderNotes(notes);
        updateClock();
    });

    socket.on('ERROR', (data) => {
        if (data.code === 404) {
            console.error('Session not found error from server');
            currentSessionId = null;
            currentSession = null;
            document.body.classList.add('session-not-found');
            document.body.classList.add('recording');
            document.getElementById('note-stream').innerHTML = '<div class="empty-state">Session not found.</div>';
            document.getElementById('input-area').style.display = 'none';
            const exportBtn = document.getElementById('export-btn');
            if (exportBtn) exportBtn.style.display = 'none';
            const mobileExportBtn = document.getElementById('mobile-export-btn');
            if (mobileExportBtn) mobileExportBtn.style.display = 'none';
            const headerTitle = document.getElementById('header-session-title');
            if (headerTitle) headerTitle.textContent = "";
            const infoEl = document.getElementById('session-info');
            if (infoEl) infoEl.textContent = "No Session";
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
                    if (headerTitle) {
                        console.log('Updating header title to:', updated.name);
                        headerTitle.textContent = updated.name;
                    }
                } else {
                    // It was deleted (should be handled by SESSION_DELETED but as a fallback)
                    currentSession = null;
                    const headerTitle = document.getElementById('header-session-title');
                    if (headerTitle) headerTitle.textContent = "";
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
            const exportBtn = document.getElementById('export-btn');
            if (exportBtn) exportBtn.style.display = 'none';
            const mobileExportBtn = document.getElementById('mobile-export-btn');
            if (mobileExportBtn) mobileExportBtn.style.display = 'none';
            const headerTitle = document.getElementById('header-session-title');
            if (headerTitle) headerTitle.textContent = "";
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
        }
    });
}

window.addEventListener('hashchange', () => {
    const m = window.location.hash.match(/#\/session\/(\d+)/);
    if (m && m[1] !== currentSessionId?.toString()) selectSession(m[1]);
});

init();
