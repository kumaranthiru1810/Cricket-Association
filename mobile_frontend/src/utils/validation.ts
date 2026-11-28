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

const NAME_REGEX = /^[\p{L}\s.'-]+$/u;

function getInvalidNameMessage(fieldName: string): string {
  if (fieldName === 'Player Full Name') return 'Please enter a valid player name.';
  if (fieldName === 'Father Name' || fieldName === "Father's Name") return 'Please enter a valid father name.';
  return `Please enter a valid ${fieldName.toLowerCase()}.`;
}

/**
 * Validates a person's name (Player Full Name, Father Name, Coach, Scorer, Umpire).
 * Rules:
 * - Required, trimmed, consecutive spaces collapsed
 * - 2+ alphabetic characters, max 100 characters
 * - Allows English & Unicode letters, spaces, periods (.), hyphens (-), apostrophes (')
 * - Rejects numbers and unsupported special characters
 */
export function validateName(name: string, fieldName = 'Name'): ValidationResult {
  const clean = normalizeSpaces(name);
  const emptyLabel = fieldName === "Father's Name" ? 'Father Name' : fieldName;

  if (!clean) {
    return {
      isValid: false,
      error: `${emptyLabel} is required.`
    };
  }

  if (clean.length > 100) {
    return {
      isValid: false,
      error: 'Name cannot exceed 100 characters.'
    };
  }

  if (!NAME_REGEX.test(clean)) {
    return {
      isValid: false,
      error: getInvalidNameMessage(fieldName)
    };
  }

  const letterCount = (clean.match(/\p{L}/gu) || []).length;
  if (letterCount === 0) {
    return {
      isValid: false,
      error: getInvalidNameMessage(fieldName)
    };
  }

  if (letterCount < 2) {
    return {
      isValid: false,
      error: 'Name must contain at least 2 letters.'
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
 * Must contain digits only (0-9), be exactly 10 digits, and start with 6, 7, 8, or 9.
 */
export function validatePhone(phone: string, fieldName = 'Phone Number'): ValidationResult {
  const raw = phone === null || phone === undefined ? '' : String(phone);

  if (!raw.trim()) {
    return {
      isValid: false,
      error: `${fieldName} is required.`
    };
  }

  if (/[^0-9]/.test(raw)) {
    return {
      isValid: false,
      error: `${fieldName} must contain digits only (0-9).`
    };
  }

  if (raw.length !== 10) {
    return {
      isValid: false,
      error: `${fieldName} must be exactly 10 digits. Currently: ${raw.length} digits.`
    };
  }

  if (!/^[6-9]\d{9}$/.test(raw)) {
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

/**
 * Normalizes an address string by collapsing consecutive whitespace into a single space and trimming.
 */
export function normalizeAddress(address: string): string {
  return (address || '').replace(/\s+/g, ' ').trim();
}

/**
 * Sanitizes live address input while typing: strips leading whitespace and collapses consecutive spaces.
 * Preserves characters so invalid characters trigger immediate inline validation feedback.
 */
export function sanitizeAddressInput(address: string): string {
  return (address || '')
    .replace(/\t/g, ' ')
    .replace(/\n+/g, ' ')
    .replace(/ {2,}/g, ' ')
    .replace(/^\s+/, '');
}

const ADDRESS_REGEX = /^[\p{L}\p{N}\s,./#'()-]+$/u;

/**
 * Validates Address for Communication (Aadhaar / Passport Proof).
 * Rules:
 * - Not empty or whitespace-only
 * - Trimmed and consecutive spaces collapsed
 * - 10 to 200 characters
 * - Only Unicode letters, numbers, spaces, and , . / # ' ( ) -
 * - Must contain at least one alphabetic character
 */
export function validateAddress(address: string): ValidationResult {
  const normalized = normalizeAddress(address);

  if (!normalized) {
    return {
      isValid: false,
      error: 'Address is required.'
    };
  }

  if (normalized.length < 10) {
    return {
      isValid: false,
      error: 'Please enter a complete address (minimum 10 characters).'
    };
  }

  if (normalized.length > 200) {
    return {
      isValid: false,
      error: 'Address cannot exceed 200 characters.'
    };
  }

  if (!ADDRESS_REGEX.test(normalized)) {
    return {
      isValid: false,
      error: 'Invalid characters detected. Please enter a valid address.'
    };
  }

  if (!/\p{L}/u.test(normalized)) {
    return {
      isValid: false,
      error: 'Address must contain alphabetic characters.'
    };
  }

  if (normalized.replace(/[^\p{L}\p{N}]/gu, '').length < 3) {
    return {
      isValid: false,
      error: 'Please enter a complete address (minimum 10 characters).'
    };
  }

  return { isValid: true };
}

/**
 * Blocks the Spacebar key on inputs where spaces are never allowed (e.g. email fields),
 * preventing React Native Web's DOM <input> from retaining a space when state stays "".
 */
export function preventSpaceKey(e: any): void {
  if (e?.nativeEvent?.key === ' ' && typeof e?.preventDefault === 'function') {
    e.preventDefault();
  }
}

/**
 * Blocks the Spacebar key when the input is currently empty so leading spaces cannot be typed.
 */
export function preventLeadingSpaceKey(e: any, currentValue: string): void {
  if (e?.nativeEvent?.key === ' ' && !currentValue && typeof e?.preventDefault === 'function') {
    e.preventDefault();
  }
}

/**
 * Blocks printable non-digit keys on numeric-only inputs (e.g. mobile number),
 * allowing navigation keys and Ctrl/Cmd shortcuts (copy/paste/select-all).
 */
export function preventNonDigitKey(e: any): void {
  const key = e?.nativeEvent?.key;
  if (!key || key.length !== 1) return;
  if (e?.ctrlKey || e?.metaKey || e?.altKey) return;
  if (!/^[0-9]$/.test(key) && typeof e?.preventDefault === 'function') {
    e.preventDefault();
  }
}

/**
 * Collapses consecutive whitespace into a single space and trims leading/trailing whitespace.
 */
export function normalizeSpaces(value: string): string {
  return (value || '').replace(/\s+/g, ' ').trim();
}

/**
 * Sanitizes live text input while typing: converts tabs/newlines to spaces,
 * collapses multiple consecutive spaces into one, and strips leading spaces.
 */
export function sanitizeSpaceCollapsedInput(value: string): string {
  return (value || '')
    .replace(/\t/g, ' ')
    .replace(/\n+/g, ' ')
    .replace(/ {2,}/g, ' ')
    .replace(/^\s+/, '');
}

/**
 * Validates Name of Club / School / College / Academy.
 */
export function validateClubOrAcademyName(value: string): ValidationResult {
  const normalized = normalizeSpaces(value);

  if (!normalized) {
    return { isValid: false, error: 'Club / School / College / Academy name is required.' };
  }
  if (normalized.length > 100) {
    return { isValid: false, error: 'Club / School / College / Academy name cannot exceed 100 characters.' };
  }
  if (/[^a-zA-Z0-9 .\-&']/.test(normalized)) {
    return { isValid: false, error: 'Club / School / College / Academy name contains invalid characters.' };
  }
  if (!/[a-zA-Z0-9]/.test(normalized)) {
    return { isValid: false, error: 'Please enter a valid Club / School / College / Academy name.' };
  }
  if (!/[a-zA-Z]/.test(normalized)) {
    return { isValid: false, error: 'Club / School / College / Academy name cannot contain only numbers.' };
  }
  if (normalized.length < 3 || normalized.replace(/[^a-zA-Z0-9]/g, '').length < 3) {
    return { isValid: false, error: 'Club / School / College / Academy name must be at least 3 meaningful characters.' };
  }

  return { isValid: true };
}

/**
 * Validates Studying School / College Name.
 */
export function validateStudyingInstitution(value: string): ValidationResult {
  const normalized = normalizeSpaces(value);

  if (!normalized) {
    return { isValid: false, error: 'School or College name is required.' };
  }
  if (normalized.length > 120) {
    return { isValid: false, error: 'School or College name cannot exceed 120 characters.' };
  }
  if (/[^a-zA-Z0-9 .\-&',/]/.test(normalized)) {
    return { isValid: false, error: 'Please enter a valid School or College name.' };
  }
  if (!/[a-zA-Z0-9]/.test(normalized)) {
    return { isValid: false, error: 'Please enter a valid School or College name.' };
  }
  if (!/[a-zA-Z]/.test(normalized)) {
    return { isValid: false, error: 'School or College name cannot contain only numbers.' };
  }
  if (normalized.length < 3 || normalized.replace(/[^a-zA-Z0-9]/g, '').length < 3) {
    return { isValid: false, error: 'School or College name must be at least 3 meaningful characters.' };
  }

  return { isValid: true };
}

/**
 * Validates Institution Type selection (COLLEGE or SCHOOL).
 */
export function validateStudyLevel(value: string): ValidationResult {
  const level = String(value || '').trim().toUpperCase();
  if (level !== 'COLLEGE' && level !== 'SCHOOL') {
    return { isValid: false, error: 'Please select either COLLEGE or SCHOOL.' };
  }
  return { isValid: true };
}

/**
 * Validates College Branch / Year / Section or School Class / Section.
 */
export function validateStudyBranchOrClass(value: string, studyLevel: string = 'COLLEGE'): ValidationResult {
  const normalized = normalizeSpaces(value);
  const label = String(studyLevel).toUpperCase() === 'SCHOOL' ? 'Class and Section' : 'Branch, Year and Section';

  if (!normalized) {
    return { isValid: false, error: `${label} is required.` };
  }
  if (normalized.length > 100) {
    return { isValid: false, error: `${label} cannot exceed 100 characters.` };
  }
  if (/[^a-zA-Z0-9 .\-/&]/.test(normalized)) {
    return { isValid: false, error: `${label} contains invalid characters.` };
  }
  if (!/[a-zA-Z0-9]/.test(normalized)) {
    return { isValid: false, error: `Please enter a valid ${label.toLowerCase()}.` };
  }
  if (normalized.length < 2 || normalized.replace(/[^a-zA-Z0-9]/g, '').length < 2) {
    return { isValid: false, error: `${label} must be at least 2 meaningful characters.` };
  }

  return { isValid: true };
}

/**
 * Validates Working Institution / Bank / Government Office Name.
 */
export function validateWorkingInstitution(value: string): ValidationResult {
  const normalized = normalizeSpaces(value);

  if (!normalized) {
    return { isValid: false, error: 'Institution / Bank / Government Office name is required.' };
  }
  if (normalized.length > 120) {
    return { isValid: false, error: 'Institution / Bank / Government Office name cannot exceed 120 characters.' };
  }
  if (/[^a-zA-Z0-9 .\-&',/()]/.test(normalized)) {
    return { isValid: false, error: 'Please enter a valid Institution / Bank / Government Office name.' };
  }
  if (!/[a-zA-Z0-9]/.test(normalized)) {
    return { isValid: false, error: 'Please enter a valid Institution / Bank / Government Office name.' };
  }
  if (!/[a-zA-Z]/.test(normalized)) {
    return { isValid: false, error: 'Institution / Bank / Government Office name cannot contain only numbers.' };
  }
  if (normalized.length < 3 || normalized.replace(/[^a-zA-Z0-9]/g, '').length < 3) {
    return { isValid: false, error: 'Institution / Bank / Government Office name must be at least 3 meaningful characters.' };
  }

  return { isValid: true };
}

/**
 * Converts DD/MM/YYYY to YYYY-MM-DD. Returns original string if not DD/MM/YYYY.
 */
export function ddmmyyyyToYyyyMmDd(value: string): string {
  const m = String(value || '').trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return String(value || '').trim();
  return `${m[3]}-${m[2]}-${m[1]}`;
}

/**
 * Converts YYYY-MM-DD to DD/MM/YYYY for CalendarPickerModal display.
 */
export function yyyyMmDdToDdMmYyyy(value: string): string {
  const m = String(value || '').trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return String(value || '').trim();
  return `${m[3]}/${m[2]}/${m[1]}`;
}

/**
 * Returns today's local date formatted as YYYY-MM-DD.
 */
export function getTodayYyyyMmDd(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Validates Declaration Date (mandatory, valid calendar date in YYYY-MM-DD format, not in future).
 */
export function validateDeclarationDate(value: string): ValidationResult {
  const clean = String(value || '').trim();
  if (!clean) {
    return { isValid: false, error: 'Declaration Date is required.' };
  }

  const m = clean.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) {
    return { isValid: false, error: 'Please select a valid Declaration Date (YYYY-MM-DD).' };
  }

  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const dt = new Date(Date.UTC(year, month - 1, day));
  if (
    Number.isNaN(dt.getTime()) ||
    dt.getUTCFullYear() !== year ||
    dt.getUTCMonth() !== month - 1 ||
    dt.getUTCDate() !== day
  ) {
    return { isValid: false, error: 'Please select a valid Declaration Date.' };
  }

  if (clean > getTodayYyyyMmDd()) {
    return { isValid: false, error: 'Declaration Date cannot be in the future.' };
  }

  return { isValid: true };
}

/**
 * Validates Declaration Place (mandatory, English letters and single spaces only, min 2 characters).
 */
export function validateDeclarationPlace(value: string): ValidationResult {
  const normalized = normalizeSpaces(value);

  if (!normalized) {
    return { isValid: false, error: 'Declaration Place is required.' };
  }

  if (normalized.length > 100) {
    return { isValid: false, error: 'Declaration Place cannot exceed 100 characters.' };
  }

  if (/[^a-zA-Z ]/.test(normalized)) {
    return { isValid: false, error: 'Declaration Place must contain only English letters and single spaces.' };
  }

  if (normalized.length < 2 || normalized.replace(/ /g, '').length < 2) {
    return { isValid: false, error: 'Declaration Place must be at least 2 characters.' };
  }

  return { isValid: true };
}

// Re-export schedule date and time validation
export * from './dateTimeValidation';

