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
export function validateEmail(email: string, customEmptyMessage?: string): ValidationResult {
  const clean = (email || '').trim();

  if (!clean) {
    return {
      isValid: false,
      error: customEmptyMessage || 'Please enter your registered email address.'
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

/**
 * Validates a 10-digit Indian mobile number.
 * Must be exactly 10 digits and start with 6, 7, 8, or 9.
 */
export function validatePhone(phone: string, fieldName = 'Phone Number'): ValidationResult {
  const digits = (phone || '').replace(/\D/g, '');

  if (!digits) {
    return {
      isValid: false,
      error: `${fieldName} is required.`
    };
  }

  if (digits.length !== 10) {
    return {
      isValid: false,
      error: `${fieldName} must be exactly 10 digits. Currently: ${digits.length} digits.`
    };
  }

  if (!/^[6-9]/.test(digits)) {
    return {
      isValid: false,
      error: `${fieldName} must start with 6, 7, 8, or 9.`
    };
  }

  return { isValid: true };
}

/**
 * Strips non-digits and truncates to 10 digits.
 */
export function formatPhone(val: string): string {
  return (val || '').replace(/\D/g, '').slice(0, 10);
}

/**
 * Validates a 12-digit Indian Aadhaar number.
 * Must be exactly 12 digits and cannot start with 0 or 1 (UIDAI format).
 */
export function validateAadhaar(aadhaar: string): ValidationResult {
  const digits = (aadhaar || '').replace(/\D/g, '');

  if (!digits) {
    return {
      isValid: false,
      error: 'Aadhaar Number is required.'
    };
  }

  if (digits.length !== 12) {
    return {
      isValid: false,
      error: `Aadhaar Number must be exactly 12 digits. Currently: ${digits.length} digits.`
    };
  }

  if (/^[01]/.test(digits)) {
    return {
      isValid: false,
      error: 'Aadhaar Number cannot start with 0 or 1 (UIDAI format).'
    };
  }

  return { isValid: true };
}

/**
 * Formats a 12-digit Aadhaar number with standard 4-digit spacing (e.g. "5432 9876 1234").
 */
export function formatAadhaar(val: string): string {
  const cleaned = (val || '').replace(/\D/g, '').slice(0, 12);
  const parts: string[] = [];
  for (let i = 0; i < cleaned.length; i += 4) {
    parts.push(cleaned.slice(i, i + 4));
  }
  return parts.join(' ');
}

// Re-export schedule date and time validation
export * from './dateTimeValidation';

