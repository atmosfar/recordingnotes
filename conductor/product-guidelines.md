# Product Guidelines

## Design Philosophy
- **Clean & Minimalist:** The interface should prioritize focus and clarity. While the tool is for professional use, avoid the clutter of a typical DAW. The goal is to reduce cognitive load, allowing the user to concentrate fully on the audio content and the act of note-taking without visual distractions.

## Visual Priorities
- **Prominent Timer:** The "recording session time" is the single most critical piece of data. It must be displayed prominently and constantly—large, clear, and always visible—so users have an immediate, unambiguous reference for the current timestamp at all times.

## Workflow & Interaction
- **Prioritized Manual Creation:** The initial workflow will focus on robust manual session creation to ensure immediate usability. Users will explicitly create sessions via a clear "New Session" interface.
- **Future Automation:** While webhook-triggered session creation is a key goal, it will be implemented iteratively. The UI should be designed to eventually accommodate automatic session population, and a dedicated webhook configuration page will be added in later stages.

## Feature Extensibility
- **Template-Based Export:** Initially, the export system will rely on a robust library of pre-defined templates (specifically targeting REAPER and Davinci Resolve). While the architecture should be designed to support custom formats in the future, the initial UI will focus on simple selection to ensure immediate usability and reliability.
