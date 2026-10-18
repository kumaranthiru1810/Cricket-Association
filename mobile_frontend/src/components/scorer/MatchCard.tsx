import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
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
  venue?: string;
  format?: string;
  overs?: number;
  status: 'Upcoming' | 'Live' | 'Completed' | string;
  scoreA?: string;
  scoreB?: string;
  result?: string;
}

interface Props {
  match: MatchData;
  variant?: 'live' | 'upcoming' | 'completed';
}

export default function MatchCard({ match, variant = 'upcoming' }: Props) {
  const { navigate } = useScorerNavigation();

  const handleAction = () => {
    if (match.status === 'Upcoming') {
      navigate('MatchSetup', { matchId: match.id });
    } else if (match.status === 'Live') {
      navigate('LiveScoring', { matchId: match.id });
    } else {
      navigate('Scorecard', { matchId: match.id });
    }
  };

  const isLive = variant === 'live' || match.status === 'Live';
  const isCompleted = variant === 'completed' || match.status === 'Completed';

  if (isLive) {
    return (
      <View style={[styles.card, styles.liveCard]}>
        <View style={styles.liveHeader}>
          <Text style={styles.tournamentText}>{match.tournament}</Text>
          <View style={styles.liveIndicatorRow}>
            <View style={styles.redDot} />
            <Text style={styles.liveBadgeText}>LIVE NOW</Text>
          </View>
        </View>
        
        <View style={styles.liveTeamsRow}>
          <View style={styles.teamCol}>
            <Text style={styles.liveTeamName}>{match.teamA}</Text>
            <Text style={styles.liveScore}>{match.scoreA || 'Yet to Bat'}</Text>
          </View>
          <View style={styles.vsCol}>
            <Text style={styles.liveVs}>VS</Text>
          </View>
          <View style={styles.teamColRight}>
            <Text style={styles.liveTeamNameRight}>{match.teamB}</Text>
            <Text style={[styles.liveScoreRight, { fontSize: match.scoreB ? 24 : 14, color: match.scoreB ? '#1e293b' : '#64748b' }]}>
              {match.scoreB || 'Yet to Bat'}
            </Text>
          </View>
        </View>

        <View style={styles.metaRow}>
          <Text style={styles.metaText}>{match.venue} &bull; {match.format}</Text>
        </View>

        <TouchableOpacity style={styles.primaryBtn} onPress={handleAction}>
          <Text style={styles.primaryBtnText}>CONTINUE SCORING</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (isCompleted) {
    return (
      <View style={[styles.card, styles.completedCard]}>
        <Text style={styles.tournamentText}>{match.tournament}</Text>
        
        <View style={styles.compactRow}>
          <Text style={styles.compactTeam}>{match.teamA}</Text>
          <Text style={styles.compactScore}>{match.scoreA}</Text>
        </View>
        <View style={styles.compactRow}>
          <Text style={styles.compactTeam}>{match.teamB}</Text>
          <Text style={styles.compactScore}>{match.scoreB}</Text>
        </View>
        
        <View style={styles.resultRow}>
          <Text style={styles.resultText}>{match.result}</Text>
          <TouchableOpacity style={styles.secondaryBtn} onPress={handleAction}>
            <Text style={styles.secondaryBtnText}>VIEW SCORECARD</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Upcoming default
  return (
    <View style={styles.card}>
      <View style={styles.upcomingHeader}>
        <Text style={styles.tournamentText}>{match.tournament}</Text>
        <View style={styles.upcomingBadge}><Text style={styles.upcomingBadgeText}>UPCOMING</Text></View>
      </View>
      
      <View style={styles.upcomingTeamsRow}>
        <Text style={styles.upcomingTeam}>{match.teamA}</Text>
        <Text style={styles.upcomingVs}>VS</Text>
        <Text style={styles.upcomingTeam}>{match.teamB}</Text>
      </View>
      
      <Text style={styles.metaTextCentered}>{match.date} &bull; {match.venue} &bull; {match.format}</Text>
      
      <View style={styles.centerBtnRow}>
        <TouchableOpacity style={styles.setupBtn} onPress={handleAction}>
          <Text style={styles.setupBtnText}>SETUP &amp; START MATCH</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.75)',
    borderColor: 'rgba(226, 232, 240, 0.8)',
    borderWidth: 1,
    borderRadius: 6,
    padding: 12,
    marginBottom: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1
  },
  liveCard: {
    borderColor: 'rgba(252, 165, 165, 0.8)',
    borderLeftWidth: 4,
    borderLeftColor: '#ef4444',
    backgroundColor: 'rgba(254, 242, 242, 0.8)',
  },
  completedCard: {
    borderColor: 'rgba(226, 232, 240, 0.8)',
    backgroundColor: 'rgba(248, 250, 252, 0.8)',
  },
  
  // LIVE STYLES
  liveHeader: { flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#e2e8f0', paddingBottom: 8, marginBottom: 10 },
  liveIndicatorRow: { flexDirection: 'row', alignItems: 'center' },
  redDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#ef4444', marginRight: 4 },
  liveBadgeText: { color: '#ef4444', fontWeight: 'bold', fontSize: 11, letterSpacing: 1 },
  tournamentText: { color: '#b45309', fontSize: 11, fontWeight: 'bold', letterSpacing: 0.5, textTransform: 'uppercase' },
  
  liveTeamsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  teamCol: { flex: 1 },
  teamColRight: { flex: 1, alignItems: 'flex-end' },
  vsCol: { width: 30, alignItems: 'center' },
  liveTeamName: { color: '#1e293b', fontSize: 14, fontWeight: '600', marginBottom: 2 },
  liveTeamNameRight: { color: '#1e293b', fontSize: 14, fontWeight: '600', marginBottom: 2, textAlign: 'right' },
  liveScore: { color: '#1e293b', fontSize: 20, fontWeight: 'bold' },
  liveScoreRight: { color: '#1e293b', fontSize: 20, fontWeight: 'bold', textAlign: 'right' },
  liveVs: { color: '#94a3b8', fontSize: 12, fontWeight: 'bold' },
  
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  metaText: { color: '#64748b', fontSize: 11 },
  metaTextCentered: { color: '#64748b', fontSize: 11, textAlign: 'center', marginBottom: 12, marginTop: 4 },
  
  primaryBtn: { backgroundColor: '#eab308', padding: 10, borderRadius: 4, alignItems: 'center' },
  primaryBtnText: { color: '#ffffff', fontWeight: 'bold', fontSize: 12, letterSpacing: 0.5 },
  
  // UPCOMING STYLES
  upcomingHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  upcomingBadge: { backgroundColor: '#f1f5f9', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 3, borderWidth: 1, borderColor: '#e2e8f0' },
  upcomingBadgeText: { color: '#64748b', fontSize: 10, fontWeight: 'bold', letterSpacing: 0.5 },
  upcomingTeamsRow: { alignItems: 'center', marginBottom: 8 },
  upcomingTeam: { color: '#1e293b', fontSize: 14, fontWeight: 'bold' },
  upcomingVs: { color: '#94a3b8', fontSize: 11, marginVertical: 2, fontWeight: 'bold' },
  centerBtnRow: { alignItems: 'center' },
  setupBtn: { backgroundColor: '#b45309', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 4 },
  setupBtnText: { color: '#ffffff', fontSize: 11, fontWeight: 'bold', letterSpacing: 0.5 },
  
  // COMPLETED STYLES
  compactRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  compactTeam: { color: '#1e293b', fontSize: 13, fontWeight: '500' },
  compactScore: { color: '#1e293b', fontSize: 13, fontWeight: 'bold' },
  resultRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#e2e8f0' },
  resultText: { color: '#16a34a', fontSize: 12, fontWeight: '600', flex: 1, paddingRight: 8 },
  secondaryBtn: { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#eab308', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 4 },
  secondaryBtnText: { color: '#b45309', fontSize: 11, fontWeight: 'bold', letterSpacing: 0.5 }
});
