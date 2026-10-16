// ========================================================================
// ADMIN SHELL
// Sidebar / drawer behaviour shared by admin.html and orders.html.
// Kept separate from auth_guard.js so the chrome works (and is testable)
// independently of authentication.
// ========================================================================

function setSidebar(open) {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    const toggle = document.querySelector('[data-sidebar-toggle]');

    if (sidebar) sidebar.classList.toggle('open', open);
    if (overlay) overlay.classList.toggle('open', open);
    if (toggle) toggle.setAttribute('aria-expanded', String(open));
    document.body.classList.toggle('no-scroll', open && window.innerWidth <= 1024);
}

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    setSidebar(!(sidebar && sidebar.classList.contains('open')));
}

// Kept on window for backwards compatibility with any older markup.
window.toggleSidebar = toggleSidebar;

function init() {
    const toggle = document.querySelector('[data-sidebar-toggle]');
    if (toggle) {
        toggle.setAttribute('aria-controls', 'sidebar');
        toggle.setAttribute('aria-expanded', 'false');
    }

    document.addEventListener('click', (event) => {
        if (event.target.closest('[data-sidebar-toggle]')) {
            event.preventDefault();
            toggleSidebar();
            return;
        }
        if (event.target.closest('[data-sidebar-close]')) {
            event.preventDefault();
            setSidebar(false);
            return;
        }
        // Close the drawer after tapping a nav link on small screens.
        if (event.target.closest('.sidebar .nav-item') && window.innerWidth <= 1024) {
            setSidebar(false);
        }
    });

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') setSidebar(false);
    });

    window.addEventListener('resize', () => {
        if (window.innerWidth > 1024) setSidebar(false);
    });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
