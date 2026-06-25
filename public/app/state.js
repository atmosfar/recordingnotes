/**
 * Centralized application state.
 * All modules import this object instead of using global variables.
 */
export const state = {
    currentSessionId: null,
    currentSession: null,
    selectedColor: "",
    sessionSearchFilter: "",
    activeDraftTimestamp: null,
    activeDraftTimerPositionMs: null,
    draftResetTimeout: null,
    lastManualNoteContent: null,
    clientRunStart: null,
    exportTimezone: 'UTC',
    pendingExportFormat: null,
    pendingExportFps: null,
};
