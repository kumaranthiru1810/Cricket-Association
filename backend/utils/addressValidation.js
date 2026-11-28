/**
 * utils/addressValidation.js
 * Strict Address for Communication validation & sanitization shared across backend routes/services.
 */

const ADDRESS_REGEX = /^[\p{L}\p{N}\s,./#'()-]+$/u;

function normalizeAddress(address) {
  if (address === null || address === undefined) return '';
  return String(address).replace(/\s+/g, ' ').trim();
}

function validateAddress(address) {
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

  return {
    isValid: true,
    normalized
  };
}

module.exports = {
  normalizeAddress,
  validateAddress
};
