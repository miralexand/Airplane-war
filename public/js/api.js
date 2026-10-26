const TOKEN_KEY = 'sky_strike_token';

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

class ApiClient {
  constructor() {
    this.token = (() => {
      try {
        return localStorage.getItem(TOKEN_KEY) || '';
      } catch {
        return '';
      }
    })();
    this.user = null;
  }

  setToken(token) {
    this.token = token || '';
    try {
      if (this.token) localStorage.setItem(TOKEN_KEY, this.token);
      else localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* noop */
    }
  }

  async request(path, options = {}) {
    const headers = { ...(options.headers || {}) };
    if (options.body) headers['Content-Type'] = 'application/json';
    if (this.token) headers.Authorization = `Bearer ${this.token}`;
    let response;
    try {
      response = await fetch(path, { ...options, headers });
    } catch {
      throw new ApiError('网络信号中断，请检查连接。', 0);
    }
    let data = {};
    try {
      data = await response.json();
    } catch {
      /* noop */
    }
    if (response.status === 401 && this.token) {
      this.setToken('');
      this.user = null;
      window.dispatchEvent(new CustomEvent('auth:expired'));
    }
    if (!response.ok) {
      throw new ApiError(data.error || '请求失败，请稍后再试。', response.status);
    }
    return data;
  }

  async register(username, password) {
    const data = await this.request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    });
    this.setToken(data.token);
    this.user = data.user;
    return data.user;
  }

  async login(username, password) {
    const data = await this.request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    });
    this.setToken(data.token);
    this.user = data.user;
    return data.user;
  }

  async me() {
    if (!this.token) return null;
    const data = await this.request('/api/me');
    this.user = data.user;
    return data.user;
  }

  logout() {
    this.setToken('');
    this.user = null;
  }

  async catalog() {
    return this.request('/api/catalog');
  }

  async network() {
    return this.request('/api/network');
  }

  async leaderboard(mode) {
    return this.request(`/api/leaderboard?mode=${encodeURIComponent(mode)}`);
  }

  async submitScore(payload) {
    const data = await this.request('/api/scores', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    this.user = data.user;
    return data;
  }

  async saveProgress(stage) {
    const data = await this.request('/api/progress', {
      method: 'POST',
      body: JSON.stringify({ stage })
    });
    this.user = data.user;
    return data.user;
  }

  async redeem(code) {
    const data = await this.request('/api/redeem', {
      method: 'POST',
      body: JSON.stringify({ code })
    });
    this.user = data.user;
    return data;
  }

  async buy(type, id) {
    const data = await this.request('/api/hangar/buy', {
      method: 'POST',
      body: JSON.stringify({ type, id })
    });
    this.user = data.user;
    return data.user;
  }

  async equip(plane, skin) {
    const data = await this.request('/api/hangar/equip', {
      method: 'POST',
      body: JSON.stringify({ plane, skin })
    });
    this.user = data.user;
    return data.user;
  }
}

export const api = new ApiClient();
