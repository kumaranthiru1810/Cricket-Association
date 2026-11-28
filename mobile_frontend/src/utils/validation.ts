/**
 * src/utils/validation.ts
 * Standard email and password validation rules.
 * 
 * Rules:
 * 1. Email: Must contain '@', '.', and valid format (e.g. name@domain.com)
 * 2. Password:
 *    - Minimum 8 characters
 *    - At least 1 uppercase letter (A-Z)
 *    - At least 1 special character (e.g. !@#$%^&*()_+-=[]{};':"|,.<>/?)
 *    - At least 2 numbers (0-9)
 */

export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

export interface PasswordCriteriaStatus {
  minLength: boolean;
  hasUppercase: boolean;
  hasSpecialChar: boolean;
  hasTwoNumbers: boolean;
  digitCount: number;
  allValid: boolean;
}

/**
 * Returns breakdown of password criteria for real-time validation badges.
 */
export function getPasswordCriteria(password: string): PasswordCriteriaStatus {
  const clean = password || '';
  const minLength = clean.length >= 8;
  const hasUppercase = /[A-Z]/.test(clean);
  const hasSpecialChar = (clean.match(/[^A-Za-z0-9\s]/g) || []).length >= 1;
  const digitCount = (clean.match(/[0-9]/g) || []).length;
  const hasTwoNumbers = digitCount >= 2;
  const allValid = minLength && hasUppercase && hasSpecialChar && hasTwoNumbers;

  return {
    minLength,
    hasUppercase,
    hasSpecialChar,
    hasTwoNumbers,
    digitCount,
    allValid
  };
}

/**
 * Validates an email address.
 * Rule: Only letters, numbers, and allowed characters (_, @, .) are permitted.
 * No other special characters allowed. Must have valid email structure.
 */
export function validateEmail(email: string, customEmptyMessage?: string): ValidationResult {
  const clean = (email || '').trim();

  if (!clean) {
    return {
      isValid: false,
      error: customEmptyMessage || 'Please enter your registered email address.'
    };
  }

  // Only letters, digits, and _, @, . are allowed
  if (/[^a-zA-Z0-9_.@]/.test(clean)) {
    return {
      isValid: false,
      error: 'Email can only contain letters, numbers, and allowed characters: "_" , "@" , "." (no other special characters).'
    };
  }

  if (!clean.includes('@')) {
    return {
      isValid: false,
      error: 'Email address must contain an "@" symbol.'
    };
  }

  const atCount = (clean.match(/@/g) || []).length;
  if (atCount !== 1) {
    return {
      isValid: false,
      error: 'Email address must contain exactly one "@" symbol.'
    };
  }

  const [localPart, domainPart] = clean.split('@');
  if (!localPart || !domainPart) {
    return {
      isValid: false,
      error: 'Please enter a valid email format (e.g. name@domain.com).'
    };
  }

  if (!domainPart.includes('.')) {
    return {
      isValid: false,
      error: 'Email domain must contain a "." (e.g. domain.com).'
    };
  }

  const emailRegex = /^[a-zA-Z0-9_.]+@[a-zA-Z0-9]+(\.[a-zA-Z0-9]+)*\.[a-zA-Z]{2,}$/;
  if (!emailRegex.test(clean)) {
    return {
      isValid: false,
      error: 'Please enter a valid email address format with "@" and domain (e.g. name@domain.com).'
    };
  }

  return { isValid: true };
}

/**
 * Validates a person's name (Player, Coach, Scorer, Umpire).
 * Rule: Must contain only letters and spaces. No numbers or special characters allowed.
 */
export function validateName(name: string, fieldName = 'Name'): ValidationResult {
  const clean = (name || '').trim();

  if (!clean) {
    return {
      isValid: false,
      error: `${fieldName} is required.`
    };
  }

  if (clean.length < 3) {
    return {
      isValid: false,
      error: `${fieldName} must be at least 3 letters.`
    };
  }

  if (/[0-9]/.test(clean)) {
    return {
      isValid: false,
      error: `${fieldName} must not contain numbers.`
    };
  }

  if (/[^a-zA-Z.\s]/.test(clean)) {
    return {
      isValid: false,
      error: `${fieldName} must not contain special characters. Only letters, initials (.), and spaces are allowed.`
    };
  }

  return { isValid: true };
}

/**
 * Validates a team / club name.
 * Rule: Only letters, numbers, underscore (_), and spaces allowed. No other special characters.
 */
export function validateTeamName(teamName: string, fieldName = 'Team Name'): ValidationResult {
  const clean = (teamName || '').trim();

  if (!clean) {
    return {
      isValid: false,
      error: `${fieldName} is required.`
    };
  }

  if (clean.length < 3) {
    return {
      isValid: false,
      error: `${fieldName} must be at least 3 characters.`
    };
  }

  if (/[^a-zA-Z0-9_\s]/.test(clean)) {
    return {
      isValid: false,
      error: `${fieldName} can only contain letters, numbers, spaces, and underscore (_). Other special characters are not allowed.`
    };
  }

  return { isValid: true };
}

/**
 * Validates umpire experience.
 * Rule: Must only contain numbers (digits 0-9).
 */
export function validateExperience(exp: string, fieldName = 'Umpire Experience'): ValidationResult {
  const clean = (exp || '').trim();

  if (!clean) {
    return {
      isValid: false,
      error: `${fieldName} is required.`
    };
  }

  if (!/^\d+$/.test(clean)) {
    return {
      isValid: false,
      error: `${fieldName} must contain numbers only.`
    };
  }

  const num = parseInt(clean, 10);
  if (num < 0 || num > 60) {
    return {
      isValid: false,
      error: 'Please enter a valid experience between 0 and 60 years.'
    };
  }

  return { isValid: true };
}

/**
 * Validates password strength:
 * 1. Min 8 characters
 * 2. At least 1 uppercase letter (A-Z)
 * 3. At least 1 special character (e.g. !@#$%)
 * 4. At least 2 numeric digits (0-9)
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
  if (specialMatches.length < 1) {
    return {
      isValid: false,
      error: 'Password must contain at least 1 special character (e.g. !@#$%).'
    };
  }

  const digitMatches = clean.match(/[0-9]/g) || [];
  if (digitMatches.length < 2) {
    return {
      isValid: false,
      error: `Password must contain at least 2 numbers (0-9). Currently found: ${digitMatches.length}.`
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

