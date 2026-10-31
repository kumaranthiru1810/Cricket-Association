/**
 * services/vjdService.js
 *
 * VJD (V Jayadevan) Method – Honest Status Service
 *
 * IMPORTANT:
 * The VJD Method was developed by V. Jayadevan (India). The official VJD
 * methodology involves proprietary resource tables and coefficients that
 * are NOT in the public domain. The full tables are available only through
 * authorized channels and licensed software.
 *
 * This module:
 * 1. Accurately identifies when VJD is selected as the active method.
 * 2. Returns a clear "UNAVAILABLE" status with an explanation.
 * 3. Does NOT fabricate VJD results using run-rate or DLS formulas.
 * 4. Provides a structural placeholder for integration with licensed VJD software.
 *
 * To enable real VJD calculations, replace the body of `getVJDPrediction`
 * with calls to an authorized VJD licensed engine or API.
 */

const VJD_DISCLAIMER = [
  'The VJD Method (V. Jayadevan Method) requires proprietary resource tables',
  'that are not publicly available.',
  'To use official VJD calculations, an authorized VJD software license is required.',
  'Contact: V. Jayadevan (developer) or authorized VJD software distributors.',
  'Reference: Jayadevan V (2002) "A new method for the computation of target scores',
  'in interrupted one-day cricket matches" Current Science 83(5):577-586.'
].join(' ');

/**
 * VJD Phase I & II curves – structural placeholders only.
 * These are NOT the actual VJD tables. Real tables require authorization.
 */
const VJD_STATUS = {
  AVAILABLE: false,  // Set to true only when licensed VJD engine is integrated
  VERSION: 'VJD Method (V. Jayadevan) — Authorization Required',
  CONTACT: 'jayadevan.v@gmail.com or authorized VJD software provider'
};

/**
 * Main VJD prediction function.
 * Returns unavailable status until a licensed VJD engine is integrated.
 *
 * @param {object} params - Match parameters (same structure as DLS params)
 * @returns {object} VJD result with unavailable status
 */
function getVJDPrediction(params) {
  // ── IMPORTANT: Do not generate fake VJD results ───────────────────────────
  // If a valid licensed VJD engine is integrated in the future,
  // replace this block with actual VJD calculations.
  // ─────────────────────────────────────────────────────────────────────────

  return {
    method: 'VJD',
    version: VJD_STATUS.VERSION,
    active: false,
    status: 'UNAVAILABLE',
    unavailableReason: 'VJD proprietary resource tables are not in the public domain',
    disclaimer: VJD_DISCLAIMER,
    contact: VJD_STATUS.CONTACT,
    reference: 'Jayadevan V (2002) Current Science 83(5):577-586',
    integrationNote: 'Integrate authorized VJD licensed software to enable calculations',
    revisedTarget: null,
    parScore: null,
    matchPosition: null,
    calculatedAt: new Date().toISOString(),
    inputParams: {
      team1Score: params?.team1Score || null,
      team2OversPlayed: params?.team2OversPlayed || null,
      team2WicketsLost: params?.team2WicketsLost || null,
      team2RevisedOvers: params?.team2RevisedOvers || null,
      hasInterruption: params?.hasInterruption || false
    }
  };
}

/**
 * Get VJD status info (for admin display).
 */
function getVJDStatus() {
  return {
    method: 'VJD',
    version: VJD_STATUS.VERSION,
    isLicensed: VJD_STATUS.AVAILABLE,
    status: VJD_STATUS.AVAILABLE ? 'AVAILABLE' : 'UNLICENSED',
    disclaimer: VJD_DISCLAIMER,
    contact: VJD_STATUS.CONTACT
  };
}

/**
 * Validate VJD input parameters (structural validation only).
 * Useful for when a licensed engine is later integrated.
 */
function validateVJDParams(params) {
  const errors = [];
  if (!params.team1Score && params.team1Score !== 0) errors.push('team1Score is required');
  if (!params.team2OversAllocated) errors.push('team2OversAllocated is required');
  if (params.team2WicketsLost > 10) errors.push('wicketsLost cannot exceed 10');
  return { valid: errors.length === 0, errors };
}

module.exports = {
  getVJDPrediction,
  getVJDStatus,
  validateVJDParams,
  VJD_STATUS,
  VJD_DISCLAIMER
};
