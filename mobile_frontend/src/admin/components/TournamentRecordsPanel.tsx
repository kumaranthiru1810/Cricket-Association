/**
 * src/admin/components/TournamentRecordsPanel.tsx
 * Admin Tournament Records, Awards, Points Table, Top-10 Leaderboards,
 * Import Records, PDF/Print Report, and Multi-Sheet Excel (.xls) Export.
 * Fully responsive for PC browsers, tablets, Android, and iPhone.
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Modal,
  StyleSheet,
  ActivityIndicator,
  Platform,
  useWindowDimensions
} from 'react-native';
import { adminApi } from '../services/adminApi';
import { showSuccess, showError, showWarning } from '../../utils/sweetalert';

interface Props {
  tournaments: any[];
}

type SortMode = 'RECENT' | 'OLDEST' | 'NAME_ASC';
type RecordsSubTab = 'summary' | 'top10';
type Top10Key =
  | 'most_runs'
  | 'most_wickets'
  | 'most_catches'
  | 'best_batting_average'
  | 'best_bowling_economy'
  | 'best_batting'
  | 'best_bowling';

const TOP10_CATEGORIES: { key: Top10Key; label: string; icon: string }[] = [
  { key: 'most_runs', label: 'Most Runs', icon: '🏏' },
  { key: 'most_wickets', label: 'Most Wickets', icon: '🎯' },
  { key: 'most_catches', label: 'Most Catches', icon: '🧤' },
  { key: 'best_batting_average', label: 'Best Bat Avg', icon: '📈' },
  { key: 'best_bowling_economy', label: 'Best Economy', icon: '⚡' },
  { key: 'best_batting', label: 'Best Batting', icon: '🔥' },
  { key: 'best_bowling', label: 'Best Bowling', icon: '🏆' }
];

function escapeXml(val: any): string {
  return String(val ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeHtml(val: any): string {
  return String(val ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function getTournamentYear(t: any): string {
  if (t?.season && /^\d{4}/.test(String(t.season))) return String(t.season).slice(0, 4);
  if (t?.end_date && /^\d{4}/.test(String(t.end_date))) return String(t.end_date).slice(0, 4);
  if (t?.start_date && /^\d{4}/.test(String(t.start_date))) return String(t.start_date).slice(0, 4);
  if (t?.createdAt) return String(new Date(t.createdAt).getFullYear());
  return '2026';
}

function getTournamentSortTimestamp(t: any): number {
  const raw = t?.completed_at || t?.end_date || t?.start_date || t?.updatedAt || t?.createdAt;
  const ts = raw ? new Date(raw).getTime() : 0;
  return Number.isNaN(ts) ? 0 : ts;
}

export const TournamentRecordsPanel: React.FC<Props> = ({ tournaments: initialTournaments }) => {
  const { width } = useWindowDimensions();
  const isMobile = width < 768;

  const [tournaments, setTournaments] = useState<any[]>(initialTournaments || []);
  const [searchQuery, setSearchQuery] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [sortMode, setSortMode] = useState<SortMode>('RECENT');
  const [subTab, setSubTab] = useState<RecordsSubTab>('summary');
  const [activeTop10, setActiveTop10] = useState<Top10Key>('most_runs');

  const [selectedId, setSelectedId] = useState<string>('');
  const [records, setRecords] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);

  // Import Modal State
  const [importVisible, setImportVisible] = useState(false);
  const [impWinner, setImpWinner] = useState('');
  const [impRunner, setImpRunner] = useState('');
  const [impMotmFinal, setImpMotmFinal] = useState('');
  const [impMott, setImpMott] = useState('');
  const [impJson, setImpJson] = useState('');
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    if (Array.isArray(initialTournaments) && initialTournaments.length > 0) {
      setTournaments(initialTournaments);
    } else {
      adminApi.getTournaments().then((res: any) => {
        const list = res?.tournaments || res?.data || [];
        if (Array.isArray(list)) setTournaments(list);
      }).catch(() => {});
    }
  }, [initialTournaments]);

  const sortedTournaments = useMemo(() => {
    const list = [...(tournaments || [])];
    if (sortMode === 'RECENT') {
      list.sort((a, b) => {
        const aDone = String(a.status || '').toUpperCase() === 'COMPLETED' ? 1 : 0;
        const bDone = String(b.status || '').toUpperCase() === 'COMPLETED' ? 1 : 0;
        if (aDone !== bDone) return bDone - aDone;
        return getTournamentSortTimestamp(b) - getTournamentSortTimestamp(a);
      });
    } else if (sortMode === 'OLDEST') {
      list.sort((a, b) => getTournamentSortTimestamp(a) - getTournamentSortTimestamp(b));
    } else {
      list.sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
    }
    return list;
  }, [tournaments, sortMode]);

  const filteredTournaments = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return sortedTournaments;
    return sortedTournaments.filter(t => {
      const yr = getTournamentYear(t).toLowerCase();
      const name = String(t.name || '').toLowerCase();
      const shortName = String(t.short_name || '').toLowerCase();
      return yr.includes(q) || name.includes(q) || shortName.includes(q);
    });
  }, [sortedTournaments, searchQuery]);

  const recentEnded = useMemo(() => {
    return sortedTournaments.slice(0, 6);
  }, [sortedTournaments]);

  const loadTournamentRecords = async (tid: string) => {
    if (!tid) return;
    setSelectedId(tid);
    setDropdownOpen(false);
    setLoading(true);
    try {
      const res: any = await adminApi.getTournamentRecords(tid);
      if (res && res.success) {
        setRecords(res);
      } else {
        showError('Load Failed', res?.message || 'Unable to load tournament records.');
      }
    } catch (err: any) {
      showError('Load Failed', err?.message || 'Unable to load tournament records.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!selectedId && sortedTournaments.length > 0) {
      loadTournamentRecords(sortedTournaments[0].id);
    }
  }, [sortedTournaments]);

  // ── Print / Save as PDF ───────────────────────────────────────────────────
  const handlePrintOrPdf = () => {
    if (!records) {
      showWarning('Select Tournament', 'Please select a tournament first.');
      return;
    }
    if (Platform.OS !== 'web' || typeof window === 'undefined') {
      showWarning('Web Print / PDF', 'PDF & Print export is available in the Web Admin Console.');
      return;
    }

    const t = records.tournament || {};
    const aw = records.awards || {};
    const ptRows = (records.points_table || []).map((r: any, idx: number) => `
      <tr>
        <td>${idx + 1}</td>
        <td><b>${escapeHtml(r.team_name || r.name || r.team_id)}</b></td>
        <td>${r.played ?? 0}</td>
        <td>${r.won ?? 0}</td>
        <td>${r.lost ?? 0}</td>
        <td>${r.tied ?? 0}</td>
        <td>${r.no_result ?? 0}</td>
        <td><b>${r.points ?? 0}</b></td>
        <td>${Number(r.nrr ?? 0).toFixed(3)}</td>
      </tr>
    `).join('');

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8" />
        <title>${escapeHtml(t.name)} - Official Tournament Records</title>
        <style>
          body { font-family: Arial, sans-serif; color: #0f172a; padding: 24px; max-width: 960px; margin: 0 auto; }
          .hdr { border-bottom: 3px solid #0f2452; padding-bottom: 12px; margin-bottom: 18px; display: flex; justify-content: space-between; align-items: center; }
          .hdr h1 { margin: 0; font-size: 20px; color: #0f2452; }
          .hdr p { margin: 4px 0 0; font-size: 12px; color: #64748b; }
          .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-bottom: 20px; }
          .card { border: 1px solid #cbd5e1; border-radius: 8px; padding: 10px 12px; background: #f8fafc; }
          .card .lbl { font-size: 11px; font-weight: bold; color: #64748b; text-transform: uppercase; }
          .card .val { font-size: 15px; font-weight: bold; color: #0f2452; margin-top: 4px; }
          .card .sub { font-size: 12px; color: #475569; margin-top: 2px; }
          table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 12px; }
          th, td { border: 1px solid #cbd5e1; padding: 7px 8px; text-align: left; }
          th { background: #0f2452; color: #fbbf24; }
          @media print { body { padding: 8px; } }
        </style>
      </head>
      <body>
        <div class="hdr">
          <div>
            <h1>CFVD • ${escapeHtml(t.name)} (${escapeHtml(t.season || '')})</h1>
            <p>Format: ${escapeHtml(t.tournament_type)} • Status: ${escapeHtml(t.status)} • Dates: ${escapeHtml(t.start_date || '-')} to ${escapeHtml(t.end_date || '-')}</p>
          </div>
          <div style="font-size:12px;color:#475569;">Generated ${new Date().toLocaleDateString()}</div>
        </div>
        <div class="grid">
          <div class="card"><div class="lbl">🏆 Winner</div><div class="val">${escapeHtml(records.winner?.name || 'TBD')}</div></div>
          <div class="card"><div class="lbl">🥈 Runner-Up</div><div class="val">${escapeHtml(records.runner_up?.name || 'TBD')}</div></div>
          <div class="card"><div class="lbl">⭐ Man of the Match (Final)</div><div class="val">${escapeHtml(records.man_of_the_match_final?.player_name || 'N/A')}</div><div class="sub">${escapeHtml(records.man_of_the_match_final?.team_name || '')}</div></div>
          <div class="card"><div class="lbl">👑 Man of the Tournament</div><div class="val">${escapeHtml(records.man_of_the_tournament?.player_name || 'N/A')}</div><div class="sub">${records.man_of_the_tournament ? `${records.man_of_the_tournament.runs || 0} Runs • ${records.man_of_the_tournament.wickets || 0} Wkts` : ''}</div></div>
          <div class="card"><div class="lbl">🏏 Most Runs</div><div class="val">${escapeHtml(aw.most_runs?.player_name || 'N/A')}</div><div class="sub">${aw.most_runs ? `${aw.most_runs.runs} Runs (Avg ${aw.most_runs.average})` : ''}</div></div>
          <div class="card"><div class="lbl">🎯 Most Wickets</div><div class="val">${escapeHtml(aw.most_wickets?.player_name || 'N/A')}</div><div class="sub">${aw.most_wickets ? `${aw.most_wickets.wickets} Wickets (Econ ${aw.most_wickets.economy})` : ''}</div></div>
          <div class="card"><div class="lbl">🧤 Most Catches</div><div class="val">${escapeHtml(aw.most_catches?.player_name || 'N/A')}</div><div class="sub">${aw.most_catches ? `${aw.most_catches.catches} Catches` : ''}</div></div>
          <div class="card"><div class="lbl">📈 Best Batting Average</div><div class="val">${escapeHtml(aw.best_batting_average?.player_name || 'N/A')}</div><div class="sub">${aw.best_batting_average ? `Avg ${aw.best_batting_average.average} (${aw.best_batting_average.runs} Runs)` : ''}</div></div>
          <div class="card"><div class="lbl">⚡ Best Bowling Economy</div><div class="val">${escapeHtml(aw.best_bowling_economy?.player_name || 'N/A')}</div><div class="sub">${aw.best_bowling_economy ? `Econ ${aw.best_bowling_economy.economy} (${aw.best_bowling_economy.overs} Ov)` : ''}</div></div>
          <div class="card"><div class="lbl">🔥 Best Batting / 🏆 Best Bowling</div><div class="val">${escapeHtml(aw.best_batting?.player_name || 'N/A')} (${escapeHtml(aw.best_batting?.score_display || '-')})</div><div class="sub">${escapeHtml(aw.best_bowling?.player_name || 'N/A')} (${escapeHtml(aw.best_bowling?.figures || '-')})</div></div>
        </div>
        <h3>📊 Points Table Records</h3>
        <table>
          <thead><tr><th>#</th><th>Team</th><th>P</th><th>W</th><th>L</th><th>T</th><th>NR</th><th>Pts</th><th>NRR</th></tr></thead>
          <tbody>${ptRows || '<tr><td colspan="9">No points table records available.</td></tr>'}</tbody>
        </table>
      </body>
      </html>
    `;

    const win = window.open('', '_blank', 'width=1024,height=768');
    if (!win) {
      showWarning('Popup Blocked', 'Please allow popups in your browser to Print / Save PDF.');
      return;
    }
    win.document.open();
    win.document.write(html);
    win.document.close();
    setTimeout(() => {
      win.focus();
      win.print();
    }, 350);
  };

  // ── Multi-Sheet Excel (.xls SpreadsheetML) Download ───────────────────────
  const handleDownloadExcel = () => {
    if (!records) {
      showWarning('Select Tournament', 'Please select a tournament first.');
      return;
    }
    if (Platform.OS !== 'web' || typeof window === 'undefined') {
      showWarning('Web Download', 'Excel download is available in the Web Admin Console.');
      return;
    }

    const buildSheet = (name: string, headers: string[], rows: (string | number)[][]) => {
      const hdrCells = headers.map(h => `<Cell><Data ss:Type="String">${escapeXml(h)}</Data></Cell>`).join('');
      const bodyRows = rows.map(r => {
        const cells = r.map(v => {
          const isNum = typeof v === 'number' && !Number.isNaN(v);
          return `<Cell><Data ss:Type="${isNum ? 'Number' : 'String'}">${escapeXml(v)}</Data></Cell>`;
        }).join('');
        return `<Row>${cells}</Row>`;
      }).join('');
      return `<Worksheet ss:Name="${escapeXml(name.slice(0, 31))}"><Table><Row>${hdrCells}</Row>${bodyRows}</Table></Worksheet>`;
    };

    const t = records.tournament || {};
    const aw = records.awards || {};
    const t10 = records.top_10 || {};

    const summarySheet = buildSheet(
      'Summary & Awards',
      ['Category', 'Winner / Player', 'Team', 'Stat / Details'],
      [
        ['Tournament', t.name || '', t.season || '', `${t.tournament_type || ''} (${t.status || ''})`],
        ['Winner', records.winner?.name || 'TBD', records.winner?.team_id || '', 'Champion'],
        ['Runner-Up', records.runner_up?.name || 'TBD', records.runner_up?.team_id || '', 'Runner-Up'],
        ['Man of the Match (Final)', records.man_of_the_match_final?.player_name || 'N/A', records.man_of_the_match_final?.team_name || '', 'Final Match'],
        ['Man of the Tournament', records.man_of_the_tournament?.player_name || 'N/A', records.man_of_the_tournament?.team_name || '', records.man_of_the_tournament ? `${records.man_of_the_tournament.runs || 0} Runs, ${records.man_of_the_tournament.wickets || 0} Wkts` : ''],
        ['Most Runs', aw.most_runs?.player_name || 'N/A', aw.most_runs?.team_name || '', aw.most_runs?.runs ?? 0],
        ['Most Wickets', aw.most_wickets?.player_name || 'N/A', aw.most_wickets?.team_name || '', aw.most_wickets?.wickets ?? 0],
        ['Most Catches', aw.most_catches?.player_name || 'N/A', aw.most_catches?.team_name || '', aw.most_catches?.catches ?? 0],
        ['Best Batting Average', aw.best_batting_average?.player_name || 'N/A', aw.best_batting_average?.team_name || '', aw.best_batting_average?.average ?? 0],
        ['Best Bowling Economy', aw.best_bowling_economy?.player_name || 'N/A', aw.best_bowling_economy?.team_name || '', aw.best_bowling_economy?.economy ?? 0],
        ['Best Batting', aw.best_batting?.player_name || 'N/A', aw.best_batting?.team_name || '', aw.best_batting?.score_display || '-'],
        ['Best Bowling', aw.best_bowling?.player_name || 'N/A', aw.best_bowling?.team_name || '', aw.best_bowling?.figures || '-']
      ]
    );

    const pointsSheet = buildSheet(
      'Points Table',
      ['Rank', 'Team', 'Played', 'Won', 'Lost', 'Tied', 'NR', 'Points', 'NRR'],
      (records.points_table || []).map((r: any, i: number) => [
        i + 1, r.team_name || r.name || r.team_id, r.played ?? 0, r.won ?? 0, r.lost ?? 0, r.tied ?? 0, r.no_result ?? 0, r.points ?? 0, Number(r.nrr ?? 0)
      ])
    );

    const runsSheet = buildSheet(
      'Top 10 Most Runs',
      ['Rank', 'Player', 'Team', 'Innings', 'Runs', 'Highest', 'Avg', 'Strike Rate'],
      (t10.most_runs || []).map((p: any, i: number) => [i + 1, p.player_name, p.team_name || '', p.innings ?? 0, p.runs ?? 0, p.highest_score ?? 0, p.average ?? 0, p.strike_rate ?? 0])
    );

    const wicketsSheet = buildSheet(
      'Top 10 Most Wickets',
      ['Rank', 'Player', 'Team', 'Innings', 'Overs', 'Wickets', 'Runs Conceded', 'Economy'],
      (t10.most_wickets || []).map((p: any, i: number) => [i + 1, p.player_name, p.team_name || '', p.innings ?? 0, p.overs || '0.0', p.wickets ?? 0, p.runs_conceded ?? 0, p.economy ?? 0])
    );

    const catchesSheet = buildSheet(
      'Top 10 Most Catches',
      ['Rank', 'Player', 'Team', 'Catches'],
      (t10.most_catches || []).map((p: any, i: number) => [i + 1, p.player_name, p.team_name || '', p.catches ?? 0])
    );

    const avgSheet = buildSheet(
      'Top 10 Best Bat Avg',
      ['Rank', 'Player', 'Team', 'Innings', 'Runs', 'Average', 'Strike Rate'],
      (t10.best_batting_average || []).map((p: any, i: number) => [i + 1, p.player_name, p.team_name || '', p.innings ?? 0, p.runs ?? 0, p.average ?? 0, p.strike_rate ?? 0])
    );

    const econSheet = buildSheet(
      'Top 10 Best Economy',
      ['Rank', 'Player', 'Team', 'Overs', 'Runs Conceded', 'Wickets', 'Economy'],
      (t10.best_bowling_economy || []).map((p: any, i: number) => [i + 1, p.player_name, p.team_name || '', p.overs || '0.0', p.runs_conceded ?? 0, p.wickets ?? 0, p.economy ?? 0])
    );

    const bestBatSheet = buildSheet(
      'Top 10 Best Batting',
      ['Rank', 'Player', 'Team', 'Score', 'Runs', 'Balls', '4s', '6s', 'Strike Rate'],
      (t10.best_batting || []).map((p: any, i: number) => [i + 1, p.player_name, p.team_name || '', p.score_display || `${p.runs}`, p.runs ?? 0, p.balls ?? 0, p.fours ?? 0, p.sixes ?? 0, p.strike_rate ?? 0])
    );

    const bestBowlSheet = buildSheet(
      'Top 10 Best Bowling',
      ['Rank', 'Player', 'Team', 'Figures', 'Wickets', 'Runs Conceded', 'Overs', 'Economy'],
      (t10.best_bowling || []).map((p: any, i: number) => [i + 1, p.player_name, p.team_name || '', p.figures || `${p.wickets}/${p.runs_conceded}`, p.wickets ?? 0, p.runs_conceded ?? 0, p.overs || '0.0', p.economy ?? 0])
    );

    const xml = `<?xml version="1.0"?><?mso-application progid="Excel.Sheet"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">${summarySheet}${pointsSheet}${runsSheet}${wicketsSheet}${catchesSheet}${avgSheet}${econSheet}${bestBatSheet}${bestBowlSheet}</Workbook>`;

    const blob = new Blob([xml], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${String(t.short_name || t.id || 'tournament').replace(/[^a-zA-Z0-9_-]/g, '_')}_records.xls`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showSuccess('Excel Exported', 'Multi-sheet Excel workbook (.xls) downloaded!');
  };

  // ── Import Records Handler ────────────────────────────────────────────────
  const openImportModal = () => {
    setImpWinner(records?.winner?.name && records.winner.name !== 'TBD' ? records.winner.name : '');
    setImpRunner(records?.runner_up?.name && records.runner_up.name !== 'TBD' ? records.runner_up.name : '');
    setImpMotmFinal(records?.man_of_the_match_final?.player_name || '');
    setImpMott(records?.man_of_the_tournament?.player_name || '');
    setImpJson('');
    setImportVisible(true);
  };

  const handleImportSubmit = async () => {
    if (!selectedId) return;
    setImporting(true);
    try {
      let payload: any = {};
      if (impJson.trim()) {
        payload = JSON.parse(impJson.trim());
      }
      if (impWinner.trim()) payload.winner = { ...(payload.winner || {}), name: impWinner.trim() };
      if (impRunner.trim()) payload.runner_up = { ...(payload.runner_up || {}), name: impRunner.trim() };
      if (impMotmFinal.trim()) payload.man_of_the_match_final = { ...(payload.man_of_the_match_final || {}), player_name: impMotmFinal.trim() };
      if (impMott.trim()) payload.man_of_the_tournament = { ...(payload.man_of_the_tournament || {}), player_name: impMott.trim() };

      const res: any = await adminApi.importTournamentRecords(selectedId, payload);
      if (res && res.success) {
        setRecords(res);
        setImportVisible(false);
        showSuccess('Records Imported', 'Official tournament records saved successfully.');
      } else {
        showError('Import Failed', res?.message || 'Unable to import records.');
      }
    } catch (err: any) {
      showError('Invalid Input', err?.message || 'Please check your JSON or fields.');
    } finally {
      setImporting(false);
    }
  };

  const activeTop10Rows = records?.top_10?.[activeTop10] || [];

  return (
    <View style={s.container}>
      {/* Search Bar + Year Dropdown + Sort Controls */}
      <View style={s.controlCard}>
        <Text style={s.sectionHeading}>🔍 Search Tournament by Year or Name</Text>
        <View style={[s.searchRow, isMobile && { flexDirection: 'column', alignItems: 'stretch' }]}>
          <View style={{ flex: 1, minWidth: 0, position: 'relative', zIndex: 50 }}>
            <TextInput
              value={searchQuery}
              onChangeText={(txt) => {
                setSearchQuery(txt);
                setDropdownOpen(true);
              }}
              onFocus={() => setDropdownOpen(true)}
              placeholder="Type year (e.g. 2026) or tournament name..."
              placeholderTextColor="#94a3b8"
              style={s.searchInput}
            />
            {dropdownOpen && (
              <View style={s.dropdownList}>
                <View style={s.dropdownHeader}>
                  <Text style={s.dropdownHeaderText}>
                    {filteredTournaments.length} matching tournament(s)
                  </Text>
                  <TouchableOpacity onPress={() => setDropdownOpen(false)}>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: '#b45309' }}>Close ✕</Text>
                  </TouchableOpacity>
                </View>
                <ScrollView style={{ maxHeight: 220 }} nestedScrollEnabled>
                  {filteredTournaments.length === 0 ? (
                    <Text style={{ padding: 12, fontSize: 12, color: '#64748b' }}>
                      No tournaments found for &quot;{searchQuery}&quot;.
                    </Text>
                  ) : (
                    filteredTournaments.map((t) => (
                      <TouchableOpacity
                        key={t.id}
                        onPress={() => loadTournamentRecords(t.id)}
                        style={[s.dropdownItem, selectedId === t.id && s.dropdownItemActive]}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={s.dropdownTitle}>{t.name}</Text>
                          <Text style={s.dropdownSub}>
                            Year: {getTournamentYear(t)} • {t.tournament_type} • {t.status}
                          </Text>
                        </View>
                        <Text style={{ fontSize: 11, fontWeight: '800', color: '#0f2452' }}>Select →</Text>
                      </TouchableOpacity>
                    ))
                  )}
                </ScrollView>
              </View>
            )}
          </View>

          {/* Sort List Controls */}
          <View style={s.sortRow}>
            {(
              [
                ['RECENT', 'Recent → Old'],
                ['OLDEST', 'Old → Recent'],
                ['NAME_ASC', 'Name A–Z']
              ] as [SortMode, string][]
            ).map(([mode, label]) => (
              <TouchableOpacity
                key={mode}
                onPress={() => setSortMode(mode)}
                style={[s.sortChip, sortMode === mode && s.sortChipActive]}
              >
                <Text style={[s.sortChipText, sortMode === mode && s.sortChipTextActive]}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Recent Tournaments Quick Strip (Recent to Old) */}
        <Text style={s.recentLabel}>🕒 Recent &amp; Ended Tournaments (Recent → Old):</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
          {recentEnded.map((t) => (
            <TouchableOpacity
              key={t.id}
              onPress={() => loadTournamentRecords(t.id)}
              style={[s.recentPill, selectedId === t.id && s.recentPillActive]}
            >
              <Text style={[s.recentPillText, selectedId === t.id && s.recentPillTextActive]}>
                {t.name} ({getTournamentYear(t)})
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Action Toolbar: PDF, Excel, Print, Import */}
      {records && (
        <View style={s.toolbarCard}>
          <View style={{ flex: 1, minWidth: 200 }}>
            <Text style={s.selectedTitle}>🏆 {records.tournament?.name}</Text>
            <Text style={s.selectedMeta}>
              Season {records.tournament?.season} • {records.tournament?.tournament_type} • {records.tournament?.status}
            </Text>
          </View>
          <View style={s.actionBtnRow}>
            <TouchableOpacity style={s.pdfBtn} onPress={handlePrintOrPdf}>
              <Text style={s.pdfBtnText}>📄 Download PDF</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.excelBtn} onPress={handleDownloadExcel}>
              <Text style={s.excelBtnText}>📊 Download Excel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.printBtn} onPress={handlePrintOrPdf}>
              <Text style={s.printBtnText}>🖨️ Print</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.importBtn} onPress={openImportModal}>
              <Text style={s.importBtnText}>📥 Import Records</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Sub-Tabs: Summary & Points Table vs Top 10 Leaderboards */}
      <View style={s.subTabRow}>
        <TouchableOpacity
          onPress={() => setSubTab('summary')}
          style={[s.subTabBtn, subTab === 'summary' && s.subTabBtnActive]}
        >
          <Text style={[s.subTabText, subTab === 'summary' && s.subTabTextActive]}>
            🏅 Awards &amp; Points Table (PDF/Print)
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setSubTab('top10')}
          style={[s.subTabBtn, subTab === 'top10' && s.subTabBtnActive]}
        >
          <Text style={[s.subTabText, subTab === 'top10' && s.subTabTextActive]}>
            📊 Top 10 Leaderboards (Excel)
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={{ padding: 40, alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#d97706" />
          <Text style={{ marginTop: 10, color: '#64748b', fontWeight: '600' }}>Loading tournament records...</Text>
        </View>
      ) : !records ? (
        <View style={s.emptyBox}>
          <Text style={{ fontSize: 15, fontWeight: '700', color: '#475569' }}>
            Select a tournament from the search box or recent list to view records.
          </Text>
        </View>
      ) : subTab === 'summary' ? (
        <View style={{ gap: 14 }}>
          {/* Winner & Runner-Up Banner */}
          <View style={[s.awardsGrid, isMobile && { flexDirection: 'column' }]}>
            <View style={[s.awardCard, { borderColor: '#f59e0b', backgroundColor: '#fffbeb' }]}>
              <Text style={s.awardLabel}>🏆 TOURNAMENT WINNER</Text>
              <Text style={s.awardValue}>{records.winner?.name || 'TBD'}</Text>
            </View>
            <View style={[s.awardCard, { borderColor: '#94a3b8', backgroundColor: '#f8fafc' }]}>
              <Text style={s.awardLabel}>🥈 RUNNER-UP</Text>
              <Text style={s.awardValue}>{records.runner_up?.name || 'TBD'}</Text>
            </View>
          </View>

          {/* Official Awards Grid */}
          <View style={s.awardsGrid}>
            {[
              ['⭐ Man of the Match (Final)', records.man_of_the_match_final?.player_name || 'N/A', records.man_of_the_match_final?.team_name || 'Final Match'],
              ['👑 Man of the Tournament', records.man_of_the_tournament?.player_name || 'N/A', records.man_of_the_tournament ? `${records.man_of_the_tournament.runs || 0} Runs • ${records.man_of_the_tournament.wickets || 0} Wkts` : ''],
              ['🏏 Most Runs', records.awards?.most_runs?.player_name || 'N/A', records.awards?.most_runs ? `${records.awards.most_runs.runs} Runs (Avg ${records.awards.most_runs.average})` : ''],
              ['🎯 Most Wickets', records.awards?.most_wickets?.player_name || 'N/A', records.awards?.most_wickets ? `${records.awards.most_wickets.wickets} Wickets (Econ ${records.awards.most_wickets.economy})` : ''],
              ['🧤 Most Catches', records.awards?.most_catches?.player_name || 'N/A', records.awards?.most_catches ? `${records.awards.most_catches.catches} Catches` : ''],
              ['📈 Best Batting Average', records.awards?.best_batting_average?.player_name || 'N/A', records.awards?.best_batting_average ? `Avg ${records.awards.best_batting_average.average}` : ''],
              ['⚡ Best Bowling Economy', records.awards?.best_bowling_economy?.player_name || 'N/A', records.awards?.best_bowling_economy ? `Econ ${records.awards.best_bowling_economy.economy}` : ''],
              ['🔥 Best Batting', records.awards?.best_batting?.player_name || 'N/A', records.awards?.best_batting?.score_display || ''],
              ['🏆 Best Bowling', records.awards?.best_bowling?.player_name || 'N/A', records.awards?.best_bowling?.figures || '']
            ].map(([lbl, val, sub]) => (
              <View key={lbl} style={[s.awardCard, isMobile && { minWidth: '100%' }]}>
                <Text style={s.awardLabel}>{lbl}</Text>
                <Text style={s.awardValue}>{val}</Text>
                {Boolean(sub) && <Text style={s.awardSub}>{sub}</Text>}
              </View>
            ))}
          </View>

          {/* Points Table Records */}
          <View style={s.tableCard}>
            <Text style={s.sectionHeading}>📊 Points Table Records</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator>
              <View style={{ minWidth: isMobile ? 600 : 760, width: '100%' }}>
                <View style={s.tableHeader}>
                  <Text style={[s.th, { width: 36 }]}>#</Text>
                  <Text style={[s.th, { flex: 2 }]}>Team</Text>
                  <Text style={[s.th, { width: 46, textAlign: 'center' }]}>P</Text>
                  <Text style={[s.th, { width: 46, textAlign: 'center' }]}>W</Text>
                  <Text style={[s.th, { width: 46, textAlign: 'center' }]}>L</Text>
                  <Text style={[s.th, { width: 46, textAlign: 'center' }]}>T</Text>
                  <Text style={[s.th, { width: 46, textAlign: 'center' }]}>NR</Text>
                  <Text style={[s.th, { width: 56, textAlign: 'center' }]}>Pts</Text>
                  <Text style={[s.th, { width: 76, textAlign: 'right' }]}>NRR</Text>
                </View>
                {(records.points_table || []).length === 0 ? (
                  <Text style={{ padding: 14, color: '#64748b', fontSize: 12 }}>No points table records available.</Text>
                ) : (
                  (records.points_table || []).map((r: any, i: number) => (
                    <View key={r.team_id || i} style={s.tableRow}>
                      <Text style={[s.td, { width: 36, fontWeight: '800' }]}>{i + 1}</Text>
                      <Text style={[s.td, { flex: 2, fontWeight: '700' }]}>{r.team_name || r.name || r.team_id}</Text>
                      <Text style={[s.td, { width: 46, textAlign: 'center' }]}>{r.played ?? 0}</Text>
                      <Text style={[s.td, { width: 46, textAlign: 'center' }]}>{r.won ?? 0}</Text>
                      <Text style={[s.td, { width: 46, textAlign: 'center' }]}>{r.lost ?? 0}</Text>
                      <Text style={[s.td, { width: 46, textAlign: 'center' }]}>{r.tied ?? 0}</Text>
                      <Text style={[s.td, { width: 46, textAlign: 'center' }]}>{r.no_result ?? 0}</Text>
                      <Text style={[s.td, { width: 56, textAlign: 'center', fontWeight: '900', color: '#b45309' }]}>{r.points ?? 0}</Text>
                      <Text style={[s.td, { width: 76, textAlign: 'right' }]}>{Number(r.nrr ?? 0).toFixed(3)}</Text>
                    </View>
                  ))
                )}
              </View>
            </ScrollView>
          </View>
        </View>
      ) : (
        /* Tab 2: Top 10 Leaderboards */
        <View style={s.tableCard}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 10 }}>
            <Text style={s.sectionHeading}>📊 Top 10 Tournament Leaderboards</Text>
            <TouchableOpacity style={s.excelBtn} onPress={handleDownloadExcel}>
              <Text style={s.excelBtnText}>📊 Export Top 10 Excel (.xls)</Text>
            </TouchableOpacity>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 10 }}>
            {TOP10_CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat.key}
                onPress={() => setActiveTop10(cat.key)}
                style={[s.sortChip, activeTop10 === cat.key && s.sortChipActive]}
              >
                <Text style={[s.sortChipText, activeTop10 === cat.key && s.sortChipTextActive]}>
                  {cat.icon} {cat.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <ScrollView horizontal showsHorizontalScrollIndicator>
            <View style={{ minWidth: isMobile ? 540 : 720, width: '100%' }}>
              <View style={s.tableHeader}>
                <Text style={[s.th, { width: 42 }]}>Rank</Text>
                <Text style={[s.th, { flex: 2 }]}>Player</Text>
                <Text style={[s.th, { flex: 1.4 }]}>Team</Text>
                <Text style={[s.th, { flex: 1, textAlign: 'right' }]}>Primary Stat</Text>
                <Text style={[s.th, { flex: 1, textAlign: 'right' }]}>Secondary</Text>
              </View>
              {activeTop10Rows.length === 0 ? (
                <Text style={{ padding: 14, color: '#64748b', fontSize: 12 }}>
                  No Top 10 records recorded yet for this category.
                </Text>
              ) : (
                activeTop10Rows.map((p: any, idx: number) => {
                  let primary = '';
                  let secondary = '';
                  if (activeTop10 === 'most_runs') {
                    primary = `${p.runs ?? 0} Runs`;
                    secondary = `Avg ${p.average ?? 0} • SR ${p.strike_rate ?? 0}`;
                  } else if (activeTop10 === 'most_wickets') {
                    primary = `${p.wickets ?? 0} Wkts`;
                    secondary = `Econ ${p.economy ?? 0} • ${p.overs || '0.0'} Ov`;
                  } else if (activeTop10 === 'most_catches') {
                    primary = `${p.catches ?? 0} Catches`;
                    secondary = 'Fielding';
                  } else if (activeTop10 === 'best_batting_average') {
                    primary = `Avg ${p.average ?? 0}`;
                    secondary = `${p.runs ?? 0} Runs (${p.innings ?? 0} Inn)`;
                  } else if (activeTop10 === 'best_bowling_economy') {
                    primary = `Econ ${p.economy ?? 0}`;
                    secondary = `${p.wickets ?? 0} Wkts (${p.overs || '0.0'} Ov)`;
                  } else if (activeTop10 === 'best_batting') {
                    primary = p.score_display || `${p.runs ?? 0}`;
                    secondary = `SR ${p.strike_rate ?? 0}`;
                  } else if (activeTop10 === 'best_bowling') {
                    primary = p.figures || `${p.wickets ?? 0}/${p.runs_conceded ?? 0}`;
                    secondary = `Econ ${p.economy ?? 0}`;
                  }
                  return (
                    <View key={`${p.player_id || p.player_name}-${idx}`} style={s.tableRow}>
                      <Text style={[s.td, { width: 42, fontWeight: '800' }]}>#{idx + 1}</Text>
                      <Text style={[s.td, { flex: 2, fontWeight: '700' }]}>{p.player_name}</Text>
                      <Text style={[s.td, { flex: 1.4, color: '#475569' }]}>{p.team_name || '—'}</Text>
                      <Text style={[s.td, { flex: 1, textAlign: 'right', fontWeight: '800', color: '#b45309' }]}>{primary}</Text>
                      <Text style={[s.td, { flex: 1, textAlign: 'right', color: '#475569' }]}>{secondary}</Text>
                    </View>
                  );
                })
              )}
            </View>
          </ScrollView>
        </View>
      )}

      {/* Import Tournament Records Modal */}
      <Modal visible={importVisible} transparent animationType="fade" onRequestClose={() => setImportVisible(false)}>
        <View style={s.modalBackdrop}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>📥 Import / Update Tournament Records</Text>
            <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
              <Text style={s.fieldLabel}>Winner Team Name</Text>
              <TextInput value={impWinner} onChangeText={setImpWinner} placeholder="e.g. Virudhunagar Strikers" style={s.modalInput} />

              <Text style={s.fieldLabel}>Runner-Up Team Name</Text>
              <TextInput value={impRunner} onChangeText={setImpRunner} placeholder="e.g. Sattur Spartans" style={s.modalInput} />

              <Text style={s.fieldLabel}>Man of the Match (Final)</Text>
              <TextInput value={impMotmFinal} onChangeText={setImpMotmFinal} placeholder="Player name" style={s.modalInput} />

              <Text style={s.fieldLabel}>Man of the Tournament</Text>
              <TextInput value={impMott} onChangeText={setImpMott} placeholder="Player name" style={s.modalInput} />

              <Text style={s.fieldLabel}>Optional Full JSON Import (awards, points_table, top_10)</Text>
              <TextInput
                value={impJson}
                onChangeText={setImpJson}
                multiline
                numberOfLines={4}
                placeholder='{"awards": {...}, "top_10": {...}}'
                style={[s.modalInput, { height: 90, textAlignVertical: 'top' }]}
              />
            </ScrollView>
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 14 }}>
              <TouchableOpacity onPress={() => setImportVisible(false)} style={s.cancelBtn}>
                <Text style={{ fontWeight: '700', color: '#475569' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleImportSubmit} disabled={importing} style={s.saveBtn}>
                <Text style={{ fontWeight: '800', color: '#ffffff' }}>
                  {importing ? 'Importing...' : 'Save & Import'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const s = StyleSheet.create({
  container: { gap: 14, width: '100%' },
  controlCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    zIndex: 50
  },
  sectionHeading: { fontSize: 15, fontWeight: '800', color: '#0f172a', marginBottom: 10 },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 10, zIndex: 50 },
  searchInput: {
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 13.5,
    color: '#0f172a',
    backgroundColor: '#f8fafc'
  },
  dropdownList: {
    position: 'absolute',
    top: 46,
    left: 0,
    right: 0,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#f59e0b',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.14,
    shadowRadius: 16,
    elevation: 8,
    zIndex: 100
  },
  dropdownHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    backgroundColor: '#fffbeb'
  },
  dropdownHeaderText: { fontSize: 11.5, fontWeight: '700', color: '#92400e' },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9'
  },
  dropdownItemActive: { backgroundColor: '#fef3c7' },
  dropdownTitle: { fontSize: 13, fontWeight: '800', color: '#0f172a' },
  dropdownSub: { fontSize: 11.5, color: '#64748b', marginTop: 2 },
  sortRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  sortChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#f8fafc'
  },
  sortChipActive: { backgroundColor: '#0f2452', borderColor: '#d4af37' },
  sortChipText: { fontSize: 12, fontWeight: '700', color: '#475569' },
  sortChipTextActive: { color: '#fbbf24' },
  recentLabel: { fontSize: 12, fontWeight: '700', color: '#475569', marginTop: 12, marginBottom: 4 },
  recentPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#cbd5e1'
  },
  recentPillActive: { backgroundColor: '#fef3c7', borderColor: '#d97706' },
  recentPillText: { fontSize: 12, fontWeight: '700', color: '#334155' },
  recentPillTextActive: { color: '#92400e' },
  toolbarCard: {
    backgroundColor: '#0f2452',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#d4af37',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 12
  },
  selectedTitle: { fontSize: 16, fontWeight: '900', color: '#ffffff' },
  selectedMeta: { fontSize: 12, color: '#cbd5e1', marginTop: 2 },
  actionBtnRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  pdfBtn: { backgroundColor: '#dc2626', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  pdfBtnText: { color: '#ffffff', fontWeight: '800', fontSize: 12 },
  excelBtn: { backgroundColor: '#059669', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  excelBtnText: { color: '#ffffff', fontWeight: '800', fontSize: 12 },
  printBtn: { backgroundColor: '#ffffff', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  printBtnText: { color: '#0f2452', fontWeight: '800', fontSize: 12 },
  importBtn: { backgroundColor: '#d97706', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  importBtnText: { color: '#ffffff', fontWeight: '800', fontSize: 12 },
  subTabRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  subTabBtn: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1'
  },
  subTabBtnActive: { backgroundColor: '#fef3c7', borderColor: '#d97706' },
  subTabText: { fontSize: 13, fontWeight: '700', color: '#475569' },
  subTabTextActive: { color: '#92400e', fontWeight: '800' },
  awardsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  awardCard: {
    flex: 1,
    minWidth: 210,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0'
  },
  awardLabel: { fontSize: 11, fontWeight: '800', color: '#64748b', textTransform: 'uppercase' },
  awardValue: { fontSize: 15, fontWeight: '900', color: '#0f2452', marginTop: 4 },
  awardSub: { fontSize: 12, color: '#475569', marginTop: 2 },
  tableCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0'
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#0f2452',
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderRadius: 8
  },
  th: { fontSize: 11.5, fontWeight: '800', color: '#fbbf24' },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    alignItems: 'center'
  },
  td: { fontSize: 12.5, color: '#0f172a' },
  emptyBox: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 28,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0'
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16
  },
  modalCard: {
    width: '100%',
    maxWidth: 480,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1.5,
    borderColor: '#d4af37'
  },
  modalTitle: { fontSize: 16, fontWeight: '900', color: '#0f2452', marginBottom: 12 },
  fieldLabel: { fontSize: 12, fontWeight: '700', color: '#334155', marginTop: 8, marginBottom: 4 },
  modalInput: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    color: '#0f172a',
    backgroundColor: '#f8fafc'
  },
  cancelBtn: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 8, backgroundColor: '#f1f5f9' },
  saveBtn: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 8, backgroundColor: '#d97706' }
});

export default TournamentRecordsPanel;
