/**
 * src/admin/pages/SettingsPage.tsx
 * Settings Page for Cricket Association Professional Admin Panel.
 * Configures Association registry details, headquarters info, administrative profile,
 * and tournament rule defaults saved directly to the database.
 */

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView } from 'react-native';
import PageHeader from '../components/PageHeader';
import LoadingSkeleton from '../components/LoadingSkeleton';
import { SettingsIcon, CheckIcon, ShieldIcon } from '../components/Icons';
import { adminApi } from '../services/adminApi';
import { useAdminAuth } from '../context/AdminAuthContext';
import { useAdminLayout } from '../components/AdminLayout';

export const SettingsPage: React.FC = () => {
  const { adminUser } = useAdminAuth();
  const { showToast } = useAdminLayout();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Association Info
  const [assocName, setAssocName] = useState('Virudhunagar District Cricket Association');
  const [shortName, setShortName] = useState('VDCA');
  const [regNumber, setRegNumber] = useState('TN-VNR-SOCIETY-2018-092');
  const [contactEmail, setContactEmail] = useState('admin@cfvd.org');
  const [contactPhone, setContactPhone] = useState('+91 94431 23456');
  const [officeAddress, setOfficeAddress] = useState('Kamarajar Stadium Complex, Virudhunagar, Tamil Nadu - 626001');

  // Competition Defaults
  const [defaultFormat, setDefaultFormat] = useState('T20');
  const [defaultOvers, setDefaultOvers] = useState('20');
  const [ballType, setBallType] = useState('WHITE_LEATHER');

  // Admin Profile
  const [adminName, setAdminName] = useState(adminUser?.name || 'Chief Administrator');
  const [adminEmail, setAdminEmail] = useState(adminUser?.email || 'admin@cfvd.org');

  useEffect(() => {
    const loadSettings = async () => {
      setLoading(true);
      try {
        const res = await adminApi.getSettings();
        if (res && res.success && res.settings) {
          const s = res.settings;
          if (s.association_name) setAssocName(s.association_name);
          if (s.short_name) setShortName(s.short_name);
          if (s.registration_number) setRegNumber(s.registration_number);
          if (s.contact_email) setContactEmail(s.contact_email);
          if (s.contact_phone) setContactPhone(s.contact_phone);
          if (s.office_address) setOfficeAddress(s.office_address);
          if (s.default_format) setDefaultFormat(s.default_format);
          if (s.default_overs) setDefaultOvers(String(s.default_overs));
          if (s.ball_type) setBallType(s.ball_type);
        }
      } catch (e: any) {
        showToast(`Failed to load settings: ${e.message}`, 'error');
      } finally {
        setLoading(false);
      }
    };
    loadSettings();
  }, []);

  const handleSaveSettings = async () => {
    setSaving(true);
    try {
      await adminApi.updateSettings({
        association_name: assocName,
        short_name: shortName,
        registration_number: regNumber,
        contact_email: contactEmail,
        contact_phone: contactPhone,
        office_address: officeAddress,
        default_format: defaultFormat,
        default_overs: parseInt(defaultOvers, 10) || 20,
        ball_type: ballType
      });
      showToast('Association settings updated successfully.', 'success');
    } catch (e: any) {
      showToast(`Save failed: ${e.message}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <PageHeader
          title="Association Settings"
          subtitle="Configure official Cricket Association parameters and administrative profile."
          breadcrumbs={[{ label: 'Admin', link: '/admin/dashboard' }, { label: 'Settings' }]}
        />
        <LoadingSkeleton rows={4} type="card" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <PageHeader
        title="Association Settings"
        subtitle="Manage official Cricket Association credentials, headquarters parameters, and competition defaults."
        breadcrumbs={[
          { label: 'Admin', link: '/admin/dashboard' },
          { label: 'Settings' }
        ]}
        actions={
          <TouchableOpacity
            style={styles.saveBtn}
            onPress={handleSaveSettings}
            disabled={saving}
          >
            <CheckIcon size={16} color="#FFFFFF" />
            <Text style={styles.saveBtnText}>
              {saving ? 'Saving...' : 'Save All Settings'}
            </Text>
          </TouchableOpacity>
        }
      />

      <View style={styles.sectionsGrid}>
        {/* Section 1: Association Legal & Contact Info */}
        <View style={styles.settingsCard}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Association Profile & Identity</Text>
            <Text style={styles.cardSub}>
              Public credentials displayed across official reports, certificates, and scores.
            </Text>
          </View>

          <View style={styles.cardBody}>
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Official Association Name</Text>
              <TextInput
                style={styles.input}
                value={assocName}
                onChangeText={setAssocName}
              />
            </View>

            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={[styles.fieldGroup, { flex: 1 }]}>
                <Text style={styles.fieldLabel}>Short Code / Abbreviation</Text>
                <TextInput
                  style={styles.input}
                  value={shortName}
                  onChangeText={setShortName}
                />
              </View>
              <View style={[styles.fieldGroup, { flex: 2 }]}>
                <Text style={styles.fieldLabel}>Society Registration Number</Text>
                <TextInput
                  style={styles.input}
                  value={regNumber}
                  onChangeText={setRegNumber}
                />
              </View>
            </View>

            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={[styles.fieldGroup, { flex: 1 }]}>
                <Text style={styles.fieldLabel}>Official Contact Email</Text>
                <TextInput
                  style={styles.input}
                  value={contactEmail}
                  onChangeText={setContactEmail}
                  keyboardType="email-address"
                />
              </View>
              <View style={[styles.fieldGroup, { flex: 1 }]}>
                <Text style={styles.fieldLabel}>Contact Phone / Secretariat</Text>
                <TextInput
                  style={styles.input}
                  value={contactPhone}
                  onChangeText={setContactPhone}
                />
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Headquarters / Office Address</Text>
              <TextInput
                style={styles.input}
                value={officeAddress}
                onChangeText={setOfficeAddress}
              />
            </View>
          </View>
        </View>

        {/* Section 2: Tournament & Match Defaults */}
        <View style={styles.settingsCard}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Tournament & Match Defaults</Text>
            <Text style={styles.cardSub}>
              Preset parameters applied automatically when creating new leagues and scheduling matches.
            </Text>
          </View>

          <View style={styles.cardBody}>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={[styles.fieldGroup, { flex: 1 }]}>
                <Text style={styles.fieldLabel}>Default Match Format</Text>
                <select
                  value={defaultFormat}
                  onChange={(e) => setDefaultFormat(e.target.value)}
                  style={{
                    padding: '9px 12px',
                    fontSize: 13,
                    borderRadius: 6,
                    border: '1px solid #CBD5E1',
                    backgroundColor: '#FFFFFF',
                    color: '#1E293B',
                    width: '100%',
                    outlineStyle: 'none'
                  }}
                >
                  <option value="T20">Twenty20 (T20)</option>
                  <option value="ODI">One Day International (50 Overs)</option>
                  <option value="T10">T10 League (10 Overs)</option>
                </select>
              </View>

              <View style={[styles.fieldGroup, { flex: 1 }]}>
                <Text style={styles.fieldLabel}>Default Overs Per Innings</Text>
                <TextInput
                  style={styles.input}
                  value={defaultOvers}
                  onChangeText={setDefaultOvers}
                  keyboardType="numeric"
                />
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Official Ball Type</Text>
              <select
                value={ballType}
                onChange={(e) => setBallType(e.target.value)}
                style={{
                  padding: '9px 12px',
                  fontSize: 13,
                  borderRadius: 6,
                  border: '1px solid #CBD5E1',
                  backgroundColor: '#FFFFFF',
                  color: '#1E293B',
                  width: '100%',
                  outlineStyle: 'none'
                }}
              >
                <option value="WHITE_LEATHER">White Leather (Regulation Match Ball)</option>
                <option value="RED_LEATHER">Red Leather (Traditional Multi-day / League)</option>
                <option value="PINK_LEATHER">Pink Leather (Day / Night Special)</option>
                <option value="TENNIS_HEAVY">Heavy Tennis Ball (District Open)</option>
              </select>
            </View>
          </View>
        </View>

        {/* Section 3: Active Administrator Identity */}
        <View style={styles.settingsCard}>
          <View style={styles.cardHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <ShieldIcon size={18} color="#0A2540" />
              <Text style={styles.cardTitle}>Administrator Account Profile</Text>
            </View>
            <Text style={styles.cardSub}>
              Active session identity with Master System Privileges.
            </Text>
          </View>

          <View style={styles.cardBody}>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={[styles.fieldGroup, { flex: 1 }]}>
                <Text style={styles.fieldLabel}>Administrator Name</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: '#F8FAFC' }]}
                  value={adminName}
                  editable={false}
                />
              </View>
              <View style={[styles.fieldGroup, { flex: 1 }]}>
                <Text style={styles.fieldLabel}>Registered Admin Email</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: '#F8FAFC' }]}
                  value={adminEmail}
                  editable={false}
                />
              </View>
            </View>

            <View style={styles.securityNote}>
              <Text style={styles.securityNoteTitle}>Security Protocol Active</Text>
              <Text style={styles.securityNoteText}>
                Your administrative privileges grant full oversight of registrations,
                scorecards, team approvals, and tournament sanctions. Passwords can be changed
                by authorized chief administration officers via the master database credentials.
              </Text>
            </View>
          </View>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  content: {
    paddingBottom: 40
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#0A2540',
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 6
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600'
  },
  sectionsGrid: {
    gap: 20
  },
  settingsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden'
  },
  cardHeader: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: '#F8FAFC',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9'
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0A2540'
  },
  cardSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2
  },
  cardBody: {
    padding: 20
  },
  fieldGroup: {
    marginBottom: 14
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 6
  },
  input: {
    height: 38,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 6,
    paddingHorizontal: 12,
    fontSize: 13,
    color: '#0F172A',
    backgroundColor: '#FFFFFF'
  },
  securityNote: {
    marginTop: 8,
    padding: 14,
    borderRadius: 8,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE'
  },
  securityNoteTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1D4ED8'
  },
  securityNoteText: {
    fontSize: 12,
    color: '#1E40AF',
    marginTop: 4,
    lineHeight: 18
  }
});

export default SettingsPage;
