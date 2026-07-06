# Fix Google sign-in DEVELOPER_ERROR (no code change needed)

DEVELOPER_ERROR means Google rejected the app because the APK's signing
fingerprint (SHA-1) is not registered with your Firebase project. EAS signed
your APK with a keystore it generated in the cloud — Firebase doesn't know
that keystore yet. Register it and the error goes away.

## Step 1 — Get the SHA-1 of your EAS keystore
In C:\projects\utopia run:

    eas credentials -p android

Pick the "preview" profile (the one you build with). The keystore details
show "SHA1 Fingerprint" — copy it (format AA:BB:CC:...). Copy SHA-256 too
if shown.

## Step 2 — Register it in Firebase
1. Firebase Console -> your Utopia project -> gear icon -> Project settings
2. "Your apps" section:
   - If there is NO Android app yet: "Add app" -> Android ->
     package name: com.nabib.utopia -> Register (you can skip the
     google-services.json download steps — the app uses the JS SDK).
   - If the Android app exists: open it.
3. "Add fingerprint" -> paste the SHA-1 -> Save.
   (Add the SHA-256 too if you copied it.)

## Step 3 — Verify the Web client ID
Open src/config/googleAuth.js. The webClientId must be the WEB client, not
an Android client:
  Firebase Console -> Authentication -> Sign-in method -> Google ->
  "Web SDK configuration" -> Web client ID (ends with
  .apps.googleusercontent.com).
Also confirm the Google provider is Enabled on that page.

## Step 4 — Wait ~5 minutes, then test
The registration is server-side. Your EXISTING APK will start working —
no rebuild required for this fix. (You are rebuilding anyway for the
keyboard fix, which is fine.)

## Later (only when you publish to Play Store)
Google Play re-signs apps. You'll add Play's "App signing key" SHA-1 the
same way. Not needed now.
