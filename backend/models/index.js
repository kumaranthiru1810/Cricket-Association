/**
 * backend/models/index.js
 * Central Models Registry & Exports
 */

const { User, UserSchema } = require('./User');
const {
  Tournament,
  TournamentSchema,
  TournamentRegistration,
  TournamentRegistrationSchema,
  TournamentCalculation,
  TournamentCalculationSchema
} = require('./Tournament');
const {
  Team,
  TeamSchema,
  TeamRegistration,
  TeamRegistrationSchema,
  TeamPlayer,
  TeamPlayerSchema
} = require('./Team');
const {
  Player,
  PlayerSchema,
  PlayerMatchRating,
  PlayerMatchRatingSchema
} = require('./Player');
const {
  Match,
  MatchSchema,
  UmpireDecision,
  UmpireDecisionSchema
} = require('./Match');
const {
  Innings,
  InningsSchema,
  InningsBatter,
  InningsBatterSchema,
  InningsBowler,
  InningsBowlerSchema,
  Delivery,
  DeliverySchema
} = require('./Innings');
const { Scorer, ScorerSchema } = require('./Scorer');
const { Notification, NotificationSchema } = require('./Notification');
const { News, NewsSchema } = require('./News');
const { Official, OfficialSchema, Venue, VenueSchema } = require('./Official');
const { AuditLog, AuditLogSchema } = require('./AuditLog');
const {
  CricketLaw,
  CricketLawSchema,
  CricketLawSection,
  CricketLawSectionSchema,
  CricketLawVersion,
  CricketLawVersionSchema,
  CricketLawAuditLog,
  CricketLawAuditLogSchema
} = require('./CricketLaw');
const { MasterSetting, MasterSettingSchema } = require('./MasterSetting');
const {
  AdminActionOtp,
  AdminActionOtpSchema,
  AdminRequest,
  AdminRequestSchema
} = require('./AdminSecurity');

const models = {
  User,
  Tournament,
  TournamentRegistration,
  TournamentCalculation,
  Team,
  Player,
  TeamRegistration,
  Match,
  Innings,
  InningsBatter,
  InningsBowler,
  Delivery,
  Scorer,
  TeamPlayer,
  Notification,
  News,
  Official,
  Venue,
  AuditLog,
  UmpireDecision,
  CricketLaw,
  CricketLawSection,
  CricketLawVersion,
  CricketLawAuditLog,
  PlayerMatchRating,
  MasterSetting,
  AdminActionOtp,
  AdminRequest
};

module.exports = {
  ...models,
  models,
  UserSchema,
  TournamentSchema,
  TournamentRegistrationSchema,
  TournamentCalculationSchema,
  TeamSchema,
  PlayerSchema,
  TeamRegistrationSchema,
  MatchSchema,
  InningsSchema,
  InningsBatterSchema,
  InningsBowlerSchema,
  DeliverySchema,
  ScorerSchema,
  TeamPlayerSchema,
  NotificationSchema,
  NewsSchema,
  OfficialSchema,
  VenueSchema,
  AuditLogSchema,
  UmpireDecisionSchema,
  CricketLawSchema,
  CricketLawSectionSchema,
  CricketLawVersionSchema,
  CricketLawAuditLogSchema,
  PlayerMatchRatingSchema,
  MasterSettingSchema,
  AdminActionOtpSchema,
  AdminRequestSchema
};
