/**
 * services/historyService.js
 * Complete Team & Player Career History, Season/Tournament Breakdown,
 * Awards, Rankings & Comparison Service.
 */

const db = require('../config/db');

class HistoryService {
  /**
   * Complete Team History: profile, tournament participation, W/L/T,
   * championships & runner-up records, season-wise performance, rankings, and historical players.
   */
  async getTeamHistory(teamIdOrName) {
    await db.initDb();
    const cleanTarget = String(teamIdOrName || '').trim();
    if (!cleanTarget) throw { status: 400, message: 'Team ID is required.' };

    const team = await db.models.Team.findOne({
      $or: [
        { id: cleanTarget },
        { team_id: cleanTarget },
        { name: new RegExp(`^${cleanTarget.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
      ]
    }).lean();

    if (!team) {
      throw { status: 404, message: `Team '${cleanTarget}' not found.` };
    }

    const candidateIds = [...new Set([team.id, team.team_id, team._id?.toString()].filter(Boolean))];

    const [matches, tournaments, players, allTeams] = await Promise.all([
      db.models.Match.find({
        $or: [
          { team_a_id: { $in: candidateIds } },
          { team_b_id: { $in: candidateIds } }
        ]
      }).sort({ match_date: -1 }).lean(),
      db.models.Tournament.find({
        $or: [
          { teams: { $in: candidateIds } },
          { champion_team_id: { $in: candidateIds } },
          { runner_up_team_id: { $in: candidateIds } }
        ]
      }).lean(),
      db.models.Player.find({ team_id: { $in: candidateIds } }).lean(),
      db.models.Team.find({}).select('id team_id name stats trophies_count').lean()
    ]);

    const tourById = {};
    tournaments.forEach(t => { tourById[t.id] = t; });

    let played = 0, won = 0, lost = 0, tied = 0, noResult = 0;
    const tourStatsMap = {};
    const seasonStatsMap = {};

    matches.forEach(m => {
      if (m.status !== 'COMPLETED') return;
      played++;
      const res = (m.result_summary || '').toLowerCase();
      const isNR = res.includes('no result') || res.includes('abandoned');
      const isTie = res.includes('tied') && !m.winner_id;
      const isWin = candidateIds.includes(m.winner_id);

      if (isNR) noResult++;
      else if (isTie) tied++;
      else if (isWin) won++;
      else lost++;

      const tid = m.tournament_id || 'STANDALONE';
      const tour = tourById[tid];
      if (!tourStatsMap[tid]) {
        tourStatsMap[tid] = {
          tournament_id: tid,
          tournament_name: m.tournament_name || tour?.name || tid,
          season: tour?.season || (m.match_date ? m.match_date.slice(0, 4) : '2026'),
          tournament_type: tour?.tournament_type || 'LEAGUE',
          played: 0,
          won: 0,
          lost: 0,
          tied: 0,
          no_result: 0,
          outcome: candidateIds.includes(tour?.champion_team_id)
            ? 'CHAMPION'
            : (candidateIds.includes(tour?.runner_up_team_id) ? 'RUNNER_UP' : (tour?.status || 'PARTICIPATED'))
        };
      }
      tourStatsMap[tid].played++;
      if (isNR) tourStatsMap[tid].no_result++;
      else if (isTie) tourStatsMap[tid].tied++;
      else if (isWin) tourStatsMap[tid].won++;
      else tourStatsMap[tid].lost++;

      const season = tourStatsMap[tid].season;
      if (!seasonStatsMap[season]) {
        seasonStatsMap[season] = { season, played: 0, won: 0, lost: 0, tied: 0, no_result: 0, titles: 0 };
      }
      seasonStatsMap[season].played++;
      if (isNR) seasonStatsMap[season].no_result++;
      else if (isTie) seasonStatsMap[season].tied++;
      else if (isWin) seasonStatsMap[season].won++;
      else seasonStatsMap[season].lost++;
    });

    // Championships & trophies (combine stored + tournament champion fields)
    const champMap = new Map();
    (team.championships || []).forEach(c => {
      champMap.set(c.tournament_id, c);
    });
    tournaments.forEach(t => {
      if (candidateIds.includes(t.champion_team_id)) {
        champMap.set(t.id, {
          tournament_id: t.id,
          tournament_name: t.name,
          season: t.season || '2026',
          position: 'CHAMPION',
          awarded_at: t.completed_at || t.updatedAt
        });
        if (seasonStatsMap[t.season || '2026']) {
          seasonStatsMap[t.season || '2026'].titles++;
        }
      } else if (candidateIds.includes(t.runner_up_team_id) && !champMap.has(t.id)) {
        champMap.set(t.id, {
          tournament_id: t.id,
          tournament_name: t.name,
          season: t.season || '2026',
          position: 'RUNNER_UP',
          awarded_at: t.completed_at || t.updatedAt
        });
      }
    });
    const championships = Array.from(champMap.values());
    const titlesWon = championships.filter(c => c.position === 'CHAMPION').length;

    // Team rankings among all registered teams
    const rankedTeams = [...allTeams].sort((a, b) => {
      const ptsA = a.stats?.points ?? ((a.stats?.won || 0) * 2);
      const ptsB = b.stats?.points ?? ((b.stats?.won || 0) * 2);
      if (ptsB !== ptsA) return ptsB - ptsA;
      return (b.trophies_count || 0) - (a.trophies_count || 0);
    });
    const rankIndex = rankedTeams.findIndex(t => candidateIds.includes(t.id));

    return {
      success: true,
      team: {
        id: team.id,
        name: team.name,
        short_name: team.short_name,
        city: team.city || team.taluk,
        coach_name: team.coach_name,
        captain: team.captain,
        status: team.status,
        logo: team.logo || team.photo
      },
      summary: {
        matches_played: played,
        won,
        lost,
        tied,
        no_result: noResult,
        win_percentage: played > 0 ? parseFloat(((won / played) * 100).toFixed(1)) : 0,
        titles_won: titlesWon,
        runner_ups: championships.filter(c => c.position === 'RUNNER_UP').length,
        ranking: rankIndex >= 0 ? rankIndex + 1 : null,
        total_teams: rankedTeams.length
      },
      championships,
      tournament_history: Object.values(tourStatsMap),
      season_performance: Object.values(seasonStatsMap).sort((a, b) => b.season.localeCompare(a.season)),
      players: players.map(p => ({
        id: p.id,
        name: p.name,
        role: p.role,
        jersey_number: p.jersey_number,
        status: p.status,
        runs: p.stats?.runs || 0,
        wickets: p.stats?.wickets || 0
      })),
      recent_matches: matches.slice(0, 15)
    };
  }

  /**
   * Complete Player Career History: batting, bowling, fielding,
   * tournament-wise, season-wise, match-by-match, POTM awards.
   */
  async getPlayerHistory(playerId) {
    await db.initDb();
    const player = await db.models.Player.findOne({ id: playerId }).lean();
    if (!player) throw { status: 404, message: `Player '${playerId}' not found.` };

    const [batRecords, bowlRecords, potmMatches, ratings] = await Promise.all([
      db.models.InningsBatter.find({ player_id: player.id }).lean(),
      db.models.InningsBowler.find({ player_id: player.id }).lean(),
      db.models.Match.find({ player_of_match: player.id }).select('id tournament_id tournament_name match_date').lean(),
      db.models.PlayerMatchRating.find({ player_id: player.id }).sort({ match_date: -1 }).lean()
    ]);

    const inningsIds = [...new Set([...batRecords.map(b => b.innings_id), ...bowlRecords.map(b => b.innings_id)])];
    const inningsList = inningsIds.length > 0
      ? await db.models.Innings.find({ id: { $in: inningsIds } }).lean()
      : [];
    const innById = {};
    inningsList.forEach(i => { innById[i.id] = i; });

    const matchIds = [...new Set([
      ...inningsList.map(i => i.match_id),
      ...batRecords.map(b => b.match_id).filter(Boolean),
      ...bowlRecords.map(b => b.match_id).filter(Boolean)
    ])];
    const matches = matchIds.length > 0
      ? await db.models.Match.find({ id: { $in: matchIds } }).sort({ match_date: -1 }).lean()
      : [];
    const matchById = {};
    matches.forEach(m => { matchById[m.id] = m; });

    const tourIds = [...new Set(matches.map(m => m.tournament_id).filter(Boolean))];
    const tournaments = tourIds.length > 0
      ? await db.models.Tournament.find({ id: { $in: tourIds } }).lean()
      : [];
    const tourById = {};
    tournaments.forEach(t => { tourById[t.id] = t; });

    // Aggregate career stats purely from innings records (no double-counting with base Player.stats)
    let runs = 0, balls = 0, fours = 0, sixes = 0, highest = 0, outs = 0, fifties = 0, hundreds = 0;
    const tourPerf = {};
    const seasonPerf = {};
    const matchHistoryMap = {};

    const ensureTour = (tid, m) => {
      const tour = tourById[tid];
      const season = tour?.season || (m?.match_date ? m.match_date.slice(0, 4) : '2026');
      if (!tourPerf[tid]) {
        tourPerf[tid] = {
          tournament_id: tid,
          tournament_name: m?.tournament_name || tour?.name || tid,
          season,
          matches: new Set(),
          runs: 0,
          balls: 0,
          wickets: 0,
          runs_conceded: 0,
          highest_score: 0
        };
      }
      if (!seasonPerf[season]) {
        seasonPerf[season] = { season, matches: new Set(), runs: 0, balls: 0, wickets: 0, runs_conceded: 0 };
      }
      return { tp: tourPerf[tid], sp: seasonPerf[season] };
    };

    batRecords.forEach(b => {
      const inn = innById[b.innings_id];
      const mid = b.match_id || inn?.match_id;
      const m = mid ? matchById[mid] : null;
      const r = b.runs || 0;
      const bl = b.balls || 0;

      runs += r;
      balls += bl;
      fours += (b.fours || 0);
      sixes += (b.sixes || 0);
      if (r > highest) highest = r;
      if (b.is_out) outs++;
      if (r >= 100) hundreds++;
      else if (r >= 50) fifties++;

      if (m) {
        const tid = m.tournament_id || 'STANDALONE';
        const { tp, sp } = ensureTour(tid, m);
        tp.matches.add(m.id);
        tp.runs += r;
        tp.balls += bl;
        if (r > tp.highest_score) tp.highest_score = r;
        sp.matches.add(m.id);
        sp.runs += r;
        sp.balls += bl;

        if (!matchHistoryMap[m.id]) {
          matchHistoryMap[m.id] = {
            match_id: m.id,
            match_date: m.match_date,
            tournament_name: m.tournament_name,
            team_a_name: m.team_a_name,
            team_b_name: m.team_b_name,
            result_summary: m.result_summary,
            batting: null,
            bowling: null,
            is_potm: m.player_of_match === player.id
          };
        }
        matchHistoryMap[m.id].batting = { runs: r, balls: bl, fours: b.fours || 0, sixes: b.sixes || 0, is_out: Boolean(b.is_out) };
      }
    });

    let wickets = 0, runsConceded = 0, ballsBowled = 0, maidens = 0;
    let bestW = 0, bestR = 999;

    bowlRecords.forEach(bw => {
      const inn = innById[bw.innings_id];
      const mid = bw.match_id || inn?.match_id;
      const m = mid ? matchById[mid] : null;
      const w = bw.wickets || 0;
      const rc = bw.runs_conceded || 0;
      const bCount = (bw.overs || 0) * 6 + (bw.balls || 0);

      wickets += w;
      runsConceded += rc;
      ballsBowled += bCount;
      maidens += (bw.maidens || 0);
      if (w > bestW || (w === bestW && rc < bestR)) {
        bestW = w;
        bestR = rc;
      }

      if (m) {
        const tid = m.tournament_id || 'STANDALONE';
        const { tp, sp } = ensureTour(tid, m);
        tp.matches.add(m.id);
        tp.wickets += w;
        tp.runs_conceded += rc;
        sp.matches.add(m.id);
        sp.wickets += w;
        sp.runs_conceded += rc;

        if (!matchHistoryMap[m.id]) {
          matchHistoryMap[m.id] = {
            match_id: m.id,
            match_date: m.match_date,
            tournament_name: m.tournament_name,
            team_a_name: m.team_a_name,
            team_b_name: m.team_b_name,
            result_summary: m.result_summary,
            batting: null,
            bowling: null,
            is_potm: m.player_of_match === player.id
          };
        }
        matchHistoryMap[m.id].bowling = {
          overs: `${bw.overs || 0}.${bw.balls || 0}`,
          wickets: w,
          runs_conceded: rc,
          maidens: bw.maidens || 0
        };
      }
    });

    const oversDecimal = ballsBowled / 6;
    const battingAvg = outs > 0 ? parseFloat((runs / outs).toFixed(2)) : runs;
    const strikeRate = balls > 0 ? parseFloat(((runs / balls) * 100).toFixed(2)) : 0;
    const economy = oversDecimal > 0 ? parseFloat((runsConceded / oversDecimal).toFixed(2)) : 0;

    return {
      success: true,
      player: {
        id: player.id,
        name: player.name,
        team_id: player.team_id,
        role: player.role,
        jersey_number: player.jersey_number,
        batting_style: player.batting_style,
        bowling_style: player.bowling_style,
        photo: player.photo || player.image_path,
        status: player.status
      },
      career: {
        matches: matches.length,
        innings_batted: batRecords.length,
        runs,
        balls,
        fours,
        sixes,
        highest_score: highest,
        fifties,
        hundreds,
        batting_average: battingAvg,
        strike_rate: strikeRate,
        wickets,
        overs_bowled: `${Math.floor(ballsBowled / 6)}.${ballsBowled % 6}`,
        runs_conceded: runsConceded,
        maidens,
        economy_rate: economy,
        best_bowling: bestW > 0 || bestR < 999 ? `${bestW}/${bestR === 999 ? 0 : bestR}` : '0/0',
        catches: player.stats?.catches || 0,
        stumpings: player.stats?.stumpings || 0,
        potm_awards: potmMatches.length
      },
      potm_matches: potmMatches,
      tournament_wise: Object.values(tourPerf).map(t => ({ ...t, matches: t.matches.size })),
      season_wise: Object.values(seasonPerf).map(s => ({ ...s, matches: s.matches.size })).sort((a, b) => b.season.localeCompare(a.season)),
      match_history: Object.values(matchHistoryMap),
      ratings: ratings.slice(0, 10)
    };
  }

  async comparePlayers(playerId1, playerId2) {
    const [p1, p2] = await Promise.all([
      this.getPlayerHistory(playerId1),
      this.getPlayerHistory(playerId2)
    ]);
    return {
      success: true,
      player_1: { player: p1.player, career: p1.career },
      player_2: { player: p2.player, career: p2.career }
    };
  }
}

module.exports = new HistoryService();
