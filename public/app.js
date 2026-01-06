let currentSessionId = null;
let currentSession = null;
let selectedColor = "";
let activeDraftTimestamp = null;
let draftResetTimeout = null;

/**
 * Formats duration in seconds to HH:MM:SS.s or HH:MM:SS.mmm
 * @param {number} seconds - Total seconds
 * @param {number} precision - Decimal places (1 for UI, 3 for export)
 * @returns {string} Formatted time string
 */
function formatDuration(seconds, precision = 0) {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    const hh = hrs.toString().padStart(2, '0');
    const mm = mins.toString().padStart(2, '0');
    
    // Handle floating point precision for seconds
    const ss = precision > 0 
        ? secs.toFixed(precision).padStart(precision + 3, '0')
        : Math.floor(secs).toString().padStart(2, '0');

    return `${hh}:${mm}:${ss}`;
}

/**
 * Gets total seconds since the start of the current day (UTC)
 * @returns {number} Floating point seconds
 */
function getSecondsSinceMidnight() {
    const now = new Date();
    return (now.getUTCHours() * 3600) + 
           (now.getUTCMinutes() * 60) + 
           now.getUTCSeconds() + 
           (now.getUTCMilliseconds() / 1000);
}

/**
 * Captures the current timestamp for a new draft note if not already set.
 */
function captureDraftTimestamp() {
    if (activeDraftTimestamp !== null) return;

    if (currentSession && currentSession.started_at) {
        const start = new Date(currentSession.started_at).getTime();
        const now = Date.now();
        activeDraftTimestamp = (now - start) / 1000;
    } else {
        activeDraftTimestamp = getSecondsSinceMidnight();
    }
    
    updateDraftDisplay();
}

/**
 * Updates the visual display of the draft timestamp.
 */
function updateDraftDisplay() {
    const displayEl = document.getElementById('draft-timestamp-display');
    if (!displayEl) return;

    if (activeDraftTimestamp !== null) {
        const displayTime = formatDuration(activeDraftTimestamp, 1);
        displayEl.textContent = displayTime;
        displayEl.style.display = 'block';
    } else {
        displayEl.style.display = 'none';
    }
}

// Live Clock & Timer
function updateClock() {
    const clockEl = document.getElementById('live-clock');
    if (!clockEl) return;

    if (currentSession && currentSession.started_at) {
        const start = new Date(currentSession.started_at).getTime();
        const end = currentSession.stopped_at ? new Date(currentSession.stopped_at).getTime() : Date.now();
        const elapsedSeconds = (end - start) / 1000;
        
        // UI display uses 0.1s precision
        clockEl.textContent = formatDuration(elapsedSeconds, 1);
        
        // Show recording indicator
        const infoEl = document.getElementById('session-info');
        if (!currentSession.stopped_at) {
            if (!infoEl.innerHTML.includes('🔴')) {
                infoEl.innerHTML = `🔴 RECORDING: ${currentSession.name}`;
            }
        } else {
            infoEl.textContent = `FINISHED: ${currentSession.name}`;
        }
    } else {
        // Time-of-Day mode for header clock with 0.1s precision
        const now = new Date();
        const localSecondsSinceMidnight = (now.getHours() * 3600) + 
                                         (now.getMinutes() * 60) + 
                                         now.getSeconds() + 
                                         (now.getMilliseconds() / 1000);
        clockEl.textContent = formatDuration(localSecondsSinceMidnight, 1);
    }
}

// Update clock every 100ms for smooth 0.1s precision
setInterval(updateClock, 100);
updateClock();

async function fetchSessions() {
    const res = await fetch('/api/sessions');
    const sessions = await res.json();
    window.lastSessions = sessions;
    renderSessionList(sessions);
}

function renderSessionList(sessions) {
    const list = document.getElementById('session-list');
    list.innerHTML = '';
    sessions.forEach(session => {
        const item = document.createElement('div');
        item.className = 'session-item';
        if (session.id === currentSessionId) item.classList.add('active');
        item.textContent = session.name;
        item.onclick = () => selectSession(session.id);
        list.appendChild(item);
    });
}

async function createSession() {
    const name = prompt('Enter session name:');
    if (!name) return;

    const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
    });
    const data = await res.json();
    if (data.id) {
        await fetchSessions();
        selectSession(data.id);
    }
}

async function selectSession(id) {
    currentSessionId = id;
    window.location.hash = `#/session/${id}`;
    renderSessionList(window.lastSessions || []);
    
    const res = await fetch(`/api/sessions/${id}`);
    currentSession = await res.json();
    
    document.getElementById('session-info').textContent = currentSession.name;
    document.getElementById('input-area').style.display = 'flex';
    document.getElementById('export-btn').style.display = 'block';
    document.getElementById('sidebar').classList.remove('open');
    
    fetchNotes(id);
    updateClock(); 
}

function handleHash() {
    const hash = window.location.hash;
    const match = hash.match(/#\/session\/(\d+)/);
    if (match) {
        const sessionId = parseInt(match[1]);
        if (sessionId !== currentSessionId) {
            selectSession(sessionId);
        }
    }
}

window.addEventListener('hashchange', handleHash);

async function init() {
    await fetchSessions();
    handleHash();

    // Desktop Palette
    document.querySelectorAll('.color-opt').forEach(opt => {
        opt.onclick = () => updateColorSelection(opt.dataset.color);
    });

    // Mobile Sheet Palette
    document.querySelectorAll('.sheet-color-opt').forEach(opt => {
        opt.onclick = () => {
            updateColorSelection(opt.dataset.color);
            toggleSheet(false);
        };
    });

    // Mobile Toggle
    const mobileToggle = document.getElementById('mobile-color-toggle');
    if (mobileToggle) mobileToggle.onclick = () => toggleSheet(true);
    
    const sheetBackdrop = document.getElementById('bottom-sheet-backdrop');
    if (sheetBackdrop) sheetBackdrop.onclick = () => toggleSheet(false);
    
    const closeSheetBtn = document.getElementById('close-sheet-btn');
    if (closeSheetBtn) closeSheetBtn.onclick = () => toggleSheet(false);
}

function updateColorSelection(color) {
    selectedColor = color;
    document.querySelectorAll('.color-opt, .sheet-color-opt').forEach(o => {
        o.classList.toggle('selected', o.dataset.color === color);
    });
    const toggle = document.getElementById('mobile-color-toggle');
    if (toggle) toggle.style.setProperty('--selected-color', color || '');
}

function toggleSheet(open) {
    const sheet = document.getElementById('bottom-sheet');
    const backdrop = document.getElementById('bottom-sheet-backdrop');
    if (sheet) sheet.classList.toggle('open', open);
    if (backdrop) backdrop.classList.toggle('open', open);
}

document.getElementById('new-session-btn').onclick = createSession;
document.getElementById('send-note-btn').onclick = sendNote;
document.getElementById('note-input').onkeypress = (e) => {
    if (e.key === 'Enter') sendNote();
};
document.getElementById('note-input').oninput = (e) => {
    const value = e.target.value;
    
    if (value.length > 0) {
        // If typing, clear any pending reset timeout and capture if needed
        if (draftResetTimeout) {
            clearTimeout(draftResetTimeout);
            draftResetTimeout = null;
        }
        captureDraftTimestamp();
    } else {
        // If empty, start the 500ms cooldown before clearing the timestamp
        if (!draftResetTimeout) {
            draftResetTimeout = setTimeout(() => {
                activeDraftTimestamp = null;
                draftResetTimeout = null;
                updateDraftDisplay();
            }, 500);
        }
    }
};
document.getElementById('menu-toggle').onclick = () => {
    document.getElementById('sidebar').classList.toggle('open');
};
document.getElementById('theme-toggle').onclick = () => {
    document.body.classList.toggle('dark-mode');
    const isDark = document.body.classList.contains('dark-mode');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    updateThemeIcon(isDark);
};

function updateThemeIcon(isDark) {
    const icon = document.getElementById('theme-icon');
    if (!icon) return;
    if (isDark) {
        icon.innerHTML = '<path d="M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9 9-4.03 9-9c0-.46-.04-.92-.1-1.36-.98 1.37-2.58 2.26-4.4 2.26-3.03 0-5.5-2.47-5.5-5.5 0-1.82.89-3.42 2.26-4.4-.44-.06-.9-.1-1.36-.1z"/>';
    } else {
        icon.innerHTML = '<path d="M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zM2 13h2c.55 0 1-.45 1-1s-.45-1-1-1H2c-.55 0-1 .45-1 1s.45 1 1 1zm18 0h2c.55 0 1-.45 1-1s-.45-1-1-1h-2c-.55 0-1 .45-1 1s.45 1 1 1zM11 2v2c0 .55.45 1 1 1s1-.45 1-1V2c0-.55-.45-1-1-1s-1 .45-1 1zm0 18v2c0 .55.45 1 1 1s1-.45 1-1v-2c0-.55-.45-1-1-1s-1 .45-1 1zM5.99 4.58c-.39-.39-1.03-.39-1.41 0s-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0s.39-1.03 0-1.41L5.99 4.58zm12.37 12.37c-.39-.39-1.03-.39-1.41 0s-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0s.39-1.03 0-1.41l-1.06-1.06zm1.06-12.37c-.39-.39-1.03-.39-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06c.39-.39.39-1.03 0-1.41zm-12.37 12.37c-.39-.39-1.03-.39-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06c.39-.39.39-1.03 0-1.41z"/>';
    }
}

updateThemeIcon(localStorage.getItem('theme') === 'dark');

document.getElementById('export-btn').onclick = () => {
    if (currentSessionId) {
        window.location.href = `/api/sessions/${currentSessionId}/export`;
    }
};

setInterval(async () => {
    if (currentSessionId) {
        const res = await fetch(`/api/sessions/${currentSessionId}`);
        const session = await res.json();
        currentSession = session;
        
        fetchNotes(currentSessionId);
    }
}, 1000);

async function fetchNotes(sessionId) {
    if (!sessionId) return;
    const res = await fetch(`/api/sessions/${sessionId}/notes`);
    const notes = await res.json();
    renderNotes(notes);
}

function renderNotes(notes) {
    const stream = document.getElementById('note-stream');
    
    // Clear empty state message if notes exist
    if (notes.length > 0) {
        const emptyMsg = stream.querySelector('div[style*="color: var(--secondary-color)"]');
        if (emptyMsg) emptyMsg.remove();
    } else if (stream.children.length === 0) {
        stream.innerHTML = '<div style="color: var(--secondary-color); text-align: center; margin-top: 2rem;">No notes yet.</div>';
    }

    // Track current editing state to avoid overwriting
    const editingNoteId = document.querySelector('.note.editing')?.dataset.noteId;

    // We'll rebuild the stream only if no one is editing, or use a more careful update
    // For simplicity in this POC, we'll keep existing elements if they're being edited.
    
    const existingNotes = Array.from(stream.querySelectorAll('.note'));
    const existingIds = new Set(existingNotes.map(n => n.dataset.noteId));

    notes.forEach(note => {
        if (note.id.toString() === editingNoteId) return; // Skip update for the note being edited

        const existingEl = existingNotes.find(n => n.dataset.noteId === note.id.toString());
        
        if (existingEl) {
            // Update content only if it changed and not focused
            const contentEl = existingEl.querySelector('.content');
            if (contentEl && contentEl.textContent !== note.content) {
                contentEl.textContent = note.content;
            }
            // Update color if needed
            if (note.color) {
                existingEl.style.borderLeft = `4px solid ${note.color}`;
                const tint = note.color.length === 7 ? note.color + '15' : note.color;
                existingEl.style.backgroundColor = tint;
            }
        } else {
            // Create new note
            const div = document.createElement('div');
            div.className = 'note';
            div.dataset.noteId = note.id;
            if (note.color) {
                div.style.borderLeft = `4px solid ${note.color}`;
                const tint = note.color.length === 7 ? note.color + '15' : note.color;
                div.style.backgroundColor = tint;
            }
            
            const displayTime = formatDuration(note.timestamp, 1);
            
            div.innerHTML = `
                <span class="timestamp">${displayTime}</span>
                <span class="content">${note.content}</span>
                <div class="note-actions">
                    <button class="edit-btn" title="Edit Note">✎</button>
                    <button class="save-btn" title="Save" style="display:none;">✓</button>
                    <button class="cancel-btn" title="Cancel" style="display:none;">✕</button>
                </div>
            `;

            const editBtn = div.querySelector('.edit-btn');
            const saveBtn = div.querySelector('.save-btn');
            const cancelBtn = div.querySelector('.cancel-btn');

            editBtn.onclick = () => toggleEditMode(div, true);
            cancelBtn.onclick = () => toggleEditMode(div, false);
            saveBtn.onclick = () => saveEdit(div);

            stream.appendChild(div);
            stream.scrollTop = stream.scrollHeight;
        }
    });

    // Remove notes that no longer exist (optional, but good for cleanup)
    const newIds = new Set(notes.map(n => n.id.toString()));
    existingNotes.forEach(n => {
        if (!newIds.has(n.dataset.noteId) && n.dataset.noteId !== editingNoteId) {
            n.remove();
        }
    });
}

/**
 * Saves the edited content of a note.
 * @param {HTMLElement} noteEl 
 */
async function saveEdit(noteEl) {
    const noteId = noteEl.dataset.noteId;
    const textarea = noteEl.querySelector('textarea');
    const newContent = textarea.value.trim();

    if (!newContent) return;

    const res = await fetch(`/api/sessions/${currentSessionId}/notes/${noteId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newContent })
    });

    if (res.ok) {
        // Exit edit mode and let the next heartbeat update the text
        activeEditingId = null;
        const span = document.createElement('span');
        span.className = 'content';
        span.textContent = newContent;
        textarea.replaceWith(span);

        noteEl.classList.remove('editing');
        noteEl.querySelector('.edit-btn').style.display = 'inline-block';
        noteEl.querySelector('.save-btn').style.display = 'none';
        noteEl.querySelector('.cancel-btn').style.display = 'none';
        
        fetchNotes(currentSessionId);
    }
}

/**
 * Toggles edit mode for a specific note element.
 * @param {HTMLElement} noteEl - The note container element.
 * @param {boolean} editing - Whether to enter or exit edit mode.
 */
function toggleEditMode(noteEl, editing) {
    const contentEl = noteEl.querySelector('.content');
    const editBtn = noteEl.querySelector('.edit-btn');
    const saveBtn = noteEl.querySelector('.save-btn');
    const cancelBtn = noteEl.querySelector('.cancel-btn');

    if (editing) {
        noteEl.classList.add('editing');
        const currentText = contentEl.textContent;
        noteEl.dataset.originalContent = currentText; // Store for cancellation

        const textarea = document.createElement('textarea');
        textarea.value = currentText;
        contentEl.replaceWith(textarea);
        
        // Auto-expand logic
        const adjustHeight = () => {
            textarea.style.height = 'auto';
            textarea.style.height = textarea.scrollHeight + 'px';
        };
        textarea.oninput = adjustHeight;
        
        // Shortcuts
        textarea.onkeydown = (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                saveEdit(noteEl);
            } else if (e.key === 'Escape') {
                toggleEditMode(noteEl, false);
            }
        };

        // Blur handling (cancel if not clicking save/cancel)
        textarea.onblur = (e) => {
            // Use setTimeout to allow click events on buttons to fire first
            setTimeout(() => {
                if (noteEl.classList.contains('editing') && 
                    document.activeElement !== saveBtn && 
                    document.activeElement !== cancelBtn) {
                    toggleEditMode(noteEl, false);
                }
            }, 150);
        };

        textarea.focus();
        adjustHeight();

        editBtn.style.display = 'none';
        saveBtn.style.display = 'inline-block';
        cancelBtn.style.display = 'inline-block';
    } else {
        noteEl.classList.remove('editing');
        const textarea = noteEl.querySelector('textarea');
        const originalText = noteEl.dataset.originalContent;

        const span = document.createElement('span');
        span.className = 'content';
        span.textContent = originalText;
        textarea.replaceWith(span);

        editBtn.style.display = 'inline-block';
        saveBtn.style.display = 'none';
        cancelBtn.style.display = 'none';
    }
}


async function sendNote() {
    const input = document.getElementById('note-input');
    const content = input.value.trim();
    if (!content || !currentSessionId) return;

    // Use activeDraftTimestamp if set, otherwise fallback to current time
    let timestamp = activeDraftTimestamp;
    if (timestamp === null) {
        if (currentSession && currentSession.started_at) {
            const start = new Date(currentSession.started_at).getTime();
            const now = Date.now();
            timestamp = (now - start) / 1000;
        } else {
            timestamp = getSecondsSinceMidnight();
        }
    }

    const res = await fetch(`/api/sessions/${currentSessionId}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, timestamp, color: selectedColor })
    });
    
    if (res.ok) {
        input.value = '';
        activeDraftTimestamp = null; // Clear draft state
        if (draftResetTimeout) {
            clearTimeout(draftResetTimeout);
            draftResetTimeout = null;
        }
        updateDraftDisplay();
        fetchNotes(currentSessionId);
    }
}

init();