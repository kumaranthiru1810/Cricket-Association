import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet
} from 'react-native';

export interface CalendarPickerModalProps {
  visible: boolean;
  title?: string;
  initialDate?: string; // YYYY-MM-DD
  minDate?: string;     // YYYY-MM-DD (e.g. Today - prevents selecting past dates)
  onClose: () => void;
  onSelectDate: (dateStr: string) => void;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const WEEK_DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

export const CalendarPickerModal: React.FC<CalendarPickerModalProps> = ({
  visible,
  title = 'Select Match Date',
  initialDate,
  minDate,
  onClose,
  onSelectDate
}) => {
  // Parse initial date
  const parsedInitial = useMemo(() => {
    if (initialDate && /^\d{4}-\d{2}-\d{2}$/.test(initialDate)) {
      const parts = initialDate.split('-').map(Number);
      return new Date(parts[0], parts[1] - 1, parts[2]);
    }
    return new Date();
  }, [initialDate]);

  const [currentYear, setCurrentYear] = useState<number>(parsedInitial.getFullYear());
  const [currentMonth, setCurrentMonth] = useState<number>(parsedInitial.getMonth());

  // Today in YYYY-MM-DD
  const todayStr = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }, []);

  const effectiveMinDate = minDate || todayStr;

  // Check if previous month navigation should be disabled
  const canGoPrevMonth = useMemo(() => {
    if (!effectiveMinDate) return true;
    const [minY, minM] = effectiveMinDate.split('-').map(Number);
    if (currentYear < minY) return false;
    if (currentYear === minY && currentMonth <= (minM - 1)) return false;
    return true;
  }, [currentYear, currentMonth, effectiveMinDate]);

  const handlePrevMonth = () => {
    if (!canGoPrevMonth) return;
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(y => y - 1);
    } else {
      setCurrentMonth(m => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(y => y + 1);
    } else {
      setCurrentMonth(m => m + 1);
    }
  };

  // Generate calendar grid
  const daysGrid = useMemo(() => {
    const firstDayOfWeek = new Date(currentYear, currentMonth, 1).getDay();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

    const grid: Array<{ day: number | null; dateStr: string; isPast: boolean; isToday: boolean; isSelected: boolean }> = [];

    // Blank cells before first day
    for (let i = 0; i < firstDayOfWeek; i++) {
      grid.push({ day: null, dateStr: '', isPast: true, isToday: false, isSelected: false });
    }

    // Days in current month
    for (let d = 1; d <= daysInMonth; d++) {
      const monthPadded = String(currentMonth + 1).padStart(2, '0');
      const dayPadded = String(d).padStart(2, '0');
      const dateStr = `${currentYear}-${monthPadded}-${dayPadded}`;

      const isPast = effectiveMinDate ? dateStr < effectiveMinDate : false;
      const isToday = dateStr === todayStr;
      const isSelected = dateStr === initialDate;

      grid.push({
        day: d,
        dateStr,
        isPast,
        isToday,
        isSelected
      });
    }

    return grid;
  }, [currentYear, currentMonth, effectiveMinDate, todayStr, initialDate]);

  const handleSelectDay = (dateStr: string, isPast: boolean) => {
    if (isPast) return;
    onSelectDate(dateStr);
    onClose();
  };

  const handleSelectToday = () => {
    onSelectDate(todayStr);
    onClose();
  };

  const handleSelectTomorrow = () => {
    const tm = new Date();
    tm.setDate(tm.getDate() + 1);
    const y = tm.getFullYear();
    const m = String(tm.getMonth() + 1).padStart(2, '0');
    const d = String(tm.getDate()).padStart(2, '0');
    onSelectDate(`${y}-${m}-${d}`);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          {/* Header */}
          <View style={styles.header}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={{ fontSize: 18 }}>📅</Text>
              <Text style={styles.title}>{title}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Month & Year Navigation */}
          <View style={styles.navRow}>
            <TouchableOpacity
              onPress={handlePrevMonth}
              disabled={!canGoPrevMonth}
              style={[styles.navArrowBtn, !canGoPrevMonth && styles.navArrowBtnDisabled]}
              activeOpacity={0.7}
            >
              <Text style={[styles.navArrowText, !canGoPrevMonth && styles.navArrowTextDisabled]}>◀</Text>
            </TouchableOpacity>

            <Text style={styles.monthYearTitle}>
              {MONTH_NAMES[currentMonth]} {currentYear}
            </Text>

            <TouchableOpacity
              onPress={handleNextMonth}
              style={styles.navArrowBtn}
              activeOpacity={0.7}
            >
              <Text style={styles.navArrowText}>▶</Text>
            </TouchableOpacity>
          </View>

          {/* Weekday Labels */}
          <View style={styles.weekdayRow}>
            {WEEK_DAYS.map((wd, i) => (
              <Text
                key={wd}
                style={[
                  styles.weekdayText,
                  i === 0 && { color: '#ef4444' }, // Sunday red
                  i === 6 && { color: '#0284c7' }  // Saturday blue
                ]}
              >
                {wd}
              </Text>
            ))}
          </View>

          {/* Days Grid */}
          <View style={styles.gridContainer}>
            {daysGrid.map((item, idx) => {
              if (item.day === null) {
                return <View key={`blank-${idx}`} style={styles.dayCellEmpty} />;
              }

              return (
                <TouchableOpacity
                  key={item.dateStr}
                  disabled={item.isPast}
                  onPress={() => handleSelectDay(item.dateStr, item.isPast)}
                  style={[
                    styles.dayCell,
                    item.isToday && styles.dayCellToday,
                    item.isSelected && styles.dayCellSelected,
                    item.isPast && styles.dayCellDisabled
                  ]}
                  activeOpacity={item.isPast ? 1 : 0.7}
                >
                  <Text
                    style={[
                      styles.dayText,
                      item.isToday && styles.dayTextToday,
                      item.isSelected && styles.dayTextSelected,
                      item.isPast && styles.dayTextDisabled
                    ]}
                  >
                    {item.day}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Notice: No past dates */}
          <View style={styles.noticeBar}>
            <Text style={styles.noticeText}>
              🔒 Past dates are locked. Only today and future dates can be selected.
            </Text>
          </View>

          {/* Quick Select & Close */}
          <View style={styles.quickBar}>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity style={styles.quickBtn} onPress={handleSelectToday}>
                <Text style={styles.quickBtnText}>Today</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.quickBtn} onPress={handleSelectTomorrow}>
                <Text style={styles.quickBtnText}>Tomorrow</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#f59e0b',
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9'
  },
  title: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a'
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center'
  },
  closeBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#64748b'
  },
  navRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 8
  },
  navArrowBtn: {
    width: 32,
    height: 32,
    borderRadius: 6,
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fde68a',
    alignItems: 'center',
    justifyContent: 'center'
  },
  navArrowBtnDisabled: {
    backgroundColor: '#f8fafc',
    borderColor: '#e2e8f0',
    opacity: 0.4
  },
  navArrowText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#b45309'
  },
  navArrowTextDisabled: {
    color: '#94a3b8'
  },
  monthYearTitle: {
    fontSize: 14.5,
    fontWeight: '800',
    color: '#1e293b'
  },
  weekdayRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#f8fafc'
  },
  weekdayText: {
    width: 40,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b'
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
    marginTop: 4
  },
  dayCellEmpty: {
    width: 40,
    height: 40,
    marginVertical: 2
  },
  dayCell: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    marginVertical: 2
  },
  dayCellToday: {
    borderWidth: 1.5,
    borderColor: '#f59e0b',
    backgroundColor: '#fffbeb'
  },
  dayCellSelected: {
    backgroundColor: '#15803d',
    borderColor: '#166534',
    borderWidth: 1.5
  },
  dayCellDisabled: {
    opacity: 0.35,
    backgroundColor: '#f8fafc'
  },
  dayText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1e293b'
  },
  dayTextToday: {
    color: '#b45309',
    fontWeight: '800'
  },
  dayTextSelected: {
    color: '#ffffff',
    fontWeight: '900'
  },
  dayTextDisabled: {
    color: '#94a3b8',
    textDecorationLine: 'line-through'
  },
  noticeBar: {
    marginTop: 10,
    padding: 8,
    backgroundColor: '#f0fdf4',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#bbf7d0'
  },
  noticeText: {
    fontSize: 10.5,
    color: '#166534',
    fontWeight: '600',
    textAlign: 'center'
  },
  quickBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9'
  },
  quickBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#cbd5e1'
  },
  quickBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155'
  },
  cancelBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#fee2e2'
  },
  cancelBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#991b1b'
  }
});
