/**
 * src/utils/validation.ts
 * Standard email and password validation rules.
 * 
 * Rules:
 * 1. Email: Must contain '@', '.', and valid format (e.g. name@domain.com)
 * 2. Password:
 *    - Minimum 8 characters
 *    - At least 1 uppercase letter (A-Z)
 *    - At least 2 special characters (e.g. !@#$%^&*()_+-=[]{};':"|,.<>/?)
 */

export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

/**
 * Validates an email address.
 * Checks for required presence, '@' symbol, domain '.', and standard format.
 */
export function validateEmail(email: string): ValidationResult {
  const clean = (email || '').trim();

  if (!clean) {
    return {
      isValid: false,
      error: 'Please enter your registered email address.'
    };
  }

  if (!clean.includes('@')) {
    return {
      isValid: false,
      error: 'Email address must contain an "@" symbol.'
    };
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(clean)) {
    return {
      isValid: false,
      error: 'Please enter a valid email address format with "@" and domain (e.g. name@domain.com).'
    };
  }

  return { isValid: true };
}

/**
 * Validates password strength:
 * 1. Min 8 characters
 * 2. At least 1 uppercase letter (A-Z)
 * 3. At least 2 special characters
 */
export function validatePassword(password: string): ValidationResult {
  const clean = password || '';

  if (!clean) {
    return {
      isValid: false,
      error: 'Password is required.'
    };
  }

  if (clean.length < 8) {
    return {
      isValid: false,
      error: 'Password must be at least 8 characters long.'
    };
  }

  if (!/[A-Z]/.test(clean)) {
    return {
      isValid: false,
      error: 'Password must contain at least 1 uppercase letter (A-Z).'
    };
  }

  const specialMatches = clean.match(/[^A-Za-z0-9\s]/g) || [];
  if (specialMatches.length < 2) {
    return {
      isValid: false,
      error: `Password must contain at least 2 special characters (e.g. !@#$%). Currently found: ${specialMatches.length}.`
    };
  }

  return { isValid: true };
}
