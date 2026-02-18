// frontend/js/auth.js
function resolveApiBase() {
  const PROD_API = 'https://taskmanager-8rtb.onrender.com/api';
  if (window.__TASK_API_BASE__) return window.__TASK_API_BASE__;
  const localOverride = localStorage.getItem('taskApiBase');
  if (localOverride) return localOverride;
  const host = window.location.hostname;
  const port = window.location.port;
  if (host === 'localhost' || host === '127.0.0.1') {
    if (port === '5000') return `${window.location.origin}/api`;
    return 'http://localhost:5000/api';
  }
  if (window.location.protocol === 'file:') return 'http://localhost:5000/api';
  return PROD_API;
}

const AUTH_API_BASE = resolveApiBase();
const AUTH_API = AUTH_API_BASE;

const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const loginError = document.getElementById('loginError');
const regError = document.getElementById('regError');
const landingSection = document.getElementById('landingSection');
const getStartedBtn = document.getElementById('getStartedBtn');
const backToHomeBtn = document.getElementById('backToHomeBtn');
const landingFooter = document.getElementById('landingFooter');
const footerGetStartedBtn = document.getElementById('footerGetStartedBtn');
const footerLoginBtn = document.getElementById('footerLoginBtn');
const authSection = document.getElementById('authSection');
const dashboard = document.getElementById('dashboard');
const logoutBtn = document.getElementById('logoutBtn');

document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');

    document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
    document.getElementById(`${tab.dataset.tab}Form`).classList.add('active');
  });
});

if (localStorage.getItem('token')) {
  showDashboard();
} else {
  showLanding();
}

getStartedBtn?.addEventListener('click', () => {
  showAuth();
});
footerGetStartedBtn?.addEventListener('click', () => {
  showAuth();
});
footerLoginBtn?.addEventListener('click', () => {
  showAuth();
});
backToHomeBtn?.addEventListener('click', () => {
  showLanding();
});

async function parseResponseBody(res) {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}

async function postAuth(path, payload) {
  const res = await fetch(`${AUTH_API}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  const data = await parseResponseBody(res);

  if (!res.ok) {
    const message = data?.message || `Request failed (${res.status})`;
    throw new Error(message);
  }

  if (!data?.token) {
    throw new Error('No token returned by server. Check backend response format.');
  }

  return data;
}

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  loginError.textContent = '';

  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;

  try {
    const data = await postAuth('/auth/login', { email, password });
    localStorage.setItem('token', data.token);
    showDashboard();
  } catch (err) {
    loginError.textContent = err.message;
  }
});

registerForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  regError.textContent = '';

  const username = document.getElementById('regUsername').value.trim();
  const email = document.getElementById('regEmail').value.trim();
  const password = document.getElementById('regPassword').value;
  const confirmPassword = document.getElementById('regConfirmPassword').value;

  if (password !== confirmPassword) {
    regError.textContent = 'Passwords do not match';
    return;
  }

  try {
    const data = await postAuth('/auth/register', { username, email, password });
    localStorage.setItem('token', data.token);
    showDashboard();
  } catch (err) {
    regError.textContent = err.message;
  }
});

logoutBtn.addEventListener('click', () => {
  localStorage.removeItem('token');
  location.reload();
});

function showDashboard() {
  if (landingSection) landingSection.style.display = 'none';
  if (landingFooter) landingFooter.style.display = 'none';
  if (backToHomeBtn) backToHomeBtn.style.display = 'none';
  authSection.style.display = 'none';
  dashboard.style.display = 'block';
  logoutBtn.style.display = 'inline-block';
  window.dispatchEvent(new Event('taskhub:auth-success'));
}

function showLanding() {
  if (landingSection) landingSection.style.display = 'grid';
  if (landingFooter) landingFooter.style.display = 'grid';
  if (backToHomeBtn) backToHomeBtn.style.display = 'none';
  authSection.style.display = 'none';
  dashboard.style.display = 'none';
  logoutBtn.style.display = 'none';
}

function showAuth() {
  if (landingSection) landingSection.style.display = 'none';
  if (landingFooter) landingFooter.style.display = 'none';
  if (backToHomeBtn) backToHomeBtn.style.display = 'block';
  authSection.style.display = 'block';
  dashboard.style.display = 'none';
  logoutBtn.style.display = 'none';
}
