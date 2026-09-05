import { io } from 'socket.io-client';

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
  return base + cleanEndpoint;
}

export async function apiFetch(endpoint, options = {}) {
  const url = getFullApiUrl(endpoint);
  return fetch(url, options);
}

// Socket manager
let socketInstance = null;

export function getSocket(onStatusChange = null) {
  if (socketInstance) return socketInstance;

  const backendUrl = getBackendUrl();
  console.log('Connecting to Socket.IO at:', backendUrl);

  socketInstance = io(backendUrl, {
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 2000,
    timeout: 10000
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

  try {
    const res = await fetch(`${targetUrl}/api/health`, { method: 'GET', mode: 'cors' });
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
