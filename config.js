const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://127.0.0.1:8000'
    : 'https://api.badiaprojectmanagement.com';

/** Read a cookie value by name. Returns '' if not found. */
function getCookie(name) {
    const match = document.cookie.match(new RegExp('(?:^|;\\s*)' + name + '=([^;]*)'));
    return match ? decodeURIComponent(match[1]) : '';
}

/** Return headers needed for authenticated mutating requests. */
function csrfHeaders() {
    return { 'X-CSRF-Token': getCookie('csrf_token') };
}

/** True if the user appears to be logged in (based on non-httpOnly role cookie). UX only. */
function isLoggedIn() {
    const role = getCookie('badia_role');
    return role === 'user' || role === 'admin';
}

/** Return the role string from the non-httpOnly cookie. UX routing only. */
function getUserRole() {
    return getCookie('badia_role');
}

