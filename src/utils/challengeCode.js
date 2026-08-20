const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 6;

const randInt = (max) => Math.floor(Math.random() * max);

/**
 * Generates a human-friendly challenge code (no ambiguous 0/O/1/I).
 * @returns {string} e.g. "AX7K92"
 */
export function generateChallengeCode() {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CODE_ALPHABET[randInt(CODE_ALPHABET.length)];
  }
  return code;
}

export const CHALLENGE_CODE_PATTERN = /^[A-HJ-NP-Z2-9]{6}$/;

export const isValidChallengeCode = (code) => CHALLENGE_CODE_PATTERN.test(code ?? '');

export const challengeShareUrl = (code) =>
  `${window.location.origin}${window.location.pathname}#/challenges?code=${code}`;