// frontend/js/auth.js
const AUTH_API = 'http://localhost:5000/api';  

// DOM elements
const loginForm    = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const loginError   = document.getElementById('loginError');
const regError     = document.getElementById('regError');
const authSection  = document.getElementById('authSection');
const dashboard    = document.getElementById('dashboard');
const logoutBtn    = document.getElementById('logoutBtn');

// Tab switching
document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

        document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
        document.getElementById(tab.dataset.tab + 'Form').classList.add('active');
    });
});

// Check if already logged in
if (localStorage.getItem('token')) {
    showDashboard();
}

// Login
loginForm.addEventListener('submit', async e => {
    e.preventDefault();
    loginError.textContent = '';

    const email    = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;

    try {
        const res = await fetch(`${AUTH_API}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        const data = await res.json();

        if (!res.ok) {
            throw new Error(data.message || 'Login failed');
        }

        // token-based auth (correct)
        localStorage.setItem('token', data.token);
        showDashboard();

    } catch (err) {
        loginError.textContent = err.message;
    }
});

// Register
registerForm.addEventListener('submit', async e => {
    e.preventDefault();
    regError.textContent = '';

    const username = document.getElementById('regUsername').value.trim();
    const email    = document.getElementById('regEmail').value.trim();
    const password = document.getElementById('regPassword').value;

    try {
        const res = await fetch(`${AUTH_API}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, email, password })
        });

        const data = await res.json();

        if (!res.ok) {
            throw new Error(data.message || 'Registration failed');
        }

        // token-based auth (correct)
        localStorage.setItem('token', data.token);
        showDashboard();

    } catch (err) {
        regError.textContent = err.message;
    }
});

// Logout
logoutBtn.addEventListener('click', () => {
    localStorage.removeItem('token');
    location.reload();
});

function showDashboard() {
    authSection.style.display = 'none';
    dashboard.style.display = 'block';
    logoutBtn.style.display = 'inline-block';         
}
