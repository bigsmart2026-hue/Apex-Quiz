import { describe, it, expect } from 'vitest';
import { getAuthErrorMessage, shouldUseRedirectFlow } from './authErrors';

describe('getAuthErrorMessage', () => {
  it('returns null for user cancellations', () => {
    expect(getAuthErrorMessage({ code: 'auth/popup-closed-by-user' })).toBeNull();
    expect(getAuthErrorMessage({ code: 'auth/cancelled-popup-request' })).toBeNull();
    expect(getAuthErrorMessage({ code: 'auth/redirect-cancelled-by-user' })).toBeNull();
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

function withUserAgent(userAgent, fn) {
  const original = navigator.userAgent;
  Object.defineProperty(navigator, 'userAgent', { value: userAgent, configurable: true });
  try {
    return fn();
  } finally {
    Object.defineProperty(navigator, 'userAgent', { value: original, configurable: true });
  }
}

function withStandalone(fn) {
  const original = window.matchMedia;
  Object.defineProperty(window, 'matchMedia', {
    value: (query) => ({
      matches: query.includes('standalone'),
      media: query,
      onchange: null,
      addListener() {},
      removeListener() {},
      addEventListener() {},
      removeEventListener() {},
      dispatchEvent() { return false; },
    }),
    configurable: true,
    writable: true,
  });
  try {
    return fn();
  } finally {
    if (original) {
      Object.defineProperty(window, 'matchMedia', { value: original, configurable: true, writable: true });
    } else {
      delete window.matchMedia;
    }
  }
}

describe('shouldUseRedirectFlow', () => {
  it('uses popup on mobile browsers', () => {
    withUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)', () => {
      expect(shouldUseRedirectFlow()).toBe(false);
    });
  });

  it('uses popup on desktop browsers', () => {
    withUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64)', () => {
      expect(shouldUseRedirectFlow()).toBe(false);
    });
  });

  it('uses redirect for installed PWAs', () => {
    withStandalone(() => {
      expect(shouldUseRedirectFlow()).toBe(true);
    });
  });

  it('uses redirect for embedded in-app browsers', () => {
    withUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Instagram 300.0', () => {
      expect(shouldUseRedirectFlow()).toBe(true);
    });
  });
});
