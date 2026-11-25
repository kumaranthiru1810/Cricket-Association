import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Image,
  Switch,
  ActivityIndicator,
  useWindowDimensions
} from 'react-native';
import { adminApi } from '../../admin/services/adminApi';
import {
  DEFAULT_HOME_POPUP_CONFIG,
  HOME_POPUP_DESTINATIONS,
  HOME_POPUP_IMAGES,
  HOME_POPUP_PRESETS,
  HomePopupConfig,
  resolveHomePopupImageSource
} from '../../utils/homePopupAssets';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSaved?: (config: HomePopupConfig) => void;
}

export const HomePopupManagerModal: React.FC<Props> = ({ visible, onClose, onSaved }) => {
  const { width } = useWindowDimensions();
  const isMobile = width < 640;

  const [config, setConfig] = useState<HomePopupConfig>(DEFAULT_HOME_POPUP_CONFIG);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [destDropdownOpen, setDestDropdownOpen] = useState(false);
  const [feedback, setFeedback] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  // Tournament selector
  const [tournaments, setTournaments] = useState<any[]>([]);
  const [tourDropdownOpen, setTourDropdownOpen] = useState(false);
  const [selectedTournamentId, setSelectedTournamentId] = useState('');

  useEffect(() => {
    if (!visible) return;
    setFeedback(null);
    setDestDropdownOpen(false);
    setTourDropdownOpen(false);
    setSelectedTournamentId('');
    setLoading(true);
    adminApi
      .getHomePopup()
      .then((res: any) => {
        if (res?.success && res.popup) {
          setConfig({ ...DEFAULT_HOME_POPUP_CONFIG, ...res.popup });
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
    // Load tournaments for quick-fill dropdown
    adminApi
      .getTournaments()
      .then((res: any) => {
        if (res?.success) setTournaments(res.tournaments || []);
      })
      .catch(() => {});
  }, [visible]);

  const handleSave = async () => {
    if (!config.title.trim()) {
      setFeedback({ text: 'Popup Title / Heading is required.', type: 'error' });
      return;
    }
    setSaving(true);
    setFeedback(null);
    try {
      const res = await adminApi.updateHomePopup(config);
      if (res?.success) {
        const saved = res.popup || config;
        setConfig(saved);
        setFeedback({ text: 'Home Portal Popup settings saved & applied!', type: 'success' });
        if (onSaved) onSaved(saved);
        setTimeout(() => {
          onClose();
        }, 900);
      } else {
        setFeedback({ text: res?.error || 'Failed to save popup settings.', type: 'error' });
      }
    } catch (err: any) {
      setFeedback({ text: err?.message || 'Failed to save popup settings.', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const previewImgSource = resolveHomePopupImageSource(config.imageKey, config.customImageUrl);
  const destLabel = HOME_POPUP_DESTINATIONS.find(d => d.key === config.buttonDestination)?.label || 'Live & Upcoming Matches';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={{
        flex: 1,
        backgroundColor: 'rgba(15, 23, 42, 0.72)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: isMobile ? 10 : 20
      }}>
        <View style={{
          width: '100%',
          maxWidth: isMobile ? '100%' : 700,
          maxHeight: isMobile ? '98%' : '92%',
          backgroundColor: '#ffffff',
          borderRadius: isMobile ? 12 : 16,
          overflow: 'hidden',
          borderWidth: 1,
          borderColor: '#1e293b',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 10 },
          shadowOpacity: 0.3,
          shadowRadius: 24,
          elevation: 14
        }}>
          {/* Header — dark navy */}
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 18,
            paddingVertical: 14,
            backgroundColor: '#0f172a',
            borderBottomWidth: 2,
            borderBottomColor: '#f59e0b'
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
              <View style={{
                width: 38,
                height: 38,
                borderRadius: 10,
                backgroundColor: '#f59e0b',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Text style={{ fontSize: 18 }}>📢</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 16, fontWeight: '900', color: '#ffffff' }}>
                  Home Portal Popup Alert
                </Text>
                <Text style={{ fontSize: 11.5, color: '#94a3b8' }}>
                  Manage official Match Day notices, Rules &amp; Championship announcements on Home Page
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={{ padding: 6 }}>
              <Text style={{ fontSize: 18, fontWeight: '800', color: '#94a3b8' }}>✕</Text>
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={{ padding: 40, alignItems: 'center', justifyContent: 'center' }}>
              <ActivityIndicator size="large" color="#d97706" />
              <Text style={{ marginTop: 10, color: '#64748b', fontSize: 13 }}>Loading popup settings...</Text>
            </View>
          ) : (
            <ScrollView style={{ padding: 18 }} showsVerticalScrollIndicator={true}>
              {/* Show Popup Toggle */}
              <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                backgroundColor: config.enabled ? '#fef3c7' : '#f8fafc',
                borderWidth: 1,
                borderColor: config.enabled ? '#f59e0b' : '#e2e8f0',
                borderRadius: 12,
                padding: 14,
                marginBottom: 16
              }}>
                <View style={{ flex: 1, paddingRight: 10 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <Text style={{ fontSize: 14, fontWeight: '800', color: '#0f172a' }}>
                      Show Popup to Visitors
                    </Text>
                    <View style={{
                      backgroundColor: config.enabled ? '#16a34a' : '#94a3b8',
                      paddingHorizontal: 8,
                      paddingVertical: 2,
                      borderRadius: 6
                    }}>
                      <Text style={{ color: '#ffffff', fontSize: 10, fontWeight: '800' }}>
                        {config.enabled ? 'LIVE ON HOME' : 'DISABLED'}
                      </Text>
                    </View>
                  </View>
                  <Text style={{ fontSize: 12, color: '#475569', marginTop: 3 }}>
                    Visitors will automatically see this official notice upon opening the Cricket Association home page.
                  </Text>
                </View>
                <Switch
                  value={config.enabled}
                  onValueChange={(val) => setConfig(prev => ({ ...prev, enabled: val }))}
                  trackColor={{ false: '#cbd5e1', true: '#f59e0b' }}
                  thumbColor="#ffffff"
                />
              </View>

              {/* Tournament Quick-Fill Selector */}
              {tournaments.length > 0 && (
                <View style={{ marginBottom: 16, zIndex: 800 }}>
                  <Text style={{ fontSize: 11.5, fontWeight: '800', color: '#475569', marginBottom: 6, textTransform: 'uppercase' }}>
                    🏆 Link to a Tournament (Auto-Fill)
                  </Text>
                  <View style={{ position: 'relative' }}>
                    <TouchableOpacity
                      onPress={() => setTourDropdownOpen(p => !p)}
                      activeOpacity={0.85}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        borderWidth: 1.5,
                        borderColor: tourDropdownOpen ? '#1e40af' : '#cbd5e1',
                        borderRadius: 10,
                        paddingHorizontal: 12,
                        paddingVertical: 10,
                        backgroundColor: selectedTournamentId ? '#eff6ff' : '#ffffff'
                      }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                        <Text style={{ fontSize: 15 }}>🏏</Text>
                        <Text style={{ fontSize: 13, fontWeight: '600', color: selectedTournamentId ? '#1d4ed8' : '#94a3b8', flex: 1 }} numberOfLines={1}>
                          {selectedTournamentId
                            ? (tournaments.find(t => t._id === selectedTournamentId)?.name || 'Selected')
                            : 'Select a tournament to auto-fill notice...'}
                        </Text>
                      </View>
                      <Text style={{ fontSize: 11, color: '#64748b' }}>{tourDropdownOpen ? '▲' : '▼'}</Text>
                    </TouchableOpacity>
                    {tourDropdownOpen && (
                      <View style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        right: 0,
                        marginTop: 4,
                        backgroundColor: '#ffffff',
                        borderWidth: 1,
                        borderColor: '#e2e8f0',
                        borderRadius: 10,
                        zIndex: 1200,
                        elevation: 12,
                        maxHeight: 200,
                        overflow: 'hidden'
                      }}>
                        <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={false} style={{ maxHeight: 200 }}>
                          {tournaments.map(t => (
                            <TouchableOpacity
                              key={t._id}
                              onPress={() => {
                                setSelectedTournamentId(t._id);
                                setTourDropdownOpen(false);
                                // Auto-fill announcement fields from tournament
                                const fmt = t.matchFormat || t.format || 'T20';
                                const overs = t.overs || t.oversPerMatch || '20';
                                const venue = t.primaryVenue || t.venue || '';
                                const season = t.season || new Date().getFullYear();
                                setConfig(prev => ({
                                  ...prev,
                                  title: `${t.name} — Season ${season}`,
                                  message: `${fmt} (${overs} Overs) Championship${venue ? ` at ${venue}` : ''}. Check live scores, fixtures and standings on the portal.`,
                                  badgeText: `${t.shortName || t.name.substring(0, 12).toUpperCase()} ${season}`,
                                  highlightText: t.registrationDeadline
                                    ? `Registration Deadline: ${t.registrationDeadline}`
                                    : prev.highlightText,
                                  buttonText: 'View Championship →',
                                  buttonDestination: 'live-scores'
                                }));
                              }}
                              style={{
                                paddingHorizontal: 14,
                                paddingVertical: 10,
                                borderBottomWidth: 1,
                                borderBottomColor: '#f1f5f9',
                                backgroundColor: selectedTournamentId === t._id ? '#eff6ff' : 'transparent',
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: 8
                              }}
                            >
                              <View style={{
                                width: 28, height: 28, borderRadius: 6,
                                backgroundColor: '#1e40af',
                                alignItems: 'center', justifyContent: 'center'
                              }}>
                                <Text style={{ fontSize: 11, fontWeight: '900', color: '#ffffff' }}>
                                  {(t.shortName || t.name || '?').substring(0, 2).toUpperCase()}
                                </Text>
                              </View>
                              <View style={{ flex: 1 }}>
                                <Text style={{ fontSize: 12.5, fontWeight: '700', color: '#0f172a' }} numberOfLines={1}>{t.name}</Text>
                                <Text style={{ fontSize: 11, color: '#64748b' }}>
                                  {t.matchFormat || t.format || 'T20'} · Season {t.season || '2026'}
                                  {t.status ? ` · ${t.status}` : ''}
                                </Text>
                              </View>
                              {selectedTournamentId === t._id && (
                                <Text style={{ fontSize: 14, color: '#1d4ed8' }}>✓</Text>
                              )}
                            </TouchableOpacity>
                          ))}
                        </ScrollView>
                      </View>
                    )}
                  </View>
                  {selectedTournamentId && (
                    <TouchableOpacity onPress={() => { setSelectedTournamentId(''); }} style={{ marginTop: 4 }}>
                      <Text style={{ fontSize: 11, color: '#94a3b8' }}>✕ Clear selection</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}

              {/* Quick Presets */}
              <Text style={{ fontSize: 11.5, fontWeight: '800', color: '#475569', marginBottom: 8, textTransform: 'uppercase' }}>
                ⚡ Quick Presets (1-Click Fill)
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                {HOME_POPUP_PRESETS.map(p => {
                  const isActive = config.presetKey === p.key;
                  return (
                    <TouchableOpacity
                      key={p.key}
                      onPress={() => setConfig(prev => ({ ...prev, ...p.values }))}
                      activeOpacity={0.75}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 8,
                        paddingHorizontal: 14,
                        paddingVertical: 10,
                        borderRadius: 24,
                        borderWidth: 2,
                        borderColor: isActive ? '#d97706' : '#e2e8f0',
                        backgroundColor: isActive ? '#fffbeb' : '#f8fafc',
                        shadowColor: isActive ? '#d97706' : '#000',
                        shadowOffset: { width: 0, height: isActive ? 2 : 1 },
                        shadowOpacity: isActive ? 0.18 : 0.06,
                        shadowRadius: isActive ? 6 : 2,
                        elevation: isActive ? 4 : 1
                      }}
                    >
                      <Text style={{ fontSize: 17 }}>{p.icon}</Text>
                      <View>
                        <Text style={{ fontSize: 12.5, fontWeight: '800', color: isActive ? '#92400e' : '#1e293b' }}>
                          {p.label}
                        </Text>
                        <Text style={{ fontSize: 10.5, color: '#64748b' }}>{p.subtitle}</Text>
                      </View>
                      {isActive && (
                        <View style={{
                          width: 8, height: 8, borderRadius: 4,
                          backgroundColor: '#d97706', marginLeft: 2
                        }} />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Select Banner Image */}
              <Text style={{ fontSize: 11.5, fontWeight: '800', color: '#475569', marginBottom: 8, textTransform: 'uppercase' }}>
                🖼️ Select Banner Image
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                {HOME_POPUP_IMAGES.map(img => {
                  const isSelected = config.imageKey === img.key;
                  return (
                    <TouchableOpacity
                      key={img.key}
                      onPress={() => setConfig(prev => ({ ...prev, imageKey: img.key }))}
                      activeOpacity={0.8}
                      style={{
                        flex: 1,
                        minWidth: 130,
                        borderWidth: 2,
                        borderColor: isSelected ? '#d97706' : '#e2e8f0',
                        borderRadius: 10,
                        overflow: 'hidden',
                        backgroundColor: isSelected ? '#fffbeb' : '#f8fafc'
                      }}
                    >
                      {img.source ? (
                        <Image source={img.source} style={{ width: '100%', height: 58 }} resizeMode="cover" />
                      ) : (
                        <View style={{ height: 58, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f1f5f9' }}>
                          <Text style={{ fontSize: 20 }}>🔗</Text>
                        </View>
                      )}
                      <View style={{ padding: 6, alignItems: 'center' }}>
                        <Text style={{ fontSize: 11, fontWeight: '700', color: isSelected ? '#92400e' : '#334155' }} numberOfLines={1}>
                          {img.label}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {config.imageKey === 'custom' && (
                <View style={{ marginBottom: 12 }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: '#334155', marginBottom: 6 }}>
                    Custom Banner Image
                  </Text>
                  {/* Upload button — web only */}
                  <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                    <TouchableOpacity
                      onPress={() => {
                        const input = (document as any).createElement('input');
                        input.type = 'file';
                        input.accept = 'image/*';
                        input.onchange = (e: any) => {
                          const file = e.target?.files?.[0];
                          if (!file) return;
                          const reader = new FileReader();
                          reader.onload = (ev: any) => {
                            const dataUrl = ev.target?.result as string;
                            if (dataUrl) setConfig(prev => ({ ...prev, customImageUrl: dataUrl }));
                          };
                          reader.readAsDataURL(file);
                        };
                        input.click();
                      }}
                      style={{
                        backgroundColor: '#f59e0b',
                        paddingHorizontal: 14,
                        paddingVertical: 9,
                        borderRadius: 8,
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 6
                      }}
                    >
                      <Text style={{ fontSize: 13, fontWeight: '800', color: '#ffffff' }}>📁 Upload Image</Text>
                    </TouchableOpacity>
                    <Text style={{ fontSize: 11.5, color: '#94a3b8', flex: 1 }}>or paste URL below</Text>
                  </View>
                  {/* Preview thumbnail if image selected */}
                  {Boolean(config.customImageUrl) && (
                    <View style={{ marginBottom: 8, borderRadius: 8, overflow: 'hidden', borderWidth: 1, borderColor: '#e2e8f0' }}>
                      <Image source={{ uri: config.customImageUrl }} style={{ width: '100%', height: 72 }} resizeMode="cover" />
                    </View>
                  )}
                  <TextInput
                    style={{
                      borderWidth: 1,
                      borderColor: '#cbd5e1',
                      borderRadius: 8,
                      paddingHorizontal: 12,
                      paddingVertical: 9,
                      fontSize: 13,
                      color: '#0f172a',
                      backgroundColor: '#ffffff'
                    }}
                    value={config.customImageUrl}
                    onChangeText={(t) => setConfig(prev => ({ ...prev, customImageUrl: t }))}
                    placeholder="https://example.com/banner.jpg"
                    placeholderTextColor="#94a3b8"
                  />
                </View>
              )}

              {/* Form Fields */}
              <View style={{ gap: 10, marginBottom: 16 }}>
                <View>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: '#334155', marginBottom: 4 }}>
                    Notice Heading / Title *
                  </Text>
                  <TextInput
                    style={{
                      borderWidth: 1,
                      borderColor: '#cbd5e1',
                      borderRadius: 8,
                      paddingHorizontal: 12,
                      paddingVertical: 9,
                      fontSize: 13,
                      color: '#0f172a',
                      backgroundColor: '#ffffff'
                    }}
                    value={config.title}
                    onChangeText={(t) => setConfig(prev => ({ ...prev, title: t }))}
                    placeholder="e.g. Virudhunagar Premier League 2026 — Match Day Notice!"
                    placeholderTextColor="#94a3b8"
                  />
                </View>

                <View>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: '#334155', marginBottom: 4 }}>
                    Announcement Message
                  </Text>
                  <TextInput
                    style={{
                      borderWidth: 1,
                      borderColor: '#cbd5e1',
                      borderRadius: 8,
                      paddingHorizontal: 12,
                      paddingVertical: 9,
                      fontSize: 13,
                      color: '#0f172a',
                      backgroundColor: '#ffffff',
                      minHeight: 64
                    }}
                    multiline
                    value={config.message}
                    onChangeText={(t) => setConfig(prev => ({ ...prev, message: t }))}
                    placeholder="Details about upcoming matches, rules, or registration..."
                    placeholderTextColor="#94a3b8"
                  />
                </View>

                <View style={{ flexDirection: isMobile ? 'column' : 'row', gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: '#334155', marginBottom: 4 }}>
                      Badge Tag
                    </Text>
                    <TextInput
                      style={{
                        borderWidth: 1,
                        borderColor: '#cbd5e1',
                        borderRadius: 8,
                        paddingHorizontal: 12,
                        paddingVertical: 9,
                        fontSize: 13,
                        color: '#0f172a',
                        backgroundColor: '#ffffff'
                      }}
                      value={config.badgeText}
                      onChangeText={(t) => setConfig(prev => ({ ...prev, badgeText: t }))}
                      placeholder="OFFICIAL MATCH NOTICE"
                      placeholderTextColor="#94a3b8"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: '#334155', marginBottom: 4 }}>
                      Highlight Strip (Rules / Note)
                    </Text>
                    <TextInput
                      style={{
                        borderWidth: 1,
                        borderColor: '#cbd5e1',
                        borderRadius: 8,
                        paddingHorizontal: 12,
                        paddingVertical: 9,
                        fontSize: 13,
                        color: '#0f172a',
                        backgroundColor: '#ffffff'
                      }}
                      value={config.highlightText}
                      onChangeText={(t) => setConfig(prev => ({ ...prev, highlightText: t }))}
                      placeholder="e.g. Report 45 mins prior to toss"
                      placeholderTextColor="#94a3b8"
                    />
                  </View>
                </View>

                <View style={{ flexDirection: isMobile ? 'column' : 'row', gap: 10, zIndex: 500 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: '#334155', marginBottom: 4 }}>
                      Button Text
                    </Text>
                    <TextInput
                      style={{
                        borderWidth: 1,
                        borderColor: '#cbd5e1',
                        borderRadius: 8,
                        paddingHorizontal: 12,
                        paddingVertical: 9,
                        fontSize: 13,
                        color: '#0f172a',
                        backgroundColor: '#ffffff'
                      }}
                      value={config.buttonText}
                      onChangeText={(t) => setConfig(prev => ({ ...prev, buttonText: t }))}
                      placeholder="View Match Schedules →"
                      placeholderTextColor="#94a3b8"
                    />
                  </View>
                  <View style={{ flex: 1, position: 'relative', zIndex: 500 }}>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: '#334155', marginBottom: 4 }}>
                      Button Destination
                    </Text>
                    <TouchableOpacity
                      onPress={() => setDestDropdownOpen(prev => !prev)}
                      style={{
                        borderWidth: 1,
                        borderColor: destDropdownOpen ? '#d97706' : '#cbd5e1',
                        borderRadius: 8,
                        paddingHorizontal: 12,
                        paddingVertical: 10,
                        backgroundColor: '#ffffff',
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}
                    >
                      <Text style={{ fontSize: 13, color: '#0f172a', fontWeight: '600' }} numberOfLines={1}>
                        {destLabel}
                      </Text>
                      <Text style={{ fontSize: 11, color: '#64748b' }}>{destDropdownOpen ? '▲' : '▼'}</Text>
                    </TouchableOpacity>
                    {destDropdownOpen && (
                      <View style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        right: 0,
                        marginTop: 4,
                        backgroundColor: '#ffffff',
                        borderWidth: 1,
                        borderColor: '#cbd5e1',
                        borderRadius: 8,
                        zIndex: 1000,
                        elevation: 8
                      }}>
                        {HOME_POPUP_DESTINATIONS.map(d => (
                          <TouchableOpacity
                            key={d.key}
                            onPress={() => {
                              setConfig(prev => ({ ...prev, buttonDestination: d.key }));
                              setDestDropdownOpen(false);
                            }}
                            style={{
                              paddingHorizontal: 12,
                              paddingVertical: 9,
                              backgroundColor: config.buttonDestination === d.key ? '#fef3c7' : 'transparent'
                            }}
                          >
                            <Text style={{
                              fontSize: 12.5,
                              fontWeight: config.buttonDestination === d.key ? '800' : '500',
                              color: config.buttonDestination === d.key ? '#92400e' : '#334155'
                            }}>
                              {d.label}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                  </View>
                </View>
              </View>

              {/* Live Visitor Preview */}
              <Text style={{ fontSize: 11.5, fontWeight: '800', color: '#475569', marginBottom: 8, textTransform: 'uppercase' }}>
                👁️ Live Home Visitor Preview
              </Text>
              <View style={{
                borderWidth: 1,
                borderColor: '#fde68a',
                borderRadius: 14,
                overflow: 'hidden',
                backgroundColor: '#ffffff',
                marginBottom: 14
              }}>
                <View style={{ position: 'relative' }}>
                  <Image source={previewImgSource} style={{ width: '100%', height: 110 }} resizeMode="cover" />
                  <View style={{
                    position: 'absolute',
                    top: 10,
                    left: 10,
                    backgroundColor: '#d97706',
                    paddingHorizontal: 10,
                    paddingVertical: 4,
                    borderRadius: 6
                  }}>
                    <Text style={{ color: '#ffffff', fontSize: 10, fontWeight: '800' }}>
                      🏏 {config.badgeText || 'OFFICIAL NOTICE'}
                    </Text>
                  </View>
                </View>
                <View style={{ padding: 14 }}>
                  <Text style={{ fontSize: 15, fontWeight: '900', color: '#0f172a' }}>
                    {config.title || 'Announcement Title'}
                  </Text>
                  {Boolean(config.message) && (
                    <Text style={{ fontSize: 12.5, color: '#475569', marginTop: 6, lineHeight: 18 }}>
                      {config.message}
                    </Text>
                  )}
                  {Boolean(config.highlightText) && (
                    <View style={{
                      backgroundColor: '#fffbeb',
                      borderWidth: 1,
                      borderColor: '#fde68a',
                      borderRadius: 8,
                      paddingHorizontal: 10,
                      paddingVertical: 7,
                      marginTop: 10
                    }}>
                      <Text style={{ fontSize: 11.5, fontWeight: '700', color: '#92400e' }}>
                        ⚖️ {config.highlightText}
                      </Text>
                    </View>
                  )}
                  <View style={{
                    marginTop: 12,
                    backgroundColor: '#d97706',
                    borderRadius: 8,
                    paddingVertical: 10,
                    alignItems: 'center'
                  }}>
                    <Text style={{ color: '#ffffff', fontSize: 13, fontWeight: '800' }}>
                      {config.buttonText || 'View Details →'}
                    </Text>
                  </View>
                </View>
              </View>

              {feedback && (
                <View style={{
                  padding: 10,
                  borderRadius: 8,
                  marginBottom: 10,
                  backgroundColor: feedback.type === 'success' ? '#dcfce7' : '#fee2e2'
                }}>
                  <Text style={{
                    fontSize: 12.5,
                    fontWeight: '700',
                    color: feedback.type === 'success' ? '#166534' : '#991b1b',
                    textAlign: 'center'
                  }}>
                    {feedback.text}
                  </Text>
                </View>
              )}
            </ScrollView>
          )}

          {/* Footer */}
          <View style={{
            flexDirection: 'row',
            justifyContent: 'flex-end',
            gap: 10,
            paddingHorizontal: 18,
            paddingVertical: 12,
            borderTopWidth: 1,
            borderTopColor: '#1e293b',
            backgroundColor: '#0f172a'
          }}>
            <TouchableOpacity
              onPress={onClose}
              style={{
                paddingHorizontal: 16,
                paddingVertical: 10,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: '#334155',
                backgroundColor: '#1e293b'
              }}
            >
              <Text style={{ fontSize: 13, fontWeight: '700', color: '#94a3b8' }}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleSave}
              disabled={saving}
              style={{
                paddingHorizontal: 18,
                paddingVertical: 10,
                borderRadius: 8,
                backgroundColor: '#f59e0b',
                opacity: saving ? 0.6 : 1
              }}
            >
              <Text style={{ fontSize: 13, fontWeight: '800', color: '#0f172a' }}>
                {saving ? 'Saving...' : '✓ Save & Apply Settings'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

