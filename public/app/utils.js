/**
 * Formats duration in seconds to HH:MM:SS.s or HH:MM:SS.mmm
 */
export function formatDuration(seconds, precision = 0) {
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
export function compareTimestamps(t1, t2) {
    if (t1 < t2) return -1;
    if (t1 > t2) return 1;
    return 0;
}

/**
 * Display a note's timestamp in the appropriate format based on session mode.
 * Clock mode: convert UTC ms to local HH:MM:SS
 * Timer mode: elapsed seconds from session start
 */
export function displayTimestamp(note, session) {
    const ts = note.timestamp_ms;
    if (!session) return formatDuration(ts / 1000, 1);

    if (session.timestamp_mode === 'timer') {
        // If the note has a stored timer position, use it directly
        // (correct regardless of current session state / multiple runs)
        if (note.timer_position_ms != null) {
            return formatDuration(note.timer_position_ms / 1000, 1);
        }
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
