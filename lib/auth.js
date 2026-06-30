export function getToken() {
  return null;
}

export function setToken() {
  // O token agora é salvo pelo proxy em cookie HttpOnly.
}

export function removeToken() {
  if (typeof window === 'undefined') return;
  fetch('/api-proxy/auth/logout', { method: 'POST', keepalive: true }).catch(() => {});
}

export function isAuthenticated() {
  return false;
}
