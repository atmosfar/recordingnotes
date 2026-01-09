let currentSessionId = null;
let currentSession = null;
let selectedColor = "";
let activeDraftTimestamp = null;
let draftResetTimeout = null;

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
    const isRecording = currentSession && currentSession.started_at && !currentSession.stopped_at;
    document.body.classList.toggle('recording', isRecording);
    
    // Update placeholders
    const input = document.getElementById('note-input');
    if (window.innerWidth <= 768) {
        input.placeholder = "Type a note";
    } else {
        input.placeholder = "Type a note and press Enter...";
    }
}

function updateClock() {
    const clockEl = document.getElementById('live-clock');
    if (!clockEl) return;

    const infoEl = document.getElementById('session-info');
    const mobileTitle = document.getElementById('mobile-session-title');

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
        if (mobileTitle) mobileTitle.textContent = currentSession.name;
    } else {
        // No session selected
        const now = new Date();
        const ssm = (now.getHours() * 3600) + (now.getMinutes() * 60) + now.getSeconds() + (now.getMilliseconds() / 1000);
        clockEl.textContent = formatDuration(ssm, 1);
        if (mobileTitle) mobileTitle.textContent = "RecNotes";
        if (infoEl) infoEl.textContent = "No Session";
    }
    updateRecordingState();
}

setInterval(updateClock, 100);

// Data Fetching
async function fetchSessions() {
    const res = await fetch('/api/sessions');
    const sessions = await res.json();
    window.lastSessions = sessions;
    renderSessionList(sessions);
}

function renderSessionList(sessions) {
    const list = document.getElementById('session-list');
    if (!list) return;
    list.innerHTML = '';
    sessions.forEach(session => {
        const item = document.createElement('div');
        item.className = 'session-item' + (session.id === currentSessionId ? ' active' : '');
        item.textContent = session.name;
        item.onclick = () => selectSession(session.id);
        list.appendChild(item);
    });
}

async function selectSession(id) {
    currentSessionId = id;
    window.location.hash = `#/session/${id}`;
    renderSessionList(window.lastSessions || []);
    
    const stream = document.getElementById('note-stream');
    if (stream) stream.innerHTML = '';
    
    const res = await fetch(`/api/sessions/${id}`);
    currentSession = await res.json();
    
    document.getElementById('input-area').style.display = 'block';
    const exportBtn = document.getElementById('export-btn');
    if (exportBtn) exportBtn.style.display = 'block';
    document.getElementById('sidebar').classList.remove('open');
    
    fetchNotes(id);
    updateClock(); 
}

async function fetchNotes(sessionId) {
    if (!sessionId) return;
    const res = await fetch(`/api/sessions/${sessionId}/notes`);
    const notes = await res.json();
    renderNotes(notes);
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
            if (note.color) {
                div.style.borderLeft = `4px solid ${note.color}`;
                div.style.backgroundColor = note.color + '15';
            }
            
            div.innerHTML = `
                <span class="timestamp">${formatDuration(note.timestamp, 1)}</span>
                <span class="content">${note.content}</span>
                <div class="note-actions">
                    <button class="edit-btn" title="Edit Note">✎</button>
                    <button class="save-btn" title="Save" style="display:none;">✓</button>
                    <button class="cancel-btn" title="Cancel" style="display:none;">✕</button>
                </div>
            `;

            div.querySelector('.edit-btn').onclick = () => toggleEditMode(div, true);
            div.querySelector('.cancel-btn').onclick = () => toggleEditMode(div, false);
            div.querySelector('.save-btn').onclick = () => saveEdit(div);
            div.onclick = () => {
                if (window.innerWidth <= 768 && !div.classList.contains('editing')) {
                    document.querySelectorAll('.note.reveal-actions').forEach(n => n !== div && n.classList.remove('reveal-actions'));
                    div.classList.toggle('reveal-actions');
                }
            };

            stream.appendChild(div);
            stream.scrollTop = stream.scrollHeight;
        }
    });
}

function toggleEditMode(noteEl, editing) {
    const contentEl = noteEl.querySelector('.content');
    const actions = ['edit-btn', 'save-btn', 'cancel-btn'].map(c => noteEl.querySelector('.' + c));

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
        actions[0].style.display = 'none';
        actions[1].style.display = 'inline-block';
        actions[2].style.display = 'inline-block';
    } else {
        noteEl.classList.remove('editing');
        const span = document.createElement('span');
        span.className = 'content';
        span.textContent = noteEl.dataset.originalContent;
        noteEl.querySelector('textarea').replaceWith(span);
        actions[0].style.display = 'inline-block';
        actions[1].style.display = 'none';
        actions[2].style.display = 'none';
    }
}

async function saveEdit(noteEl) {
    const noteId = noteEl.dataset.noteId;
    const textarea = noteEl.querySelector('textarea');
    if (!textarea) return;
    const newContent = textarea.value.trim();
    if (!newContent) return;

    const res = await fetch(`/api/sessions/${currentSessionId}/notes/${noteId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newContent })
    });

    if (res.ok) {
        noteEl.dataset.originalContent = newContent;
        toggleEditMode(noteEl, false);
        fetchNotes(currentSessionId);
    }
}

async function sendNote() {
    const input = document.getElementById('note-input');
    const content = input.value.trim();
    if (!content || !currentSessionId) return;

    const timestamp = activeDraftTimestamp !== null ? activeDraftTimestamp : (currentSession?.started_at ? (Date.now() - new Date(currentSession.started_at).getTime()) / 1000 : getSecondsSinceMidnight());

    const res = await fetch(`/api/sessions/${currentSessionId}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, timestamp, color: selectedColor })
    });
    
    if (res.ok) {
        input.value = '';
        activeDraftTimestamp = null;
        if (draftResetTimeout) { clearTimeout(draftResetTimeout); draftResetTimeout = null; }
        updateDraftDisplay();
        fetchNotes(currentSessionId);
    }
}

function updateColorSelection(color) {
    selectedColor = color;
    document.querySelectorAll('.color-opt, .sheet-color-opt').forEach(o => o.classList.toggle('selected', o.dataset.color === color));
    const toggle = document.getElementById('mobile-color-toggle');
    if (toggle) toggle.style.setProperty('--selected-color', color || '#eee');
}

function toggleSheet(open) {
    const sheet = document.getElementById('bottom-sheet');
    const backdrop = document.getElementById('bottom-sheet-backdrop');
    if (sheet) sheet.classList.toggle('open', open);
    if (backdrop) backdrop.classList.toggle('open', open);
}

function toggleOverflow(open) {
    const menu = document.getElementById('overflow-menu');
    if (menu) menu.classList.toggle('open', open);
}

async function init() {
    await fetchSessions();
    const match = window.location.hash.match(/#\/session\/(\d+)/);
    if (match) selectSession(match[1]);

    document.querySelectorAll('.color-opt').forEach(opt => opt.onclick = () => updateColorSelection(opt.dataset.color));
    document.querySelectorAll('.sheet-color-opt').forEach(opt => opt.onclick = () => { updateColorSelection(opt.dataset.color); toggleSheet(false); });

    document.getElementById('mobile-color-toggle').onclick = () => toggleSheet(true);
    document.getElementById('bottom-sheet-backdrop').onclick = () => { toggleSheet(false); toggleOverflow(false); };
    document.getElementById('close-sheet-btn').onclick = () => toggleSheet(false);
    
    // Close overflow menu if clicking anywhere else
    document.addEventListener('click', (e) => {
        const menu = document.getElementById('overflow-menu');
        const toggle = document.getElementById('overflow-menu-toggle');
        if (menu && menu.classList.contains('open') && !menu.contains(e.target) && !toggle.contains(e.target)) {
            toggleOverflow(false);
        }
    });
    
    document.getElementById('new-session-btn').onclick = () => {
        const name = prompt('Enter session name:');
        if (name) fetch('/api/sessions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) })
            .then(res => res.json()).then(data => data.id && fetchSessions().then(() => selectSession(data.id)));
    };
    
    document.getElementById('send-note-btn').onclick = sendNote;
    document.getElementById('note-input').onkeypress = (e) => e.key === 'Enter' && sendNote();
    document.getElementById('note-input').oninput = (e) => {
        if (e.target.value.length > 0) {
            if (draftResetTimeout) { clearTimeout(draftResetTimeout); draftResetTimeout = null; }
            captureDraftTimestamp();
        } else if (!draftResetTimeout) {
            draftResetTimeout = setTimeout(() => { activeDraftTimestamp = null; draftResetTimeout = null; updateDraftDisplay(); }, 500);
        }
    };

    document.getElementById('menu-toggle').onclick = () => document.getElementById('sidebar').classList.add('open');
    document.getElementById('close-sidebar').onclick = () => document.getElementById('sidebar').classList.remove('open');
    
    document.getElementById('overflow-menu-toggle').onclick = () => toggleOverflow(true);
    
    const themeToggleFn = (isDark) => {
        document.body.classList.toggle('dark-mode', isDark);
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
        const icon = document.getElementById('theme-icon');
        if (icon) {
            icon.innerHTML = isDark 
                ? '<path d="M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9 9-4.03 9-9c0-.46-.04-.92-.1-1.36-.98 1.37-2.58 2.26-4.4 2.26-3.03 0-5.5-2.47-5.5-5.5 0-1.82.89-3.42 2.26-4.4-.44-.06-.9-.1-1.36-.1z"/>'
                : '<path d="M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zM2 13h2c.55 0 1-.45 1-1s-.45-1-1-1H2c-.55 0-1 .45-1 1s.45 1 1 1zm18 0h2c.55 0 1-.45 1-1s-.45-1-1-1h-2c-.55 0-1 .45-1 1s.45 1 1 1zM11 2v2c0 .55.45 1 1 1s1-.45 1-1V2c0-.55-.45-1-1-1s-1 .45-1 1zm0 18v2c0 .55.45 1 1 1s1-.45 1-1v-2c0-.55-.45-1-1-1s-1 .45-1 1zM5.99 4.58c-.39-.39-1.03-.39-1.41 0s-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0s.39-1.03 0-1.41L5.99 4.58zm12.37 12.37c-.39-.39-1.03-.39-1.41 0s-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0s.39-1.03 0-1.41l-1.06-1.06zm1.06-12.37c-.39-.39-1.03-.39-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06c.39-.39.39-1.03 0-1.41zm-12.37 12.37c-.39-.39-1.03-.39-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06c.39-.39.39-1.03 0-1.41zm-12.37 12.37c-.39-.39-1.03-.39-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06c.39-.39.39-1.03 0-1.41z"/>';
        }
    };

    document.getElementById('theme-toggle').onclick = () => themeToggleFn(!document.body.classList.contains('dark-mode'));
    document.getElementById('mobile-theme-toggle').onclick = () => { themeToggleFn(!document.body.classList.contains('dark-mode')); toggleOverflow(false); };
    
    const exportFn = () => currentSessionId && (window.location.href = `/api/sessions/${currentSessionId}/export`);
    document.getElementById('export-btn').onclick = exportFn;
    document.getElementById('mobile-export-btn').onclick = () => { exportFn(); toggleOverflow(false); };

    themeToggleFn(localStorage.getItem('theme') === 'dark');
}

window.addEventListener('hashchange', () => {
    const m = window.location.hash.match(/#\/session\/(\d+)/);
    if (m && m[1] !== currentSessionId?.toString()) selectSession(m[1]);
});

setInterval(() => currentSessionId && fetch(`/api/sessions/${currentSessionId}`).then(r => r.json()).then(s => { currentSession = s; fetchNotes(currentSessionId); }), 1000);

init();
