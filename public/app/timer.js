import { state } from './state.js';
import { formatDuration } from './utils.js';

/**
 * Update recording state visual indicators (body class, input state).
 */
export function updateRecordingState() {
    if (document.body.classList.contains('session-not-found')) {
        document.body.classList.add('recording');
        return;
    }
    const isRecording = state.currentSession && state.currentSession.started_at && !state.currentSession.stopped_at;
    document.body.classList.toggle('recording', !!isRecording);

    // Update input state
    const input = document.getElementById('note-input');
    if (input) {
        const isTimerStopped = state.currentSession
            && state.currentSession.timestamp_mode === 'timer'
            && (!state.currentSession.started_at || state.currentSession.stopped_at);

        document.body.classList.toggle('timer-stopped', !!isTimerStopped);

        if (isTimerStopped) {
            input.placeholder = 'Timer stopped - start timer to add notes';
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

/**
 * Update the live clock/timer display. Called every 100ms.
 */
export function updateClock() {
    const clockEl = document.getElementById('live-clock');
    if (!clockEl) return;

    const infoEl = document.getElementById('session-info');
    const headerTitle = document.getElementById('header-session-title');

    if (state.currentSession) {
        if (state.currentSession.timestamp_mode === 'timer') {
            const elapsedMs = state.currentSession.elapsed_ms || 0;

            if (state.currentSession.started_at && !state.currentSession.stopped_at) {
                // Timer running: elapsed + current run
                // Use clientRunStart (captured at button press) for display
                // to avoid drift from server timestamp round-trip
                const runStart = state.clientRunStart || new Date(state.currentSession.started_at).getTime();
                const totalMs = elapsedMs + (Date.now() - runStart);
                clockEl.textContent = formatDuration(totalMs / 1000, 1);
                if (infoEl) infoEl.textContent = `🔴 RECORDING: ${state.currentSession.name}`;
            } else if (elapsedMs > 0 || (state.currentSession.last_run_ms || 0) > 0) {
                // Timer stopped: show accumulated time (elapsed_ms + last_run_ms)
                const totalMs = elapsedMs + (state.currentSession.last_run_ms || 0);
                clockEl.textContent = formatDuration(totalMs / 1000, 1);
                if (infoEl) infoEl.textContent = `FINISHED: ${state.currentSession.name}`;
            } else {
                // Timer never started
                clockEl.textContent = '00:00:00.0';
                if (infoEl) infoEl.textContent = state.currentSession.name;
            }
        } else {
            // Clock mode: time-of-day
            const now = new Date();
            const ssm = (now.getHours() * 3600) + (now.getMinutes() * 60) + now.getSeconds() + (now.getMilliseconds() / 1000);
            clockEl.textContent = formatDuration(ssm, 1);
            if (infoEl) infoEl.textContent = state.currentSession.name;
        }
        if (headerTitle && headerTitle.textContent !== state.currentSession.name) headerTitle.textContent = state.currentSession.name;
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

// Start the clock ticker
setInterval(updateClock, 100);

/**
 * Show/hide timer control buttons in the overflow menu.
 */
export function updateTimerMenuVisibility() {
    const startBtn = document.getElementById('menu-timer-start');
    const stopBtn = document.getElementById('menu-timer-stop');
    const resetBtn = document.getElementById('menu-timer-reset');

    if (!startBtn || !stopBtn || !resetBtn) return;

    if (!state.currentSession) {
        startBtn.style.display = 'none';
        stopBtn.style.display = 'none';
        resetBtn.style.display = 'none';
        return;
    }

    const isTimer = state.currentSession.timestamp_mode === 'timer';
    const isRunning = isTimer && state.currentSession.started_at && !state.currentSession.stopped_at;
    const hasElapsed = isTimer && (state.currentSession.started_at || (state.currentSession.elapsed_ms || 0) > 0);
    // Show Start for timer mode (stopped/never started) AND clock mode (to allow switching)
    const canStart = !isRunning;

    startBtn.style.display = canStart ? 'flex' : 'none';
    stopBtn.style.display = isRunning ? 'flex' : 'none';
    resetBtn.style.display = hasElapsed ? 'flex' : 'none';
}

/**
 * Show/hide session-dependent menu items (share, export).
 */
export function updateSessionMenuVisibility() {
    const shareLink = document.getElementById('menu-share-link');
    if (shareLink) {
        shareLink.style.display = state.currentSessionId && !window.isGuestMode ? 'flex' : 'none';
    }

    const items = ['menu-export-reaper', 'menu-export-audition', 'menu-export-edl'];
    const show = !!state.currentSessionId;
    items.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = show ? 'flex' : 'none';
    });
}

/**
 * Start the session timer via API.
 */
export async function startTimer() {
    if (!state.currentSessionId) return;
    state.clientRunStart = Date.now();
    try {
        const res = await fetch(`/api/sessions/${state.currentSessionId}/timer/start`, { method: 'POST' });
        if (res.ok) {
            const data = await res.json();
            Object.assign(state.currentSession, data.session);
            updateClock();
            updateTimerMenuVisibility();
        }
    } catch (err) {
        console.error('startTimer error:', err);
    }
}

/**
 * Stop the session timer via API.
 */
export async function stopTimer() {
    if (!state.currentSessionId) return;
    state.clientRunStart = null;
    try {
        const res = await fetch(`/api/sessions/${state.currentSessionId}/timer/stop`, { method: 'POST' });
        if (res.ok) {
            const data = await res.json();
            Object.assign(state.currentSession, data.session);
            updateClock();
            updateTimerMenuVisibility();
        }
    } catch (err) {
        console.error('stopTimer error:', err);
    }
}

/**
 * Reset the session timer via API.
 */
export async function resetTimer() {
    if (!state.currentSessionId) return;
    state.clientRunStart = null;
    try {
        const res = await fetch(`/api/sessions/${state.currentSessionId}/timer/reset`, { method: 'POST' });
        if (res.ok) {
            const data = await res.json();
            Object.assign(state.currentSession, data.session);
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

/**
 * Show the timer reset warning modal.
 */
export function showTimerResetWarning(message) {
    const modal = document.getElementById('timer-warning-modal');
    const msgEl = document.getElementById('timer-warning-message');
    const backdrop = document.getElementById('bottom-sheet-backdrop');
    if (!modal || !msgEl) return;
    msgEl.textContent = message;
    modal.style.display = 'flex';
    modal.setAttribute('aria-hidden', 'false');
    if (backdrop) {
        backdrop.style.display = 'block';
        backdrop.style.opacity = '1';
    }
    document.getElementById('timer-warning-ok').focus();
}
