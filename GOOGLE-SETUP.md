# GOOGLE LOGIN — ACTIVATION GUIDE

Email verification works right now with zero setup. Google login is fully
coded but only runs in the INSTALLED app (APK / development build) —
Google blocks its login flow inside Expo Go. Do these steps when you make
your first EAS build; until then the button shows a clear explanation.

## 1. Enable the provider (browser, 1 minute)
Firebase console -> Authentication -> Sign-in method -> Google -> Enable.
Pick your support email. Save.

## 2. Install the library (PowerShell, in C:\projects\utopia)
```
npx expo install @react-native-google-signin/google-signin
```
Then open app.json and add the plugin:
```json
"plugins": [
  "@react-native-google-signin/google-signin",
  ["expo-location", { ... keep what's already there ... }],
  ["expo-image-picker", { ... keep what's already there ... }]
]
```

## 3. Paste the Web client ID
Firebase console -> Authentication -> Sign-in method -> Google ->
expand "Web SDK configuration" -> copy the Web client ID
(looks like 1084xxxx-xxxx.apps.googleusercontent.com).
Paste it into src/config/googleAuth.js replacing PASTE_YOURS.

## 4. Register your app's fingerprint (needed for Android)
Google verifies WHICH app is asking. After you set up EAS build:
```
npm install -g eas-cli
eas login
eas build:configure
eas credentials
```
In `eas credentials` (Android -> production -> Keystore) copy the
**SHA-1 fingerprint**. Then: Firebase console -> Project settings ->
Your apps -> **Add app -> Android** -> package name = the one in your
app.json (e.g. com.yourname.utopia) -> register -> then open the
Android app's settings and **Add fingerprint** -> paste the SHA-1.
(Skip downloading google-services.json — not needed with our setup.)

## 5. Build and test
```
eas build --platform android --profile preview
```
Install the APK from the link EAS gives you. The "Continue with Google"
button now opens the real Google account picker. Google accounts are
treated as already-verified emails, so they skip the confirm screen.

## Troubleshooting
- Error DEVELOPER_ERROR / code 10 on the phone: the SHA-1 in Firebase
  doesn't match the build. Re-run `eas credentials`, re-copy SHA-1
  (preview and production keystores differ — add BOTH fingerprints).
- "Google login is not configured yet": step 3 was missed.
- Works in APK but not Expo Go: expected, by design.
