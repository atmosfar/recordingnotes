let currentSessionId = null;
let selectedColor = "";

// Live Clock
function updateClock() {
    const now = new Date();
    const clockEl = document.getElementById('live-clock');
    if (clockEl) clockEl.textContent = now.toTimeString().split(' ')[0];
}
setInterval(updateClock, 1000);
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
    const session = await res.json();
    
    document.getElementById('session-info').textContent = session.name;
    document.getElementById('input-area').style.display = 'flex';
    document.getElementById('export-btn').style.display = 'block';
    document.getElementById('sidebar').classList.remove('open');
    
    fetchNotes(id);
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
    document.getElementById('mobile-color-toggle').onclick = () => toggleSheet(true);
    document.getElementById('bottom-sheet-backdrop').onclick = () => toggleSheet(false);
    document.getElementById('close-sheet-btn').onclick = () => toggleSheet(false);
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
    document.getElementById('bottom-sheet').classList.toggle('open', open);
    document.getElementById('bottom-sheet-backdrop').classList.toggle('open', open);
}

document.getElementById('new-session-btn').onclick = createSession;
document.getElementById('send-note-btn').onclick = sendNote;
document.getElementById('note-input').onkeypress = (e) => {
    if (e.key === 'Enter') sendNote();
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
    if (isDark) {
        // Moon icon path
        icon.innerHTML = '<path d="M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9 9-4.03 9-9c0-.46-.04-.92-.1-1.36-.98 1.37-2.58 2.26-4.4 2.26-3.03 0-5.5-2.47-5.5-5.5 0-1.82.89-3.42 2.26-4.4-.44-.06-.9-.1-1.36-.1z"/>';
    } else {
        // Sun icon path
        icon.innerHTML = '<path d="M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zM2 13h2c.55 0 1-.45 1-1s-.45-1-1-1H2c-.55 0-1 .45-1 1s.45 1 1 1zm18 0h2c.55 0 1-.45 1-1s-.45-1-1-1h-2c-.55 0-1 .45-1 1s.45 1 1 1zM11 2v2c0 .55.45 1 1 1s1-.45 1-1V2c0-.55-.45-1-1-1s-1 .45-1 1zm0 18v2c0 .55.45 1 1 1s1-.45 1-1v-2c0-.55-.45-1-1-1s-1 .45-1 1zM5.99 4.58c-.39-.39-1.03-.39-1.41 0s-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0s.39-1.03 0-1.41L5.99 4.58zm12.37 12.37c-.39-.39-1.03-.39-1.41 0s-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0s.39-1.03 0-1.41l-1.06-1.06zm1.06-12.37c-.39-.39-1.03-.39-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06c.39-.39.39-1.03 0-1.41zm-12.37 12.37c-.39-.39-1.03-.39-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06c.39-.39.39-1.03 0-1.41z"/>';
    }
}

// Set initial icon
updateThemeIcon(localStorage.getItem('theme') === 'dark');

document.getElementById('export-btn').onclick = () => {
    if (currentSessionId) {
        window.location.href = `/api/sessions/${currentSessionId}/export`;
    }
};

setInterval(() => {
    if (currentSessionId) fetchNotes(currentSessionId);
}, 200);

async function fetchNotes(sessionId) {
    if (!sessionId) return;
    const res = await fetch(`/api/sessions/${sessionId}/notes`);
    const notes = await res.json();
    renderNotes(notes);
}

function renderNotes(notes) {
    const stream = document.getElementById('note-stream');
    stream.innerHTML = '';
    notes.forEach(note => {
        const div = document.createElement('div');
        div.className = 'note';
        if (note.color) {
            div.style.borderLeft = `4px solid ${note.color}`;
            const tint = note.color.length === 7 ? note.color + '15' : note.color;
            div.style.backgroundColor = tint;
        }
        div.innerHTML = `
            <span class="timestamp">${note.timestamp}</span>
            <span class="content">${note.content}</span>
        `;
        stream.appendChild(div);
    });
    stream.scrollTop = stream.scrollHeight;
}

async function sendNote() {
    const input = document.getElementById('note-input');
    const content = input.value.trim();
    if (!content || !currentSessionId) return;

    const now = new Date();
    const timestamp = now.toTimeString().split(' ')[0];

    const res = await fetch(`/api/sessions/${currentSessionId}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, timestamp, color: selectedColor })
    });
    
    if (res.ok) {
        input.value = '';
        fetchNotes(currentSessionId);
    }
}

init();
