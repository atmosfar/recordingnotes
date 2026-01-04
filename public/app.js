let currentSessionId = null;

async function fetchSessions() {
    const res = await fetch('/api/sessions');
    const sessions = await res.json();
    renderSessionList(sessions);
}

function renderSessionList(sessions) {
    const list = document.getElementById('session-list');
    list.innerHTML = '';
    sessions.forEach(session => {
        const item = document.createElement('div');
        item.className = 'session-item';
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
    const res = await fetch(`/api/sessions/${id}`);
    const session = await res.json();
    
    document.getElementById('session-info').textContent = `Active Session: ${session.name}`;
    document.getElementById('input-area').style.display = 'flex';
    document.getElementById('export-btn').style.display = 'block';
    
    // Trigger note fetching (next task)
    if (window.fetchNotes) {
        window.fetchNotes(id);
    }
}

document.getElementById('new-session-btn').onclick = createSession;
document.getElementById('export-btn').onclick = () => {
    if (currentSessionId) {
        window.location.href = `/api/sessions/${currentSessionId}/export`;
    }
};

// Initial load
fetchSessions();