import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet
} from 'react-native';

interface CalendarPickerModalProps {
  visible: boolean;
  value?: string; // DD/MM/YYYY
  initialDate?: string; // YYYY-MM-DD or DD/MM/YYYY
  title?: string;
  maxDate?: Date;
  minDate?: string | Date;
  showToday?: boolean;
  onSelect?: (ddmmyyyy: string) => void;
  onSelectDate?: (date: string) => void;
  onClose: () => void;
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function parseDDMMYYYY(str: string): Date | null {
  const m = String(str || '').match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatDDMMYYYY(d: Date): string {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

export const CalendarPickerModal: React.FC<CalendarPickerModalProps> = ({
  visible,
  value = '',
  initialDate,
  title = 'Select Date',
  maxDate,
  showToday = true,
  onSelect,
  onSelectDate,
  onClose
}) => {
  const effectiveValue = value || initialDate || '';
  const handlePick = (ddmmyyyy: string) => {
    if (onSelect) onSelect(ddmmyyyy);
    if (onSelectDate) onSelectDate(ddmmyyyy);
  };
  const maxDateTs = maxDate ? maxDate.getTime() : null;
  const today = useMemo(() => {
    const d = maxDateTs !== null ? new Date(maxDateTs) : new Date();
    d.setHours(23, 59, 59, 999);
    return d;
  }, [maxDateTs]);

  const parsedInitial = useMemo(() => parseDDMMYYYY(effectiveValue) || new Date(2004, 0, 1), [effectiveValue]);
  const [viewYear, setViewYear] = useState<number>(parsedInitial.getFullYear());
  const [viewMonth, setViewMonth] = useState<number>(parsedInitial.getMonth());
  const [mode, setMode] = useState<'DAY' | 'YEAR' | 'MONTH'>('DAY');
  const wasVisibleRef = useRef<boolean>(false);

  useEffect(() => {
    if (visible && !wasVisibleRef.current) {
      const p = parseDDMMYYYY(effectiveValue);
      if (p) {
        setViewYear(p.getFullYear());
        setViewMonth(p.getMonth());
      } else {
        setViewYear(today.getFullYear() - 18);
        setViewMonth(0);
      }
      setMode('DAY');
    }
    wasVisibleRef.current = visible;
  }, [visible, effectiveValue, today]);

  const yearsList = useMemo(() => {
    const maxY = today.getFullYear();
    const list: number[] = [];
    for (let y = maxY; y >= 1950; y--) {
      list.push(y);
    }
    return list;
  }, [today]);

  const calendarCells = useMemo(() => {
    const firstDay = new Date(viewYear, viewMonth, 1).getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const cells: (number | null)[] = [];
    for (let i = 0; i < firstDay; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [viewYear, viewMonth]);

  const selectedDateObj = useMemo(() => parseDDMMYYYY(effectiveValue), [effectiveValue]);

  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewYear((y) => Math.max(1950, y - 1));
      setViewMonth(11);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    const nextMonth = viewMonth === 11 ? 0 : viewMonth + 1;
    const nextYear = viewMonth === 11 ? viewYear + 1 : viewYear;
    if (new Date(nextYear, nextMonth, 1) > today) return;
    setViewYear(nextYear);
    setViewMonth(nextMonth);
  };

  const canGoNextMonth =
    new Date(viewMonth === 11 ? viewYear + 1 : viewYear, viewMonth === 11 ? 0 : viewMonth + 1, 1) <= today;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          {/* Navy & Gold Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.headerTitle}>📅 {title}</Text>
              <Text style={styles.headerSub}>
                {selectedDateObj ? formatDDMMYYYY(selectedDateObj) : 'Select a valid past/today date'}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Month / Year Switcher Bar */}
          <View style={styles.navBar}>
            <TouchableOpacity onPress={handlePrevMonth} style={styles.navArrow}>
              <Text style={styles.navArrowText}>‹</Text>
            </TouchableOpacity>

            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
              <TouchableOpacity
                onPress={() => setMode(mode === 'MONTH' ? 'DAY' : 'MONTH')}
                style={[styles.pillBtn, mode === 'MONTH' && styles.pillBtnActive]}
              >
                <Text style={[styles.pillText, mode === 'MONTH' && styles.pillTextActive]}>
                  {MONTHS[viewMonth]} ▾
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setMode(mode === 'YEAR' ? 'DAY' : 'YEAR')}
                style={[styles.pillBtn, mode === 'YEAR' && styles.pillBtnActive]}
              >
                <Text style={[styles.pillText, mode === 'YEAR' && styles.pillTextActive]}>
                  {viewYear} ▾
                </Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              onPress={handleNextMonth}
              disabled={!canGoNextMonth}
              style={[styles.navArrow, !canGoNextMonth && { opacity: 0.35 }]}
            >
              <Text style={styles.navArrowText}>›</Text>
            </TouchableOpacity>
          </View>

          {/* Body */}
          {mode === 'YEAR' ? (
            <ScrollView style={{ maxHeight: 250 }} contentContainerStyle={styles.gridWrap}>
              {yearsList.map((y) => {
                const active = y === viewYear;
                return (
                  <TouchableOpacity
                    key={y}
                    onPress={() => {
                      setViewYear(y);
                      if (new Date(y, viewMonth, 1) > today) {
                        setViewMonth(today.getMonth());
                      }
                      setMode('DAY');
                    }}
                    style={[styles.yearCell, active && styles.activeCell]}
                  >
                    <Text style={[styles.yearText, active && styles.activeCellText]}>{y}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          ) : mode === 'MONTH' ? (
            <View style={styles.gridWrap}>
              {MONTHS.map((mName, idx) => {
                const isFuture = new Date(viewYear, idx, 1) > today;
                const active = idx === viewMonth;
                return (
                  <TouchableOpacity
                    key={mName}
                    disabled={isFuture}
                    onPress={() => {
                      setViewMonth(idx);
                      setMode('DAY');
                    }}
                    style={[styles.monthCell, active && styles.activeCell, isFuture && { opacity: 0.3 }]}
                  >
                    <Text style={[styles.yearText, active && styles.activeCellText]}>
                      {mName.slice(0, 3)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : (
            <View style={{ padding: 12 }}>
              <View style={styles.weekRow}>
                {WEEKDAYS.map((w) => (
                  <Text key={w} style={styles.weekText}>{w}</Text>
                ))}
              </View>
              <View style={styles.daysGrid}>
                {calendarCells.map((day, idx) => {
                  if (!day) {
                    return <View key={`empty-${idx}`} style={styles.dayCell} />;
                  }
                  const candidate = new Date(viewYear, viewMonth, day);
                  const isFuture = candidate > today;
                  const isSelected =
                    selectedDateObj &&
                    selectedDateObj.getDate() === day &&
                    selectedDateObj.getMonth() === viewMonth &&
                    selectedDateObj.getFullYear() === viewYear;
                  return (
                    <TouchableOpacity
                      key={`day-${day}`}
                      disabled={isFuture}
                      onPress={() => {
                        handlePick(formatDDMMYYYY(candidate));
                        onClose();
                      }}
                      style={[
                        styles.dayCell,
                        isSelected && styles.dayCellSelected,
                        isFuture && styles.dayCellDisabled
                      ]}
                    >
                      <Text
                        style={[
                          styles.dayText,
                          isSelected && styles.dayTextSelected,
                          isFuture && styles.dayTextDisabled
                        ]}
                      >
                        {day}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          {/* Footer */}
          <View style={[styles.footer, !(showToday && new Date() <= today) && { justifyContent: 'flex-end' }]}>
            {showToday && new Date() <= today ? (
              <TouchableOpacity
                onPress={() => {
                  const now = new Date();
                  handlePick(formatDDMMYYYY(now));
                  onClose();
                }}
                style={styles.todayBtn}
              >
                <Text style={styles.todayBtnText}>Today</Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity onPress={onClose} style={styles.cancelBtn}>
              <Text style={styles.cancelBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: '#f59e0b',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8
  },
  header: {
    backgroundColor: '#0f2452',
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 2,
    borderBottomColor: '#f59e0b'
  },
  headerTitle: {
    color: '#facc15',
    fontSize: 14,
    fontWeight: '900'
  },
  headerSub: {
    color: '#e2e8f0',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center'
  },
  closeText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800'
  },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#f8fafc',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0'
  },
  navArrow: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    alignItems: 'center',
    justifyContent: 'center'
  },
  navArrowText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f2452'
  },
  pillBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1'
  },
  pillBtnActive: {
    backgroundColor: '#0f2452',
    borderColor: '#f59e0b'
  },
  pillText: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#0f172a'
  },
  pillTextActive: {
    color: '#facc15'
  },
  gridWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 12,
    gap: 8,
    justifyContent: 'center'
  },
  yearCell: {
    width: '22%',
    paddingVertical: 9,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
    alignItems: 'center'
  },
  monthCell: {
    width: '30%',
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
    alignItems: 'center'
  },
  activeCell: {
    backgroundColor: '#0f2452',
    borderColor: '#f59e0b'
  },
  yearText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#1e293b'
  },
  activeCellText: {
    color: '#facc15',
    fontWeight: '900'
  },
  weekRow: {
    flexDirection: 'row',
    marginBottom: 6
  },
  weekText: {
    width: '14.28%',
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '800',
    color: '#64748b'
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap'
  },
  dayCell: {
    width: '14.28%',
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8
  },
  dayCellSelected: {
    backgroundColor: '#0f2452',
    borderWidth: 1.5,
    borderColor: '#f59e0b'
  },
  dayCellDisabled: {
    opacity: 0.25
  },
  dayText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a'
  },
  dayTextSelected: {
    color: '#facc15',
    fontWeight: '900'
  },
  dayTextDisabled: {
    color: '#94a3b8'
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    backgroundColor: '#f8fafc'
  },
  todayBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: '#fef3c7',
    borderWidth: 1,
    borderColor: '#f59e0b'
  },
  todayBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#92400e'
  },
  cancelBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1'
  },
  cancelBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569'
  }
});

export default CalendarPickerModal;
