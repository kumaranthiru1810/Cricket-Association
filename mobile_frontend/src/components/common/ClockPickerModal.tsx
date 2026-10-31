import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform
} from 'react-native';
import Svg, { Line, Circle } from 'react-native-svg';

export interface ClockPickerModalProps {
  visible: boolean;
  title?: string;
  initialTime?: string;
  referenceStartTime?: string;
  onClose: () => void;
  onSelectTime: (formattedTime: string) => void;
}

/**
 * Parses time string like "11:57 am", "12.00am", "12:00 PM", "14:30"
 */
export function parseTimeString(timeStr?: string): { hour: number; minute: number; period: 'AM' | 'PM' } {
  const now = new Date();
  let defaultHour = now.getHours();
  let defaultMinute = now.getMinutes();
  let defaultPeriod: 'AM' | 'PM' = defaultHour >= 12 ? 'PM' : 'AM';
  defaultHour = defaultHour % 12 || 12;

  if (!timeStr || typeof timeStr !== 'string') {
    return { hour: defaultHour, minute: defaultMinute, period: defaultPeriod };
  }

  const clean = timeStr.trim().toLowerCase().replace(/\./g, ':');
  const match = clean.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i);
  if (!match) {
    return { hour: defaultHour, minute: defaultMinute, period: defaultPeriod };
  }

  let h = parseInt(match[1], 10);
  const m = match[2] ? parseInt(match[2], 10) : 0;
  const rawAmPm = match[3]?.toUpperCase();

  if (rawAmPm === 'AM' || rawAmPm === 'PM') {
    if (h < 1) h = 12;
    if (h > 12) h = ((h - 1) % 12) + 1;
    return {
      hour: h,
      minute: Math.min(59, Math.max(0, m)),
      period: rawAmPm as 'AM' | 'PM'
    };
  }

  // 24-hour style
  let period: 'AM' | 'PM' = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return {
    hour: h,
    minute: Math.min(59, Math.max(0, m)),
    period
  };
}

/**
 * Calculates duration in minutes between start and end time strings.
 * Handles both "11:57 am", "12.00am", overnight, and common 12-hour AM/PM confusion.
 */
export function calculateDurationMinutes(startStr: string, endStr: string): number | null {
  if (!startStr || !endStr) return null;

  const parseToMinutes = (str: string): number | null => {
    const clean = str.trim().toLowerCase().replace(/\./g, ':');
    const match = clean.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i);
    if (!match) return null;
    let h = parseInt(match[1], 10);
    const m = match[2] ? parseInt(match[2], 10) : 0;
    const ampm = match[3]?.toLowerCase();

    if (h < 0 || m < 0 || m > 59) return null;

    if (ampm) {
      if (h === 12) {
        h = ampm === 'pm' ? 12 : 0;
      } else if (ampm === 'pm') {
        h += 12;
      }
    } else if (h > 23) {
      return null;
    }
    return h * 60 + m;
  };

  const start = parseToMinutes(startStr);
  const end = parseToMinutes(endStr);
  if (start === null || end === null) return null;

  let diff = end - start;
  if (diff < 0) {
    diff += 1440; // overnight wrap
  }
  // If user accidentally inverted AM/PM for a short break (e.g. 11:57 am to 12:00 am = 723 mins)
  if (diff >= 700 && diff <= 740) {
    diff = Math.abs(diff - 720);
  }
  return diff;
}

export const ClockPickerModal: React.FC<ClockPickerModalProps> = ({
  visible,
  title = 'Select Time',
  initialTime,
  referenceStartTime,
  onClose,
  onSelectTime
}) => {
  const [selectedHour, setSelectedHour] = useState<number>(12);
  const [selectedMinute, setSelectedMinute] = useState<number>(0);
  const [period, setPeriod] = useState<'AM' | 'PM'>('AM');
  const [mode, setMode] = useState<'HOUR' | 'MINUTE'>('HOUR');

  useEffect(() => {
    if (visible) {
      const parsed = parseTimeString(initialTime);
      setSelectedHour(parsed.hour);
      setSelectedMinute(parsed.minute);
      setPeriod(parsed.period);
      setMode('HOUR');
    }
  }, [visible, initialTime]);

  const clockSize = 240;
  const radius = 90;
  const center = clockSize / 2;

  // Compute angle & coordinates for current mode selection
  const { currentAngle, targetX, targetY } = useMemo(() => {
    let angleDeg = 0;
    if (mode === 'HOUR') {
      angleDeg = (selectedHour % 12) * 30 - 90;
    } else {
      angleDeg = (selectedMinute / 5) * 30 - 90;
    }
    const angleRad = (angleDeg * Math.PI) / 180;
    const x = center + radius * Math.cos(angleRad);
    const y = center + radius * Math.sin(angleRad);
    return { currentAngle: angleDeg, targetX: x, targetY: y };
  }, [mode, selectedHour, selectedMinute]);

  // Set to current device time
  const handleSetCurrentTime = () => {
    const now = new Date();
    let h = now.getHours();
    const m = now.getMinutes();
    const p: 'AM' | 'PM' = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    setSelectedHour(h);
    setSelectedMinute(m);
    setPeriod(p);
  };

  // Add offset minutes from reference start time (e.g. +15m)
  const handleApplyPresetMinutes = (offsetMinutes: number) => {
    const base = parseTimeString(referenceStartTime || initialTime);
    let totalMins = (base.hour % 12 + (base.period === 'PM' ? 12 : 0)) * 60 + base.minute + offsetMinutes;
    totalMins = (totalMins % 1440 + 1440) % 1440;

    let newH = Math.floor(totalMins / 60);
    const newM = totalMins % 60;
    const newP: 'AM' | 'PM' = newH >= 12 ? 'PM' : 'AM';
    newH = newH % 12 || 12;

    setSelectedHour(newH);
    setSelectedMinute(newM);
    setPeriod(newP);
  };

  const handleConfirm = () => {
    const formatted = `${selectedHour}:${String(selectedMinute).padStart(2, '0')} ${period.toLowerCase()}`;
    onSelectTime(formatted);
  };

  const hoursList = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
  const minutesList = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.clockCard}>
          {/* Header */}
          <View style={styles.headerRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={styles.clockIconEmoji}>🕒</Text>
              <Text style={styles.modalTitle}>{title}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Big Time Display Display */}
          <View style={styles.timeDisplayCard}>
            <View style={styles.digitsRow}>
              {/* Hour Box */}
              <TouchableOpacity
                style={[styles.digitBox, mode === 'HOUR' && styles.digitBoxActive]}
                onPress={() => setMode('HOUR')}
                activeOpacity={0.8}
              >
                <Text style={[styles.digitText, mode === 'HOUR' && styles.digitTextActive]}>
                  {String(selectedHour).padStart(2, '0')}
                </Text>
                <Text style={styles.digitLabel}>HOUR</Text>
              </TouchableOpacity>

              <Text style={styles.timeSeparator}>:</Text>

              {/* Minute Box */}
              <TouchableOpacity
                style={[styles.digitBox, mode === 'MINUTE' && styles.digitBoxActive]}
                onPress={() => setMode('MINUTE')}
                activeOpacity={0.8}
              >
                <Text style={[styles.digitText, mode === 'MINUTE' && styles.digitTextActive]}>
                  {String(selectedMinute).padStart(2, '0')}
                </Text>
                <Text style={styles.digitLabel}>MIN</Text>
              </TouchableOpacity>

              {/* AM / PM Toggle */}
              <View style={styles.periodCol}>
                <TouchableOpacity
                  style={[styles.periodBtn, period === 'AM' && styles.periodBtnActive]}
                  onPress={() => setPeriod('AM')}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.periodText, period === 'AM' && styles.periodTextActive]}>AM</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.periodBtn, period === 'PM' && styles.periodBtnActive]}
                  onPress={() => setPeriod('PM')}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.periodText, period === 'PM' && styles.periodTextActive]}>PM</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.modeIndicator}>
              <Text style={styles.modeIndicatorText}>
                {mode === 'HOUR' ? '👉 Tap an hour number on clock' : '👉 Tap a minute number or use steppers'}
              </Text>
            </View>
          </View>

          {/* Interactive Clock Face */}
          <View style={styles.clockContainer}>
            <View style={styles.clockFace}>
              {/* SVG Hand & Selection Indicator */}
              <Svg width={clockSize} height={clockSize} style={StyleSheet.absoluteFill}>
                {/* Pointer Line */}
                <Line
                  x1={center}
                  y1={center}
                  x2={targetX}
                  y2={targetY}
                  stroke="#d97706"
                  strokeWidth={2.5}
                />
                {/* Center Pivot */}
                <Circle cx={center} cy={center} r={5} fill="#d97706" />
                {/* Target Circle highlight */}
                <Circle cx={targetX} cy={targetY} r={17} fill="#d97706" />
              </Svg>

              {/* Clock Numbers Overlay */}
              {mode === 'HOUR' ? (
                hoursList.map((h) => {
                  const angleDeg = (h % 12) * 30 - 90;
                  const rad = (angleDeg * Math.PI) / 180;
                  const x = center + radius * Math.cos(rad);
                  const y = center + radius * Math.sin(rad);
                  const isSelected = selectedHour === h;

                  return (
                    <TouchableOpacity
                      key={`hour-${h}`}
                      style={[
                        styles.numberNode,
                        { left: x - 18, top: y - 18 }
                      ]}
                      onPress={() => {
                        setSelectedHour(h);
                        setMode('MINUTE'); // smoothly transition to minute selection
                      }}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.nodeText, isSelected && styles.nodeTextSelected]}>
                        {h}
                      </Text>
                    </TouchableOpacity>
                  );
                })
              ) : (
                minutesList.map((m) => {
                  const angleDeg = (m / 5) * 30 - 90;
                  const rad = (angleDeg * Math.PI) / 180;
                  const x = center + radius * Math.cos(rad);
                  const y = center + radius * Math.sin(rad);
                  const isSelected = selectedMinute === m;

                  return (
                    <TouchableOpacity
                      key={`min-${m}`}
                      style={[
                        styles.numberNode,
                        { left: x - 18, top: y - 18 }
                      ]}
                      onPress={() => setSelectedMinute(m)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.nodeText, isSelected && styles.nodeTextSelected]}>
                        {String(m).padStart(2, '0')}
                      </Text>
                    </TouchableOpacity>
                  );
                })
              )}
            </View>
          </View>

          {/* Minute Adjuster Stepper */}
          <View style={styles.stepperRow}>
            <TouchableOpacity
              style={styles.stepBtn}
              onPress={() => setSelectedMinute((prev) => (prev - 5 + 60) % 60)}
              activeOpacity={0.7}
            >
              <Text style={styles.stepBtnText}>-5m</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.stepBtn}
              onPress={() => setSelectedMinute((prev) => (prev - 1 + 60) % 60)}
              activeOpacity={0.7}
            >
              <Text style={styles.stepBtnText}>-1m</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.stepBtn, { backgroundColor: '#fef3c7', borderColor: '#fde68a' }]}
              onPress={handleSetCurrentTime}
              activeOpacity={0.7}
            >
              <Text style={[styles.stepBtnText, { color: '#b45309', fontWeight: '700' }]}>Now</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.stepBtn}
              onPress={() => setSelectedMinute((prev) => (prev + 1) % 60)}
              activeOpacity={0.7}
            >
              <Text style={styles.stepBtnText}>+1m</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.stepBtn}
              onPress={() => setSelectedMinute((prev) => (prev + 5) % 60)}
              activeOpacity={0.7}
            >
              <Text style={styles.stepBtnText}>+5m</Text>
            </TouchableOpacity>
          </View>

          {/* Quick End-Time Presets if reference start time is given */}
          {referenceStartTime ? (
            <View style={styles.presetsBox}>
              <Text style={styles.presetsLabel}>Quick Duration from Start ({referenceStartTime}):</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.presetsScroll}>
                {[5, 10, 15, 20, 30, 45].map((mins) => (
                  <TouchableOpacity
                    key={`preset-${mins}`}
                    style={styles.presetChip}
                    onPress={() => handleApplyPresetMinutes(mins)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.presetChipText}>+{mins} min</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          ) : null}

          {/* Footer Actions */}
          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose} activeOpacity={0.7}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.confirmBtn} onPress={handleConfirm} activeOpacity={0.8}>
              <Text style={styles.confirmBtnText}>SET TIME</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16
  },
  clockCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 18,
    elevation: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0'
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12
  },
  clockIconEmoji: {
    fontSize: 20
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a'
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#fee2e2',
    justifyContent: 'center',
    alignItems: 'center'
  },
  closeBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#ef4444'
  },
  timeDisplayCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    marginBottom: 10
  },
  digitsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8
  },
  digitBox: {
    width: 68,
    height: 60,
    backgroundColor: '#ffffff',
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#cbd5e1',
    justifyContent: 'center',
    alignItems: 'center'
  },
  digitBoxActive: {
    borderColor: '#d97706',
    backgroundColor: '#fffbeb'
  },
  digitText: {
    fontSize: 26,
    fontWeight: '800',
    color: '#334155'
  },
  digitTextActive: {
    color: '#b45309'
  },
  digitLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#64748b',
    marginTop: -2
  },
  timeSeparator: {
    fontSize: 28,
    fontWeight: '800',
    color: '#64748b',
    marginHorizontal: -2
  },
  periodCol: {
    marginLeft: 6,
    gap: 4
  },
  periodBtn: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#ffffff'
  },
  periodBtnActive: {
    backgroundColor: '#d97706',
    borderColor: '#d97706'
  },
  periodText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569'
  },
  periodTextActive: {
    color: '#ffffff'
  },
  modeIndicator: {
    marginTop: 8
  },
  modeIndicatorText: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '600'
  },
  clockContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 6
  },
  clockFace: {
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    position: 'relative'
  },
  numberNode: {
    position: 'absolute',
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10
  },
  nodeText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1e293b'
  },
  nodeTextSelected: {
    color: '#ffffff',
    fontWeight: '800'
  },
  stepperRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginTop: 8
  },
  stepBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#ffffff'
  },
  stepBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155'
  },
  presetsBox: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9'
  },
  presetsLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
    marginBottom: 5
  },
  presetsScroll: {
    flexDirection: 'row',
    gap: 6,
    paddingBottom: 2
  },
  presetChip: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#fef3c7',
    borderWidth: 1,
    borderColor: '#fde68a'
  },
  presetChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#b45309'
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 14,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9'
  },
  cancelBtn: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#f8fafc'
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569'
  },
  confirmBtn: {
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 8,
    backgroundColor: '#d97706'
  },
  confirmBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff'
  }
});

