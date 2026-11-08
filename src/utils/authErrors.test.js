import { describe, it, expect } from 'vitest';
import { getAuthErrorMessage, shouldUseRedirectFlow } from './authErrors';

describe('getAuthErrorMessage', () => {
  it('returns null for user cancellations', () => {
    expect(getAuthErrorMessage({ code: 'auth/popup-closed-by-user' })).toBeNull();
    expect(getAuthErrorMessage({ code: 'auth/cancelled-popup-request' })).toBeNull();
  });

  it('explains unauthorized and disabled providers', () => {
    expect(getAuthErrorMessage({ code: 'auth/unauthorized-domain' })).toContain('Authorized domains');
    expect(getAuthErrorMessage({ code: 'auth/operation-not-allowed' })).toContain('Enable the Google provider');
  });

  it('explains blocked popups and network failures', () => {
    expect(getAuthErrorMessage({ code: 'auth/popup-blocked' })).toContain('blocked');
    expect(getAuthErrorMessage({ code: 'auth/network-request-failed' })).toContain('Network error');
  });

  it('falls back to the Firebase message or a generic message', () => {
    expect(getAuthErrorMessage({ code: 'auth/unknown', message: 'Something specific' })).toBe('Something specific');
    expect(getAuthErrorMessage(null)).toBe('Sign-in failed. Please try again.');
  });
});

describe('shouldUseRedirectFlow', () => {
  it('uses redirect on mobile user agents', () => {
    const original = navigator.userAgent;
    Object.defineProperty(navigator, 'userAgent', { value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)', configurable: true });
    expect(shouldUseRedirectFlow()).toBe(true);
    Object.defineProperty(navigator, 'userAgent', { value: original, configurable: true });
  });

  it('uses popup on desktop user agents', () => {
    const original = navigator.userAgent;
    Object.defineProperty(navigator, 'userAgent', { value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', configurable: true });
    expect(shouldUseRedirectFlow()).toBe(false);
    Object.defineProperty(navigator, 'userAgent', { value: original, configurable: true });
  });
});
