// ------------------------------------------------------------------
// GOOGLE SIGN-IN CONFIG
// Paste your Web client ID here (GOOGLE-SETUP.md, step 3).
// Find it: Firebase console -> Authentication -> Sign-in method ->
// Google -> "Web SDK configuration" -> Web client ID.
// It looks like: 1084xxxxxxx-xxxxxxxx.apps.googleusercontent.com
// ------------------------------------------------------------------
export const GOOGLE_WEB_CLIENT_ID = 'PASTE_YOURS.apps.googleusercontent.com';

export const GOOGLE_READY =
  !GOOGLE_WEB_CLIENT_ID.startsWith('635658991923-e1hgncueqshkte54b1shabush49v9759.apps.googleusercontent.com');
