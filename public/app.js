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
    
        // Trigger note fetching
    
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
    
                <span class="user">Producer</span>
    
                <span class="content">${note.content}</span>
    
            `;
    
            stream.appendChild(div);
    
        });
    
        // Scroll to bottom
    
        stream.scrollTop = stream.scrollHeight;
    
    }
    
    
    
    async function sendNote() {
    
        const input = document.getElementById('note-input');
    
        const content = input.value.trim();
    
        if (!content || !currentSessionId) return;
    
    
    
        // Use current time as timestamp for now
    
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
    
    
    
    document.getElementById('new-session-btn').onclick = createSession;
    
    document.getElementById('send-note-btn').onclick = sendNote;
    
    document.getElementById('note-input').onkeypress = (e) => {
    
        if (e.key === 'Enter') sendNote();
    
    };
    
    document.getElementById('export-btn').onclick = () => {
    
        if (currentSessionId) {
    
            window.location.href = `/api/sessions/${currentSessionId}/export`;
    
        }
    
    };
    
    
    
    // Polling for updates
    
    setInterval(() => {
    
        if (currentSessionId) fetchNotes(currentSessionId);
    
    }, 3000);
    
    
    
    // Initial load
    
    fetchSessions();
    
    