const TOKEN_KEY = 'imob_token';

export function getToken() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
  const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toUTCString();
  document.cookie = `auth_token=${token}; path=/; expires=${expires}; SameSite=Strict`;
}

export function removeToken() {
  localStorage.removeItem(TOKEN_KEY);
  document.cookie = 'auth_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Strict';
}

export function isAuthenticated() {
  return !!getToken();
}
