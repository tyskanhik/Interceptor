import { AuthTokens } from "../models/auth.model";

export function getStoredTokens(): AuthTokens | null {
  try {
    const tokens = localStorage.getItem('auth_tokens');
    return tokens ? JSON.parse(tokens) : null;
  } catch {
    return null;
  }
}

export function isTokenValid(tokens: AuthTokens | null): boolean {
  if (!tokens?.expiresAt) return false;
  return tokens.expiresAt > Date.now();
}

export function storeTokens(tokens: AuthTokens): void {
  localStorage.setItem('auth_tokens', JSON.stringify(tokens));
}

export function clearTokens(): void {
  localStorage.removeItem('auth_tokens');
}

export function getTokenExpiryTime(tokens: AuthTokens | null): string | null {
  if (!tokens?.expiresAt) return null;
  return new Date(tokens.expiresAt).toLocaleTimeString();
}

export function getTimeUntilExpiry(tokens: AuthTokens | null): string | null {
  if (!tokens?.expiresAt) return null;
  
  const timeLeft = tokens.expiresAt - Date.now();
  if (timeLeft <= 0) return 'Истек';
  
  const seconds = Math.floor(timeLeft / 1000);
  return `${seconds} сек`;
}