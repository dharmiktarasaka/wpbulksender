import { io } from 'socket.io-client';

// Generate / retrieve persistent private Session ID
export function getSessionId() {
  let sid = localStorage.getItem('WASENDER_SESSION_ID');
  if (!sid || typeof sid !== 'string' || sid.trim().length === 0) {
    sid = 'usr_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
    localStorage.setItem('WASENDER_SESSION_ID', sid);
    try {
      document.cookie = `wa_session_id=${sid}; path=/; max-age=31536000; SameSite=Lax`;
    } catch (e) {}
  }
  return sid;
}

export function resetSessionId() {
  const sid = 'usr_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
  localStorage.setItem('WASENDER_SESSION_ID', sid);
  try {
    document.cookie = `wa_session_id=${sid}; path=/; max-age=31536000; SameSite=Lax`;
  } catch (e) {}

  // Disconnect and reconnect socket to new private session room
  if (socketInstance) {
    socketInstance.removeAllListeners();
    socketInstance.disconnect();
    socketInstance = null;
  }
  return sid;
}

// Get current backend URL
export function getBackendUrl() {
  const saved = localStorage.getItem('WASENDER_BACKEND_URL');
  if (saved && saved.trim()) {
    return saved.trim().replace(/\/+$/, '');
  }

  if (import.meta.env && import.meta.env.VITE_BACKEND_URL) {
    return import.meta.env.VITE_BACKEND_URL.trim().replace(/\/+$/, '');
  }

  const hostname = window.location.hostname || '';
  const isLocal =
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '::1' ||
    hostname === '[::1]' ||
    hostname === '0.0.0.0' ||
    hostname.endsWith('.local') ||
    hostname === '';

  if (isLocal) {
    // If frontend is running on Vite port 3000 (or 5173), point to backend at 5000
    if (window.location.port !== '5000') {
      return 'http://localhost:5000';
    }
    return window.location.origin;
  }

  return window.location.origin;
}

export function setBackendUrl(url) {
  if (!url || !url.trim()) {
    localStorage.removeItem('WASENDER_BACKEND_URL');
  } else {
    localStorage.setItem('WASENDER_BACKEND_URL', url.trim().replace(/\/+$/, ''));
  }
}

export function getFullApiUrl(endpoint) {
  const base = getBackendUrl();
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : '/' + endpoint;
  const separator = cleanEndpoint.includes('?') ? '&' : '?';
  const sid = getSessionId();
  return `${base}${cleanEndpoint}${separator}sessionId=${encodeURIComponent(sid)}`;
}

export async function apiFetch(endpoint, options = {}) {
  const url = getFullApiUrl(endpoint);
  const sid = getSessionId();
  const headers = {
    'x-session-id': sid,
    ...(options.headers || {})
  };
  return fetch(url, { ...options, headers });
}

// Socket manager
let socketInstance = null;

export function getSocket(onStatusChange = null) {
  if (socketInstance) return socketInstance;

  const backendUrl = getBackendUrl();
  const sid = getSessionId();
  console.log('Connecting to Socket.IO at:', backendUrl, '(Private Session:', sid, ')');

  socketInstance = io(backendUrl, {
    transports: ['websocket', 'polling'],
    auth: { sessionId: sid },
    query: { sessionId: sid },
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 2000,
    timeout: 15000
  });

  if (onStatusChange) {
    socketInstance.on('connect', () => onStatusChange('connected', backendUrl));
    socketInstance.on('disconnect', (reason) => onStatusChange('disconnected', backendUrl, reason));
    socketInstance.on('connect_error', (err) => onStatusChange('error', backendUrl, err.message));
  }

  return socketInstance;
}

export function reconnectSocket(onStatusChange = null) {
  if (socketInstance) {
    socketInstance.removeAllListeners();
    socketInstance.disconnect();
    socketInstance = null;
  }
  return getSocket(onStatusChange);
}

// Ping & Health Tester
export async function testServerPing(customUrl = null) {
  const targetUrl = customUrl ? customUrl.replace(/\/+$/, '') : getBackendUrl();
  const startTime = Date.now();
  const sid = getSessionId();

  try {
    const res = await fetch(`${targetUrl}/api/health?sessionId=${encodeURIComponent(sid)}`, {
      method: 'GET',
      mode: 'cors',
      headers: { 'x-session-id': sid }
    });
    const latency = Date.now() - startTime;
    if (res.ok) {
      const data = await res.json();
      return {
        success: true,
        latency,
        data
      };
    }
    return { success: false, error: `HTTP ${res.status}` };
  } catch (err) {
    return { success: false, error: err.message || 'Server Unreachable' };
  }
}
