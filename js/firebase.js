// ========================================
// JANNAT BAKING TOOLS - FIREBASE CONFIG
// ========================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getAuth, 
    signInWithEmailAndPassword, 
    signOut, 
    onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
    getFirestore, 
    collection, 
    doc, 
    addDoc, 
    getDocs, 
    getDoc,
    updateDoc, 
    deleteDoc, 
    query, 
    where, 
    orderBy, 
    onSnapshot,
    serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
// We add these back so app.js doesn't crash:
import { 
    getStorage, 
    ref, 
    uploadBytes, 
    getDownloadURL 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";

// Firebase Configuration
// NOTE: Make sure you put your REAL keys back here!
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
const storage = getStorage(app); // Initialize storage

// Export everything (including the storage tools app.js is looking for)
export { 
    app, 
    auth, 
    db, 
    storage,
    // Auth functions
    signInWithEmailAndPassword, 
    signOut, 
    onAuthStateChanged,
    // Firestore functions
    collection, 
    doc, 
    addDoc, 
    getDocs, 
    getDoc,
    updateDoc, 
    deleteDoc, 
    query, 
    where, 
    orderBy, 
    onSnapshot,
    serverTimestamp,
    // Storage functions (Crucial for app.js to stop crashing)
    ref, 
    uploadBytes, 
    getDownloadURL 
};