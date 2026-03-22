/* ─────────────────────────────────────────────────────────
   API helper — dùng chung cho toàn bộ frontend
───────────────────────────────────────────────────────── */

const API_BASE = '/api';

function getToken() {
  return localStorage.getItem('token');
}

function getUser() {
  try {
    return JSON.parse(localStorage.getItem('user') || 'null');
  } catch {
    return null;
  }
}

function setAuth(token, user) {
  localStorage.setItem('token', token);
  localStorage.setItem('user', JSON.stringify(user));
}

function clearAuth() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
}

function isLoggedIn() {
  return !!getToken();
}

async function apiFetch(endpoint, options = {}) {
  const token = getToken();
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${endpoint}`, { ...options, headers });

  // Auto logout on 401 (token expired) or 403 (banned)
  if (res.status === 401) {
    clearAuth();
    window.location.href = '/dang-nhap';
    throw new Error('Phiên đăng nhập hết hạn');
  }
  if (res.status === 403) {
    const data = await res.json().catch(() => ({}));
    // Only force logout if it's an account suspension (not a permissions error)
    if (data.error && data.error.includes('tạm ngưng')) {
      clearAuth();
      window.location.href = '/dang-nhap?banned=1';
      throw new Error(data.error);
    }
  }

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Lỗi không xác định');
  return data;
}


// Shorthand methods
const api = {
  get: (url) => apiFetch(url),
  post: (url, body) => apiFetch(url, { method: 'POST', body: JSON.stringify(body) }),
  put: (url, body) => apiFetch(url, { method: 'PUT', body: JSON.stringify(body) }),
  delete: (url) => apiFetch(url, { method: 'DELETE' }),
};

export { api, getToken, getUser, setAuth, clearAuth, isLoggedIn };
export default api;
