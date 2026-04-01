// ========================================
// AUTH GUARD - Protect Admin Routes
// ========================================

import { auth, onAuthStateChanged } from "./firebase.js";

onAuthStateChanged(auth, (user) => {
    if (!user) {
        // Not logged in, redirect to login
        window.location.href = "login.html";
    }
});

// Logout function
window.logout = async () => {
    try {
        const { signOut } = await import("./firebase.js");
        await signOut(auth);
        window.location.href = "login.html";
    } catch (error) {
        console.error("Logout error:", error);
    }
};
