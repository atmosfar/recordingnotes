let currentSessionId = null;

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
    renderSessionList(window.lastSessions || []); // Immediate visual feedback
    const res = await fetch(`/api/sessions/${id}`);
    const session = await res.json();
    
    document.getElementById('session-info').textContent = session.name;
    document.getElementById('input-area').style.display = 'flex';
    document.getElementById('export-btn').style.display = 'block';
    
    // Close sidebar on mobile
    document.getElementById('sidebar').classList.remove('open');
    
    fetchNotes(id);
}

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
        if (note.color) div.style.borderLeft = `4px solid ${note.color}`;
        
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
        body: JSON.stringify({ content, timestamp })
    });
    
    if (res.ok) {
        input.value = '';
        fetchNotes(currentSessionId);
    }
}

// Event Listeners
document.getElementById('new-session-btn').onclick = createSession;
document.getElementById('send-note-btn').onclick = sendNote;
document.getElementById('note-input').onkeypress = (e) => {
    if (e.key === 'Enter') sendNote();
};
document.getElementById('menu-toggle').onclick = () => {
    document.getElementById('sidebar').classList.toggle('open');
};
document.getElementById('export-btn').onclick = () => {
    if (currentSessionId) {
        window.location.href = `/api/sessions/${currentSessionId}/export`;
    }
};

// Polling
setInterval(() => {
    if (currentSessionId) fetchNotes(currentSessionId);
}, 200);

fetchSessions();