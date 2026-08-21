import type { AuthUser, LoginResponseUser } from "../types/auth";

const SESSION_TOKEN_KEY = "assetflow_session_token";

export function toAuthUser(user: LoginResponseUser): AuthUser {
  return {
    id: user.id,
    name: user.name,
    loginId: user.login_id,
    role: user.role,
  };
}

export function getSessionToken() {
  try {
    return window.localStorage.getItem(SESSION_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setSessionToken(sessionToken: string | null | undefined) {
  try {
    if (sessionToken) {
      window.localStorage.setItem(SESSION_TOKEN_KEY, sessionToken);
      return;
    }

    window.localStorage.removeItem(SESSION_TOKEN_KEY);
  } catch {
    // Ignore storage failures and let cookie-based auth continue.
  }
}

export function clearSessionToken() {
  setSessionToken(null);
}
