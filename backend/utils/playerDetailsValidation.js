/**
 * utils/playerDetailsValidation.js
 * Strict validation & normalization for Player Registration fields:
 * - Club / School / College / Academy Name
 * - Studying section (Institution Name, Institution Type, Branch/Year/Section or Class/Section)
 * - Working section (Institution / Bank / Government Office Name)
 * Note: "Other" (NONE) occupation type is intentionally left unvalidated.
 */

function normalizeSpaces(value) {
  if (value === null || value === undefined) return '';
  return String(value).replace(/\s+/g, ' ').trim();
}

const PERSON_NAME_REGEX = /^[\p{L}\s.'-]+$/u;

function validatePersonName(value, fieldName = 'Player Full Name') {
  const normalized = normalizeSpaces(value);
  const invalidMsg = fieldName === 'Father Name'
    ? 'Please enter a valid father name.'
    : 'Please enter a valid player name.';

  if (!normalized) {
    return { isValid: false, error: `${fieldName} is required.` };
  }
  if (normalized.length > 100) {
    return { isValid: false, error: 'Name cannot exceed 100 characters.' };
  }
  if (!PERSON_NAME_REGEX.test(normalized)) {
    return { isValid: false, error: invalidMsg };
  }
  const letterCount = (normalized.match(/\p{L}/gu) || []).length;
  if (letterCount === 0) {
    return { isValid: false, error: invalidMsg };
  }
  if (letterCount < 2) {
    return { isValid: false, error: 'Name must contain at least 2 letters.' };
  }

  return { isValid: true, normalized };
}

function validateClubOrAcademyName(value) {
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

  return { isValid: true, normalized };
}

function validateStudyingInstitution(value) {
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

  return { isValid: true, normalized };
}

function validateStudyLevel(value) {
  const level = String(value || '').trim().toUpperCase();
  if (level !== 'COLLEGE' && level !== 'SCHOOL') {
    return { isValid: false, error: 'Please select either COLLEGE or SCHOOL.' };
  }
  return { isValid: true, normalized: level };
}

function validateStudyBranchOrClass(value, studyLevel = 'COLLEGE') {
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

  return { isValid: true, normalized };
}

function validateWorkingInstitution(value) {
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

  return { isValid: true, normalized };
}

function getTodayYyyyMmDd() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function validateDeclarationDate(value) {
  const clean = value === null || value === undefined ? '' : String(value).trim();
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

  return { isValid: true, normalized: clean };
}

function validateDeclarationPlace(value) {
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

  return { isValid: true, normalized };
}

function validateIndianMobile(value) {
  const raw = value === null || value === undefined ? '' : String(value);
  if (!raw.trim()) {
    return { isValid: false, error: 'Mobile number is required.' };
  }
  if (/[^0-9]/.test(raw)) {
    return { isValid: false, error: 'Mobile number must contain digits only (0-9).' };
  }
  if (raw.length !== 10) {
    return { isValid: false, error: 'Mobile number must be exactly 10 digits.' };
  }
  if (!/^[6-9]\d{9}$/.test(raw)) {
    return { isValid: false, error: 'Indian mobile number must start with 6, 7, 8, or 9.' };
  }
  return { isValid: true, normalized: raw };
}

module.exports = {
  normalizeSpaces,
  validatePersonName,
  validateClubOrAcademyName,
  validateStudyingInstitution,
  validateStudyLevel,
  validateStudyBranchOrClass,
  validateWorkingInstitution,
  validateDeclarationDate,
  validateDeclarationPlace,
  validateIndianMobile
};

