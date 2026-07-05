# NOTIFICATIONS — WHAT'S LIVE & WHAT NEEDS THE APK

## Works right now (Expo Go + installed app)
Pop-up notifications fire on your phone for every new alert — messages,
reactions, comments, replies, mentions, friend requests/accepts — while
Utopia is OPEN or in the BACKGROUND. The app asks for notification
permission on first launch after this update; tap Allow.

## Needs the APK / push server (later)
True push while the app is FULLY CLOSED (swiped away) needs a push
service (Expo Push + a small server or a Cloud Function on the Firebase
Blaze plan). The code is structured so we can add that in the APK phase
without changing screens — we'll register an Expo push token per user
and send from a Cloud Function when a notification doc is created.

## Install for this update
```
npx expo install expo-notifications
```
Then in app.json add the plugin (keep your existing plugins):
```json
"plugins": [
  "expo-notifications",
  ...your other plugins...
]
```
On Android 13+ the OS also shows a permission prompt the first time —
that's expected.
