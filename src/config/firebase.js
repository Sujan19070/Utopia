import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  initializeAuth,
  getReactNativePersistence,
  getAuth,
} from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey: "AIzaSyAB0sxKjB2_NbhIcM1eEymJ4TdZPG1rPz8",
  authDomain: "utopia-19070.firebaseapp.com",
  projectId: "utopia-19070",
  storageBucket: "utopia-19070.firebasestorage.app",
  messagingSenderId: "635658991923",
  appId: "1:635658991923:web:d187eced779613a4326646"
};

export const FIREBASE_READY = firebaseConfig.apiKey !== 'PASTE_YOURS';

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

let _auth;
try {
  _auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
} catch (e) {
  _auth = getAuth(app);
}

export const auth = _auth;
export const db = getFirestore(app);
export default app;