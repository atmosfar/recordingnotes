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
    draftResetTimeout: null,
    lastManualNoteContent: null,
    clientRunStart: null,
};
