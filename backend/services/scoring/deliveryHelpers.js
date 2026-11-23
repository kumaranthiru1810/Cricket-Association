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

module.exports = {
  broadcastScoreUpdate,
  getMaxWicketsForInnings,
  getFullPlayerMap,
  buildDismissalText,
  generateCommentary
};

