/**
 * services/scoring/deliveryHelpers.js
 * Commentary generation, dismissal text, player maps, and max wicket calculations.
 */

const db = require('../../config/db');
const socketService = require('../socketService');

const broadcastScoreUpdate = (matchId, payload) => socketService.broadcastScoreUpdate(matchId, payload);

function getMaxWicketsForInnings(innings, match) {
  if (!match) return 10;
  const isTeamA = innings?.batting_team_id === match.team_a_id;
  const lineup = isTeamA ? (match.team_a_playing_xi || match.team_a_lineup) : (match.team_b_playing_xi || match.team_b_lineup);
  if (Array.isArray(lineup) && lineup.length > 1) {
    return Math.max(1, lineup.length - 1);
  }
  if (match.players_per_side && match.players_per_side > 1) {
    return Math.max(1, match.players_per_side - 1);
  }
  return 10;
}

async function getFullPlayerMap() {
  await db.initDb();
  const [players, teamRegs] = await Promise.all([
    db.models.Player.find({}).lean(),
    db.models.TeamRegistration.find({}).lean()
  ]);
  const playerMap = {};
  (players || []).forEach(p => { playerMap[p.id] = p; });
  (teamRegs || []).forEach(tr => {
    (tr.players || []).forEach((p, idx) => {
      const pId = p.id || (p._id ? p._id.toString() : `${tr.id}-P${idx + 1}`);
      if (!playerMap[pId]) {
        playerMap[pId] = {
          id: pId,
          name: p.name,
          role: p.role || 'BATTER',
          jersey_number: p.jersey_number || (idx + 1),
          team_id: tr.id
        };
      }
    });
  });
  return playerMap;
}

function buildDismissalText(wicketType, bowlerName, fielderName) {
  switch (wicketType) {
    case 'BOWLED':
      return `b ${bowlerName}`;
    case 'CAUGHT':
      return fielderName ? `c ${fielderName} b ${bowlerName}` : `c & b ${bowlerName}`;
    case 'CAUGHT_BEHIND':
      return fielderName ? `c †${fielderName} b ${bowlerName}` : `c †Keeper b ${bowlerName}`;
    case 'CAUGHT_AND_BOWLED':
      return `c & b ${bowlerName}`;
    case 'LBW':
      return `lbw b ${bowlerName}`;
    case 'RUN_OUT':
      return fielderName ? `run out (${fielderName})` : 'run out';
    case 'STUMPED':
      return fielderName ? `st †${fielderName} b ${bowlerName}` : `st †Keeper b ${bowlerName}`;
    case 'HIT_WICKET':
      return `hit wicket b ${bowlerName}`;
    case 'RETIRED_OUT':
      return 'retired out';
    default:
      return wicketType ? wicketType.toLowerCase() : 'out';
  }
}

function generateCommentary(strikerName, bowlerName, runsBatter, runsExtras, extraType, wicket, wicketType, fieldingPosition, fielderName, dismissedName = null) {
  const posText = fieldingPosition ? ` towards ${fieldingPosition}` : '';
  const fielderText = fielderName ? ` (${fielderName})` : '';
  const victim = dismissedName || strikerName;

  if (wicket) {
    switch (wicketType) {
      case 'BOWLED': return `OUT! Clean bowled! ${bowlerName} rattles the timber! ${victim} has to walk.`;
      case 'CAUGHT': return `OUT! Caught! ${victim} slices it in the air${posText} and taken cleanly by ${fielderName || 'the fielder'}! Breakthrough for ${bowlerName}!`;
      case 'CAUGHT_BEHIND': return `OUT! Edged and taken! Wicketkeeper ${fielderName || 'behind the stumps'} takes a clean catch! ${victim} departs off ${bowlerName}!`;
      case 'CAUGHT_AND_BOWLED': return `OUT! Caught & Bowled! Sensational reflex return catch by ${bowlerName}! ${victim} is out!`;
      case 'LBW': return `OUT! Plumb in front! Huge appeal and the umpire raises the finger. LBW given! ${victim} departs.`;
      case 'RUN_OUT': return `OUT! RUN OUT! Direct hit${posText}${fielderText}! ${victim} is caught well short of the crease!`;
      case 'STUMPED': return `OUT! Stumped! ${victim} dances down the track, beaten in the flight by ${bowlerName}, keeper whips off the bails!`;
      case 'HIT_WICKET': return `OUT! Hit wicket! ${victim} accidentally dislodges the bails while playing the stroke!`;
      case 'RETIRED_OUT': return `${victim} has retired out and returns to the pavilion.`;
      default: return `OUT! ${victim} dismissed (${wicketType || 'Wicket'}).`;
    }
  }

  if (extraType === 'WIDE') {
    const extraRuns = runsExtras > 1 ? ` plus ${runsExtras - 1} extra runs` : '';
    return `Wide ball signaled by the umpire. 1 extra run${extraRuns}.`;
  }
  if (extraType === 'NO_BALL') {
    const batText = runsBatter > 0 ? ` and ${strikerName} scores ${runsBatter} runs` : '';
    return `No ball! Bowler oversteps. 1 extra${batText}. Free hit coming up.`;
  }
  if (extraType === 'BYE') {
    return `${runsExtras} bye${runsExtras > 1 ? 's' : ''} signaled as the ball beats batter and wicketkeeper.`;
  }
  if (extraType === 'LEG_BYE') {
    return `${runsExtras} leg bye${runsExtras > 1 ? 's' : ''} taken after deflecting off the pads${posText}.`;
  }

  if (runsBatter === 6) {
    return `SIX! Magnificent stroke by ${strikerName}! Clean connection over the boundary${posText}!`;
  }
  if (runsBatter === 4) {
    return `FOUR! Beautifully timed drive by ${strikerName}! Pierces the infield${posText} and races away to the fence!`;
  }
  if (runsBatter === 3) {
    return `3 runs. Excellent placement${posText} and great running between the wickets.`;
  }
  if (runsBatter === 2) {
    return `2 runs. Worked into the gap${posText}, easy double taken.`;
  }
  if (runsBatter === 1) {
    return `1 run. ${strikerName} rotates the strike with a push${posText}.`;
  }
  return `Dot ball. Good bowling by ${bowlerName}, solid defense${posText}.`;
}

function toDecimalOvers(oversVal, ballsVal = 0, isAllOut = false, maxOvers = 20) {
  if (isAllOut && maxOvers > 0) return maxOvers;
  const o = typeof oversVal === 'number' ? oversVal : parseFloat(oversVal || 0);
  const b = typeof ballsVal === 'number' ? ballsVal : parseFloat(ballsVal || 0);
  const wholeOvers = Math.floor(o);
  const remainderBalls = Math.round((o - wholeOvers) * 10) || b;
  return wholeOvers + (remainderBalls / 6);
}

/**
 * Auto-calculate winner bonus point:
 * Winning team's run rate >= 1.25 * losing team's run rate.
 */
function computeAutoBonusWinner(match, inn1, inn2, winnerId) {
  if (!match || !inn1 || !inn2 || !winnerId || match.is_walkover) return false;
  if (winnerId !== match.team_a_id && winnerId !== match.team_b_id) return false;

  const standardMaxOvers = match.overs_per_side || 20;
  const isDlsOrRevised = Boolean(match.revised_target || match.revised_overs || inn2?.revised_overs);
  const revisedOvers = match.revised_overs || inn2?.revised_overs || null;
  const revisedTarget = match.revised_target || inn2?.target || null;

  const maxW1 = getMaxWicketsForInnings(inn1, match);
  const allOut1 = (inn1.wickets || 0) >= maxW1;
  const runs1 = (isDlsOrRevised && revisedOvers && revisedTarget)
    ? Math.max(0, revisedTarget - 1)
    : (inn1.total_runs || 0);
  const overs1 = (isDlsOrRevised && revisedOvers)
    ? revisedOvers
    : toDecimalOvers(inn1.overs, inn1.balls, allOut1, standardMaxOvers);

  const maxW2 = getMaxWicketsForInnings(inn2, match);
  const allOut2 = (inn2.wickets || 0) >= maxW2;
  const runs2 = inn2.total_runs || 0;
  const maxO2 = (isDlsOrRevised && revisedOvers) ? revisedOvers : standardMaxOvers;
  const overs2 = toDecimalOvers(inn2.overs, inn2.balls, allOut2, maxO2);

  const rr1 = overs1 > 0 ? runs1 / overs1 : 0;
  const rr2 = overs2 > 0 ? runs2 / overs2 : 0;

  let winnerRR = 0;
  let loserRR = 0;
  if (winnerId === inn1.batting_team_id) {
    winnerRR = rr1;
    loserRR = rr2;
  } else if (winnerId === inn2.batting_team_id) {
    winnerRR = rr2;
    loserRR = rr1;
  } else {
    return false;
  }

  if (winnerRR <= 0) return false;
  if (loserRR <= 0) return true;
  return winnerRR >= (loserRR * 1.25) - 1e-9;
}

module.exports = {
  broadcastScoreUpdate,
  getMaxWicketsForInnings,
  toDecimalOvers,
  computeAutoBonusWinner,
  getFullPlayerMap,
  buildDismissalText,
  generateCommentary
};

