// ========================================
// AUTH GUARD
// Protects the admin pages and handles sign-out.
// Dashboard chrome lives in js/admin-shell.js.
// ========================================

import { auth, onAuthStateChanged, signOut } from './firebase.js';

/* ------------------------------------------------------------------ */
/* Route protection                                                    */
/* ------------------------------------------------------------------ */

onAuthStateChanged(auth, (user) => {
    if (!user) {
        const target = window.location.pathname.split('/').pop() || 'orders.html';
        window.location.replace('login.html?next=' + encodeURIComponent(target));
        return;
    }

    const email = user.email || 'Signed in';
    document.querySelectorAll('[data-admin-email]').forEach((el) => {
        el.textContent = email;
        el.setAttribute('title', email);
    });
    document.querySelectorAll('[data-admin-initial]').forEach((el) => {
        el.textContent = (email.trim()[0] || 'A').toUpperCase();
    });
});

/* ------------------------------------------------------------------ */
/* Logout                                                             */
/* ------------------------------------------------------------------ */

async function logout() {
    try {
        await signOut(auth);
    } catch (error) {
        console.error('[auth] logout failed', error);
    } finally {
        window.location.replace('login.html');
    }
}

// Kept on window for backwards compatibility with any inline handlers.
window.logout = logout;

document.addEventListener('click', (event) => {
    if (event.target.closest('[data-logout]')) {
        event.preventDefault();
        logout();
    }
});
