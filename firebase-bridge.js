
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {
  getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword,
  signOut, onAuthStateChanged, updateProfile, updatePassword,
  reauthenticateWithCredential, EmailAuthProvider, sendPasswordResetEmail
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {
  initializeFirestore, persistentLocalCache, persistentSingleTabManager,
  collection, doc, addDoc, setDoc, getDoc, getDocs,
  updateDoc, deleteDoc, onSnapshot, query, where, orderBy,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import {
  getStorage, ref, uploadBytes, getDownloadURL
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js';
import {
  getMessaging, getToken, onMessage
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging.js';

// ── Firebase Init ──────────────────────────────────────────
const firebaseConfig = {
  apiKey: "AIzaSyCsQDE6X6aZMQP7uJslJhWTQRGd4yWGXEM",
  authDomain: "notesnyc-55d0a.firebaseapp.com",
  databaseURL: "https://notesnyc-55d0a-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "notesnyc-55d0a",
  storageBucket: "notesnyc-55d0a.firebasestorage.app",
  messagingSenderId: "727233752008",
  appId: "1:727253752008:web:b8961ac87ad1d1d7142efd"
};
const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
// Persistance offline activée : les écritures faites sans connexion sont mises
// en file d'attente automatiquement par Firestore et renvoyées dès que le
// réseau revient — plus besoin de gérer ça manuellement.
const db = initializeFirestore(firebaseApp, {
  localCache: persistentLocalCache({ tabManager: persistentSingleTabManager() })
});
const storage = getStorage(firebaseApp);
const messaging = getMessaging(firebaseApp);
const VAPID_KEY = 'BMPl4NP3onbq68rzLJMDUdIo3a_484Nvh8BAWV5B3SZwty_oAiO7C_MtVjHDK1RyLxJ-jji9mylkV27vSbd9tag';

// ── Exposition globale pour les scripts classiques ──────────
window.firebaseApp = firebaseApp;
window.auth = auth;
window.db = db;
window.storage = storage;
window.messaging = messaging;
window.VAPID_KEY = VAPID_KEY;

// Auth
window.createUserWithEmailAndPassword = createUserWithEmailAndPassword;
window.signInWithEmailAndPassword = signInWithEmailAndPassword;
window.signOut = signOut;
window.onAuthStateChanged = onAuthStateChanged;
window.updateProfile = updateProfile;
window.updatePassword = updatePassword;
window.reauthenticateWithCredential = reauthenticateWithCredential;
window.EmailAuthProvider = EmailAuthProvider;
window.sendPasswordResetEmail = sendPasswordResetEmail;

// Firestore
window.collection = collection;
window.doc = doc;
window.addDoc = addDoc;
window.setDoc = setDoc;
window.getDoc = getDoc;
window.getDocs = getDocs;
window.updateDoc = updateDoc;
window.deleteDoc = deleteDoc;
window.onSnapshot = onSnapshot;
window.query = query;
window.where = where;
window.orderBy = orderBy;
window.serverTimestamp = serverTimestamp;

// Storage
window.ref = ref;
window.uploadBytes = uploadBytes;
window.getDownloadURL = getDownloadURL;

// Messaging
window.getToken = getToken;
window.onMessage = onMessage;


window.dispatchEvent(new Event('firebase-bridge-ready'));
