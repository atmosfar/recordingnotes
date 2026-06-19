import { state } from './state.js';
import { socket } from './socket.js';
import { tagManager } from './tags.js';
import { displayTimestamp, compareTimestamps } from './utils.js';

/**
 * Render notes into the note stream. Handles both new notes and updates.
 */
export function renderNotes(notes) {
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
            timestampSpan.textContent = displayTimestamp(note, state.currentSession);
            timestampSpan.setAttribute('aria-label', `Timestamp: ${displayTimestamp(note, state.currentSession)}`);

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
                <button class="save-btn" title="Save" aria-label="Save note">Save</button>
                <button class="delete-btn" title="Delete Note" aria-label="Delete note">Delete</button>
                <button class="confirm-del-btn" title="Confirm Delete" aria-label="Confirm delete">Confirm Del.</button>
                <button class="cancel-btn" title="Cancel" aria-label="Cancel editing">Cancel</button>
            `;

            div.appendChild(timestampSpan);
            div.appendChild(contentWrapper);
            div.appendChild(actionsDiv);

            // Helper: close editing/delete-confirm on all other notes (desktop)
            const closeOtherNotesActions = (self) => {
                if (window.innerWidth > 768) {
                    document.querySelectorAll('.note.editing, .note.delete-confirm').forEach(other => {
                        if (other !== self) {
                            if (other.classList.contains('editing')) toggleEditMode(other, false);
                            other.classList.remove('delete-confirm');
                        }
                    });
                }
            };

            div.querySelector('.edit-btn').onclick = () => { closeOtherNotesActions(div); toggleEditMode(div, true); };
            div.querySelector('.delete-btn').onclick = () => {
                closeOtherNotesActions(div);
                div.classList.remove('editing');
                showDeleteConfirm(div);
            };
            div.querySelector('.save-btn').onclick = () => { closeOtherNotesActions(div); saveEdit(div); };
            div.querySelector('.cancel-btn').onclick = () => {
                closeOtherNotesActions(div);
                if (div.classList.contains('editing')) {
                    toggleEditMode(div, false);
                } else if (div.classList.contains('delete-confirm')) {
                    div.classList.remove('delete-confirm');
                }
            };
            div.querySelector('.confirm-del-btn').onclick = () => { closeOtherNotesActions(div); deleteNote(div); };

            // Long-press to enter edit mode (mobile)
            let lpTimer = null;
            let lpStartX = 0, lpStartY = 0;
            let lpTriggered = false;
            let wasTouched = false;
            const LP_MS = 600;
            const LP_TOLERANCE = 12;

            const lpClear = () => { if (lpTimer) { clearTimeout(lpTimer); lpTimer = null; } };

            const lpAction = () => {
                lpTriggered = true;
                document.querySelectorAll('.note.editing').forEach(other => {
                    if (other !== div) toggleEditMode(other, false);
                });
                toggleEditMode(div, true);
            };

            const lpGuards = (e) => {
                if (window.innerWidth > 768) return false;
                if (div.classList.contains('editing')) return false;
                if (e.target.closest('.note-actions')) return false;
                if (e.type === 'mousedown' && wasTouched) return false;
                return true;
            };

            const lpStart = (x, y, e) => {
                if (!lpGuards(e)) return;
                lpClear();
                lpTriggered = false;
                lpStartX = x; lpStartY = y;
                lpTimer = setTimeout(lpAction, LP_MS);
            };

            const lpMove = (x, y) => {
                if (!lpTimer) return;
                if (Math.hypot(x - lpStartX, y - lpStartY) > LP_TOLERANCE) lpClear();
            };

            const lpEnd = () => {
                lpClear();
                setTimeout(() => { wasTouched = false; }, 1500);
            };

            // Touch
            div.addEventListener('touchstart', (e) => {
                if (e.touches.length > 1) return;
                wasTouched = true;
                const t = e.touches[0];
                lpStart(t.clientX, t.clientY, e);
            }, { passive: true });

            div.addEventListener('touchmove', (e) => {
                if (!e.touches.length) return;
                const t = e.touches[0];
                lpMove(t.clientX, t.clientY);
            }, { passive: true });

            div.addEventListener('touchend', lpEnd, { passive: true });
            div.addEventListener('touchcancel', lpEnd, { passive: true });

            // Mouse
            div.addEventListener('mousedown', (e) => {
                if (e.button !== 0) return;
                lpStart(e.clientX, e.clientY, e);
            });

            document.addEventListener('mousemove', (e) => {
                if (!lpTimer) return;
                lpMove(e.clientX, e.clientY);
            });

            document.addEventListener('mouseup', (e) => {
                if (e.button !== 0) return;
                lpEnd();
            });

            // Prevent native context menu
            div.addEventListener('contextmenu', (e) => e.preventDefault(), { passive: false });

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

/**
 * Toggle a note into/out of edit mode.
 */
export function toggleEditMode(noteEl, editing) {
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
        wrapper.style.height = rect.height + 'px';

        ta.value = span.textContent;
        autosizeEditArea(ta);

        ta.onkeydown = (e) => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveEdit(noteEl); }
            else if (e.key === 'Escape') toggleEditMode(noteEl, false);
        };
        ta.oninput = () => {
            autosizeEditArea(ta);
            wrapper.style.height = ta.scrollHeight + 'px';
        };

        ta.focus();
    } else {
        noteEl.classList.remove('editing');
        noteEl.classList.remove('delete-confirm');

        // Copy value back to span
        span.textContent = ta.value;

        // Unlock wrapper
        wrapper.style.width = '';
        wrapper.style.height = '';
    }
}

/**
 * Auto-resize a textarea to fit its content.
 */
export function autosizeEditArea(ta) {
    ta.style.height = '0px';
    ta.style.height = ta.scrollHeight + 'px';
}

/**
 * Save an edited note via WebSocket.
 */
export async function saveEdit(noteEl) {
    const noteId = noteEl.dataset.noteId;
    const ta = noteEl.querySelector('.edit-area');
    if (!ta) return;
    const newContent = ta.value.trim();
    if (!newContent) return;

    socket.send('UPDATE_NOTE', { noteId, content: newContent });
    toggleEditMode(noteEl, false);
}

/**
 * Show the delete confirmation state on a note.
 */
export function showDeleteConfirm(noteEl) {
    noteEl.classList.add('delete-confirm');
}

/**
 * Delete a note via WebSocket.
 */
export function deleteNote(noteEl) {
    const noteId = noteEl.dataset.noteId;
    socket.send('DELETE_NOTE', { noteId });
    noteEl.remove();
}

/**
 * Send a new note via WebSocket.
 */
export async function sendNote() {
    const input = document.getElementById('note-input');
    if (!input || input.disabled) return;
    let content = input.value.trim();

    // Repeat last note if input is empty
    if (!content && state.lastManualNoteContent) {
        content = state.lastManualNoteContent;
    }

    if (!content || !state.currentSessionId) return;

    // Save for next repeat
    state.lastManualNoteContent = content;

    const timestamp = state.activeDraftTimestamp !== null ? state.activeDraftTimestamp : Date.now();

    socket.send('CREATE_NOTE', {
        payload: { content, timestamp, color: state.selectedColor, timer_position_ms: state.activeDraftTimerPositionMs }
    });

    input.value = '';
    state.activeDraftTimestamp = null;
    state.activeDraftTimerPositionMs = null;
    if (state.draftResetTimeout) { clearTimeout(state.draftResetTimeout); state.draftResetTimeout = null; }
    updateDraftDisplay();
}

/**
 * Capture a draft timestamp when the user starts typing.
 */
export function captureDraftTimestamp() {
    if (state.activeDraftTimestamp !== null) return;
    // Block draft timestamp capture when timer is stopped
    if (state.currentSession && state.currentSession.timestamp_mode === 'timer' && (!state.currentSession.started_at || state.currentSession.stopped_at)) {
        return;
    }
    state.activeDraftTimestamp = Date.now();

    // Freeze the timer position at the moment the draft is captured.
    // This is critical for multi-run sessions: the position is locked to
    // the run that was active when the user started typing, not the run
    // that happens when they eventually hit Enter.
    if (state.currentSession && state.currentSession.timestamp_mode === 'timer' && state.currentSession.started_at) {
        const sessionStartMs = new Date(state.currentSession.started_at).getTime();
        const elapsedMs = state.currentSession.elapsed_ms || 0;
        state.activeDraftTimerPositionMs = elapsedMs + (Date.now() - sessionStartMs);
    } else {
        state.activeDraftTimerPositionMs = null;
    }
    updateDraftDisplay();
}

/**
 * Update the draft timestamp display element.
 */
export function updateDraftDisplay() {
    const displayEl = document.getElementById('draft-timestamp-display');
    if (!displayEl) return;
    if (state.activeDraftTimestamp !== null) {
        // Create a pseudo-note object for displayTimestamp.
        // Include the frozen timer position so displayTimestamp uses it
        // directly — correct regardless of session state changes (stop/start).
        const pseudoNote = {
            timestamp_ms: state.activeDraftTimestamp,
            timer_position_ms: state.activeDraftTimerPositionMs
        };
        displayEl.textContent = displayTimestamp(pseudoNote, state.currentSession);
        displayEl.style.display = 'block';
    } else {
        displayEl.style.display = 'none';
    }
}

/**
 * Render quick tag buttons in the input area.
 */
export function renderQuickTags() {
    const list = document.getElementById('quick-tags-list');
    if (!list) return;
    list.innerHTML = '';
    tagManager.getTags().forEach(tag => {
        const btn = document.createElement('button');
        btn.className = 'tag-btn';
        btn.textContent = tag;
        btn.setAttribute('aria-label', `Quick tag: ${tag}`);
        btn.onclick = () => {
            // Block note creation if timer mode and timer not running
            if (state.currentSession && state.currentSession.timestamp_mode === 'timer' && (!state.currentSession.started_at || state.currentSession.stopped_at)) {
                return;
            }
            const timestamp = Date.now();
            socket.send('CREATE_NOTE', {
                payload: { content: tag, timestamp, color: state.selectedColor }
            });
        };
        list.appendChild(btn);
    });
}
