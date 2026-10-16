// ========================================
// JANNAT BAKING TOOLS - FIREBASE CONFIG
// Single source of truth for Firebase SDK access.
// ========================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import {
    getAuth,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    setPersistence,
    browserLocalPersistence,
    browserSessionPersistence
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import {
    getFirestore,
    collection,
    doc,
    addDoc,
    setDoc,
    getDocs,
    getDoc,
    updateDoc,
    deleteDoc,
    query,
    where,
    orderBy,
    limit,
    onSnapshot,
    serverTimestamp,
    increment,
    writeBatch,
    documentId
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import {
    getStorage,
    ref,
    uploadBytes,
    getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";

// Firebase Configuration
// NOTE: These values are safe to expose in the browser — access is controlled
// by Firebase Security Rules (see firestore.rules in the project root).
const firebaseConfig = {
    apiKey: "AIzaSyAZUnF_3TU3qoZCXYoCg4SvmMPlESjMx_g",
    authDomain: "jannat-baking-tools-web-15b09.firebaseapp.com",
    projectId: "jannat-baking-tools-web-15b09",
    storageBucket: "jannat-baking-tools-web-15b09.firebasestorage.app",
    messagingSenderId: "216078314365",
    appId: "1:216078314365:web:d8ed0328680b6605003a14",
    measurementId: "G-4M64WY4PZZ"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

export {
    app,
    auth,
    db,
    storage,
    // Auth
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    setPersistence,
    browserLocalPersistence,
    browserSessionPersistence,
    // Firestore
    collection,
    doc,
    addDoc,
    setDoc,
    getDocs,
    getDoc,
    updateDoc,
    deleteDoc,
    query,
    where,
    orderBy,
    limit,
    onSnapshot,
    serverTimestamp,
    increment,
    writeBatch,
    documentId,
    // Storage
    ref,
    uploadBytes,
    getDownloadURL
};
