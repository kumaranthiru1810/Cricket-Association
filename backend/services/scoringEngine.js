/**
 * services/scoringEngine.js
 * Modular Cricket Scoring Engine & Rules Service Facade
 * Pure MongoDB Implementation delegating to specialized scoring sub-services:
 * - scoring/deliveryService.js: Ball-by-ball delivery processing, strike rotation, bowler changes
 * - scoring/inningsService.js: Overs, innings transitions, declare, match completion, breaks
 * - scoring/undoEditService.js: Undo last delivery, edit delivery with full recalculation
 * - scoring/wicketService.js: Other wickets (retired hurt/out, timed out) and batter substitution
 * - scoring/extrasService.js: Penalty runs and extra calculations
 * - scoring/superOverService.js: Super over initialization and status
 * - scoring/deliveryHelpers.js: Commentary generation, dismissal text, player maps
 */

const deliveryService = require('./scoring/deliveryService');
const inningsService = require('./scoring/inningsService');
const undoEditService = require('./scoring/undoEditService');
const wicketService = require('./scoring/wicketService');
const extrasService = require('./scoring/extrasService');
const superOverService = require('./scoring/superOverService');
const deliveryHelpers = require('./scoring/deliveryHelpers');

class ScoringEngine {
  // Helper calculations
  getMaxWicketsForInnings(innings, match) {
    return deliveryHelpers.getMaxWicketsForInnings(innings, match);
  }

  async getFullPlayerMap() {
    return deliveryHelpers.getFullPlayerMap();
  }

  buildDismissalText(wicketType, bowlerName, fielderName) {
    return deliveryHelpers.buildDismissalText(wicketType, bowlerName, fielderName);
  }

  generateCommentary(strikerName, bowlerName, runsBatter, runsExtras, extraType, wicket, wicketType, fieldingPosition, fielderName, dismissedName = null) {
    return deliveryHelpers.generateCommentary(strikerName, bowlerName, runsBatter, runsExtras, extraType, wicket, wicketType, fieldingPosition, fielderName, dismissedName);
  }

  // Delivery & Ball-by-Ball
  async recordDelivery(matchId, deliveryData, scorerId) {
    return deliveryService.recordDelivery(matchId, deliveryData, scorerId);
  }

  async swapStrike(matchId) {
    return deliveryService.swapStrike(matchId);
  }

  async changeBowler(matchId, payload) {
    return deliveryService.changeBowler(matchId, payload);
  }

  async recordBallChange(matchId, ballData) {
    return deliveryService.recordBallChange(matchId, ballData);
  }

  // Innings & Match Lifecycle
  async endOver(matchId, nextBowlerId) {
    return inningsService.endOver(matchId, nextBowlerId);
  }

  async endInnings(matchId) {
    return inningsService.endInnings(matchId);
  }

  async updateMatchStatus(matchId, status) {
    return inningsService.updateMatchStatus(matchId, status);
  }

  async startNextInnings(matchId) {
    return inningsService.startNextInnings(matchId);
  }

  async endMatch(matchId, payload) {
    return inningsService.endMatch(matchId, payload);
  }

  async correctMatchResult(matchId, payload) {
    return inningsService.correctMatchResult(matchId, payload);
  }

  async setRevisedOvers(matchId, payload) {
    return inningsService.setRevisedOvers(matchId, payload);
  }

  async editPlayingXI(matchId, payload) {
    return inningsService.editPlayingXI(matchId, payload);
  }

  async addBreak(matchId, breakData) {
    return inningsService.addBreak(matchId, breakData);
  }

  async endBreak(matchId) {
    return inningsService.endBreak(matchId);
  }

  async addSession(matchId, sessionData) {
    return inningsService.addSession(matchId, sessionData);
  }

  async addEndDay(matchId, endDayData) {
    return inningsService.addEndDay(matchId, endDayData);
  }

  async declareInnings(matchId) {
    return inningsService.declareInnings(matchId);
  }

  async updateMatchTimes(matchId, timesData) {
    return inningsService.updateMatchTimes(matchId, timesData);
  }

  async saveUmpireAssessment(matchId, assessmentData) {
    return inningsService.saveUmpireAssessment(matchId, assessmentData);
  }

  async changeTeamBeforeStart(matchId, payload) {
    return inningsService.changeTeamBeforeStart(matchId, payload);
  }

  // Undo & Edit Delivery
  async undoLastDelivery(matchId) {
    return undoEditService.undoLastDelivery(matchId);
  }

  async editDelivery(matchId, deliveryId, updateData, scorerId) {
    return undoEditService.editDelivery(matchId, deliveryId, updateData, scorerId);
  }

  // Wickets & Batter
  async recordOtherWicket(matchId, payload) {
    return wicketService.recordOtherWicket(matchId, payload);
  }

  async changeBatter(matchId, payload) {
    return wicketService.changeBatter(matchId, payload);
  }

  // Penalty & Extras
  async addPenalty(matchId, penaltyData) {
    return extrasService.addPenalty(matchId, penaltyData);
  }

  // Super Over
  async startSuperOver(matchId, payload) {
    return superOverService.startSuperOver(matchId, payload);
  }
}

module.exports = new ScoringEngine();
