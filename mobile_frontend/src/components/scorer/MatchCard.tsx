import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, Linking, useWindowDimensions } from 'react-native';
import { useScorerNavigation } from '../../navigation/ScorerNavigationContext';

export interface MatchData {
  id: string;
  tournament?: string;
  tournament_name?: string;
  teamA: string;
  teamB: string;
  teamAShort?: string;
  teamBShort?: string;
  date?: string;
  match_date?: string;
  match_time?: string;
  venue?: string;
  venue_maps_url?: string;
  format?: string;
  overs?: number;
  overs_per_side?: number;
  revised_overs?: number;
  revisedOvers?: number;
  revised_target?: number;
  revisedTarget?: number;
  revised_comments?: string;
  revisedComments?: string;
  target?: number;
  stage?: string;
  status: 'Upcoming' | 'Live' | 'Completed' | string;
  scoreA?: string;
  scoreB?: string;
  result?: string;
  umpire1_id?: string;
  umpire2_id?: string;
  umpire1_name?: string;
  umpire2_name?: string;
  umpire1?: string;
  umpire2?: string;
  assigned_scorer_id?: string;
  assigned_scorer?: string;
  scorer_name?: string;
  scorer?: string;
}

export function formatScoreWithTotalOvers(scoreStr?: string, maxOvers?: number): string {
  if (!scoreStr || scoreStr === 'Yet to Bat' || scoreStr === 'Upcoming' || scoreStr === 'Yet to bat') {
    return scoreStr || 'Yet to Bat';
  }
  if (!maxOvers) return scoreStr;

  // Don't format if the overs in parentheses already contains total overs e.g. "(12.1/20 Ov)"
  if (/\([^)]*\/\s*\d+[^)]*\)/i.test(scoreStr)) return scoreStr;

  return scoreStr.replace(/\((\d+(\.\d+)?)\s*(Ov|ov|Overs)?\)/i, (_match, ov) => {
    return `(${ov}/${maxOvers} Ov)`;
  });
}

interface Props {
  match: MatchData;
  variant?: 'live' | 'upcoming' | 'completed';
}

export interface ScheduleTimeline {
  isOverdue: boolean;
  daysDiff: number;
  hoursDiff: number;
  badgeText: string;
  badgeType: 'overdue' | 'today' | 'upcoming';
  bannerText: string;
  formattedDate: string;
}

export function getScheduleTimeline(dateStr?: string, timeStr?: string): ScheduleTimeline {
  if (!dateStr) {
    return {
      isOverdue: false,
      daysDiff: 0,
      hoursDiff: 0,
      badgeText: 'UPCOMING',
      badgeType: 'upcoming',
      bannerText: '',
      formattedDate: 'Date TBD'
    };
  }

  try {
    const rawDatePart = dateStr.trim().split(' ')[0];
    let year = 2026, month = 9, day = 30; // 0-indexed month
    if (rawDatePart.includes('-')) {
      const parts = rawDatePart.split('-');
      year = parseInt(parts[0], 10) || 2026;
      month = (parseInt(parts[1], 10) || 10) - 1;
      day = parseInt(parts[2], 10) || 1;
    } else if (rawDatePart.includes('/')) {
      const parts = rawDatePart.split('/');
      day = parseInt(parts[0], 10) || 1;
      month = (parseInt(parts[1], 10) || 10) - 1;
      year = parseInt(parts[2], 10) || 2026;
    }

    let hours = 9, minutes = 30;
    const timeCandidates = [
      timeStr,
      dateStr.includes(' ') ? dateStr.substring(dateStr.indexOf(' ') + 1) : null
    ].filter(Boolean) as string[];

    const effectiveTime = timeCandidates[0] || '09:30 AM';
    const cleanTime = effectiveTime.trim().toUpperCase().replace('.', ':');
    const isPM = cleanTime.includes('PM');
    const isAM = cleanTime.includes('AM');
    const timeDigits = cleanTime.replace(/[APM\s]/g, '');
    const [h, m] = timeDigits.split(':');
    hours = parseInt(h, 10) || 0;
    minutes = parseInt(m, 10) || 0;
    if (isPM && hours < 12) hours += 12;
    if (isAM && hours === 12) hours = 0;

    const scheduledDate = new Date(year, month, day, hours, minutes);
    const now = new Date();

    const diffMs = now.getTime() - scheduledDate.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const formattedDate = `${day} ${monthNames[month] || 'Oct'} ${year} • ${effectiveTime}`;

    if (diffMs > 0) {
      if (diffDays >= 1) {
        return {
          isOverdue: true,
          daysDiff: diffDays,
          hoursDiff: diffHours,
          badgeText: `⚠️ ${diffDays} DAY${diffDays > 1 ? 'S' : ''} OVERDUE`,
          badgeType: 'overdue',
          bannerText: `Match was scheduled ${diffDays} day${diffDays > 1 ? 's' : ''} ago (${formattedDate}). Please commence match setup or record reschedule notes.`,
          formattedDate
        };
      } else {
        const lateHrs = Math.max(1, diffHours);
        return {
          isOverdue: true,
          daysDiff: 0,
          hoursDiff: lateHrs,
          badgeText: `⚠️ ${lateHrs}H DELAYED TODAY`,
          badgeType: 'overdue',
          bannerText: `Match is running ${lateHrs} hour${lateHrs > 1 ? 's' : ''} past scheduled start time (${effectiveTime}).`,
          formattedDate
        };
      }
    } else {
      const absDays = Math.abs(diffDays);
      if (absDays === 0) {
        return {
          isOverdue: false,
          daysDiff: 0,
          hoursDiff: Math.abs(diffHours),
          badgeText: '🔴 SCHEDULED TODAY',
          badgeType: 'today',
          bannerText: `Match is scheduled for today at ${effectiveTime}. Prepare playing XIs.`,
          formattedDate
        };
      } else {
        return {
          isOverdue: false,
          daysDiff: absDays,
          hoursDiff: Math.abs(diffHours),
          badgeText: `⏳ IN ${absDays} DAY${absDays > 1 ? 'S' : ''}`,
          badgeType: 'upcoming',
          bannerText: `Scheduled fixture in ${absDays} day${absDays > 1 ? 's' : ''}.`,
          formattedDate
        };
      }
    }
  } catch (_e) {
    return {
      isOverdue: false,
      daysDiff: 0,
      hoursDiff: 0,
      badgeText: 'UPCOMING',
      badgeType: 'upcoming',
      bannerText: '',
      formattedDate: dateStr || 'Date TBD'
    };
  }
}

function getTeamInitial(name: string, shortName?: string): string {
  if (shortName && shortName.length <= 4) return shortName.toUpperCase();
  if (!name) return 'TM';
  const words = name.trim().split(/\s+/);
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  return name.substring(0, Math.min(3, name.length)).toUpperCase();
}

export default function MatchCard({ match, variant = 'upcoming' }: Props) {
  const { navigate } = useScorerNavigation();
  const { width } = useWindowDimensions();
  const isMobile = width < 640;
  const styles = getStyles(isMobile);

  const handleAction = () => {
    if (match.status === 'Upcoming' || variant === 'upcoming') {
      navigate('MatchSetup', { matchId: match.id });
    } else if (match.status === 'Live' || variant === 'live') {
      navigate('LiveScoring', { matchId: match.id });
    } else {
      navigate('Scorecard', { matchId: match.id, returnTo: 'Dashboard', status: match.status });
    }
  };

  const isLive = variant === 'live' || match.status === 'Live';
  const isCompleted = variant === 'completed' || match.status === 'Completed';

  // Match officials resolution
  const umpire1 = match.umpire1_name || match.umpire1 || 'Thiru. K. Sundaram';
  const umpire2 = match.umpire2_name || match.umpire2 || 'Thiru. M. Ramanathan';
  const umpire1Id = match.umpire1_id || 'UMP-101';
  const umpire2Id = match.umpire2_id || 'UMP-102';

  const scorerName = match.assigned_scorer || match.scorer_name || (
    match.assigned_scorer_id === 'OFF-02' ? 'K. Murugan' :
    match.assigned_scorer_id === 'OFF-01' ? 'S. Ramesh' :
    match.assigned_scorer_id === 'SCR-104' ? 'Athi Lingam' : 'Athi Lingam'
  );
  const scorerId = match.assigned_scorer_id || 'SCR-101';

  const timeline = getScheduleTimeline(match.date || match.match_date, match.match_time);
  const teamAInit = getTeamInitial(match.teamA, match.teamAShort);
  const teamBInit = getTeamInitial(match.teamB, match.teamBShort);

  // ══════════════════════════════════════════════════════════════════════════
  // LIVE VARIANT (WITH ONGOING DAYS TRACKER & TOTAL OVERS DISPLAY)
  // ══════════════════════════════════════════════════════════════════════════
  if (isLive) {
    const totalMatchOvers = match.revisedOvers || match.revised_overs || match.overs || match.overs_per_side || 20;
    const isRevisedOvers = Boolean(
      (match.revisedOvers && match.revisedOvers !== (match.overs || match.overs_per_side || 20)) ||
      (match.revised_overs && match.revised_overs !== (match.overs || match.overs_per_side || 20))
    );
    const revisedTargetRuns = match.revisedTarget || match.revised_target || match.target;
    const interruptionReason = match.revisedComments || match.revised_comments;

    return (
      <View style={[styles.card, styles.liveCard]}>
        <View style={styles.liveHeader}>
          <Text style={styles.tournamentText} numberOfLines={1}>
            🏆 {match.tournament || match.tournament_name || 'Association Match'}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end', flexShrink: 0 }}>
            {timeline.daysDiff > 0 ? (
              <View style={styles.liveDurationBadge}>
                <Text style={styles.liveDurationText}>⏳ {timeline.daysDiff} DAYS ONGOING</Text>
              </View>
            ) : (
              <View style={[styles.liveDurationBadge, { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' }]}>
                <Text style={[styles.liveDurationText, { color: '#166534' }]}>🟢 DAY 1 (TODAY)</Text>
              </View>
            )}
            <View style={styles.liveIndicatorRow}>
              <View style={styles.redDot} />
              <Text style={styles.liveBadgeText}>LIVE NOW</Text>
            </View>
          </View>
        </View>
        
        <View style={styles.liveTeamsRow}>
          <View style={styles.teamCol}>
            <Text style={styles.liveTeamName} numberOfLines={1}>{match.teamA}</Text>
            <Text style={styles.liveScore}>{formatScoreWithTotalOvers(match.scoreA, totalMatchOvers)}</Text>
          </View>
          <View style={styles.vsCol}>
            <Text style={styles.liveVs}>VS</Text>
            <View style={[styles.liveOversBadge, isRevisedOvers && styles.liveOversBadgeRevised]}>
              <Text style={[styles.liveOversBadgeText, isRevisedOvers && styles.liveOversBadgeTextRevised]}>
                {isRevisedOvers ? `${totalMatchOvers} Ov (Rev)` : `${totalMatchOvers} Ov`}
              </Text>
            </View>
          </View>
          <View style={styles.teamColRight}>
            <Text style={styles.liveTeamNameRight} numberOfLines={1}>{match.teamB}</Text>
            <Text style={[styles.liveScoreRight, { fontSize: match.scoreB ? (isMobile ? 15 : 20) : (isMobile ? 12 : 14), color: match.scoreB ? '#1e293b' : '#64748b' }]}>
              {formatScoreWithTotalOvers(match.scoreB, totalMatchOvers)}
            </Text>
          </View>
        </View>

        {(isRevisedOvers || Boolean(revisedTargetRuns)) && (
          <View style={styles.liveRevisedBanner}>
            <Text style={styles.liveRevisedBannerText}>
              🌧️ REVISED: {totalMatchOvers} OVERS {revisedTargetRuns ? `• TARGET: ${revisedTargetRuns} RUNS` : ''} {interruptionReason ? `(${interruptionReason})` : ''}
            </Text>
          </View>
        )}

        <View style={styles.metaRow}>
          <TouchableOpacity
            activeOpacity={0.7}
            style={{ flex: 1, minWidth: 0 }}
            onPress={() => {
              const v = match.venue || 'Virudhunagar Cricket Ground';
              const url = match.venue_maps_url || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(v + (v.toLowerCase().includes('virudhunagar') || v.toLowerCase().includes('sivakasi') ? '' : ', Virudhunagar'))}`;
              if (Platform.OS === 'web' && typeof window !== 'undefined') window.open(url, '_blank');
              else Linking.openURL(url).catch(() => {});
            }}
          >
            <Text style={styles.metaText}>
              📍 <Text style={{ textDecorationLine: 'underline', color: '#0284c7' }}>{match.venue || 'Virudhunagar Cricket Ground'} ↗</Text> • 🏏 {match.format || 'T20'} ({isRevisedOvers ? `Curtailed to ${totalMatchOvers} Overs` : `${totalMatchOvers} Overs Match`}) {timeline.formattedDate ? `• 📅 Started ${timeline.formattedDate}` : ''}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Live Match Officials Strip */}
        <View style={styles.compactOfficialsStrip}>
          <Text style={styles.compactOfficialsText}>
            👔 <Text style={{ fontWeight: '700' }}>Umpires:</Text> {umpire1} & {umpire2} • 📝 <Text style={{ fontWeight: '700' }}>Scorer:</Text> {scorerName} ({scorerId})
          </Text>
        </View>

        <TouchableOpacity style={styles.primaryBtn} onPress={handleAction} activeOpacity={0.85}>
          <Text style={styles.primaryBtnText}>CONTINUE LIVE SCORING ▶</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // COMPLETED VARIANT (CLEAN, MODERN, DECLUTTERED)
  // ══════════════════════════════════════════════════════════════════════════
  if (isCompleted) {
    const totalMatchOvers = match.revisedOvers || match.revised_overs || match.overs || match.overs_per_side || 20;

    return (
      <TouchableOpacity activeOpacity={0.92} onPress={handleAction} style={[styles.card, styles.completedCardClean]}>
        {/* 1. Clean Header: Tournament + Verified Completed Pill */}
        <View style={styles.completedHeaderRow}>
          <View style={{ flex: 1, paddingRight: 8 }}>
            <Text style={styles.completedTournamentText} numberOfLines={1}>
              🏆 {(match.tournament || match.tournament_name || 'Association Championship').toUpperCase()}
            </Text>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => {
                const v = match.venue || 'Virudhunagar Cricket Ground';
                const url = match.venue_maps_url || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(v + (v.toLowerCase().includes('virudhunagar') || v.toLowerCase().includes('sivakasi') ? '' : ', Virudhunagar'))}`;
                if (Platform.OS === 'web' && typeof window !== 'undefined') window.open(url, '_blank');
                else Linking.openURL(url).catch(() => {});
              }}
            >
              <Text style={styles.completedVenueSub} numberOfLines={1}>
                📍 <Text style={{ textDecorationLine: 'underline', color: '#0284c7' }}>{match.venue || 'Virudhunagar Cricket Ground'} ↗</Text> • 🏏 {match.format || 'T20'} ({totalMatchOvers} Ov) {match.date ? `• 📅 ${match.date.split(' ')[0]}` : ''}
              </Text>
            </TouchableOpacity>
          </View>
          <View style={styles.completedBadgeGreen}>
            <Text style={styles.completedBadgeGreenText}>✓ COMPLETED</Text>
          </View>
        </View>

        {/* 2. Structured Teams & Scores Display */}
        <View style={styles.completedScoresBox}>
          <View style={styles.completedTeamScoreRow}>
            <Text style={styles.completedTeamName} numberOfLines={1}>
              {match.teamA}
            </Text>
            <Text style={styles.completedScoreVal}>{formatScoreWithTotalOvers(match.scoreA, totalMatchOvers)}</Text>
          </View>
          <View style={[styles.completedTeamScoreRow, { marginTop: 6 }]}>
            <Text style={styles.completedTeamName} numberOfLines={1}>
              {match.teamB}
            </Text>
            <Text style={styles.completedScoreVal}>{formatScoreWithTotalOvers(match.scoreB, totalMatchOvers)}</Text>
          </View>
        </View>

        {/* 3. Victory Result Highlight */}
        <View style={styles.completedResultBanner}>
          <Text style={styles.completedResultText} numberOfLines={2}>
            🏆 {match.result || 'Match Concluded'}
          </Text>
        </View>

        {/* 4. Sleek Footer: Compact Officials & Scorecard CTA */}
        <View style={styles.completedFooterRow}>
          <Text style={styles.completedOfficialsLine} numberOfLines={1}>
            👔 {umpire1} & {umpire2} • 📝 {scorerName}
          </Text>
          <TouchableOpacity style={styles.completedViewBtn} onPress={handleAction} activeOpacity={0.8}>
            <Text style={styles.completedViewBtnText}>SCORECARD ▶</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // UPCOMING VARIANT (ULTRA-PROFESSIONAL ASSOCIATION GRADE)
  // ══════════════════════════════════════════════════════════════════════════
  return (
    <View style={[styles.card, styles.upcomingCardContainer, timeline.isOverdue && styles.overdueCardBorder]}>
      {/* 1. TOURNAMENT & STATUS HEADER */}
      <View style={styles.upcomingHeaderRow}>
        <View style={styles.tournamentCol}>
          <Text style={styles.tournamentBadgeText}>
            🏆 {(match.tournament || match.tournament_name || 'District Championship').toUpperCase()}
          </Text>
          <View style={styles.formatTagRow}>
            <View style={styles.formatPill}>
              <Text style={styles.formatPillText}>🏏 {match.format || 'T20'}</Text>
            </View>
            <View style={styles.oversPill}>
              <Text style={styles.oversPillText}>{match.overs ? `${match.overs}-Overs Match` : 'Limited Overs'}</Text>
            </View>
            {match.stage && (
              <View style={styles.stagePill}>
                <Text style={styles.stagePillText}>{match.stage}</Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.headerBadgesCol}>
          {timeline.isOverdue ? (
            <View style={styles.overdueDangerBadge}>
              <Text style={styles.overdueDangerText}>{timeline.badgeText}</Text>
            </View>
          ) : timeline.badgeType === 'today' ? (
            <View style={styles.todayBadge}>
              <Text style={styles.todayBadgeText}>{timeline.badgeText}</Text>
            </View>
          ) : (
            <View style={styles.standardUpcomingBadge}>
              <Text style={styles.standardUpcomingText}>{timeline.badgeText}</Text>
            </View>
          )}
          <View style={styles.statusPill}>
            <Text style={styles.statusPillText}>UPCOMING</Text>
          </View>
        </View>
      </View>

      {/* 2. OVERDUE DANGER ALERT BANNER (If overdue) */}
      {timeline.isOverdue && (
        <View style={styles.overdueBanner}>
          <Text style={styles.overdueBannerIcon}>⏰</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.overdueBannerTitle}>
              MATCH DELAYED: {timeline.daysDiff > 0 ? `${timeline.daysDiff} DAYS PAST SCHEDULE` : 'SCHEDULE TIME EXCEEDED'}
            </Text>
            <Text style={styles.overdueBannerSub}>
              {timeline.bannerText}
            </Text>
          </View>
        </View>
      )}

      {/* 3. TEAMS HEAD-TO-HEAD MATCHUP */}
      <View style={styles.teamsMatchupContainer}>
        {/* Team A */}
        <View style={styles.teamSideCol}>
          <View style={[styles.teamAvatar, { backgroundColor: '#0f766e' }]}>
            <Text style={styles.teamAvatarText}>{teamAInit}</Text>
          </View>
          <Text style={styles.teamNameTitle} numberOfLines={2}>{match.teamA}</Text>
          <Text style={styles.teamSubRole}>Team A</Text>
        </View>

        {/* Center VS Divider */}
        <View style={styles.matchupVsCol}>
          <View style={styles.vsLine} />
          <View style={styles.vsCircle}>
            <Text style={styles.vsCircleText}>VS</Text>
          </View>
          <View style={styles.vsLine} />
          <Text style={styles.matchVersusOvers}>{match.overs ? `${match.overs} Ov` : 'T20'}</Text>
        </View>

        {/* Team B */}
        <View style={[styles.teamSideCol, { alignItems: 'flex-end' }]}>
          <View style={[styles.teamAvatar, { backgroundColor: '#1e3a8a' }]}>
            <Text style={styles.teamAvatarText}>{teamBInit}</Text>
          </View>
          <Text style={[styles.teamNameTitle, { textAlign: 'right' }]} numberOfLines={2}>{match.teamB}</Text>
          <Text style={[styles.teamSubRole, { textAlign: 'right' }]}>Team B</Text>
        </View>
      </View>

      {/* 4. SCHEDULE & VENUE META STRIP */}
      <View style={styles.scheduleVenueStrip}>
        <View style={styles.metaInfoItem}>
          <Text style={styles.metaInfoLabel}>📅 SCHEDULED DATE &amp; TIME</Text>
          <Text style={[styles.metaInfoVal, timeline.isOverdue && { color: '#b91c1c', fontWeight: '800' }]}>
            {timeline.formattedDate}
          </Text>
        </View>
        <View style={styles.metaInfoDivider} />
        <TouchableOpacity
          style={[styles.metaInfoItem, { flex: 1.2 }]}
          activeOpacity={0.7}
          onPress={() => {
            const v = match.venue || 'District Stadium, Virudhunagar';
            const url = match.venue_maps_url || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(v + (v.toLowerCase().includes('virudhunagar') || v.toLowerCase().includes('sivakasi') ? '' : ', Virudhunagar'))}`;
            if (Platform.OS === 'web' && typeof window !== 'undefined') window.open(url, '_blank');
            else Linking.openURL(url).catch(() => {});
          }}
        >
          <Text style={styles.metaInfoLabel}>📍 VENUE &amp; GROUND ↗</Text>
          <Text style={[styles.metaInfoVal, { color: '#0284c7', textDecorationLine: 'underline' }]} numberOfLines={1}>
            {match.venue || 'District Stadium, Virudhunagar'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* 5. OFFICIAL MATCH GOVERNANCE (UMPIRES & SCORER) */}
      <View style={styles.officialsCard}>
        <View style={styles.officialsHeaderRow}>
          <Text style={styles.officialsSectionLabel}>MATCH OFFICIALS &amp; GOVERNANCE APPOINTMENTS</Text>
          <View style={styles.tncaSealPill}>
            <Text style={styles.tncaSealText}>CFVD • TNCA AFFILIATED</Text>
          </View>
        </View>

        <View style={styles.officialsGrid}>
          {/* Umpires Column */}
          <View style={styles.officialCol}>
            <View style={styles.officialRoleHeader}>
              <Text style={styles.officialIcon}>👔</Text>
              <Text style={styles.officialRoleLabel}>OFFICIAL UMPIRES</Text>
            </View>
            <View style={styles.officialNameRow}>
              <View style={styles.dotUmp} />
              <Text style={styles.officialNameText}>1. {umpire1}</Text>
              <Text style={styles.officialIdBadge}>{umpire1Id}</Text>
            </View>
            <View style={styles.officialNameRow}>
              <View style={styles.dotUmp} />
              <Text style={styles.officialNameText}>2. {umpire2}</Text>
              <Text style={styles.officialIdBadge}>{umpire2Id}</Text>
            </View>
          </View>

          <View style={styles.officialsColDivider} />

          {/* Scorer Column */}
          <View style={styles.officialCol}>
            <View style={styles.officialRoleHeader}>
              <Text style={styles.officialIcon}>📝</Text>
              <Text style={styles.officialRoleLabel}>OFFICIAL SCORER</Text>
            </View>
            <View style={styles.officialNameRow}>
              <View style={styles.dotScorer} />
              <Text style={styles.officialNameText}>{scorerName}</Text>
              <Text style={styles.officialIdBadge}>{scorerId}</Text>
            </View>
            <View style={styles.scorerStatusPill}>
              <Text style={styles.scorerStatusText}>✓ Appointed Match Scorer</Text>
            </View>
          </View>
        </View>
      </View>

      {/* 6. ACTION BUTTON ROW */}
      <View style={styles.actionRow}>
        <TouchableOpacity style={styles.proStartBtn} onPress={handleAction} activeOpacity={0.85}>
          <Text style={styles.proStartBtnText}>🏏 SETUP &amp; START MATCH ▶</Text>
        </TouchableOpacity>
        {timeline.isOverdue && (
          <Text style={styles.overdueNoteText}>
            * Overdue match: Setup will prompt for official start confirmation and toss record.
          </Text>
        )}
      </View>
    </View>
  );
}

const getStyles = (isMobile: boolean) => StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    borderWidth: 1.5,
    borderRadius: 10,
    padding: isMobile ? 12 : 16,
    marginBottom: 16,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
    width: '100%',
    maxWidth: '100%',
    overflow: 'hidden'
  },
  liveCard: {
    borderColor: '#fca5a5',
    borderLeftWidth: 5,
    borderLeftColor: '#ef4444',
    backgroundColor: '#fffaf0'
  },
  completedCard: {
    borderColor: '#e2e8f0',
    backgroundColor: '#ffffff'
  },
  upcomingCardContainer: {
    backgroundColor: '#ffffff',
    borderLeftWidth: 5,
    borderLeftColor: '#0284c7'
  },
  overdueCardBorder: {
    borderLeftColor: '#dc2626',
    borderColor: '#fca5a5',
    backgroundColor: '#fffdfd'
  },

  // 1. UPCOMING HEADER
  upcomingHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    paddingBottom: 10,
    width: '100%'
  },
  tournamentCol: {
    flex: 1,
    minWidth: 140,
    paddingRight: 6
  },
  tournamentBadgeText: {
    color: '#b45309',
    fontSize: isMobile ? 11.5 : 12.5,
    fontWeight: '800',
    letterSpacing: 0.6,
    marginBottom: 5
  },
  formatTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6
  },
  formatPill: {
    backgroundColor: '#eff6ff',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#bfdbfe'
  },
  formatPillText: {
    color: '#1d4ed8',
    fontSize: 10,
    fontWeight: '700'
  },
  oversPill: {
    backgroundColor: '#f8fafc',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#e2e8f0'
  },
  oversPillText: {
    color: '#475569',
    fontSize: 10,
    fontWeight: '600'
  },
  stagePill: {
    backgroundColor: '#fef3c7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#fde68a'
  },
  stagePillText: {
    color: '#92400e',
    fontSize: 9.5,
    fontWeight: '800',
    textTransform: 'uppercase'
  },
  headerBadgesCol: {
    alignItems: 'flex-end',
    flexWrap: 'wrap',
    gap: 4
  },
  overdueDangerBadge: {
    backgroundColor: '#fee2e2',
    borderColor: '#ef4444',
    borderWidth: 1.2,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3
  },
  overdueDangerText: {
    color: '#b91c1c',
    fontSize: 10.5,
    fontWeight: '900',
    letterSpacing: 0.5
  },
  todayBadge: {
    backgroundColor: '#ffedd5',
    borderColor: '#f97316',
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3
  },
  todayBadgeText: {
    color: '#c2410c',
    fontSize: 10.5,
    fontWeight: '800'
  },
  standardUpcomingBadge: {
    backgroundColor: '#f1f5f9',
    borderColor: '#cbd5e1',
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3
  },
  standardUpcomingText: {
    color: '#334155',
    fontSize: 10.5,
    fontWeight: '700'
  },
  statusPill: {
    backgroundColor: '#f8fafc',
    borderColor: '#e2e8f0',
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 1
  },
  statusPillText: {
    color: '#64748b',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5
  },

  // 2. OVERDUE ALERT BANNER
  overdueBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 8,
    padding: 10,
    marginBottom: 14,
    gap: 8,
    width: '100%'
  },
  overdueBannerIcon: {
    fontSize: 20
  },
  overdueBannerTitle: {
    color: '#991b1b',
    fontSize: 11.5,
    fontWeight: '800',
    letterSpacing: 0.3
  },
  overdueBannerSub: {
    color: '#7f1d1d',
    fontSize: 10.5,
    marginTop: 2,
    lineHeight: 14
  },

  // 3. TEAMS MATCHUP
  teamsMatchupContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    marginBottom: 12,
    width: '100%'
  },
  teamSideCol: {
    flex: 1,
    minWidth: 0,
    alignItems: 'flex-start'
  },
  teamAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
    borderWidth: 2,
    borderColor: '#f8fafc',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2
  },
  teamAvatarText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.5
  },
  teamNameTitle: {
    color: '#0f172a',
    fontSize: isMobile ? 13.5 : 15,
    fontWeight: '800',
    textTransform: 'capitalize',
    letterSpacing: 0.2
  },
  teamSubRole: {
    color: '#94a3b8',
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2
  },
  matchupVsCol: {
    width: isMobile ? 44 : 60,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0
  },
  vsLine: {
    width: 1,
    height: 10,
    backgroundColor: '#e2e8f0'
  },
  vsCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#f8fafc',
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 2
  },
  vsCircleText: {
    color: '#64748b',
    fontSize: 10,
    fontWeight: '900'
  },
  matchVersusOvers: {
    color: '#94a3b8',
    fontSize: 9.5,
    fontWeight: '700',
    marginTop: 2
  },

  // 4. SCHEDULE & VENUE META STRIP
  scheduleVenueStrip: {
    flexDirection: isMobile ? 'column' : 'row',
    backgroundColor: '#f8fafc',
    borderRadius: 6,
    padding: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    width: '100%',
    gap: isMobile ? 6 : 0
  },
  metaInfoItem: {
    flex: 1,
    minWidth: 0
  },
  metaInfoDivider: {
    width: isMobile ? '100%' : 1,
    height: isMobile ? 1 : 'auto',
    backgroundColor: '#e2e8f0',
    marginHorizontal: isMobile ? 0 : 10,
    marginVertical: isMobile ? 4 : 0
  },
  metaInfoLabel: {
    color: '#64748b',
    fontSize: 8.5,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 3
  },
  metaInfoVal: {
    color: '#1e293b',
    fontSize: 11,
    fontWeight: '600'
  },

  // 5. OFFICIAL MATCH GOVERNANCE (UMPIRES & SCORER)
  officialsCard: {
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    borderRadius: 8,
    padding: 10,
    marginBottom: 14,
    width: '100%'
  },
  officialsHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 4,
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#dcfce7',
    paddingBottom: 4,
    width: '100%'
  },
  officialsSectionLabel: {
    color: '#166534',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.6
  },
  tncaSealPill: {
    backgroundColor: '#dcfce7',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 3
  },
  tncaSealText: {
    color: '#15803d',
    fontSize: 8,
    fontWeight: '700'
  },
  officialsGrid: {
    flexDirection: isMobile ? 'column' : 'row',
    alignItems: 'flex-start',
    width: '100%',
    gap: isMobile ? 8 : 0
  },
  officialCol: {
    flex: 1,
    minWidth: 0,
    width: isMobile ? '100%' : 'auto'
  },
  officialsColDivider: {
    width: isMobile ? '100%' : 1,
    height: isMobile ? 1 : 'auto',
    backgroundColor: '#dcfce7',
    alignSelf: 'stretch',
    marginHorizontal: isMobile ? 0 : 10,
    marginVertical: isMobile ? 6 : 0
  },
  officialRoleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
    gap: 4
  },
  officialIcon: {
    fontSize: 12
  },
  officialRoleLabel: {
    color: '#1e293b',
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.4
  },
  officialNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 3,
    gap: 4
  },
  dotUmp: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#0284c7'
  },
  dotScorer: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#d97706'
  },
  officialNameText: {
    color: '#0f172a',
    fontSize: 11,
    fontWeight: '600',
    flex: 1
  },
  officialIdBadge: {
    backgroundColor: '#e2e8f0',
    color: '#475569',
    fontSize: 8.5,
    fontWeight: '700',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3
  },
  scorerStatusPill: {
    marginTop: 4,
    alignSelf: 'flex-start',
    backgroundColor: '#fef3c7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4
  },
  scorerStatusText: {
    color: '#92400e',
    fontSize: 8.5,
    fontWeight: '700'
  },

  // 6. ACTION AREA
  actionRow: {
    alignItems: 'center',
    gap: 6,
    width: '100%'
  },
  proStartBtn: {
    backgroundColor: '#b45309',
    paddingVertical: 11,
    paddingHorizontal: 28,
    borderRadius: 6,
    width: '100%',
    alignItems: 'center',
    shadowColor: '#b45309',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2
  },
  proStartBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.6
  },
  overdueNoteText: {
    color: '#dc2626',
    fontSize: 9.5,
    fontWeight: '600',
    textAlign: 'center'
  },

  // COMPACT OFFICIALS STRIP (FOR LIVE & COMPLETED)
  compactOfficialsStrip: {
    backgroundColor: '#f8fafc',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 4,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    width: '100%'
  },
  compactOfficialsText: {
    color: '#475569',
    fontSize: 10.5,
    lineHeight: 15
  },

  // LIVE STYLES
  liveHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#fecaca',
    paddingBottom: 8,
    marginBottom: 10,
    width: '100%'
  },
  liveIndicatorRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  redDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#ef4444',
    marginRight: 5
  },
  liveBadgeText: {
    color: '#ef4444',
    fontWeight: '900',
    fontSize: 11,
    letterSpacing: 1
  },
  tournamentText: {
    color: '#b45309',
    fontSize: isMobile ? 11 : 11.5,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    flex: 1,
    minWidth: 120
  },
  liveTeamsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    width: '100%'
  },
  teamCol: { flex: 1, minWidth: 0, paddingRight: 4 },
  teamColRight: { flex: 1, minWidth: 0, alignItems: 'flex-end', paddingLeft: 4 },
  vsCol: { width: isMobile ? 44 : 64, alignItems: 'center', paddingHorizontal: 2, flexShrink: 0 },
  liveTeamName: { color: '#0f172a', fontSize: isMobile ? 13 : 14, fontWeight: '700', marginBottom: 2 },
  liveTeamNameRight: { color: '#0f172a', fontSize: isMobile ? 13 : 14, fontWeight: '700', marginBottom: 2, textAlign: 'right' },
  liveScore: { color: '#0f172a', fontSize: isMobile ? 15 : 20, fontWeight: '900' },
  liveScoreRight: { color: '#0f172a', fontSize: isMobile ? 15 : 20, fontWeight: '900', textAlign: 'right' },
  liveVs: { color: '#94a3b8', fontSize: 12, fontWeight: 'bold' },
  liveOversBadge: {
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    marginTop: 3,
    alignItems: 'center'
  },
  liveOversBadgeRevised: {
    backgroundColor: '#fef3c7',
    borderColor: '#fde68a'
  },
  liveOversBadgeText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#1d4ed8'
  },
  liveOversBadgeTextRevised: {
    color: '#b45309'
  },
  liveRevisedBanner: {
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fde68a',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginBottom: 10,
    width: '100%'
  },
  liveRevisedBannerText: {
    color: '#b45309',
    fontSize: 11,
    fontWeight: '800'
  },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 10, width: '100%' },
  metaText: { color: '#64748b', fontSize: 11, lineHeight: 16 },
  primaryBtn: {
    backgroundColor: '#eab308',
    padding: 11,
    borderRadius: 6,
    alignItems: 'center',
    width: '100%'
  },
  primaryBtnText: { color: '#ffffff', fontWeight: '800', fontSize: 12, letterSpacing: 0.5 },

  liveDurationBadge: {
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4
  },
  liveDurationText: {
    color: '#b91c1c',
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.5
  },

  // DECLUTTERED COMPLETED STYLES
  completedCardClean: {
    borderLeftWidth: 4,
    borderLeftColor: '#16a34a',
    backgroundColor: '#ffffff',
    padding: isMobile ? 12 : 14,
    marginBottom: 12,
    width: '100%',
    maxWidth: '100%',
    overflow: 'hidden'
  },
  completedHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f8fafc',
    paddingBottom: 6,
    width: '100%'
  },
  completedTournamentText: {
    color: '#b45309',
    fontSize: 11.5,
    fontWeight: '800',
    letterSpacing: 0.5,
    flex: 1,
    minWidth: 120
  },
  completedVenueSub: {
    color: '#64748b',
    fontSize: 10.5,
    marginTop: 2
  },
  completedBadgeGreen: {
    backgroundColor: '#dcfce7',
    borderWidth: 1,
    borderColor: '#86efac',
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 4
  },
  completedBadgeGreenText: {
    color: '#15803d',
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.6
  },
  completedScoresBox: {
    backgroundColor: '#f8fafc',
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    marginBottom: 8,
    width: '100%'
  },
  completedTeamScoreRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  completedTeamName: {
    color: '#1e293b',
    fontSize: 13,
    fontWeight: '700',
    flex: 1
  },
  completedScoreVal: {
    color: '#0f172a',
    fontSize: 13,
    fontWeight: '900'
  },
  completedResultBanner: {
    backgroundColor: '#f0fdf4',
    borderLeftWidth: 3,
    borderLeftColor: '#22c55e',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 4,
    marginBottom: 8,
    width: '100%'
  },
  completedResultText: {
    color: '#15803d',
    fontSize: 11.5,
    fontWeight: '700'
  },
  completedFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#f8fafc',
    width: '100%'
  },
  completedOfficialsLine: {
    color: '#64748b',
    fontSize: 10,
    fontWeight: '600',
    flex: 1,
    marginRight: 8
  },
  completedViewBtn: {
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#f59e0b',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 4
  },
  completedViewBtnText: {
    color: '#b45309',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5
  },

  // LEGACY COMPLETED STYLES
  compactRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  compactTeam: { color: '#0f172a', fontSize: 13, fontWeight: '600' },
  compactScore: { color: '#0f172a', fontSize: 13, fontWeight: '800' },
  resultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9'
  },
  resultText: { color: '#16a34a', fontSize: 12, fontWeight: '700', flex: 1, paddingRight: 8 },
  secondaryBtn: {
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#f59e0b',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4
  },
  secondaryBtnText: { color: '#b45309', fontSize: 10.5, fontWeight: '800', letterSpacing: 0.5 },
  upcomingBadge: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#e2e8f0'
  },
  upcomingBadgeText: { color: '#64748b', fontSize: 9.5, fontWeight: '800', letterSpacing: 0.5 }
});
