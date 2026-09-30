const API = (() => {
  const BASE_URL = 'http://localhost:5000/api';
  const TOKEN_KEY = 'safara_token';
  const USER_KEY = 'safara_user';

  // Remove data created by the former browser-only database and key storage.
  ['safara_v2', 'safara_session', 'safara_apikey'].forEach(key => {
    localStorage.removeItem(key);
  });

  function getToken() {
    return localStorage.getItem(TOKEN_KEY);
  }

  function getCurrentUser() {
    try {
      return JSON.parse(localStorage.getItem(USER_KEY)) || null;
    } catch {
      return null;
    }
  }

  function isLoggedIn() {
    return Boolean(getToken() && getCurrentUser());
  }

  function logout(redirect = true) {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    if (redirect) window.location.href = 'index.html';
  }

  async function request(path, { auth = true, ...options } = {}) {
    const headers = new Headers(options.headers || {});
    if (options.body !== undefined && !(options.body instanceof FormData)) {
      headers.set('Content-Type', 'application/json');
    }
    if (auth && getToken()) {
      headers.set('Authorization', `Bearer ${getToken()}`);
    }

    let response;
    try {
      response = await fetch(`${BASE_URL}${path}`, { ...options, headers });
    } catch {
      throw new Error('Cannot reach the SAFARA server. Make sure the backend is running at http://localhost:5000.');
    }

    const raw = await response.text();
    let data = null;
    if (raw) {
      try {
        data = JSON.parse(raw);
      } catch {
        data = null;
      }
    }

    if (!response.ok) {
      if (response.status === 401 && auth && getToken()) logout();
      const messages = {
        400: 'Please check the information and try again.',
        401: 'Your session is invalid or has expired. Please sign in again.',
        403: 'You do not have permission to perform this action.',
        404: 'The requested SAFARA resource was not found.',
        500: 'The server could not complete your request. Please try again later.',
      };
      const message = (response.status < 500 && data?.error) || messages[response.status] || 'The request could not be completed.';
      throw new Error(message);
    }

    return data;
  }

  function saveSession(result) {
    localStorage.setItem(TOKEN_KEY, result.token);
    localStorage.setItem(USER_KEY, JSON.stringify(result.user));
    return result.user;
  }

  return {
    getToken,
    getCurrentUser,
    isLoggedIn,
    logout,
    async login(email, password) {
      const result = await request('/auth/login', {
        method: 'POST',
        auth: false,
        body: JSON.stringify({ email, password }),
      });
      return saveSession(result);
    },
    async signup({ name, email, password, city }) {
      const result = await request('/auth/signup', {
        method: 'POST',
        auth: false,
        body: JSON.stringify({ name, email, password, city }),
      });
      return saveSession(result);
    },
    ngoRegister(fields) {
      return request('/auth/ngo-register', {
        method: 'POST',
        auth: false,
        body: JSON.stringify(fields),
      });
    },
    getIncidents() {
      return request('/incidents');
    },
    createIncident(incident) {
      return request('/incidents', {
        method: 'POST',
        body: JSON.stringify(incident),
      });
    },
    updateIncident(id, changes) {
      return request(`/incidents/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify(changes),
      });
    },
    getStats() {
      return request('/stats');
    },
    getEmergencyContacts() {
      return request('/contacts');
    },
    classifyIncident(text, location) {
      return request('/classify', {
        method: 'POST',
        body: JSON.stringify({ text, location }),
      });
    },
  };
})();
