// ------------------------------------------------------------------
// GOOGLE SIGN-IN CONFIG
// Web client ID from: Firebase console -> Authentication ->
// Sign-in method -> Google -> "Web SDK configuration" -> Web client ID.
// It looks like: 1084xxxxxxx-xxxxxxxx.apps.googleusercontent.com
// ------------------------------------------------------------------
export const GOOGLE_WEB_CLIENT_ID =
  '635658991923-e1hgncueqshkte54b1shabush49v9759.apps.googleusercontent.com';

// True once a real Web client ID is set (i.e. the placeholder is gone).
export const GOOGLE_READY =
  !!GOOGLE_WEB_CLIENT_ID &&
  !GOOGLE_WEB_CLIENT_ID.startsWith('PASTE_YOURS') &&
  GOOGLE_WEB_CLIENT_ID.endsWith('.apps.googleusercontent.com');
