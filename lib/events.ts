// Module-level flag so new-session can signal the home screen that a save just happened.
// Consumed once on home screen focus.
let _savedSessionId: string | null = null;

export function markSessionSaved(sessionId: string) {
  _savedSessionId = sessionId;
}

export function consumeSessionSaved(): string | null {
  const id = _savedSessionId;
  _savedSessionId = null;
  return id;
}
