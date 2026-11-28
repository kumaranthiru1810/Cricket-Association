/**
 * middleware/validationMiddleware.js
 * Comprehensive Request Body Validation using Zod.
 * Validates types, lengths, enums, numeric ranges, email/phone formats on POST/PUT/PATCH.
 * Returns consistent 400 responses: { success: false, message, code: 'VALIDATION_ERROR', errors: [...] }
 */

const { z } = require('zod');
const { normalizeAddress, validateAddress } = require('../utils/addressValidation');
const {
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
} = require('../utils/playerDetailsValidation');

/**
 * Higher-order middleware to validate request bodies against a Zod schema.
 */
function validateBody(schema) {
  return (req, res, next) => {
    if (!schema) return next();
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const issues = result.error.issues || result.error.errors || [];
      const errorDetails = issues.map(err => {
        const field = Array.isArray(err.path) ? err.path.join('.') : '';
        return `${field ? `${field}: ` : ''}${err.message}`;
      });
      return res.status(400).json({
        success: false,
        message: `Validation Error: ${errorDetails[0] || 'Invalid input'}`,
        code: 'VALIDATION_ERROR',
        errors: errorDetails
      });
    }
    req.body = result.data;
    next();
  };
}

// 1. Delivery Recording & Editing Schema
const deliverySchema = z.object({
  runsBatter: z.coerce.number().min(0).max(7).optional().default(0),
  runsExtras: z.coerce.number().min(0).max(7).optional().default(0),
  runs: z.coerce.number().min(0).max(7).optional(),
  extraType: z.enum(['NONE', 'WIDE', 'NO_BALL', 'BYE', 'LEG_BYE', 'PENALTY']).optional().default('NONE'),
  wicket: z.boolean().optional().default(false),
  wicketType: z.enum([
    'BOWLED',
    'CAUGHT',
    'CAUGHT_BEHIND',
    'CAUGHT_AND_BOWLED',
    'LBW',
    'RUN_OUT',
    'STUMPED',
    'HIT_WICKET',
    'RETIRED_OUT',
    'RETIRED_HURT',
    'TIMED_OUT',
    'OBSTRUCTING_FIELD',
    'HIT_BALL_TWICE'
  ]).nullable().optional(),
  strikerId: z.string().max(100).optional(),
  nonStrikerId: z.string().max(100).optional(),
  bowlerId: z.string().max(100).optional(),
  dismissedPlayerId: z.string().max(100).nullable().optional(),
  replacementBatterId: z.string().max(100).nullable().optional(),
  nextBatterId: z.string().max(100).nullable().optional(),
  replacementBatterName: z.string().max(100).optional(),
  overNumber: z.coerce.number().min(0).max(100).optional(),
  ballNumber: z.coerce.number().min(0).max(10).optional(),
  shotType: z.string().max(50).nullable().optional(),
  fieldingPosition: z.string().max(50).nullable().optional(),
  shotAngle: z.coerce.number().min(0).max(360).nullable().optional(),
  shotDistance: z.coerce.number().min(0).max(200).nullable().optional(),
  shotZone: z.string().max(50).nullable().optional(),
  shotX: z.coerce.number().nullable().optional(),
  shotY: z.coerce.number().nullable().optional(),
  fielderId: z.string().max(100).nullable().optional(),
  fielderName: z.string().max(100).nullable().optional(),
  remarks: z.string().max(500).nullable().optional(),
  reason: z.string().max(200).nullable().optional(),
  note: z.string().max(200).nullable().optional(),
  isOverthrow: z.boolean().optional(),
  is_overthrow: z.boolean().optional(),
  overthrowFielders: z.array(z.string().max(100)).optional(),
  rotateStrike: z.boolean().optional(),
  runs_ran: z.coerce.number().min(0).max(7).optional()
}).passthrough();

// 2. Authentication & Login Schemas
const loginSchema = z.object({
  identifier: z.string().min(1, 'Identifier (email, name, or ID) is required.').max(100),
  passwordOrOtp: z.string().min(1).max(100).optional(),
  password: z.string().max(100).optional(),
  otp: z.string().max(20).optional(),
  role: z.enum(['ADMIN', 'SCORER', 'COACH', 'TEAM', 'PLAYER', 'UMPIRE', 'CONTENT', 'USER']).optional(),
  teamName: z.string().max(100).optional()
}).passthrough();

const adminLoginSchema = z.object({
  email: z.string().email('Valid administrator email address is required.').max(100),
  password: z.string().min(1, 'Admin password is required.').max(100)
}).passthrough();

const otpRequestSchema = z.object({
  email: z.string().email('Valid email address is required.').max(100),
  role: z.string().max(50).optional(),
  name: z.string().max(100).optional(),
  teamName: z.string().max(100).optional()
}).passthrough();

const otpVerifySchema = z.object({
  email: z.string().email('Valid email address is required.').max(100),
  otp: z.string().min(4, 'OTP code must be at least 4 digits.').max(10, 'Invalid OTP length.')
}).passthrough();

const resetPasswordSchema = z.object({
  email: z.string().email('Valid email address is required.').max(100),
  otp: z.string().min(4, 'OTP code is required.').max(10),
  newPassword: z.string().min(4, 'New password must be at least 4 characters.').max(100)
}).passthrough();

// 3. Registration Schemas
const scorerRegistrationSchema = z.object({
  name: z.string().min(1, 'Scorer name is required.').max(100).optional(),
  full_name: z.string().max(100).optional(),
  email: z.string().email('Valid email address is required.').max(100),
  mobile: z.string().max(25).optional(),
  phone: z.string().max(25).optional(),
  aadhaar: z.string().max(20).optional(),
  aadhaarNumber: z.string().max(20).optional(),
  taluk: z.string().max(100).optional(),
  certificationLevel: z.string().max(100).optional(),
  pin: z.string().max(20).optional(),
  password: z.string().min(4, 'Password must be at least 4 characters.').max(100).optional(),
  association: z.string().max(150).optional()
}).refine(data => data.name || data.full_name, {
  message: 'Scorer full name is required.'
}).passthrough();

const playerRegistrationSchema = z.object({
  name: z.any().superRefine((val, ctx) => {
    const res = validatePersonName(val, 'Player Full Name');
    if (!res.isValid) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: res.error });
    }
  }).transform((val) => normalizeSpaces(val)),
  fatherName: z.any().superRefine((val, ctx) => {
    const res = validatePersonName(val, 'Father Name');
    if (!res.isValid) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: res.error });
    }
  }).transform((val) => normalizeSpaces(val)),
  email: z.string().email('Valid email address is required.').max(100),
  mobile: z.string().max(25).optional(),
  phone: z.string().max(25).optional(),
  password: z.string().min(4, 'Password must be at least 4 characters.').max(100).optional(),
  aadhaar: z.string().max(20).optional(),
  aadhaarNumber: z.string().max(20).optional(),
  role: z.string().max(50).optional(),
  category: z.string().max(50).optional(),
  taluk: z.string().max(100).optional(),
  battingStyle: z.string().max(50).optional(),
  bowlingStyle: z.string().max(50).optional(),
  clubChoice: z.any().superRefine((val, ctx) => {
    const res = validateClubOrAcademyName(val);
    if (!res.isValid) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: res.error });
    }
  }).transform((val) => normalizeSpaces(val)),
  address: z.any().superRefine((val, ctx) => {
    const res = validateAddress(val);
    if (!res.isValid) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: res.error
      });
    }
  }).transform((val) => normalizeAddress(val)),
  declarationPlace: z.any().superRefine((val, ctx) => {
    const res = validateDeclarationPlace(val);
    if (!res.isValid) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: res.error });
    }
  }).transform((val) => normalizeSpaces(val)),
  declarationDate: z.any().superRefine((val, ctx) => {
    const res = validateDeclarationDate(val);
    if (!res.isValid) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: res.error });
    }
  }).transform((val) => String(val || '').trim())
}).superRefine((data, ctx) => {
  const rawMobile = data.mobile !== undefined ? data.mobile : data.phone;
  const mobileRes = validateIndianMobile(rawMobile);
  if (!mobileRes.isValid) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['mobile'], message: mobileRes.error });
  }
  const occ = String(data.occupationType || '').trim().toUpperCase();
  if (occ === 'STUDYING') {
    const instRes = validateStudyingInstitution(data.studyingInstitution);
    if (!instRes.isValid) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['studyingInstitution'], message: instRes.error });
    }
    const lvlRes = validateStudyLevel(data.studyLevel);
    if (!lvlRes.isValid) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['studyLevel'], message: lvlRes.error });
    } else if (lvlRes.normalized === 'COLLEGE') {
      const brRes = validateStudyBranchOrClass(data.branchYearSec, 'COLLEGE');
      if (!brRes.isValid) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['branchYearSec'], message: brRes.error });
      }
    } else if (lvlRes.normalized === 'SCHOOL') {
      const clsRes = validateStudyBranchOrClass(data.classSection, 'SCHOOL');
      if (!clsRes.isValid) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['classSection'], message: clsRes.error });
      }
    }
  } else if (occ === 'WORKING') {
    const workRes = validateWorkingInstitution(data.workingInstitution);
    if (!workRes.isValid) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['workingInstitution'], message: workRes.error });
    }
  }
}).passthrough();

const teamRegistrationSchema = z.object({
  teamName: z.string().min(1, 'Team name is required.').max(100),
  coachName: z.string().min(1, 'Coach name is required.').max(100),
  coachEmail: z.string().email('Valid coach email address is required.').max(100),
  coachPhone: z.string().max(25).optional(),
  coachMobile: z.string().max(25).optional(),
  phone: z.string().max(25).optional(),
  mobile: z.string().max(25).optional(),
  coachAadhaar: z.string().max(20).optional(),
  password: z.string().min(4, 'Password must be at least 4 characters.').max(100).optional(),
  city: z.string().max(100).optional(),
  taluk: z.string().max(100).optional(),
  players: z.array(z.object({
    name: z.string().min(1, 'Player name is required.').max(100),
    role: z.string().max(50).optional(),
    mobile: z.string().max(25).optional(),
    phone: z.string().max(25).optional(),
    email: z.string().max(100).optional(),
    aadhaar: z.string().max(20).optional()
  })).optional()
}).passthrough();

const umpireRegistrationSchema = z.object({
  name: z.string().min(1, 'Umpire name is required.').max(100).optional(),
  umpireName: z.string().max(100).optional(),
  email: z.string().email('Valid umpire email address is required.').max(100),
  mobile: z.string().max(25).optional(),
  phone: z.string().max(25).optional(),
  experience: z.string().min(1, 'Experience is required.').max(50).optional(),
  yearsOfExperience: z.coerce.number().optional(),
  qualification: z.string().max(100).optional(),
  certificationLevel: z.string().max(100).optional(),
  district: z.string().max(100).optional(),
  state: z.string().max(100).optional(),
  password: z.string().min(4, 'Password must be at least 4 characters.').max(100).optional()
}).refine(data => data.name || data.umpireName, {
  message: 'Umpire full name is required.'
}).passthrough();

// 4. Scoring Action Schemas
const penaltySchema = z.object({
  points: z.coerce.number().min(1).max(20).optional().default(5),
  type: z.string().max(50).optional().default('Batting Penalty'),
  reason: z.string().min(1, 'Penalty reason is required.').max(200),
  targetTeamName: z.string().max(100).optional(),
  targetTeamId: z.string().max(100).optional()
}).passthrough();

const changeBatterSchema = z.object({
  target: z.enum(['striker', 'nonStriker']).optional().default('striker'),
  newBatterId: z.string().max(100).optional(),
  newBatterName: z.string().max(100).optional()
}).refine(data => data.newBatterId || data.newBatterName, {
  message: 'Either newBatterId or newBatterName is required.'
}).passthrough();

const changeBowlerSchema = z.object({
  newBowlerId: z.string().max(100).optional(),
  newBowlerName: z.string().max(100).optional(),
  reason: z.string().max(100).optional(),
  situation: z.string().max(100).optional(),
  suspendCurrentBowler: z.boolean().optional()
}).refine(data => data.newBowlerId || data.newBowlerName, {
  message: 'Either newBowlerId or newBowlerName is required.'
}).passthrough();

const superOverSchema = z.object({
  battingTeamId: z.string().max(100).optional(),
  bowlingTeamId: z.string().max(100).optional(),
  strikerId: z.string().max(100).optional(),
  nonStrikerId: z.string().max(100).optional(),
  bowlerId: z.string().max(100).optional()
}).passthrough();

const revisedOversSchema = z.object({
  totalOvers: z.coerce.number().min(1).max(100).optional(),
  revisedTarget: z.coerce.number().min(1).max(1000).optional(),
  comments: z.string().max(200).optional()
}).passthrough();

module.exports = {
  validateBody,
  deliverySchema,
  loginSchema,
  adminLoginSchema,
  otpRequestSchema,
  otpVerifySchema,
  resetPasswordSchema,
  scorerRegistrationSchema,
  playerRegistrationSchema,
  teamRegistrationSchema,
  umpireRegistrationSchema,
  penaltySchema,
  changeBatterSchema,
  changeBowlerSchema,
  superOverSchema,
  revisedOversSchema
};
