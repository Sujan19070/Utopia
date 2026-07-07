import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import Constants from 'expo-constants';

// Expo Go (SDK 53+) removed expo-notifications; importing it there crashes.
// So we only ever load it in a real build (dev build / APK / standalone).
const IS_EXPO_GO = Constants.appOwnership === 'expo';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut as fbSignOut,
  sendEmailVerification,
  sendPasswordResetEmail,
  GoogleAuthProvider,
  signInWithCredential,
} from 'firebase/auth';
import {
  collection, doc, getDoc, setDoc, addDoc, updateDoc, deleteDoc,
  onSnapshot, query, where, orderBy, limit, serverTimestamp,
  arrayUnion, arrayRemove, deleteField, increment, writeBatch,
} from 'firebase/firestore';
import { auth, db, FIREBASE_READY } from '../config/firebase';
import { applyTheme } from '../theme';
import { setLang } from '../i18n/strings';
import { GOOGLE_WEB_CLIENT_ID, GOOGLE_READY } from '../config/googleAuth';

const AppContext = createContext(null);

export const REACTIONS = [
  { key: 'love', emoji: '❤️' },
  { key: 'haha', emoji: '😂' },
  { key: 'sad', emoji: '😢' },
  { key: 'angry', emoji: '😡' },
  { key: 'dislike', emoji: '👎' },
];
export const EMOJI = Object.fromEntries(REACTIONS.map((r) => [r.key, r.emoji]));

export const STORY_TTL_MS = 24 * 3600 * 1000; // stories live 24 hours

const FRIENDLY = {
  'auth/invalid-email': 'That email address looks invalid.',
  'auth/email-already-in-use': 'An account with this email already exists — try signing in.',
  'auth/weak-password': 'Password must be at least 6 characters.',
  'auth/invalid-credential': 'Wrong email or password.',
  'auth/user-not-found': 'No account with this email — create one first.',
  'auth/wrong-password': 'Wrong email or password.',
  'auth/network-request-failed': 'Network problem — check your internet connection.',
};
const friendly = (e) => FRIENDLY[e?.code] || e?.message || 'Something went wrong.';

export function AppProvider({ children }) {
  const [user, setUser] = useState(null);
  const [booting, setBooting] = useState(true);
  const [authError, setAuthError] = useState('');
  const [posts, setPosts] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [directory, setDirectory] = useState([]);
  const [stories, setStories] = useState([]);

  // ---- session (live profile subscription) ----
  useEffect(() => {
    if (!FIREBASE_READY) { setBooting(false); return; }
    let unsubProfile = null;
    const unsubAuth = onAuthStateChanged(auth, (fb) => {
      if (unsubProfile) { unsubProfile(); unsubProfile = null; }
      if (fb) {
        unsubProfile = onSnapshot(doc(db, 'users', fb.uid), (snap) => {
          const p = snap.exists() ? snap.data() : {};
          setUser({
            id: fb.uid,
            email: fb.email,
            emailVerified: fb.emailVerified,
            name: p.name || 'Student',
            username: p.username || '',
            dept: p.dept || '',
            year: p.year || '',
            birthday: p.birthday || '',
            mobile: p.mobile || '',
            hometown: p.hometown || '',
            area: p.area || '',
            university: p.university || '',
            college: p.college || '',
            school: p.school || '',
            photoB64: p.photoB64 || null,
            friends: p.friends || [],
            blocked: p.blocked || [],
            settings: p.settings || {},
            major: p.major || '',
            minorField: p.minorField || '',
            researchPapers: p.researchPapers || '',
            interests: p.interests || [],
            role: p.role || 'student',
            subject: p.subject || '',
            batch: p.batch || '',
            roleVerified: !!p.roleVerified,
            eduEmail: p.eduEmail || '',
            anon: p.anon || { on: false, name: '', emoji: '🎭', color: '#4B3F72' },
            lastActive: p.lastActive || null,
          });
          setBooting(false);
        });
      } else {
        setUser(null);
        setBooting(false);
      }
    });
    return () => { unsubAuth(); if (unsubProfile) unsubProfile(); };
  }, []);

  // ---- phone notifications (local pop-ups via expo-notifications) ----
  // Real push while the app is fully closed needs a push server (Blaze
  // phase); while Utopia is open or in background, these pop up for real.
  useEffect(() => {
    if (!user?.id || IS_EXPO_GO) return;
    (async () => {
      try {
        const N = await import('expo-notifications');
        N.setNotificationHandler({
          handleNotification: async () => ({
            shouldShowAlert: true, shouldShowBanner: true, shouldShowList: true,
            shouldPlaySound: true, shouldSetBadge: false,
          }),
        });
        if (Platform.OS === 'android') {
          await N.setNotificationChannelAsync('default', {
            name: 'Utopia', importance: N.AndroidImportance.MAX,
            sound: 'default', vibrationPattern: [0, 200, 100, 200],
          });
        }
        await N.requestPermissionsAsync();
      } catch (e) {}
    })();
  }, [user?.id]);

  const NOTIF_TEXT = {
    reaction: (n) => `reacted ${n.emoji || ''} to your post`,
    comment: () => 'commented on your post',
    reply: () => 'replied to your comment',
    mention: () => 'mentioned you in a comment',
    friend_request: () => 'sent you a friend request',
    friend_accept: () => 'accepted your friend request',
    message: (n) => n.preview || 'sent you a message',
    story_reaction: (n) => `reacted ${n.emoji || ''} to your story`,
    story_reply: (n) => `replied to your story: "${n.preview || ''}"`,
    star: () => 'gave your post a ⭐ star',
  };

  const fireLocal = async (n) => {
    if (IS_EXPO_GO) return; // no-op in Expo Go; works in the built app
    try {
      const N = await import('expo-notifications');
      await N.scheduleNotificationAsync({
        content: {
          title: n.fromName || 'Utopia',
          body: n.type === 'message'
            ? (n.preview || 'sent you a message')
            : `${(NOTIF_TEXT[n.type] || NOTIF_TEXT.comment)(n)}${n.preview ? ` — "${n.preview}"` : ''}`,
          sound: 'default',
        },
        trigger: null,
      });
    } catch (e) {}
  };

  // fire a pop-up for every NEW unread notification (skip the initial load)
  const seenNotif = useRef(null);
  useEffect(() => {
    if (!user?.id) { seenNotif.current = null; return; }
    if (seenNotif.current === null) {
      seenNotif.current = new Set(notifications.map((n) => n.id));
      return;
    }
    notifications.forEach((n) => {
      if (seenNotif.current.has(n.id)) return;
      seenNotif.current.add(n.id);
      if (!n.read) fireLocal(n);
    });
  }, [notifications, user?.id]);

  // ---- appearance & language (from settings, applied live) ----
  const [uiTick, setUiTick] = useState(0);
  const st = user?.settings || {};
  useEffect(() => {
    applyTheme(st.night ? 'night' : (st.theme || 'emerald'));
    setLang(st.lang || 'en');
    setUiTick((v) => v + 1);
  }, [st.theme, st.night, st.lang]);

  const saveSettings = async (partial) => {
    const patch = {};
    Object.entries(partial).forEach(([k, v]) => { patch['settings.' + k] = v; });
    await updateDoc(doc(db, 'users', user.id), patch);
  };

  // ---- presence heartbeat (last seen / active now) ----
  useEffect(() => {
    if (!user?.id) return;
    if (user?.settings?.showActive === false) {
      updateDoc(doc(db, 'users', user.id), { lastActive: deleteField() }).catch(() => {});
      return;
    }
    const beat = () =>
      updateDoc(doc(db, 'users', user.id), { lastActive: serverTimestamp() }).catch(() => {});
    beat();
    const iv = setInterval(beat, 60000);
    const sub = AppState.addEventListener('change', (s2) => { if (s2 === 'active') beat(); });
    return () => { clearInterval(iv); sub.remove(); };
  }, [user?.id, user?.settings?.showActive]);

  // ---- everyone's profiles (names + photos for avatars everywhere) ----
  useEffect(() => {
    if (!user?.id) { setDirectory([]); return; }
    return onSnapshot(collection(db, 'users'), (snap) =>
      setDirectory(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    );
  }, [user?.id]);

  const usersById = useMemo(
    () => Object.fromEntries(directory.map((u) => [u.id, u])),
    [directory]
  );

  // ---- live feed ----
  useEffect(() => {
    if (!user) { setPosts(null); return; }
    const q = query(collection(db, 'posts'), orderBy('createdAt', 'desc'), limit(50));
    return onSnapshot(
      q,
      (snap) => setPosts(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      (err) => console.warn('feed error', err)
    );
  }, [user?.id]);

  // ---- stories (active = younger than 24h; old docs are ignored) ----
  useEffect(() => {
    if (!user?.id) { setStories([]); return; }
    return onSnapshot(collection(db, 'stories'), (snap) => {
      const now = Date.now();
      const rows = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((s) => !s.createdAt?.toDate || now - s.createdAt.toDate().getTime() < STORY_TTL_MS)
        .sort((a, b) => (a.createdAt?.seconds || 1e12) - (b.createdAt?.seconds || 1e12));
      setStories(rows);
    });
  }, [user?.id]);

  const addStory = async ({ imageB64, text, bg }) => {
    await addDoc(collection(db, 'stories'), {
      authorId: user.id,
      authorName: user.name,
      imageB64: imageB64 || null,
      text: text || null,
      bg: bg || null,
      createdAt: serverTimestamp(),
    });
  };

  const deleteStory = async (story) => {
    if (story.authorId !== user.id) return;
    await deleteDoc(doc(db, 'stories', story.id));
  };

  // React to a story (one reaction per person, stored on the story doc).
  const reactToStory = async (story, key) => {
    const cur = story.reactions?.[user.id];
    await updateDoc(doc(db, 'stories', story.id), {
      [`reactions.${user.id}`]: cur === key ? deleteField() : key,
    });
    if (cur !== key && story.authorId !== user.id) {
      notify(story.authorId, 'story_reaction', {
        emoji: EMOJI[key],
        preview: story.text ? story.text.slice(0, 40) : 'your story',
      });
    }
  };

  // Reply to a story: delivered as a normal 1:1 chat message to the owner,
  // quoting the story. Story replies bypass the friends-only rule so anyone
  // who can see a story can respond to it (like Instagram).
  const replyToStory = async (story, text) => {
    const body = (text || '').trim();
    if (!body || story.authorId === user.id) return;
    const cid = [user.id, story.authorId].sort().join('_');
    await addDoc(collection(db, 'chats', cid, 'messages'), {
      senderId: user.id,
      senderName: user.name,
      type: 'text',
      text: body,
      reactions: {},
      storyReply: {
        preview: story.text ? story.text.slice(0, 60) : (story.imageB64 ? '📷 Photo story' : 'Story'),
        bg: story.bg || null,
      },
      createdAt: serverTimestamp(),
    });
    await setDoc(doc(db, 'chats', cid), {
      participants: [user.id, story.authorId],
      names: { [user.id]: user.name, [story.authorId]: story.authorName },
      lastMessage: `↩️ Replied to story: ${body.slice(0, 40)}`,
      updatedAt: serverTimestamp(),
      storyReplyAllowed: true,
    }, { merge: true });
    notify(story.authorId, 'story_reply', { preview: body.slice(0, 60), chatId: cid });
  };

  // ---- notifications ----
  useEffect(() => {
    if (!user) { setNotifications([]); return; }
    const q = query(collection(db, 'notifications'), where('to', '==', user.id));
    return onSnapshot(q, (snap) => {
      const rows = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
        .slice(0, 50);
      setNotifications(rows);
    });
  }, [user?.id]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markNotificationsRead = async () => {
    const unread = notifications.filter((n) => !n.read);
    if (!unread.length) return;
    const batch = writeBatch(db);
    unread.forEach((n) => batch.update(doc(db, 'notifications', n.id), { read: true }));
    try { await batch.commit(); } catch (e) {}
  };

  const notify = async (to, type, extra = {}) => {
    if (!to || to === user.id) return;
    if ((user?.blocked || []).includes(to)) return;
    if ((usersById[to]?.blocked || []).includes(user.id)) return;
    try {
      const { fromName: anonName, ...rest } = extra;
      await addDoc(collection(db, 'notifications'), {
        to,
        fromId: anonName ? null : user.id,
        fromName: anonName || user.name,
        type, read: false, createdAt: serverTimestamp(), ...rest,
      });
    } catch (e) {}
  };

  // ---- auth ----
  const signUp = async (name, email, password) => {
    setAuthError('');
    try {
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
      await setDoc(doc(db, 'users', cred.user.uid), {
        name: name.trim(), email: email.trim(), dept: '', year: '',
        friends: [], createdAt: serverTimestamp(),
      });
      try { await sendEmailVerification(cred.user); } catch (e) {}
    } catch (e) {
      setAuthError(friendly(e));
    }
  };

  // Resend the confirmation email (verify screen).
  const resendVerification = async () => {
    if (auth.currentUser) await sendEmailVerification(auth.currentUser);
  };

  // Re-check with Firebase whether the link was clicked.
  const refreshVerification = async () => {
    if (!auth.currentUser) return false;
    await auth.currentUser.reload();
    const ok = auth.currentUser.emailVerified;
    if (ok) setUser((u) => (u ? { ...u, emailVerified: true } : u));
    return ok;
  };

  // Google sign-in: needs the installed build (Expo Go can't run
  // Google's native flow). Google accounts arrive already verified.
  const signInWithGoogle = async () => {
    setAuthError('');
    if (!GOOGLE_READY) {
      throw new Error(
        'Google login is not configured yet — see GOOGLE-SETUP.md (paste the Web client ID in src/config/googleAuth.js).'
      );
    }
    let GS;
    try {
      GS = await import('@react-native-google-signin/google-signin');
      if (!GS?.GoogleSignin) throw new Error('module missing');
    } catch (e) {
      throw new Error(
        'Google login works in the installed Utopia app (APK build), not inside Expo Go. Use email login for now — it is fully real.'
      );
    }
    const { GoogleSignin } = GS;
    GoogleSignin.configure({ webClientId: GOOGLE_WEB_CLIENT_ID });
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    // Clear any cached Google account first so the account CHOOSER always
    // appears (otherwise Google silently reuses the last account).
    try { await GoogleSignin.signOut(); } catch (e) {}
    const res = await GoogleSignin.signIn();
    const idToken = res?.data?.idToken || res?.idToken;
    if (!idToken) throw new Error('Google did not return a sign-in token.');
    const cred = GoogleAuthProvider.credential(idToken);
    const { user: fb } = await signInWithCredential(auth, cred);
    const snap = await getDoc(doc(db, 'users', fb.uid));
    if (!snap.exists()) {
      await setDoc(doc(db, 'users', fb.uid), {
        name: fb.displayName || 'Student',
        email: fb.email,
        dept: '', year: '', friends: [],
        createdAt: serverTimestamp(),
      });
    }
  };

  const signIn = async (email, password) => {
    setAuthError('');
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (e) {
      setAuthError(friendly(e));
    }
  };

  // Send a Firebase password-reset email; the person sets a new password
  // from the link, then signs in with it.
  const resetPassword = async (email) => {
    const e = (email || '').trim().toLowerCase();
    if (!/^[^@]+@[^@]+\.[^@]+$/.test(e)) throw new Error('Enter a valid email address first.');
    await sendPasswordResetEmail(auth, e);
  };

  const signOut = () => fbSignOut(auth);

  // ---- account editing ----
  // Username must be unique across the whole app: a usernames/{name} doc
  // acts as the claim ticket.
  const saveAccount = async (f) => {
    const uname = (f.username || '').trim().toLowerCase();
    if (uname) {
      if (!/^[a-z0-9_.]{3,20}$/.test(uname)) {
        return { error: 'Username must be 3–20 characters: letters, numbers, dot or underscore.' };
      }
      if (uname !== (user.username || '')) {
        const snap = await getDoc(doc(db, 'usernames', uname));
        if (snap.exists() && snap.data().uid !== user.id) {
          return { error: 'That username is already taken — try another.' };
        }
        await setDoc(doc(db, 'usernames', uname), { uid: user.id });
        if (user.username) {
          try { await deleteDoc(doc(db, 'usernames', user.username)); } catch (e) {}
        }
      }
    }
    await updateDoc(doc(db, 'users', user.id), {
      name: (f.name || '').trim() || user.name,
      username: uname,
      birthday: f.birthday || '',
      mobile: f.mobile || '',
      hometown: f.hometown || '',
      area: f.area || '',
      university: f.university || '',
      college: f.college || '',
      school: f.school || '',
    });
    return { ok: true };
  };

  const updateProfilePhoto = async (b64) => {
    await updateDoc(doc(db, 'users', user.id), { photoB64: b64 });
  };

  // ---- friends ----
  const sendFriendRequest = async (toId, toName, note = '') => {
    await setDoc(doc(db, 'friendRequests', `${user.id}_${toId}`), {
      from: user.id, fromName: user.name, to: toId, toName,
      note: note || '', status: 'pending', createdAt: serverTimestamp(),
    });
    notify(toId, 'friend_request', note ? { preview: note } : {});
  };

  const respondFriendRequest = async (fromId, accept) => {
    const reqRef = doc(db, 'friendRequests', `${fromId}_${user.id}`);
    if (accept) {
      const batch = writeBatch(db);
      batch.update(doc(db, 'users', user.id), { friends: arrayUnion(fromId) });
      batch.update(doc(db, 'users', fromId), { friends: arrayUnion(user.id) });
      batch.set(reqRef, { status: 'accepted' }, { merge: true });
      await batch.commit();
      notify(fromId, 'friend_accept', {});
    } else {
      await setDoc(reqRef, { status: 'declined' }, { merge: true });
    }
  };

  // ---- location (Near me) ----
  // Rounded to 3 decimals (~110 m) so nobody's exact spot is exposed.
  const setMyLocation = async (coords) => {
    if (coords) {
      await updateDoc(doc(db, 'users', user.id), {
        lat: +coords.latitude.toFixed(3),
        lng: +coords.longitude.toFixed(3),
        locAt: serverTimestamp(),
      });
    } else {
      await updateDoc(doc(db, 'users', user.id), {
        lat: deleteField(), lng: deleteField(), locAt: deleteField(),
      });
    }
  };

  // ---- presence readout (reciprocal: hide yours -> can't see others') ----
  const presenceOf = (uid) => {
    if (user?.settings?.showActive === false) return null;
    const p = usersById[uid];
    const ts = p?.lastActive;
    if (!ts?.toDate) return null;
    const s2 = (Date.now() - ts.toDate().getTime()) / 1000;
    if (s2 < 150) return { active: true };
    if (s2 < 3600) return { active: false, ago: `${Math.floor(s2 / 60)}m` };
    if (s2 < 86400) return { active: false, ago: `${Math.floor(s2 / 3600)}h` };
    return { active: false, ago: `${Math.floor(s2 / 86400)}d` };
  };

  // ---- block / unfriend ----
  const isBlockedEither = (uid) =>
    (user?.blocked || []).includes(uid) ||
    ((usersById[uid]?.blocked || []).includes(user?.id));

  const clearRequests = async (uid) => {
    try { await deleteDoc(doc(db, 'friendRequests', `${user.id}_${uid}`)); } catch (e) {}
    try { await deleteDoc(doc(db, 'friendRequests', `${uid}_${user.id}`)); } catch (e) {}
  };

  const unfriend = async (uid) => {
    const batch = writeBatch(db);
    batch.update(doc(db, 'users', user.id), { friends: arrayRemove(uid) });
    batch.update(doc(db, 'users', uid), { friends: arrayRemove(user.id) });
    await batch.commit();
    await clearRequests(uid);
  };

  const blockUser = async (uid) => {
    const batch = writeBatch(db);
    batch.update(doc(db, 'users', user.id), { blocked: arrayUnion(uid), friends: arrayRemove(uid) });
    batch.update(doc(db, 'users', uid), { friends: arrayRemove(user.id) });
    await batch.commit();
    await clearRequests(uid);
  };

  const unblockUser = (uid) =>
    updateDoc(doc(db, 'users', user.id), { blocked: arrayRemove(uid) });

  // ---- anonymous mode ----
  const saveAnon = (a) =>
    updateDoc(doc(db, 'users', user.id), {
      anon: {
        on: !!a.on,
        name: (a.name || '').trim(),
        emoji: a.emoji || '🎭',
        color: a.color || '#4B3F72',
      },
    });

  // ---- education profile ----
  const saveEducation = (f) => {
    const requested = f.role || 'student';
    // Student is the default role and always works, verified or not.
    // Teacher/Alumni only take effect once verified. Any role KEEPS its
    // verified badge if it's already verified for that same role.
    // Student <-> Alumni are interchangeable once verified (you graduate,
    // you come back to study — same person, same university email).
    const flexPair = ['student', 'alumni'];
    const flexSwitch = user.roleVerified &&
      flexPair.includes(user.role) && flexPair.includes(requested);
    const canSetRole =
      requested === 'student' || flexSwitch ||
      (user.roleVerified && user.role === requested);
    // Switching keeps the badge if it's the same verified role OR a
    // student<->alumni switch; anything else drops it.
    const keepVerified = user.roleVerified &&
      (user.role === requested || flexSwitch);
    return updateDoc(doc(db, 'users', user.id), {
      university: f.university || '',
      college: f.college || '',
      major: f.major || '',
      minorField: f.minorField || '',
      researchPapers: f.researchPapers || '',
      interests: f.interests || [],
      subject: f.subject || '',
      batch: f.batch || '',
      ...(canSetRole
        ? { role: requested, ...(keepVerified ? {} : { roleVerified: false, eduEmail: '' }) }
        : {}),
    });
  };

  // ---- role verification by university / student email ----
  // Sends a real Firebase confirmation email to the education address; the
  // role activates only after the link is clicked. Uses a secondary auth
  // app so it never disturbs the person's main login session.
  const requestRoleVerification = async (requestedRole, eduEmail) => {
    const email = (eduEmail || '').trim().toLowerCase();
    if (!/^[^@]+@[^@]+\.[^@]+$/.test(email)) {
      return { error: 'Enter a valid email address.' };
    }
    // Basic sanity: personal inboxes can't prove a role.
    const personal = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com', 'proton.me'];
    const domain = email.split('@')[1];
    if (requestedRole !== 'alumni' && personal.includes(domain)) {
      return { error: 'Use your university / institutional email (not a personal Gmail/Yahoo) to verify this role.' };
    }
    try {
      const { initializeApp, getApps } = await import('firebase/app');
      const fbAuth = await import('firebase/auth');
      const cfg = auth.app.options;
      const secondary =
        getApps().find((a) => a.name === 'roleVerify') ||
        initializeApp(cfg, 'roleVerify');
      const sAuth = fbAuth.getAuth(secondary);
      // Create-or-sign-in a throwaway credential on the edu email so Firebase
      // will send it a verification link. Password is deterministic per uid.
      const pwd = `Utopia!${user.id.slice(0, 12)}`;
      let cred;
      try {
        cred = await fbAuth.createUserWithEmailAndPassword(sAuth, email, pwd);
      } catch (e) {
        if (e.code === 'auth/email-already-in-use') {
          cred = await fbAuth.signInWithEmailAndPassword(sAuth, email, pwd);
        } else {
          throw e;
        }
      }
      await fbAuth.sendEmailVerification(cred.user);
      await updateDoc(doc(db, 'users', user.id), {
        role: requestedRole, eduEmail: email, roleVerified: false,
      });
      await fbAuth.signOut(sAuth);
      return { ok: true };
    } catch (e) {
      return { error: e?.message || String(e) };
    }
  };

  // Re-check whether the edu email link was clicked; flips roleVerified true.
  const checkRoleVerified = async () => {
    const email = (user.eduEmail || '').trim().toLowerCase();
    if (!email) return false;
    try {
      const { initializeApp, getApps } = await import('firebase/app');
      const fbAuth = await import('firebase/auth');
      const secondary =
        getApps().find((a) => a.name === 'roleVerify') ||
        initializeApp(auth.app.options, 'roleVerify');
      const sAuth = fbAuth.getAuth(secondary);
      const pwd = `Utopia!${user.id.slice(0, 12)}`;
      const cred = await fbAuth.signInWithEmailAndPassword(sAuth, email, pwd);
      await cred.user.reload();
      const ok = cred.user.emailVerified;
      await fbAuth.signOut(sAuth);
      if (ok) await updateDoc(doc(db, 'users', user.id), { roleVerified: true });
      return ok;
    } catch (e) {
      return false;
    }
  };

  // ---- posts ----
  const addPost = async ({ text, anonymous, imageB64 }) => {
    await addDoc(collection(db, 'posts'), {
      text,
      anonymous: !!anonymous,
      authorName: anonymous ? null : user.name,
      authorDept: anonymous ? null : user.dept,
      authorRole: anonymous ? null : (user.roleVerified ? (user.role || 'student') : null),
      authorSubject: anonymous ? null : (user.roleVerified ? (user.subject || '') : ''),
      anonName: anonymous && user.anon?.on ? (user.anon.name || null) : null,
      anonAvatar: anonymous && user.anon?.on
        ? { emoji: user.anon.emoji || '🎭', color: user.anon.color || '#4B3F72' }
        : null,
      realAuthorId: user.id,
      imageB64: imageB64 || null,
      reactions: {},
      likedBy: [],
      savedBy: [],
      commentsCount: 0,
      createdAt: serverTimestamp(),
    });
  };

  // ---- daily star rewards ----
  // Everyone generates 2 stars per day to give away on Education & Jobs
  // posts. Stars can't be taken back. Totals decide the Campus Spotlight.
  const dateKey = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  const weekKeyNow = () => {
    const d = new Date();
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); // back to Monday
    return `w-${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  const starsLeftToday = () =>
    (user?.starDate === dateKey() ? (user.starsLeft ?? 0) : 2);

  // Account suspension: bannedUntil is 'forever' or a millisecond timestamp.
  const banActive = !!user && (
    user.bannedUntil === 'forever' ||
    (typeof user.bannedUntil === 'number' && user.bannedUntil > Date.now())
  );

  // Developer/admin account: sees behind every anonymous identity in-app.
  const ADMIN_EMAIL = 'sujanofficial19070@gmail.com';
  const isAdmin = ((user?.email || '').toLowerCase() === ADMIN_EMAIL);

  const awardStar = async ({ coll, id, targets, toUserId }) => {
    if (!user) return { ok: false, msg: 'Not signed in.' };
    if (toUserId === user.id) return { ok: false, msg: "You can't star your own post." };
    const left = starsLeftToday();
    if (left <= 0) {
      return { ok: false, msg: 'No stars left today — you get 2 fresh stars every day.' };
    }
    await updateDoc(doc(db, 'users', user.id), { starsLeft: left - 1, starDate: dateKey() });
    // A star can live on more than one doc (the section post + its feed copy).
    const tgts = targets || [{ coll, id }];
    for (const t of tgts) {
      try {
        await updateDoc(doc(db, t.coll, t.id), {
          stars: increment(1), [`starsBy.${user.id}`]: increment(1),
        });
      } catch (e) { /* one copy may be deleted — fine */ }
    }
    const wk = weekKeyNow();
    const rSnap = await getDoc(doc(db, 'users', toUserId));
    const r = rSnap.exists() ? rSnap.data() : {};
    await updateDoc(doc(db, 'users', toUserId), {
      starsReceived: increment(1),
      ...(r.starsWeekKey === wk
        ? { starsWeek: increment(1) }
        : { starsWeek: 1, starsWeekKey: wk }),
    });
    notify(toUserId, 'star', { preview: '⭐ gave your post a star' });
    return { ok: true, left: left - 1 };
  };

  // Campus sections (Events, Lost & Found, Clubs, Seminars, Alumni) also
  // appear in the main feed as normal posts — so people can react & comment.
  // `campusKind` tags them so the feed shows a labelled badge.
  const crossPostToFeed = async ({ campusKind, title, text, imageB64, anonymous, starColl, starDocId }) => {
    const ref = await addDoc(collection(db, 'posts'), {
      text: text || '',
      campusKind: campusKind || null,      // event | lostfound | club | seminar | alumni | education | jobs | review
      campusTitle: title || '',
      anonymous: !!anonymous,
      authorName: anonymous ? null : user.name,
      anonName: anonymous ? 'Anonymous' : null,
      anonAvatar: anonymous ? '🎭' : null,
      authorDept: anonymous ? null : user.dept,
      authorRole: !anonymous && user.roleVerified ? (user.role || 'student') : null,
      authorSubject: !anonymous && user.roleVerified ? (user.subject || '') : '',
      realAuthorId: user.id,
      starColl: starColl || null,
      starDocId: starDocId || null,
      stars: 0,
      starsBy: {},
      imageB64: imageB64 || null,
      reactions: {},
      likedBy: [],
      savedBy: [],
      commentsCount: 0,
      createdAt: serverTimestamp(),
    });
    return ref.id;
  };

  const reactToPost = async (post, key) => {
    const current = post.reactions?.[user.id] ||
      ((post.likedBy || []).includes(user.id) ? 'love' : null);
    const removing = current === key;
    await updateDoc(doc(db, 'posts', post.id), {
      [`reactions.${user.id}`]: removing ? deleteField() : key,
      likedBy: arrayRemove(user.id),
    });
    if (!removing) {
      notify(post.realAuthorId, 'reaction', {
        postId: post.id,
        postOwnerId: post.realAuthorId,
        emoji: EMOJI[key],
        preview: (post.text || 'your photo').slice(0, 60),
      });
    }
  };

  const toggleSave = async (post) => {
    const saved = (post.savedBy || []).includes(user.id);
    await updateDoc(doc(db, 'posts', post.id), {
      savedBy: saved ? arrayRemove(user.id) : arrayUnion(user.id),
    });
  };

  const deletePost = async (post) => {
    if (post.realAuthorId !== user.id && !isAdmin) return;
    await deleteDoc(doc(db, 'posts', post.id));
    // If it's a linked campus post, remove the section copy too (admin cleanup).
    if (isAdmin && post.starColl && post.starDocId) {
      try { await deleteDoc(doc(db, post.starColl, post.starDocId)); } catch (e) {}
    }
  };

  // ---- reports ----
  const submitReport = async (post, reason, note) => {
    await addDoc(collection(db, 'reports'), {
      postId: post.id,
      postText: (post.text || '').slice(0, 200),
      campusKind: post.campusKind || null,
      starColl: post.starColl || null,
      starDocId: post.starDocId || null,
      reportedUserId: post.realAuthorId || null,
      reporterId: user.id,
      reporterName: user.name,
      reason,
      note: (note || '').trim(),
      status: 'open',
      createdAt: serverTimestamp(),
    });
  };

  // ---- comments ----
  const addComment = async ({ post, text, parentId, parentAuthorId, mentions }) => {
    const anonOn = !!user.anon?.on;
    await addDoc(collection(db, 'posts', post.id, 'comments'), {
      text,
      authorId: user.id,
      authorName: user.name,
      anonymous: anonOn,
      anonName: anonOn ? (user.anon.name || null) : null,
      anonAvatar: anonOn
        ? { emoji: user.anon.emoji || '🎭', color: user.anon.color || '#4B3F72' }
        : null,
      parentId: parentId || null,
      mentions: mentions || [],
      likes: [],
      dislikes: [],
      createdAt: serverTimestamp(),
    });
    await updateDoc(doc(db, 'posts', post.id), { commentsCount: increment(1) });

    const preview = text.slice(0, 60);
    const base = { postId: post.id, postOwnerId: post.realAuthorId, preview };
    if (anonOn) base.fromName = user.anon.name || 'Anonymous';
    const already = new Set([user.id]);
    if (parentId && parentAuthorId && !already.has(parentAuthorId)) {
      already.add(parentAuthorId);
      notify(parentAuthorId, 'reply', base);
    }
    if (!already.has(post.realAuthorId)) {
      already.add(post.realAuthorId);
      notify(post.realAuthorId, 'comment', base);
    }
    (mentions || []).forEach((m) => {
      if (!already.has(m.id)) { already.add(m.id); notify(m.id, 'mention', base); }
    });
  };

  const voteComment = async (postId, comment, kind) => {
    const other = kind === 'likes' ? 'dislikes' : 'likes';
    const has = (comment[kind] || []).includes(user.id);
    await updateDoc(doc(db, 'posts', postId, 'comments', comment.id), {
      [kind]: has ? arrayRemove(user.id) : arrayUnion(user.id),
      [other]: arrayRemove(user.id),
    });
  };

  const value = useMemo(
    () => ({
      user, booting, authError, setAuthError,
      signUp, signIn, signOut,
      signInWithGoogle, resetPassword, resendVerification, refreshVerification,
      directory, usersById,
      posts, addPost, crossPostToFeed, reactToPost, toggleSave, deletePost,
      awardStar, starsLeftToday, isAdmin, banActive, submitReport,
      stories, addStory, deleteStory, reactToStory, replyToStory,
      addComment, voteComment,
      saveAccount, updateProfilePhoto, setMyLocation,
      saveSettings, saveEducation, saveAnon, presenceOf,
      requestRoleVerification, checkRoleVerified,
      unfriend, blockUser, unblockUser, isBlockedEither,
      sendFriendRequest, respondFriendRequest, uiTick,
      notifications, unreadCount, markNotificationsRead,
    }),
    [user, booting, authError, posts, notifications, directory, stories, uiTick]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export const useApp = () => useContext(AppContext);
