import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Platform,
  Alert
} from 'react-native';
import { ScorerApi } from '../../services/api';

type PeriodType = 'day' | 'month' | 'year';

function getDefaultDateForPeriod(p: PeriodType): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  if (p === 'day') return `${y}-${m}-${d}`;
  if (p === 'month') return `${y}-${m}`;
  return `${y}`;
}

function escapeHtml(str: any): string {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export default function AdminReportsPanel() {
  const [period, setPeriod] = useState<PeriodType>('month');
  const [dateValue, setDateValue] = useState<string>(() => getDefaultDateForPeriod('month'));
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<any>(null);

  const loadReport = useCallback(async (p: PeriodType, d: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await ScorerApi.getReports(p, d);
      setReport(res);
    } catch (_err: any) {
      setReport({
        period: p,
        date: d,
        summary: {
          totalTournaments: 0,
          totalMatches: 0,
          completedMatches: 0,
          liveMatches: 0,
          scheduledMatches: 0
        },
        tournaments: [],
        matches: []
      });
      setError('Data not found.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadReport(period, dateValue);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePeriodChange = (nextPeriod: PeriodType) => {
    const nextDate = getDefaultDateForPeriod(nextPeriod);
    setPeriod(nextPeriod);
    setDateValue(nextDate);
    loadReport(nextPeriod, nextDate);
  };

  const handlePrint = () => {
    if (!report) return;
    if (Platform.OS !== 'web') {
      Alert.alert(
        'Print Report',
        `Report for ${period.toUpperCase()} (${dateValue}): ${report.summary?.totalTournaments || 0} Tournaments, ${report.summary?.totalMatches || 0} Matches. Please use the Web Admin portal to print PDF/hardcopy.`
      );
      return;
    }

    const toursHtml = (report.tournaments || []).length > 0
      ? (report.tournaments || []).map((t: any, i: number) => `
          <tr>
            <td>${i + 1}</td>
            <td><strong>${escapeHtml(t.name)}</strong></td>
            <td>${escapeHtml(t.format)}</td>
            <td>${escapeHtml(t.start_date)} to ${escapeHtml(t.end_date)}</td>
            <td style="text-align:center">${t.teams_count}</td>
            <td style="text-align:center">${t.matches_in_period}</td>
            <td>${escapeHtml(t.status)}</td>
            <td>${escapeHtml(t.champion)}</td>
          </tr>
        `).join('')
      : `<tr><td colspan="8" style="text-align:center;color:#64748b;">No tournaments recorded in this period.</td></tr>`;

    const matchesHtml = (report.matches || []).length > 0
      ? (report.matches || []).map((m: any, i: number) => `
          <tr>
            <td>${i + 1}</td>
            <td>${escapeHtml(m.match_date)}<br/><small style="color:#64748b">${escapeHtml(m.match_time)}</small></td>
            <td>${escapeHtml(m.tournament_name)}</td>
            <td><strong>${escapeHtml(m.team_a_name)}</strong> vs <strong>${escapeHtml(m.team_b_name)}</strong><br/><small style="color:#475569">${escapeHtml(m.score_a)} | ${escapeHtml(m.score_b)}</small></td>
            <td>${escapeHtml(m.result_summary)}</td>
            <td><strong style="color:#b45309">${escapeHtml(m.player_of_match || '—')}</strong></td>
            <td><strong style="color:#0369a1">${escapeHtml(m.points_summary || '—')}</strong></td>
            <td>${escapeHtml(m.status)}</td>
          </tr>
        `).join('')
      : `<tr><td colspan="8" style="text-align:center;color:#64748b;">No matches recorded in this period.</td></tr>`;

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>CFVD Official Activity Report - ${escapeHtml(period.toUpperCase())} (${escapeHtml(dateValue)})</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #0f172a; padding: 24px; }
    .header { border-bottom: 3px solid #0e184e; padding-bottom: 12px; margin-bottom: 18px; display: flex; justify-content: space-between; align-items: flex-end; }
    .title { font-size: 20px; font-weight: 900; color: #0e184e; margin: 0; }
    .sub { font-size: 12px; color: #475569; margin-top: 4px; }
    .kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 20px; }
    .kpi { border: 1px solid #cbd5e1; border-radius: 8px; padding: 10px 12px; background: #f8fafc; }
    .kpi-lbl { font-size: 10px; font-weight: 800; color: #64748b; text-transform: uppercase; }
    .kpi-val { font-size: 20px; font-weight: 900; color: #0e184e; margin-top: 4px; }
    h2 { font-size: 14px; font-weight: 800; color: #0e184e; margin: 18px 0 8px; border-left: 4px solid #f59e0b; padding-left: 8px; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 16px; }
    th { background: #0e184e; color: #ffffff; text-align: left; padding: 7px 8px; font-weight: 700; }
    td { border-bottom: 1px solid #e2e8f0; padding: 7px 8px; vertical-align: top; }
    tr:nth-child(even) td { background: #f8fafc; }
    @media print { body { padding: 10px; } }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="title">CRICKET FEDERATION OF VIRUDHUNAGAR DISTRICT</div>
      <div class="sub">Official ${escapeHtml(period.toUpperCase())} Wise Report • Period: <strong>${escapeHtml(dateValue)}</strong></div>
    </div>
    <div class="sub">Generated: ${new Date().toLocaleString()}</div>
  </div>
  <div class="kpis">
    <div class="kpi"><div class="kpi-lbl">Tournaments</div><div class="kpi-val">${report.summary?.totalTournaments || 0}</div></div>
    <div class="kpi"><div class="kpi-lbl">Total Matches</div><div class="kpi-val">${report.summary?.totalMatches || 0}</div></div>
    <div class="kpi"><div class="kpi-lbl">Completed Matches</div><div class="kpi-val">${report.summary?.completedMatches || 0}</div></div>
    <div class="kpi"><div class="kpi-lbl">Live / Scheduled</div><div class="kpi-val">${(report.summary?.liveMatches || 0) + (report.summary?.scheduledMatches || 0)}</div></div>
  </div>
  <h2>Tournaments Conducted (${(report.tournaments || []).length})</h2>
  <table>
    <thead>
      <tr><th>#</th><th>Tournament</th><th>Format</th><th>Dates</th><th>Teams</th><th>Matches</th><th>Status</th><th>Champion</th></tr>
    </thead>
    <tbody>${toursHtml}</tbody>
  </table>
  <h2>Matches Conducted (${(report.matches || []).length})</h2>
  <table>
    <thead>
      <tr><th>#</th><th>Date & Time</th><th>Tournament</th><th>Match & Score</th><th>Result</th><th>Man of the Match</th><th>Points</th><th>Status</th></tr>
    </thead>
    <tbody>${matchesHtml}</tbody>
  </table>
</body>
</html>`;

    const win = window.open('', '_blank', 'width=1024,height=768');
    if (win) {
      win.document.open();
      win.document.write(html);
      win.document.close();
      win.focus();
      setTimeout(() => win.print(), 350);
    }
  };

  const tournaments = report?.tournaments || [];
  const matches = report?.matches || [];
  const summary = report?.summary || { totalTournaments: 0, totalMatches: 0, completedMatches: 0, liveMatches: 0, scheduledMatches: 0 };

  return (
    <ScrollView style={s.container} contentContainerStyle={{ paddingBottom: 40 }}>
      {/* Header & Controls */}
      <View style={s.card}>
        <View style={s.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={s.title}>📊 Official Association Reports</Text>
            <Text style={s.subtitle}>
              Generate & print Day, Month, or Year wise reports of tournaments, matches, Man of the Match, and points.
            </Text>
          </View>
          <TouchableOpacity
            style={[s.printBtn, (!report || loading) && { opacity: 0.5 }]}
            onPress={handlePrint}
            disabled={!report || loading}
          >
            <Text style={s.printBtnText}>🖨️ Print Report</Text>
          </TouchableOpacity>
        </View>

        {/* Period Selector + Date Input */}
        <View style={s.controlsRow}>
          <View style={s.periodGroup}>
            {(['day', 'month', 'year'] as PeriodType[]).map((p) => (
              <TouchableOpacity
                key={p}
                style={[s.periodBtn, period === p && s.periodBtnActive]}
                onPress={() => handlePeriodChange(p)}
              >
                <Text style={[s.periodBtnText, period === p && s.periodBtnTextActive]}>
                  {p === 'day' ? 'Day Wise' : p === 'month' ? 'Month Wise' : 'Year Wise'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={s.dateControlWrap}>
            {Platform.OS === 'web' && period !== 'year' ? (
              <input
                type={period === 'day' ? 'date' : 'month'}
                value={dateValue}
                onChange={(e: any) => {
                  const val = e.target.value;
                  setDateValue(val);
                  if (val) loadReport(period, val);
                }}
                style={{
                  height: 36,
                  padding: '0 10px',
                  borderRadius: 8,
                  border: '1px solid #cbd5e1',
                  fontSize: 13,
                  fontWeight: 600,
                  color: '#0f172a',
                  backgroundColor: '#ffffff'
                }}
              />
            ) : (
              <TextInput
                style={s.dateInput}
                value={dateValue}
                onChangeText={setDateValue}
                placeholder={period === 'day' ? 'YYYY-MM-DD' : period === 'month' ? 'YYYY-MM' : 'YYYY'}
                placeholderTextColor="#94a3b8"
              />
            )}

            <TouchableOpacity
              style={s.generateBtn}
              onPress={() => loadReport(period, dateValue)}
              disabled={loading}
            >
              <Text style={s.generateBtnText}>{loading ? 'Loading...' : 'Generate Report'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {error ? (
        <View style={s.infoBox}>
          <Text style={s.infoText}>ℹ️ Data not found for the selected period.</Text>
        </View>
      ) : null}

      {loading ? (
        <View style={s.loadingBox}>
          <ActivityIndicator size="large" color="#0e184e" />
          <Text style={s.loadingText}>Generating {period} wise report for {dateValue}...</Text>
        </View>
      ) : (
        <>
          {/* Summary KPI Row */}
          <View style={s.kpiGrid}>
            <View style={[s.kpiCard, { borderLeftColor: '#0e184e' }]}>
              <Text style={s.kpiLabel}>TOURNAMENTS</Text>
              <Text style={s.kpiValue}>{summary.totalTournaments}</Text>
            </View>
            <View style={[s.kpiCard, { borderLeftColor: '#0284c7' }]}>
              <Text style={s.kpiLabel}>TOTAL MATCHES</Text>
              <Text style={s.kpiValue}>{summary.totalMatches}</Text>
            </View>
            <View style={[s.kpiCard, { borderLeftColor: '#16a34a' }]}>
              <Text style={s.kpiLabel}>COMPLETED</Text>
              <Text style={[s.kpiValue, { color: '#15803d' }]}>{summary.completedMatches}</Text>
            </View>
            <View style={[s.kpiCard, { borderLeftColor: '#d97706' }]}>
              <Text style={s.kpiLabel}>LIVE / SCHEDULED</Text>
              <Text style={[s.kpiValue, { color: '#b45309' }]}>
                {(summary.liveMatches || 0) + (summary.scheduledMatches || 0)}
              </Text>
            </View>
          </View>

          {/* Tournaments Section */}
          <View style={s.card}>
            <Text style={s.sectionTitle}>🏆 Tournaments Conducted ({tournaments.length})</Text>
            {tournaments.length === 0 ? (
              <Text style={s.emptyText}>Data not found for {dateValue}.</Text>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator>
                <View style={{ minWidth: 740 }}>
                  <View style={s.thRow}>
                    <Text style={[s.th, { width: 200 }]}>Tournament</Text>
                    <Text style={[s.th, { width: 120 }]}>Format</Text>
                    <Text style={[s.th, { width: 170 }]}>Dates</Text>
                    <Text style={[s.th, { width: 65, textAlign: 'center' }]}>Teams</Text>
                    <Text style={[s.th, { width: 70, textAlign: 'center' }]}>Matches</Text>
                    <Text style={[s.th, { width: 100 }]}>Status</Text>
                    <Text style={[s.th, { width: 140 }]}>Champion</Text>
                  </View>
                  {tournaments.map((t: any, idx: number) => (
                    <View key={t.id || idx} style={[s.tdRow, idx % 2 === 1 && s.tdRowAlt]}>
                      <Text style={[s.tdBold, { width: 200 }]} numberOfLines={2}>{t.name}</Text>
                      <Text style={[s.td, { width: 120 }]}>{t.format}</Text>
                      <Text style={[s.td, { width: 170 }]}>{t.start_date} → {t.end_date}</Text>
                      <Text style={[s.td, { width: 65, textAlign: 'center' }]}>{t.teams_count}</Text>
                      <Text style={[s.tdBold, { width: 70, textAlign: 'center' }]}>{t.matches_in_period}</Text>
                      <Text style={[s.td, { width: 100 }]}>{t.status}</Text>
                      <Text style={[s.td, { width: 140, color: '#b45309', fontWeight: '700' }]}>{t.champion}</Text>
                    </View>
                  ))}
                </View>
              </ScrollView>
            )}
          </View>

          {/* Matches Section */}
          <View style={s.card}>
            <Text style={s.sectionTitle}>🏏 Matches Conducted ({matches.length})</Text>
            {matches.length === 0 ? (
              <Text style={s.emptyText}>Data not found for {dateValue}.</Text>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator>
                <View style={{ minWidth: 960 }}>
                  <View style={s.thRow}>
                    <Text style={[s.th, { width: 105 }]}>Date</Text>
                    <Text style={[s.th, { width: 155 }]}>Tournament</Text>
                    <Text style={[s.th, { width: 210 }]}>Match & Scores</Text>
                    <Text style={[s.th, { width: 175 }]}>Result</Text>
                    <Text style={[s.th, { width: 135 }]}>⭐ Man of the Match</Text>
                    <Text style={[s.th, { width: 195 }]}>🏆 Points</Text>
                    <Text style={[s.th, { width: 90 }]}>Status</Text>
                  </View>
                  {matches.map((m: any, idx: number) => (
                    <View key={m.id || idx} style={[s.tdRow, idx % 2 === 1 && s.tdRowAlt]}>
                      <View style={{ width: 105 }}>
                        <Text style={s.tdBold}>{m.match_date}</Text>
                        <Text style={s.tdSub}>{m.match_time}</Text>
                      </View>
                      <Text style={[s.td, { width: 155 }]} numberOfLines={2}>{m.tournament_name}</Text>
                      <View style={{ width: 210 }}>
                        <Text style={s.tdBold} numberOfLines={2}>{m.team_a_name} vs {m.team_b_name}</Text>
                        <Text style={s.tdSub}>{m.score_a} | {m.score_b}</Text>
                      </View>
                      <Text style={[s.td, { width: 175 }]} numberOfLines={2}>{m.result_summary}</Text>
                      <Text style={[s.tdBold, { width: 135, color: '#b45309' }]} numberOfLines={2}>
                        {m.player_of_match || '—'}
                      </Text>
                      <Text style={[s.tdBold, { width: 195, color: '#0369a1' }]} numberOfLines={2}>
                        {m.points_summary || '—'}
                      </Text>
                      <Text style={[s.td, { width: 90 }]}>{m.status}</Text>
                    </View>
                  ))}
                </View>
              </ScrollView>
            )}
          </View>
        </>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 16,
    marginBottom: 14
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 14
  },
  title: { fontSize: 17, fontWeight: '900', color: '#0e184e' },
  subtitle: { fontSize: 12, color: '#64748b', marginTop: 3 },
  printBtn: {
    backgroundColor: '#0e184e',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 8
  },
  printBtnText: { color: '#ffffff', fontSize: 12.5, fontWeight: '800' },
  controlsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 10
  },
  periodGroup: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
    padding: 3,
    gap: 4
  },
  periodBtn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 6 },
  periodBtnActive: { backgroundColor: '#0e184e' },
  periodBtnText: { fontSize: 12, fontWeight: '700', color: '#475569' },
  periodBtnTextActive: { color: '#ffffff' },
  dateControlWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  dateInput: {
    height: 36,
    minWidth: 130,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
    color: '#0f172a'
  },
  generateBtn: {
    backgroundColor: '#f59e0b',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 8
  },
  generateBtnText: { color: '#0f172a', fontSize: 12.5, fontWeight: '800' },
  infoBox: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    padding: 12,
    marginBottom: 14
  },
  infoText: { color: '#475569', fontSize: 12.5, fontWeight: '700' },
  loadingBox: { padding: 32, alignItems: 'center' },
  loadingText: { marginTop: 10, fontSize: 12.5, color: '#64748b', fontWeight: '600' },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 14
  },
  kpiCard: {
    flex: 1,
    minWidth: 140,
    backgroundColor: '#ffffff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderLeftWidth: 4,
    padding: 12
  },
  kpiLabel: { fontSize: 10, fontWeight: '800', color: '#64748b', letterSpacing: 0.4 },
  kpiValue: { fontSize: 22, fontWeight: '900', color: '#0e184e', marginTop: 4 },
  sectionTitle: { fontSize: 14.5, fontWeight: '800', color: '#0e184e', marginBottom: 10 },
  emptyText: { fontSize: 12.5, color: '#64748b', paddingVertical: 12 },
  thRow: {
    flexDirection: 'row',
    backgroundColor: '#0e184e',
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8
  },
  th: { color: '#ffffff', fontSize: 11, fontWeight: '800', paddingRight: 8 },
  tdRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    backgroundColor: '#ffffff'
  },
  tdRowAlt: { backgroundColor: '#f8fafc' },
  td: { fontSize: 11.5, color: '#334155', paddingRight: 8 },
  tdBold: { fontSize: 11.5, fontWeight: '700', color: '#0f172a', paddingRight: 8 },
  tdSub: { fontSize: 10.5, color: '#64748b', marginTop: 2 }
});
