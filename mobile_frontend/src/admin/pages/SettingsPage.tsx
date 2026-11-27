/**
 * src/admin/pages/SettingsPage.tsx
 * Dynamic Settings Management for Cricket Association Professional Admin Panel.
 * Supports dynamic configuration and CRUD operations for:
 * - Taluk Jurisdiction
 * - Playing Role
 * - Batting Style
 * - Age Category
 * - Certification Level
 * - Umpire Certification / Qualification
 * - State
 * Along with Association registry settings saved to database.
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Modal,
  ActivityIndicator,
  Platform,
  Switch,
  useWindowDimensions
} from 'react-native';
import PageHeader from '../components/PageHeader';
import LoadingSkeleton from '../components/LoadingSkeleton';
import EmptyState from '../components/EmptyState';
import { ConfirmDialog } from '../components/ConfirmDialog';
import {
  CheckIcon,
  ShieldIcon,
  PlusIcon,
  TrashIcon,
  SearchIcon,
  RefreshIcon,
  CloseIcon
} from '../components/Icons';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { adminApi } from '../services/adminApi';
import { useAdminLayout } from '../components/AdminLayout';

export interface DynamicCategoryDef {
  key: string;
  label: string;
  iconName: string;
  iconFamily: 'Ionicons' | 'MaterialCommunityIcons';
  singular: string;
  description: string;
  placeholder: string;
  defaultSeedCount?: number;
}

const renderCategoryIcon = (cat?: DynamicCategoryDef, size = 16, color = '#0f172a') => {
  const family = cat?.iconFamily || 'Ionicons';
  const name = cat?.iconName || 'location-outline';
  if (family === 'MaterialCommunityIcons') {
    return <MaterialCommunityIcons name={name as any} size={size} color={color} />;
  }
  return <Ionicons name={name as any} size={size} color={color} />;
};

export const DYNAMIC_CATEGORIES: DynamicCategoryDef[] = [
  {
    key: 'taluk_jurisdiction',
    label: 'Taluk Jurisdiction',
    iconName: 'location-outline',
    iconFamily: 'Ionicons',
    singular: 'Taluk',
    description: 'Manage geographical taluks and administrative jurisdictions within the district.',
    placeholder: 'e.g. Sivakasi, Virudhunagar, Kariapatti'
  },
  {
    key: 'playing_role',
    label: 'Playing Role',
    iconName: 'cricket',
    iconFamily: 'MaterialCommunityIcons',
    singular: 'Playing Role',
    description: 'Configure official playing roles and on-field player specializations.',
    placeholder: 'e.g. Batsman, Bowler, All-Rounder, Wicket Keeper'
  },
  {
    key: 'batting_style',
    label: 'Batting Style',
    iconName: 'flash-outline',
    iconFamily: 'Ionicons',
    singular: 'Batting Style',
    description: 'Configure recognized batting stances and techniques.',
    placeholder: 'e.g. Right-Handed Batsman, Left-Handed Batsman'
  },
  {
    key: 'age_category',
    label: 'Age Category',
    iconName: 'trophy-outline',
    iconFamily: 'Ionicons',
    singular: 'Age Category',
    description: 'Official age brackets for tournaments, matches, and player rosters.',
    placeholder: 'e.g. Under-19, Under-16, Senior Men, Under-23'
  },
  {
    key: 'certification_level',
    label: 'Certification Level',
    iconName: 'document-text-outline',
    iconFamily: 'Ionicons',
    singular: 'Scorer Level',
    description: 'Accreditation tiers and federation certifications for official match scorers.',
    placeholder: 'e.g. District Certified, State Panel, Club Scorer'
  },
  {
    key: 'umpire_certification',
    label: 'Umpire Certification / Qualification',
    iconName: 'scale-balance',
    iconFamily: 'MaterialCommunityIcons',
    singular: 'Umpire Qualification',
    description: 'Official match umpire panel tiers, badges, and federation qualifications.',
    placeholder: 'e.g. State Panel A (Senior), BCCI Level 1 Certified'
  },
  {
    key: 'state',
    label: 'State',
    iconName: 'globe-outline',
    iconFamily: 'Ionicons',
    singular: 'State',
    description: 'Affiliated states and regional territories for match and player origin.',
    placeholder: 'e.g. Tamil Nadu, Kerala, Karnataka'
  },
  {
    key: 'ground',
    label: 'Ground',
    iconName: 'stadium-variant',
    iconFamily: 'MaterialCommunityIcons',
    singular: 'Ground',
    description: 'Add and manage official cricket grounds stored in the database for match scheduling.',
    placeholder: 'e.g. Kamarajar District Stadium, Sivakasi Cricket Ground'
  },
  {
    key: 'district_venue',
    label: 'Primary District Venue / Stadium',
    iconName: 'stadium-variant',
    iconFamily: 'MaterialCommunityIcons',
    singular: 'Venue / Stadium',
    description: 'Configure and manage official district stadiums, grounds, and match venues.',
    placeholder: 'e.g. Kamarajar District Stadium, Sivakasi Cricket Ground'
  }
];

interface MasterSettingItem {
  id: string;
  category: string;
  name: string;
  code?: string;
  description?: string;
  is_active: boolean;
  sort_order?: number;
  created_at?: string;
}

export const DEFAULT_MASTER_SETTINGS: Record<string, MasterSettingItem[]> = {
  taluk_jurisdiction: [
    { id: 'MSET-TALUK-01', category: 'taluk_jurisdiction', name: 'Virudhunagar', code: 'VNR', description: 'Virudhunagar Taluk Jurisdiction Headquarters', is_active: true, sort_order: 1 },
    { id: 'MSET-TALUK-02', category: 'taluk_jurisdiction', name: 'Sivakasi', code: 'SVKS', description: 'Sivakasi Industrial Taluk Jurisdiction', is_active: true, sort_order: 2 },
    { id: 'MSET-TALUK-03', category: 'taluk_jurisdiction', name: 'Rajapalayam', code: 'RJPM', description: 'Rajapalayam Taluk Jurisdiction', is_active: true, sort_order: 3 },
    { id: 'MSET-TALUK-04', category: 'taluk_jurisdiction', name: 'Srivilliputhur', code: 'SVPR', description: 'Srivilliputhur Heritage Taluk Jurisdiction', is_active: true, sort_order: 4 },
    { id: 'MSET-TALUK-05', category: 'taluk_jurisdiction', name: 'Aruppukottai', code: 'APKI', description: 'Aruppukottai Taluk Jurisdiction', is_active: true, sort_order: 5 },
    { id: 'MSET-TALUK-06', category: 'taluk_jurisdiction', name: 'Sattur', code: 'STR', description: 'Sattur Taluk Jurisdiction', is_active: true, sort_order: 6 },
    { id: 'MSET-TALUK-08', category: 'taluk_jurisdiction', name: 'Kariapatti', code: 'KPT', description: 'Kariapatti Taluk Jurisdiction', is_active: true, sort_order: 7 },
    { id: 'MSET-TALUK-09', category: 'taluk_jurisdiction', name: 'Tiruchuli', code: 'TCL', description: 'Tiruchuli Taluk Jurisdiction', is_active: true, sort_order: 9 },
    { id: 'MSET-TALUK-10', category: 'taluk_jurisdiction', name: 'Vembakottai', code: 'VBK', description: 'Vembakottai Archaeological Taluk Jurisdiction', is_active: true, sort_order: 10 },
    { id: 'MSET-TALUK-11', category: 'taluk_jurisdiction', name: 'Other', code: 'OTHER', description: 'Other Regional Jurisdiction outside specified taluks', is_active: true, sort_order: 11 }
  ],
  playing_role: [
    { id: 'MSET-ROLE-01', category: 'playing_role', name: 'Batsman', code: 'BAT', description: 'Top-order / Middle-order specialist batter', is_active: true, sort_order: 1 },
    { id: 'MSET-ROLE-02', category: 'playing_role', name: 'Bowler', code: 'BOWL', description: 'Frontline strike bowler (Fast/Medium/Spin)', is_active: true, sort_order: 2 },
    { id: 'MSET-ROLE-03', category: 'playing_role', name: 'All-Rounder', code: 'AR', description: 'Multi-discipline player proficient in both batting and bowling', is_active: true, sort_order: 3 },
    { id: 'MSET-ROLE-04', category: 'playing_role', name: 'Wicket Keeper', code: 'WK', description: 'Designated wicket keeper and wicket keeper-batter', is_active: true, sort_order: 4 },
    { id: 'MSET-ROLE-05', category: 'playing_role', name: 'Captain', code: 'CPT', description: 'Appointed team captain and on-field leader', is_active: true, sort_order: 5 },
    { id: 'MSET-ROLE-06', category: 'playing_role', name: 'Vice Captain', code: 'VC', description: 'Appointed squad vice captain', is_active: true, sort_order: 6 }
  ],
  batting_style: [
    { id: 'MSET-BAT-01', category: 'batting_style', name: 'Right-Handed Batsman', code: 'RHB', description: 'Right-hand batting stance and technique', is_active: true, sort_order: 1 },
    { id: 'MSET-BAT-02', category: 'batting_style', name: 'Left-Handed Batsman', code: 'LHB', description: 'Left-hand batting stance and technique', is_active: true, sort_order: 2 }
  ],
  age_category: [
    { id: 'MSET-AGE-01', category: 'age_category', name: 'Senior Men', code: 'SR_MEN', description: "Open division men's senior district cricket category", is_active: true, sort_order: 1 },
    { id: 'MSET-AGE-02', category: 'age_category', name: "Women's Senior", code: 'SR_WOMEN', description: "Open division women's senior district cricket category", is_active: true, sort_order: 2 },
    { id: 'MSET-AGE-03', category: 'age_category', name: 'Under-23', code: 'U23', description: 'Colts and young emerging adults under 23 years of age', is_active: true, sort_order: 3 },
    { id: 'MSET-AGE-04', category: 'age_category', name: 'Under-19', code: 'U19', description: 'Junior district age group under 19 years of age', is_active: true, sort_order: 4 },
    { id: 'MSET-AGE-05', category: 'age_category', name: 'Under-16', code: 'U16', description: 'Sub-junior division under 16 years of age', is_active: true, sort_order: 5 },
    { id: 'MSET-AGE-06', category: 'age_category', name: 'Under-14', code: 'U14', description: 'Cadet and youth development division under 14 years of age', is_active: true, sort_order: 6 },
    { id: 'MSET-AGE-07', category: 'age_category', name: 'Under-12', code: 'U12', description: 'Grassroots foundational cricket division under 12 years of age', is_active: true, sort_order: 7 }
  ],
  certification_level: [
    { id: 'MSET-SCERT-01', category: 'certification_level', name: 'District Certified', code: 'DIST_CERT', description: 'Accredited district scorer certified by Virudhunagar Cricket Association', is_active: true, sort_order: 1 },
    { id: 'MSET-SCERT-02', category: 'certification_level', name: 'State Panel', code: 'STATE_PANEL', description: 'Official state panel digital and manual match scorer', is_active: true, sort_order: 2 },
    { id: 'MSET-SCERT-03', category: 'certification_level', name: 'Club Scorer', code: 'CLUB_SCR', description: 'Registered local club match scorer', is_active: true, sort_order: 3 },
    { id: 'MSET-SCERT-04', category: 'certification_level', name: 'Trainee Scorer', code: 'TRAINEE_SCR', description: 'Apprentice scorer undergoing digital scorekeeping certification', is_active: true, sort_order: 4 }
  ],
  umpire_certification: [
    { id: 'MSET-UCERT-01', category: 'umpire_certification', name: 'State Panel A (Senior)', code: 'STATE_PANEL_A', description: 'State Association Panel A Senior Umpire authorized for premier league fixtures', is_active: true, sort_order: 1 },
    { id: 'MSET-UCERT-02', category: 'umpire_certification', name: 'State Panel B', code: 'STATE_PANEL_B', description: 'State Association Panel B Umpire authorized for state & division matches', is_active: true, sort_order: 2 },
    { id: 'MSET-UCERT-03', category: 'umpire_certification', name: 'BCCI Level 1 Certified', code: 'BCCI_L1', description: 'National BCCI Level 1 Certified Match Official', is_active: true, sort_order: 3 },
    { id: 'MSET-UCERT-04', category: 'umpire_certification', name: 'District Senior Panel', code: 'DIST_SR_PANEL', description: 'Senior District Panel Umpire with 5+ years official umpiring tenure', is_active: true, sort_order: 4 },
    { id: 'MSET-UCERT-05', category: 'umpire_certification', name: 'District Certified Umpire', code: 'DIST_CERT_UMP', description: 'Accredited district match umpire certified under MCC Cricket Laws', is_active: true, sort_order: 5 },
    { id: 'MSET-UCERT-06', category: 'umpire_certification', name: 'Trainee Umpire', code: 'TRAINEE_UMP', description: 'Provisional trainee umpire currently under field mentorship', is_active: true, sort_order: 6 }
  ],
  state: [
    { id: 'MSET-STATE-01', category: 'state', name: 'Tamil Nadu', code: 'TN', description: 'Tamil Nadu State, India', is_active: true, sort_order: 1 },
    { id: 'MSET-STATE-02', category: 'state', name: 'Kerala', code: 'KL', description: 'Kerala State, India', is_active: true, sort_order: 2 },
    { id: 'MSET-STATE-03', category: 'state', name: 'Karnataka', code: 'KA', description: 'Karnataka State, India', is_active: true, sort_order: 3 },
    { id: 'MSET-STATE-04', category: 'state', name: 'Andhra Pradesh', code: 'AP', description: 'Andhra Pradesh State, India', is_active: true, sort_order: 4 },
    { id: 'MSET-STATE-05', category: 'state', name: 'Telangana', code: 'TS', description: 'Telangana State, India', is_active: true, sort_order: 5 },
    { id: 'MSET-STATE-06', category: 'state', name: 'Pondicherry', code: 'PY', description: 'Puducherry Union Territory, India', is_active: true, sort_order: 6 },
    { id: 'MSET-STATE-07', category: 'state', name: 'Other', code: 'OTHER', description: 'Other Indian States / Union Territories', is_active: true, sort_order: 7 }
  ],
  district_venue: [
    { id: 'VEN-01', category: 'district_venue', name: 'Kamarajar District Stadium', code: 'KDS', description: 'Virudhunagar Headquarters Main Turf Stadium', is_active: true, sort_order: 1 },
    { id: 'VEN-02', category: 'district_venue', name: 'Municipal Cricket Complex', code: 'MCC', description: 'Municipal Cricket Complex, Sivakasi', is_active: true, sort_order: 2 },
    { id: 'VEN-03', category: 'district_venue', name: 'Rajapalayam RAC Ground', code: 'RAC', description: 'PACR Road, Rajapalayam', is_active: true, sort_order: 3 },
    { id: 'VEN-04', category: 'district_venue', name: 'Aruppukottai Pavilion Turf Ground', code: 'APTG', description: 'Pavilion Turf Ground, Aruppukottai', is_active: true, sort_order: 4 }
  ]
};

interface Props {
  initialCategory?: string;
  onNavigate?: (path: string) => void;
}

export const SettingsPage: React.FC<Props> = ({ initialCategory, onNavigate }) => {
  const { showToast } = useAdminLayout();
  const { width } = useWindowDimensions();
  const isMobile = width < 768;
  const isSmall = width < 480;

  // Normalize initial category
  const getInitialTab = (): string => {
    if (!initialCategory || initialCategory === 'association' || initialCategory === 'settings') {
      return 'taluk_jurisdiction';
    }
    const normalized = initialCategory.replace(/-/g, '_').toLowerCase();
    const match = DYNAMIC_CATEGORIES.find(c => c.key === normalized);
    return match ? match.key : 'taluk_jurisdiction';
  };

  const [activeTab, setActiveTab] = useState<string>(getInitialTab());
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [items, setItems] = useState<MasterSettingItem[]>(
    DEFAULT_MASTER_SETTINGS[getInitialTab()] || []
  );
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Add Item Modal State
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [newName, setNewName] = useState<string>('');
  const [newCode, setNewCode] = useState<string>('');
  const [newDescription, setNewDescription] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Delete Confirmation Dialog State
  const [itemToDelete, setItemToDelete] = useState<MasterSettingItem | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // Admin Emblem Stealth Sequence State
  const [emblemEnabled, setEmblemEnabled] = useState<boolean>(true);
  const [emblemSequence, setEmblemSequence] = useState<Array<'LEFT' | 'RIGHT' | 'CENTER'>>([
    'LEFT', 'RIGHT', 'LEFT', 'RIGHT', 'CENTER'
  ]);
  const [emblemSaving, setEmblemSaving] = useState<boolean>(false);
  const [emblemExpanded, setEmblemExpanded] = useState<boolean>(false);

  // Association Rule 15 (Minimum Players Per Team) State
  const [rule15Enabled, setRule15Enabled] = useState<boolean>(true);
  const [rule15MinPlayers, setRule15MinPlayers] = useState<number>(9);
  const [rule15Text, setRule15Text] = useState<string>('');
  const [rule15Saving, setRule15Saving] = useState<boolean>(false);
  const [rule15Expanded, setRule15Expanded] = useState<boolean>(false);

  // Office Bearers & Ground In-Charges State (100% English Admin UI)
  const [committeeEnabled, setCommitteeEnabled] = useState<boolean>(true);
  const [committeeTitle, setCommitteeTitle] = useState<string>('Tournament Committee & Office Bearers');
  const [committeeRoles, setCommitteeRoles] = useState<Array<{ roleTitle: string; members: string }>>([
    { roleTitle: 'Tournament Coordinator', members: 'D. Saravanamuthu (Assistant Secretary)' },
    { roleTitle: 'Assistants', members: 'Thangamarimuthu (JC), B. Sri Vallaba Ganesh (Redrose)' },
    { roleTitle: 'Registration Coordinators', members: 'M. Suresh (Yazhini), Christopher (Yazhini)' },
    { roleTitle: 'Umpire & Scorer Coordinator', members: 'S. Kabirthasan • Assistants: G. Sankar (Nature), Guhan (Sasinagar)' },
    { roleTitle: 'Media Coordinators', members: 'R. Sankar (Joint Secretary), M. Manikannan (Miraculous)' }
  ]);
  const [groundInCharges, setGroundInCharges] = useState<Array<{ groundName: string; inCharge: string }>>([
    { groundName: 'Ramco Cements Turf', inCharge: 'Ramco' },
    { groundName: 'CFVD Ground', inCharge: 'Shooters' },
    { groundName: 'Mepco', inCharge: 'Physical Education Director' },
    { groundName: 'PACR', inCharge: 'Ramco' },
    { groundName: 'AAA', inCharge: 'War Horses & Leo Sports' },
    { groundName: 'MCC', inCharge: 'Mathai' }
  ]);
  const [teamNotice, setTeamNotice] = useState<string>(
    'On every match day, each team must nominate 3 members from their squad for match official duties. We kindly request everyone to keep the ground clean.'
  );
  const [signatoryTitle, setSignatoryTitle] = useState<string>('Secretary');
  const [signatoryName, setSignatoryName] = useState<string>('P. Mohanraj');
  const [noticeDate, setNoticeDate] = useState<string>('21.11.2026');
  const [committeeSaving, setCommitteeSaving] = useState<boolean>(false);
  const [committeeExpanded, setCommitteeExpanded] = useState<boolean>(false);
  const [emailStatus, setEmailStatus] = useState<{
    date?: string;
    count?: number;
    failures?: number;
    currentProvider?: string;
    fallbackProvider?: string;
    alertSentAt?: string | null;
  } | null>(null);

  useEffect(() => {
    adminApi
      .getEmailStatus()
      .then((res: any) => {
        if (res?.success) {
          setEmailStatus(res);
        }
      })
      .catch(() => {});
    adminApi
      .getEmblemSequence()
      .then((res: any) => {
        if (res?.success && res.config) {
          setEmblemEnabled(Boolean(res.config.enabled));
          if (Array.isArray(res.config.sequence)) {
            setEmblemSequence(res.config.sequence);
          }
        }
      })
      .catch(() => {});

    adminApi
      .getRule15Config()
      .then((res: any) => {
        if (res?.success && res.config) {
          setRule15Enabled(res.config.enabled !== false);
          if (typeof res.config.minPlayers === 'number') {
            setRule15MinPlayers(res.config.minPlayers);
          }
          if (typeof res.config.ruleText === 'string') {
            setRule15Text(res.config.ruleText);
          }
        }
      })
      .catch(() => {});

    adminApi
      .getCommitteeMembers()
      .then((res: any) => {
        if (res?.success && res.config) {
          setCommitteeEnabled(res.config.enabled !== false);
          if (res.config.sectionTitle) setCommitteeTitle(res.config.sectionTitle);
          if (Array.isArray(res.config.roles)) setCommitteeRoles(res.config.roles);
          if (Array.isArray(res.config.groundInCharges)) setGroundInCharges(res.config.groundInCharges);
          if (typeof res.config.teamNotice === 'string') setTeamNotice(res.config.teamNotice);
          if (typeof res.config.signatoryTitle === 'string') setSignatoryTitle(res.config.signatoryTitle);
          if (typeof res.config.signatoryName === 'string') setSignatoryName(res.config.signatoryName);
          if (typeof res.config.noticeDate === 'string') setNoticeDate(res.config.noticeDate);
        }
      })
      .catch(() => {});
  }, []);

  const handleSaveCommittee = async (nextEnabled = committeeEnabled) => {
    setCommitteeSaving(true);
    try {
      const res = await adminApi.updateCommitteeMembers({
        enabled: nextEnabled,
        sectionTitle: committeeTitle,
        roles: committeeRoles.filter(r => r.roleTitle.trim() && r.members.trim()),
        groundInCharges: groundInCharges.filter(g => g.groundName.trim() && g.inCharge.trim()),
        teamNotice,
        signatoryTitle,
        signatoryName,
        noticeDate
      });
      if (res?.success) {
        showToast(
          nextEnabled
            ? 'Office Bearers & Ground In-Charges saved to Home website.'
            : 'Office Bearers section hidden from Home website.',
          'success'
        );
      } else {
        showToast(res?.error || 'Failed to save Office Bearers.', 'error');
      }
    } catch (err: any) {
      showToast(err?.message || 'Failed to save Office Bearers.', 'error');
    } finally {
      setCommitteeSaving(false);
    }
  };

  const handleSaveRule15 = async (
    nextEnabled = rule15Enabled,
    nextMin = rule15MinPlayers,
    nextText = rule15Text
  ) => {
    if (nextMin < 1 || nextMin > 11) {
      showToast('Minimum players must be between 1 and 11.', 'error');
      return;
    }
    setRule15Saving(true);
    try {
      const res = await adminApi.updateRule15Config({
        enabled: nextEnabled,
        minPlayers: nextMin,
        ruleText: nextText
      });
      if (res?.success) {
        showToast(
          nextEnabled
            ? `Rule 15 updated: Minimum ${nextMin} players per team`
            : 'Rule 15 minimum attendance check disabled',
          'success'
        );
      } else {
        showToast(res?.error || 'Failed to save Rule 15 settings.', 'error');
      }
    } catch (err: any) {
      showToast(err?.message || 'Failed to save Rule 15 settings.', 'error');
    } finally {
      setRule15Saving(false);
    }
  };

  const handleSaveEmblemSequence = async (nextEnabled = emblemEnabled, nextSeq = emblemSequence) => {
    if (nextEnabled && nextSeq.length === 0) {
      showToast('Please add at least 1 ball click to the sequence, or turn off emblem access.', 'error');
      return;
    }
    setEmblemSaving(true);
    try {
      const res = await adminApi.updateEmblemSequence({
        enabled: nextEnabled,
        sequence: nextSeq
      });
      if (res?.success) {
        showToast(
          nextEnabled
            ? `Emblem admin access updated (${nextSeq.length} clicks)`
            : 'Emblem admin access disabled on Home page',
          'success'
        );
      } else {
        showToast(res?.error || 'Failed to save emblem sequence.', 'error');
      }
    } catch (err: any) {
      showToast(err?.message || 'Failed to save emblem sequence.', 'error');
    } finally {
      setEmblemSaving(false);
    }
  };

  // Sync initialCategory when route changes
  useEffect(() => {
    if (initialCategory && initialCategory !== 'association' && initialCategory !== 'settings') {
      const normalized = initialCategory.replace(/-/g, '_').toLowerCase();
      const match = DYNAMIC_CATEGORIES.find(c => c.key === normalized);
      if (match && match.key !== activeTab) {
        setActiveTab(match.key);
      }
    }
  }, [initialCategory]);

  // Load items whenever active dynamic category changes (Database only - no localStorage)
  const loadCategoryItems = async (categoryKey: string) => {
    // Clean up any legacy localStorage items if present
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem(`mset_added_${categoryKey}`);
        localStorage.removeItem(`mset_del_${categoryKey}`);
      } catch (e) {}
    }

    setLoading(true);

    try {
      const res = await adminApi.getMasterSettings(categoryKey);
      let loaded: MasterSettingItem[] = [];
      if (res && res.success && Array.isArray(res.data) && res.data.length > 0) {
        loaded = res.data;
      } else if (res && Array.isArray(res) && res.length > 0) {
        loaded = res;
      } else if (res && res.items && Array.isArray(res.items) && res.items.length > 0) {
        loaded = res.items;
      } else if (res && res.grouped && res.grouped[categoryKey]?.items && res.grouped[categoryKey].items.length > 0) {
        loaded = res.grouped[categoryKey].items;
      }

      if (loaded.length > 0) {
        setItems(loaded);
      } else {
        const defaults = DEFAULT_MASTER_SETTINGS[categoryKey] || [];
        setItems(defaults);
      }
    } catch (err: any) {
      console.warn('Load category items error from database:', err);
      const defaults = DEFAULT_MASTER_SETTINGS[categoryKey] || [];
      setItems(defaults);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCategoryItems(activeTab);
  }, [activeTab]);

  const activeCategoryDef = DYNAMIC_CATEGORIES.find(c => c.key === activeTab);

  // Filtered Items
  const filteredItems = items.filter(item => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      item.name.toLowerCase().includes(q) ||
      (item.code && item.code.toLowerCase().includes(q)) ||
      (item.description && item.description.toLowerCase().includes(q))
    );
  });

  // Handle Add Item Submit - Stores strictly in database
  const handleAddItem = async () => {
    const trimmedName = newName.trim();
    if (!trimmedName) {
      setFormError('Please enter a valid option name.');
      return;
    }
    setIsSubmitting(true);
    setFormError(null);

    const generatedCode = newCode.trim() 
      ? newCode.trim().toUpperCase() 
      : trimmedName.toUpperCase().replace(/\s+/g, '_').substring(0, 20);

    // Call backend API to persist to MongoDB database
    try {
      const res = await adminApi.addMasterSetting({
        category: activeTab,
        name: trimmedName,
        code: generatedCode,
        description: newDescription.trim() || undefined
      });

      if (!res || (!res.success && !res.data)) {
        throw new Error(res?.message || 'Failed to save setting to database.');
      }

      const createdItem: MasterSettingItem = res.data || {
        id: res.id || `MSET-${Date.now()}`,
        category: activeTab,
        name: trimmedName,
        code: generatedCode,
        description: newDescription.trim() || undefined,
        is_active: true
      };

      // Add to UI state directly from saved database record
      setItems(prev => {
        const filtered = prev.filter(
          it => it.id !== createdItem.id && it.name.toLowerCase() !== createdItem.name.toLowerCase()
        );
        return [...filtered, createdItem];
      });

      setShowAddModal(false);
      setNewName('');
      setNewCode('');
      setNewDescription('');

      // Dispatch cross-screen notification event without localStorage
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('master_settings_updated', {
            detail: { category: activeTab, item: createdItem }
          })
        );
        window.dispatchEvent(
          new CustomEvent('venues_updated', {
            detail: { venue: createdItem }
          })
        );
      }

      showToast(res?.message || `Added "${trimmedName}" to database successfully!`, 'success');
    } catch (err: any) {
      console.error('Failed to save master setting to database:', err);
      const errMsg = err?.message || 'Database error: Failed to save setting. Please check connection.';
      setFormError(errMsg);
      showToast(errMsg, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Delete Confirmation - Deletes strictly from database
  const confirmDelete = async () => {
    if (!itemToDelete) return;
    const target = itemToDelete;
    setIsDeleting(true);

    try {
      const res = await adminApi.deleteMasterSetting(target.id);
      if (!res || (!res.success && res.success !== undefined)) {
        throw new Error(res?.message || 'Failed to delete setting from database.');
      }

      // Remove from UI state only when database delete succeeds
      setItems(prev => prev.filter(it => it.id !== target.id && it.name !== target.name));
      setItemToDelete(null);

      // Dispatch cross-screen notification event
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('master_settings_updated', {
            detail: { category: activeTab, deletedId: target.id, deletedName: target.name }
          })
        );
        window.dispatchEvent(
          new CustomEvent('venues_updated', {
            detail: { deletedId: target.id, deletedName: target.name }
          })
        );
      }

      showToast(res?.message || `Deleted "${target.name}" from database successfully!`, 'success');
    } catch (err: any) {
      console.error('Failed to delete master setting from database:', err);
      showToast(err?.message || `Failed to delete "${target.name}" from database.`, 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <View style={[styles.container, isMobile && { padding: 12 }]}>
      {/* Top Header */}
      <PageHeader
        title="Settings"
        subtitle="Manage official dynamic lookup categories and options saved in MongoDB database."
        breadcrumbs={[
          { label: 'Admin', link: '/admin/dashboard' },
          { label: 'Settings', link: '/admin/settings' },
          ...(activeCategoryDef ? [{ label: activeCategoryDef.label }] : [])
        ]}
      />

      {/* STEALTH ADMIN EMBLEM ACCESS SECURITY CARD */}
      <View style={{
        backgroundColor: '#ffffff',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: emblemEnabled ? '#fde68a' : '#e2e8f0',
        padding: isMobile ? 14 : 16,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 4,
        elevation: 2
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <View style={{ flex: 1, minWidth: 220 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="lock-closed" size={16} color="#0f172a" />
                <Text style={{ fontSize: 15, fontWeight: '900', color: '#0f172a' }}>
                  Home Emblem Admin Login Trigger
                </Text>
              </View>
              <View style={{
                backgroundColor: emblemEnabled ? '#dcfce7' : '#fee2e2',
                paddingHorizontal: 8,
                paddingVertical: 2,
                borderRadius: 6
              }}>
                <Text style={{ fontSize: 10.5, fontWeight: '800', color: emblemEnabled ? '#166534' : '#991b1b' }}>
                  {emblemEnabled ? `ACTIVE • ${emblemSequence.length} CLICKS` : 'DISABLED'}
                </Text>
              </View>
            </View>
            <Text style={{ fontSize: 12, color: '#64748b', marginTop: 3 }}>
              Control whether tapping the Left, Right &amp; Center balls on the Home crest opens Admin Login, and customize the exact click order.
            </Text>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Switch
              value={emblemEnabled}
              onValueChange={(val) => {
                setEmblemEnabled(val);
                handleSaveEmblemSequence(val, emblemSequence);
              }}
              trackColor={{ false: '#cbd5e1', true: '#f59e0b' }}
              thumbColor="#ffffff"
            />
            <TouchableOpacity
              onPress={() => setEmblemExpanded(prev => !prev)}
              activeOpacity={0.8}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: 8,
                backgroundColor: emblemExpanded ? '#fef3c7' : '#f8fafc',
                borderWidth: 1,
                borderColor: emblemExpanded ? '#f59e0b' : '#cbd5e1',
                flexDirection: 'row',
                alignItems: 'center',
                gap: 5
              }}
            >
              <Ionicons name={emblemExpanded ? 'chevron-up' : 'settings-outline'} size={13} color={emblemExpanded ? '#92400e' : '#334155'} />
              <Text style={{ fontSize: 12, fontWeight: '700', color: emblemExpanded ? '#92400e' : '#334155' }}>
                {emblemExpanded ? 'Hide Sequence' : 'Configure Sequence'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {emblemExpanded && (
          <View style={{ marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: '#f1f5f9' }}>
            <Text style={{ fontSize: 11.5, fontWeight: '800', color: '#475569', textTransform: 'uppercase', marginBottom: 8 }}>
              Tap Ball Buttons in Desired Order (1 to 12 Clicks)
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
              {[
                { key: 'LEFT' as const, label: '+ Left Ball (9 o\'clock)' },
                { key: 'CENTER' as const, label: '+ Center Ball (In-Flight)' },
                { key: 'RIGHT' as const, label: '+ Right Ball (3 o\'clock)' }
              ].map(btn => (
                <TouchableOpacity
                  key={btn.key}
                  disabled={emblemSequence.length >= 12}
                  onPress={() => setEmblemSequence(prev => (prev.length < 12 ? [...prev, btn.key] : prev))}
                  activeOpacity={0.8}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderRadius: 8,
                    backgroundColor: '#fffbeb',
                    borderWidth: 1,
                    borderColor: '#f59e0b',
                    opacity: emblemSequence.length >= 12 ? 0.5 : 1
                  }}
                >
                  <Text style={{ fontSize: 12.5, fontWeight: '800', color: '#92400e' }}>{btn.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Current Sequence Order */}
            <Text style={{ fontSize: 11.5, fontWeight: '700', color: '#64748b', marginBottom: 6 }}>
              Configured Sequence Order ({emblemSequence.length} clicks — tap a step to remove):
            </Text>
            <View style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              gap: 6,
              backgroundColor: '#f8fafc',
              borderWidth: 1,
              borderColor: '#e2e8f0',
              borderRadius: 10,
              padding: 10,
              minHeight: 46,
              alignItems: 'center'
            }}>
              {emblemSequence.length === 0 ? (
                <Text style={{ fontSize: 12, color: '#94a3b8', fontStyle: 'italic' }}>
                  No clicks added yet. Tap Left, Center, or Right Ball above to build your sequence.
                </Text>
              ) : (
                emblemSequence.map((ball, idx) => (
                  <TouchableOpacity
                    key={`${ball}-${idx}`}
                    onPress={() => setEmblemSequence(prev => prev.filter((_, i) => i !== idx))}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 5,
                      backgroundColor: '#ffffff',
                      borderWidth: 1,
                      borderColor: '#cbd5e1',
                      borderRadius: 8,
                      paddingHorizontal: 9,
                      paddingVertical: 5
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Text style={{ fontSize: 11.5, fontWeight: '800', color: '#0f172a' }}>{idx + 1}.</Text>
                      <Ionicons
                        name={ball === 'LEFT' ? 'arrow-back' : ball === 'RIGHT' ? 'arrow-forward' : 'locate'}
                        size={12}
                        color="#0f172a"
                      />
                      <Text style={{ fontSize: 11.5, fontWeight: '800', color: '#0f172a' }}>
                        {ball === 'LEFT' ? 'Left' : ball === 'RIGHT' ? 'Right' : 'Center'}
                      </Text>
                    </View>
                    <Ionicons name="close" size={12} color="#ef4444" />
                  </TouchableOpacity>
                ))
              )}
            </View>

            {/* Counts & Action Row */}
            <View style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 10,
              marginTop: 12
            }}>
              <Text style={{ fontSize: 12, color: '#475569', fontWeight: '600' }}>
                Left: {emblemSequence.filter(b => b === 'LEFT').length} • Center: {emblemSequence.filter(b => b === 'CENTER').length} • Right: {emblemSequence.filter(b => b === 'RIGHT').length}
              </Text>
              <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                <TouchableOpacity
                  onPress={() => setEmblemSequence([])}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: '#e2e8f0',
                    backgroundColor: '#ffffff'
                  }}
                >
                  <Text style={{ fontSize: 12, fontWeight: '700', color: '#64748b' }}>Clear</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setEmblemSequence(['LEFT', 'RIGHT', 'LEFT', 'RIGHT', 'CENTER'])}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: '#cbd5e1',
                    backgroundColor: '#f8fafc'
                  }}
                >
                  <Text style={{ fontSize: 12, fontWeight: '700', color: '#334155' }}>Reset Default (5)</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => handleSaveEmblemSequence(emblemEnabled, emblemSequence)}
                  disabled={emblemSaving}
                  style={{
                    paddingHorizontal: 14,
                    paddingVertical: 8,
                    borderRadius: 8,
                    backgroundColor: '#d97706',
                    opacity: emblemSaving ? 0.6 : 1,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 5
                  }}
                >
                  {!emblemSaving && <Ionicons name="checkmark" size={14} color="#ffffff" />}
                  <Text style={{ fontSize: 12.5, fontWeight: '800', color: '#ffffff' }}>
                    {emblemSaving ? 'Saving...' : 'Save Sequence'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
      </View>

      {/* ASSOCIATION RULE 15 • MATCH ATTENDANCE REQUIREMENT */}
      <View style={{
        backgroundColor: '#ffffff',
        borderRadius: 14,
        borderWidth: 1,
        borderColor: rule15Enabled ? '#fde68a' : '#e2e8f0',
        marginBottom: 16,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2
      }}>
        <TouchableOpacity
          activeOpacity={0.75}
          onPress={() => setRule15Expanded(prev => !prev)}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 16,
            paddingVertical: 14,
            backgroundColor: rule15Enabled ? '#fffbeb' : '#f8fafc'
          }}
        >
          <View style={{ flex: 1, marginRight: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="document-text-outline" size={16} color="#0f172a" />
                <Text style={{ fontSize: 15, fontWeight: '800', color: '#0f172a' }}>
                  Association Rule 15 • Match Attendance
                </Text>
              </View>
              <View style={{
                paddingHorizontal: 8,
                paddingVertical: 2,
                borderRadius: 999,
                backgroundColor: rule15Enabled ? '#fef3c7' : '#e2e8f0',
                borderWidth: 1,
                borderColor: rule15Enabled ? '#f59e0b' : '#cbd5e1'
              }}>
                <Text style={{
                  fontSize: 10.5,
                  fontWeight: '800',
                  color: rule15Enabled ? '#92400e' : '#475569'
                }}>
                  {rule15Enabled ? `ACTIVE • MIN ${rule15MinPlayers} PLAYERS` : 'DISABLED'}
                </Text>
              </View>
            </View>
            <Text style={{ fontSize: 12, color: '#64748b', marginTop: 3 }}>
              Configure minimum attending players required per team before a scorer can start a match
            </Text>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Switch
              value={rule15Enabled}
              onValueChange={(val) => {
                setRule15Enabled(val);
                handleSaveRule15(val, rule15MinPlayers, rule15Text);
              }}
              trackColor={{ false: '#cbd5e1', true: '#f59e0b' }}
              thumbColor="#ffffff"
            />
            <Text style={{ fontSize: 13, fontWeight: '700', color: '#475569' }}>
              {rule15Expanded ? '▲' : '▼'}
            </Text>
          </View>
        </TouchableOpacity>

        {rule15Expanded && (
          <View style={{ padding: 16, borderTopWidth: 1, borderTopColor: '#f1f5f9', gap: 14 }}>
            <View>
              <Text style={{ fontSize: 12, fontWeight: '800', color: '#334155', marginBottom: 8 }}>
                Minimum Players Required Per Team (1 – 11):
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                {[5, 7, 8, 9, 10, 11].map((num) => {
                  const active = rule15MinPlayers === num;
                  return (
                    <TouchableOpacity
                      key={`rule15-preset-${num}`}
                      onPress={() => setRule15MinPlayers(num)}
                      style={{
                        paddingHorizontal: 14,
                        paddingVertical: 8,
                        borderRadius: 10,
                        borderWidth: 1.5,
                        borderColor: active ? '#d97706' : '#cbd5e1',
                        backgroundColor: active ? '#fef3c7' : '#f8fafc'
                      }}
                    >
                      <Text style={{
                        fontSize: 13,
                        fontWeight: '800',
                        color: active ? '#92400e' : '#334155'
                      }}>
                        {num} Players
                      </Text>
                    </TouchableOpacity>
                  );
                })}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginLeft: 4 }}>
                  <TouchableOpacity
                    onPress={() => setRule15MinPlayers(prev => Math.max(1, prev - 1))}
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 8,
                      backgroundColor: '#f1f5f9',
                      borderWidth: 1,
                      borderColor: '#cbd5e1',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    <Text style={{ fontSize: 16, fontWeight: '800', color: '#0f172a' }}>-</Text>
                  </TouchableOpacity>
                  <Text style={{ minWidth: 28, textAlign: 'center', fontSize: 15, fontWeight: '800', color: '#0f172a' }}>
                    {rule15MinPlayers}
                  </Text>
                  <TouchableOpacity
                    onPress={() => setRule15MinPlayers(prev => Math.min(11, prev + 1))}
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 8,
                      backgroundColor: '#f1f5f9',
                      borderWidth: 1,
                      borderColor: '#cbd5e1',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    <Text style={{ fontSize: 16, fontWeight: '800', color: '#0f172a' }}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            <View>
              <Text style={{ fontSize: 12, fontWeight: '800', color: '#334155', marginBottom: 6 }}>
                Custom Rule Display Text (Optional — leave blank for automatic):
              </Text>
              <TextInput
                value={rule15Text}
                onChangeText={setRule15Text}
                placeholder={`Rule 15: A minimum of ${rule15MinPlayers} players must be present at the start of each innings.`}
                placeholderTextColor="#94a3b8"
                style={{
                  borderWidth: 1,
                  borderColor: '#cbd5e1',
                  borderRadius: 10,
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  fontSize: 13,
                  color: '#0f172a',
                  backgroundColor: '#f8fafc'
                }}
              />
            </View>

            <View style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 10,
              paddingTop: 4
            }}>
              <Text style={{ fontSize: 11.5, color: '#64748b', flex: 1 }}>
                Preview: &quot;{rule15Text.trim() || `Rule 15: A minimum of ${rule15MinPlayers} players must be present at the start of each innings.`}&quot;
              </Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity
                  onPress={() => {
                    setRule15Enabled(true);
                    setRule15MinPlayers(9);
                    setRule15Text('');
                  }}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: '#cbd5e1',
                    backgroundColor: '#f8fafc'
                  }}
                >
                  <Text style={{ fontSize: 12, fontWeight: '700', color: '#334155' }}>Reset Default (9)</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => handleSaveRule15(rule15Enabled, rule15MinPlayers, rule15Text)}
                  disabled={rule15Saving}
                  style={{
                    paddingHorizontal: 14,
                    paddingVertical: 8,
                    borderRadius: 8,
                    backgroundColor: '#d97706',
                    opacity: rule15Saving ? 0.6 : 1,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 5
                  }}
                >
                  {!rule15Saving && <Ionicons name="checkmark" size={14} color="#ffffff" />}
                  <Text style={{ fontSize: 12.5, fontWeight: '800', color: '#ffffff' }}>
                    {rule15Saving ? 'Saving...' : 'Save Rule 15'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
      </View>

      {/* OFFICE BEARERS & GROUND IN-CHARGES (ENGLISH ADMIN UI -> PUBLIC WEBSITE) */}
      <View style={{
        backgroundColor: '#ffffff',
        borderRadius: 14,
        borderWidth: 1,
        borderColor: committeeEnabled ? '#bfdbfe' : '#e2e8f0',
        marginBottom: 16,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2
      }}>
        <TouchableOpacity
          activeOpacity={0.75}
          onPress={() => setCommitteeExpanded(prev => !prev)}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 16,
            paddingVertical: 14,
            backgroundColor: committeeEnabled ? '#eff6ff' : '#f8fafc'
          }}
        >
          <View style={{ flex: 1, marginRight: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="people-outline" size={16} color="#0f172a" />
                <Text style={{ fontSize: 15, fontWeight: '800', color: '#0f172a' }}>
                  Office Bearers & Ground In-Charges
                </Text>
              </View>
              <View style={{
                paddingHorizontal: 8,
                paddingVertical: 2,
                borderRadius: 999,
                backgroundColor: committeeEnabled ? '#dbeafe' : '#e2e8f0',
                borderWidth: 1,
                borderColor: committeeEnabled ? '#3b82f6' : '#cbd5e1'
              }}>
                <Text style={{
                  fontSize: 10.5,
                  fontWeight: '800',
                  color: committeeEnabled ? '#1e40af' : '#475569'
                }}>
                  {committeeEnabled ? `LIVE ON HOME • ${committeeRoles.length} ROLES` : 'HIDDEN'}
                </Text>
              </View>
            </View>
            <Text style={{ fontSize: 12, color: '#64748b', marginTop: 3 }}>
              Manage Tournament Coordinators, Ground In-Charges, Team Notice, and Secretary Signatory shown on the public website
            </Text>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Switch
              value={committeeEnabled}
              onValueChange={(val) => {
                setCommitteeEnabled(val);
                handleSaveCommittee(val);
              }}
              trackColor={{ false: '#cbd5e1', true: '#2563eb' }}
              thumbColor="#ffffff"
            />
            <Text style={{ fontSize: 13, fontWeight: '700', color: '#475569' }}>
              {committeeExpanded ? '▲' : '▼'}
            </Text>
          </View>
        </TouchableOpacity>

        {committeeExpanded && (
          <View style={{ padding: 16, borderTopWidth: 1, borderTopColor: '#f1f5f9', gap: 14 }}>
            <View>
              <Text style={{ fontSize: 12, fontWeight: '800', color: '#334155', marginBottom: 6 }}>
                Section Heading (Public Website):
              </Text>
              <TextInput
                value={committeeTitle}
                onChangeText={setCommitteeTitle}
                placeholder="Tournament Committee & Office Bearers"
                style={{
                  borderWidth: 1,
                  borderColor: '#cbd5e1',
                  borderRadius: 8,
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  fontSize: 13,
                  color: '#0f172a',
                  backgroundColor: '#f8fafc'
                }}
              />
            </View>

            {/* Committee Roles */}
            <View style={{ gap: 8 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ fontSize: 12.5, fontWeight: '800', color: '#1e293b' }}>
                  Committee Roles & Coordinators ({committeeRoles.length})
                </Text>
                <TouchableOpacity
                  onPress={() => setCommitteeRoles(prev => [...prev, { roleTitle: '', members: '' }])}
                  style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, backgroundColor: '#dbeafe' }}
                >
                  <Text style={{ fontSize: 11.5, fontWeight: '800', color: '#1d4ed8' }}>+ Add Role</Text>
                </TouchableOpacity>
              </View>

              {committeeRoles.map((item, idx) => (
                <View key={`role-row-${idx}`} style={{ flexDirection: isMobile ? 'column' : 'row', gap: 8, alignItems: isMobile ? 'stretch' : 'center' }}>
                  <TextInput
                    value={item.roleTitle}
                    onChangeText={(txt) => setCommitteeRoles(prev => prev.map((r, i) => i === idx ? { ...r, roleTitle: txt } : r))}
                    placeholder="Role Title (e.g. Tournament Coordinator)"
                    style={{
                      flex: 1,
                      borderWidth: 1,
                      borderColor: '#cbd5e1',
                      borderRadius: 8,
                      paddingHorizontal: 10,
                      paddingVertical: 7,
                      fontSize: 12.5,
                      backgroundColor: '#ffffff'
                    }}
                  />
                  <TextInput
                    value={item.members}
                    onChangeText={(txt) => setCommitteeRoles(prev => prev.map((r, i) => i === idx ? { ...r, members: txt } : r))}
                    placeholder="Members & Clubs (e.g. D. Saravanamuthu (Assistant Secretary))"
                    style={{
                      flex: 2,
                      borderWidth: 1,
                      borderColor: '#cbd5e1',
                      borderRadius: 8,
                      paddingHorizontal: 10,
                      paddingVertical: 7,
                      fontSize: 12.5,
                      backgroundColor: '#ffffff'
                    }}
                  />
                  <TouchableOpacity
                    onPress={() => setCommitteeRoles(prev => prev.filter((_, i) => i !== idx))}
                    style={{ paddingHorizontal: 10, paddingVertical: 7, borderRadius: 8, backgroundColor: '#fee2e2', alignItems: 'center' }}
                  >
                    <Text style={{ fontSize: 11.5, fontWeight: '800', color: '#b91c1c' }}>Remove</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>

            {/* Ground In-Charges */}
            <View style={{ gap: 8 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ fontSize: 12.5, fontWeight: '800', color: '#1e293b' }}>
                  Ground In-Charges ({groundInCharges.length})
                </Text>
                <TouchableOpacity
                  onPress={() => setGroundInCharges(prev => [...prev, { groundName: '', inCharge: '' }])}
                  style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, backgroundColor: '#dcfce7' }}
                >
                  <Text style={{ fontSize: 11.5, fontWeight: '800', color: '#15803d' }}>+ Add Ground</Text>
                </TouchableOpacity>
              </View>

              {groundInCharges.map((g, idx) => (
                <View key={`ground-row-${idx}`} style={{ flexDirection: isMobile ? 'column' : 'row', gap: 8, alignItems: isMobile ? 'stretch' : 'center' }}>
                  <TextInput
                    value={g.groundName}
                    onChangeText={(txt) => setGroundInCharges(prev => prev.map((row, i) => i === idx ? { ...row, groundName: txt } : row))}
                    placeholder="Ground Name (e.g. Ramco Cements Turf)"
                    style={{
                      flex: 1,
                      borderWidth: 1,
                      borderColor: '#cbd5e1',
                      borderRadius: 8,
                      paddingHorizontal: 10,
                      paddingVertical: 7,
                      fontSize: 12.5,
                      backgroundColor: '#ffffff'
                    }}
                  />
                  <TextInput
                    value={g.inCharge}
                    onChangeText={(txt) => setGroundInCharges(prev => prev.map((row, i) => i === idx ? { ...row, inCharge: txt } : row))}
                    placeholder="In-Charge Club / Person (e.g. Ramco)"
                    style={{
                      flex: 1,
                      borderWidth: 1,
                      borderColor: '#cbd5e1',
                      borderRadius: 8,
                      paddingHorizontal: 10,
                      paddingVertical: 7,
                      fontSize: 12.5,
                      backgroundColor: '#ffffff'
                    }}
                  />
                  <TouchableOpacity
                    onPress={() => setGroundInCharges(prev => prev.filter((_, i) => i !== idx))}
                    style={{ paddingHorizontal: 10, paddingVertical: 7, borderRadius: 8, backgroundColor: '#fee2e2', alignItems: 'center' }}
                  >
                    <Text style={{ fontSize: 11.5, fontWeight: '800', color: '#b91c1c' }}>Remove</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>

            {/* Request to Teams + Signatory */}
            <View>
              <Text style={{ fontSize: 12, fontWeight: '800', color: '#334155', marginBottom: 6 }}>
                Official Request / Notice to Teams:
              </Text>
              <TextInput
                value={teamNotice}
                onChangeText={setTeamNotice}
                multiline
                numberOfLines={2}
                placeholder="Official notice for participating teams..."
                style={{
                  borderWidth: 1,
                  borderColor: '#cbd5e1',
                  borderRadius: 8,
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  fontSize: 12.5,
                  color: '#0f172a',
                  backgroundColor: '#f8fafc',
                  minHeight: 56
                }}
              />
            </View>

            <View style={{ flexDirection: isMobile ? 'column' : 'row', gap: 8 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 11.5, fontWeight: '700', color: '#475569', marginBottom: 4 }}>Signatory Title</Text>
                <TextInput
                  value={signatoryTitle}
                  onChangeText={setSignatoryTitle}
                  placeholder="Secretary"
                  style={{ borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7, fontSize: 12.5, backgroundColor: '#ffffff' }}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 11.5, fontWeight: '700', color: '#475569', marginBottom: 4 }}>Signatory Name</Text>
                <TextInput
                  value={signatoryName}
                  onChangeText={setSignatoryName}
                  placeholder="P. Mohanraj"
                  style={{ borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7, fontSize: 12.5, backgroundColor: '#ffffff' }}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 11.5, fontWeight: '700', color: '#475569', marginBottom: 4 }}>Date</Text>
                <TextInput
                  value={noticeDate}
                  onChangeText={setNoticeDate}
                  placeholder="21.11.2026"
                  style={{ borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7, fontSize: 12.5, backgroundColor: '#ffffff' }}
                />
              </View>
            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8, paddingTop: 4 }}>
              <TouchableOpacity
                onPress={() => handleSaveCommittee(committeeEnabled)}
                disabled={committeeSaving}
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 9,
                  borderRadius: 8,
                  backgroundColor: '#2563eb',
                  opacity: committeeSaving ? 0.6 : 1,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 5
                }}
              >
                {!committeeSaving && <Ionicons name="checkmark" size={14} color="#ffffff" />}
                <Text style={{ fontSize: 12.5, fontWeight: '800', color: '#ffffff' }}>
                  {committeeSaving ? 'Saving...' : 'Save Office Bearers'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>

      {/* EMAIL & OTP SERVICE STATUS */}
      {emailStatus && (
        <View style={{
          backgroundColor: '#ffffff',
          borderRadius: 12,
          borderWidth: 1,
          borderColor: '#e2e8f0',
          padding: 14,
          marginBottom: 14,
          flexDirection: isMobile ? 'column' : 'row',
          alignItems: isMobile ? 'flex-start' : 'center',
          justifyContent: 'space-between',
          gap: 10
        }}>
          <View>
            <Text style={{ fontSize: 13.5, fontWeight: '800', color: '#0f172a' }}>
              ✉️ Email & OTP Service Status ({emailStatus.date || 'Today'})
            </Text>
            <Text style={{ fontSize: 11.5, color: '#64748b', marginTop: 2 }}>
              Provider: <Text style={{ fontWeight: '700', color: '#0f2452' }}>{String(emailStatus.currentProvider || 'BREVO').toUpperCase()}</Text>
              {' • '}Fallback: <Text style={{ fontWeight: '700', color: '#334155' }}>{String(emailStatus.fallbackProvider || 'RESEND').toUpperCase()}</Text>
              {emailStatus.alertSentAt ? ' • ⚠️ 250-Alert Dispatched' : ''}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ backgroundColor: '#f8fafc', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0' }}>
              <Text style={{ fontSize: 10.5, color: '#64748b', fontWeight: '700' }}>TODAY SENT</Text>
              <Text style={{ fontSize: 15, fontWeight: '800', color: (emailStatus.count || 0) >= 250 ? '#dc2626' : '#0f2452' }}>
                {emailStatus.count ?? 0}
              </Text>
            </View>
            <View style={{ backgroundColor: '#f8fafc', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0' }}>
              <Text style={{ fontSize: 10.5, color: '#64748b', fontWeight: '700' }}>FAILURES</Text>
              <Text style={{ fontSize: 15, fontWeight: '800', color: (emailStatus.failures || 0) > 0 ? '#d97706' : '#16a34a' }}>
                {emailStatus.failures ?? 0}
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* DYNAMIC CATEGORY DROPDOWN */}
      <View style={[styles.tabBarContainer, { position: 'relative', zIndex: 1000 }]}>
        <View style={{
          flexDirection: isMobile ? 'column' : 'row',
          alignItems: isMobile ? 'stretch' : 'center',
          gap: 10
        }}>
          <Text style={{ fontSize: 13, fontWeight: '700', color: '#475569' }}>
            Lookup Category:
          </Text>
          <View style={{ position: 'relative', flex: isMobile ? undefined : 1, maxWidth: isMobile ? '100%' : 400, zIndex: 1000 }}>
            <TouchableOpacity
              onPress={() => setCategoryDropdownOpen(prev => !prev)}
              activeOpacity={0.8}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                backgroundColor: '#ffffff',
                borderWidth: 1.5,
                borderColor: categoryDropdownOpen ? '#d97706' : '#cbd5e1',
                borderRadius: 10,
                paddingHorizontal: 14,
                paddingVertical: 11,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.05,
                shadowRadius: 3,
                elevation: 2
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                {renderCategoryIcon(activeCategoryDef, 16, '#0f172a')}
                <Text style={{ fontSize: 13.5, fontWeight: '700', color: '#0f172a' }} numberOfLines={1}>
                  {activeCategoryDef?.label || 'Select Category'}
                </Text>
              </View>
              <Text style={{ fontSize: 12, color: '#64748b', marginLeft: 8 }}>
                {categoryDropdownOpen ? '▲' : '▼'}
              </Text>
            </TouchableOpacity>

            {categoryDropdownOpen && (
              <View style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                marginTop: 6,
                backgroundColor: '#ffffff',
                borderWidth: 1,
                borderColor: '#e2e8f0',
                borderRadius: 12,
                paddingVertical: 6,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: 0.14,
                shadowRadius: 16,
                elevation: 12,
                zIndex: 2000
              }}>
                {DYNAMIC_CATEGORIES.map(cat => {
                  const isActive = activeTab === cat.key;
                  return (
                    <TouchableOpacity
                      key={cat.key}
                      onPress={() => {
                        setActiveTab(cat.key);
                        setSearchQuery('');
                        setCategoryDropdownOpen(false);
                        if (onNavigate) {
                          onNavigate(`/admin/settings/${cat.key.replace(/_/g, '-')}`);
                        }
                      }}
                      activeOpacity={0.7}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        paddingHorizontal: 14,
                        paddingVertical: 10,
                        backgroundColor: isActive ? '#fef3c7' : 'transparent'
                      }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                        {renderCategoryIcon(cat, 16, isActive ? '#92400e' : '#475569')}
                        <Text style={{
                          fontSize: 13.5,
                          fontWeight: isActive ? '800' : '600',
                          color: isActive ? '#92400e' : '#334155'
                        }}>
                          {cat.label}
                        </Text>
                      </View>
                      {isActive && (
                        <Ionicons name="checkmark" size={14} color="#d97706" />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>
        </View>
      </View>

      {/* Dynamic Category Management View */}
      <View style={styles.categoryViewContainer}>
          {/* Category Top Banner */}
          <View style={[styles.categoryBanner, isMobile && { padding: 14, gap: 10 }]}>
            <View style={[styles.bannerLeft, isMobile && { width: '100%', minWidth: 0, gap: 10 }]}>
              <View style={styles.bannerIconBox}>
                {renderCategoryIcon(activeCategoryDef, 22, '#d97706')}
              </View>
              <View style={styles.bannerText}>
                <View style={styles.bannerTitleRow}>
                  <Text style={[styles.bannerTitle, isMobile && { fontSize: 16 }]}>{activeCategoryDef?.label}</Text>
                  <View style={styles.countBadge}>
                    <Text style={styles.countBadgeText}>
                      {items.length} {items.length === 1 ? 'Option' : 'Options'}
                    </Text>
                  </View>
                </View>
                <Text style={[styles.bannerSubtitle, isMobile && { fontSize: 12 }]}>
                  {activeCategoryDef?.description}
                </Text>
              </View>
            </View>

            <View style={[styles.bannerActions, isMobile && { width: '100%', justifyContent: 'space-between', marginTop: 4 }]}>
              <TouchableOpacity
                style={styles.refreshBtn}
                onPress={() => loadCategoryItems(activeTab)}
                activeOpacity={0.7}
              >
                <RefreshIcon size={16} color="#0f2452" />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.addBtn, isMobile && { flex: 1, justifyContent: 'center' }]}
                onPress={() => {
                  setNewName('');
                  setNewCode('');
                  setNewDescription('');
                  setFormError(null);
                  setShowAddModal(true);
                }}
                activeOpacity={0.85}
              >
                <PlusIcon size={16} color="#ffffff" />
                <Text style={styles.addBtnText}>Add {activeCategoryDef?.singular || 'Item'}</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Search Bar */}
          <View style={styles.searchBarRow}>
            <View style={styles.searchBox}>
              <SearchIcon size={16} color="#94a3b8" />
              <TextInput
                style={styles.searchInput}
                placeholder={`Search ${activeCategoryDef?.label || 'options'}...`}
                placeholderTextColor="#94a3b8"
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.searchClearBtn}>
                  <CloseIcon size={14} color="#94a3b8" />
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Items List Content */}
          {loading ? (
            <LoadingSkeleton rows={4} type="card" />
          ) : filteredItems.length === 0 ? (
            <EmptyState
              title={searchQuery ? 'No matching items found' : `No ${activeCategoryDef?.label || 'options'} registered yet`}
              description={
                searchQuery
                  ? `No options matched "${searchQuery}". Clear your search query.`
                  : `Add your first dynamic ${activeCategoryDef?.singular || 'item'} to make it selectable across player, scorer, and tournament forms.`
              }
              actionText={`Add ${activeCategoryDef?.singular || 'Item'}`}
              onAction={() => setShowAddModal(true)}
            />
          ) : isMobile ? (
            /* MOBILE RESPONSIVE CARDS VIEW */
            <ScrollView style={styles.tableScroll} showsVerticalScrollIndicator={false}>
              <View style={styles.mobileListContainer}>
                {filteredItems.map((item, index) => (
                  <View key={item.id || String(index)} style={styles.mobileItemCard}>
                    <View style={styles.mobileItemHeader}>
                      <View style={styles.mobileIndexBadge}>
                        <Text style={styles.mobileIndexText}>#{index + 1}</Text>
                      </View>
                      <View style={styles.mobileItemTitleWrap}>
                        <Text style={styles.itemNameText}>{item.name}</Text>
                        {item.description ? (
                          <Text style={styles.itemDescText} numberOfLines={2}>
                            {item.description}
                          </Text>
                        ) : null}
                      </View>
                      <View style={styles.activePill}>
                        <View style={styles.activeDot} />
                        <Text style={styles.activePillText}>Active</Text>
                      </View>
                    </View>

                    <View style={styles.mobileItemFooter}>
                      <View style={styles.codeBadge}>
                        <Text style={styles.codeBadgeText}>CODE: {item.code || '—'}</Text>
                      </View>

                      <TouchableOpacity
                        style={styles.deleteBtn}
                        onPress={() => setItemToDelete(item)}
                        activeOpacity={0.7}
                        accessibilityLabel={`Delete ${item.name}`}
                      >
                        <TrashIcon size={15} color="#ef4444" />
                        <Text style={styles.deleteBtnText}>Delete</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            </ScrollView>
          ) : (
            /* DESKTOP TABLE VIEW */
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tableScroll}>
              <View style={[styles.tableCard, { minWidth: 620 }]}>
                {/* Table Header */}
                <View style={styles.tableHeaderRow}>
                  <Text style={[styles.thCell, styles.thIndex]}>#</Text>
                  <Text style={[styles.thCell, styles.thName]}>OPTION NAME</Text>
                  <Text style={[styles.thCell, styles.thCode]}>CODE / SLUG</Text>
                  <Text style={[styles.thCell, styles.thStatus]}>STATUS</Text>
                  <Text style={[styles.thCell, styles.thActions]}>ACTIONS</Text>
                </View>

                {/* Table Rows */}
                {filteredItems.map((item, index) => (
                  <View key={item.id || String(index)} style={styles.tableRow}>
                    <Text style={[styles.tdCell, styles.thIndex, styles.indexText]}>
                      {index + 1}
                    </Text>

                    <View style={[styles.tdCell, styles.thName]}>
                      <Text style={styles.itemNameText}>{item.name}</Text>
                      {item.description ? (
                        <Text style={styles.itemDescText} numberOfLines={1}>
                          {item.description}
                        </Text>
                      ) : null}
                    </View>

                    <View style={[styles.tdCell, styles.thCode]}>
                      <View style={styles.codeBadge}>
                        <Text style={styles.codeBadgeText}>{item.code || '—'}</Text>
                      </View>
                    </View>

                    <View style={[styles.tdCell, styles.thStatus]}>
                      <View style={styles.activePill}>
                        <View style={styles.activeDot} />
                        <Text style={styles.activePillText}>Active</Text>
                      </View>
                    </View>

                    <View style={[styles.tdCell, styles.thActions]}>
                      <TouchableOpacity
                        style={styles.deleteBtn}
                        onPress={() => setItemToDelete(item)}
                        activeOpacity={0.7}
                        accessibilityLabel={`Delete ${item.name}`}
                      >
                        <TrashIcon size={16} color="#ef4444" />
                        <Text style={styles.deleteBtnText}>Delete</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            </ScrollView>
          )}
        </View>

      {/* Add New Item Modal */}
      <Modal
        visible={showAddModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAddModal(false)}
      >
        <View style={[styles.modalOverlay, isMobile && { padding: 12 }]}>
          <View style={[styles.modalCard, isMobile && { maxHeight: '92%' }]}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderLeft}>
                {renderCategoryIcon(activeCategoryDef, 20, '#d97706')}
                <Text style={styles.modalTitle}>
                  Add New {activeCategoryDef?.singular || 'Item'}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowAddModal(false)}
                style={styles.modalCloseBtn}
                disabled={isSubmitting}
              >
                <CloseIcon size={18} color="#64748b" />
              </TouchableOpacity>
            </View>

            {/* Modal Form Body with keyboard-safe scroll */}
            <ScrollView style={{ maxHeight: 380 }} showsVerticalScrollIndicator={false}>
              <View style={styles.modalBody}>
                <Text style={styles.modalSub}>
                  Add a new selectable option into{' '}
                  <Text style={{ fontWeight: '700', color: '#0f2452' }}>
                    {activeCategoryDef?.label}
                  </Text>
                  . It will immediately appear in registration and profile dropdowns.
                </Text>

                {formError && (
                  <View style={styles.errorBanner}>
                    <Text style={styles.errorBannerText}>{formError}</Text>
                  </View>
                )}

                <View style={styles.modalField}>
                  <Text style={styles.modalLabel}>
                    {activeCategoryDef?.singular || 'Item'} Name <Text style={styles.reqStar}>*</Text>
                  </Text>
                  <TextInput
                    style={styles.modalInput}
                    placeholder={activeCategoryDef?.placeholder || 'Enter option name'}
                    placeholderTextColor="#94a3b8"
                    value={newName}
                    onChangeText={text => {
                      setNewName(text);
                      if (formError) setFormError(null);
                    }}
                    autoFocus
                  />
                </View>

                <View style={styles.modalField}>
                  <Text style={styles.modalLabel}>Code / Abbreviation (Optional)</Text>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="e.g. SVKS, RHB, U19 (Auto-generated if left blank)"
                    placeholderTextColor="#94a3b8"
                    value={newCode}
                    onChangeText={setNewCode}
                    autoCapitalize="characters"
                  />
                </View>

                <View style={styles.modalField}>
                  <Text style={styles.modalLabel}>Description / Notes (Optional)</Text>
                  <TextInput
                    style={[styles.modalInput, styles.modalTextArea]}
                    placeholder="Additional context or notes for this item"
                    placeholderTextColor="#94a3b8"
                    value={newDescription}
                    onChangeText={setNewDescription}
                    multiline
                    numberOfLines={2}
                  />
                </View>
              </View>
            </ScrollView>

            {/* Modal Actions */}
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setShowAddModal(false)}
                disabled={isSubmitting}
                activeOpacity={0.7}
              >
                <Text style={styles.modalCancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalSubmitBtn, isSubmitting && styles.btnDisabled]}
                onPress={handleAddItem}
                disabled={isSubmitting}
                activeOpacity={0.85}
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <>
                    <PlusIcon size={16} color="#ffffff" />
                    <Text style={styles.modalSubmitBtnText}>Add Option</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        visible={Boolean(itemToDelete)}
        title={`Delete ${activeCategoryDef?.singular || 'Item'}`}
        message={`Are you sure you want to delete "${itemToDelete?.name}" from ${activeCategoryDef?.label}? This will remove it from future registration and selection dropdowns.`}
        confirmText={isDeleting ? 'Deleting...' : 'Delete Option'}
        cancelText="Keep Option"
        variant="danger"
        onConfirm={confirmDelete}
        onCancel={() => setItemToDelete(null)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    backgroundColor: '#f8fafc'
  },
  sectionSwitcher: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    padding: 6,
    marginBottom: 20,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2
  },
  sectionSwitcherBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    gap: 12,
    backgroundColor: 'transparent'
  },
  sectionSwitcherBtnActive: {
    backgroundColor: '#0f2452',
    shadowColor: '#0f2452',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3
  },
  sectionSwitcherIcon: {
    fontSize: 20
  },
  sectionSwitcherTitle: {
    fontSize: 14.5,
    fontWeight: '700',
    color: '#334155'
  },
  sectionSwitcherTitleActive: {
    color: '#ffffff',
    fontWeight: '800'
  },
  sectionSwitcherSubtitle: {
    fontSize: 11,
    fontWeight: '500',
    color: '#64748b',
    marginTop: 1
  },
  sectionSwitcherSubtitleActive: {
    color: '#cbd5e1'
  },
  sectionSwitcherBadge: {
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: '#e2e8f0'
  },
  sectionSwitcherBadgeActive: {
    backgroundColor: '#d4af37',
    borderColor: '#b8960c'
  },
  sectionSwitcherBadgeText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#475569'
  },
  sectionSwitcherBadgeTextActive: {
    color: '#0a1936'
  },
  tabBarContainer: {
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    paddingBottom: 12
  },
  tabBarScroll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  tabPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 6
  },
  tabPillActive: {
    backgroundColor: '#0f2452',
    borderColor: '#0f2452'
  },
  tabPillIcon: {
    fontSize: 14
  },
  tabPillText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b'
  },
  tabPillTextActive: {
    color: '#ffffff',
    fontWeight: '700'
  },
  categoryViewContainer: {
    flex: 1
  },
  categoryBanner: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 18,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    flexWrap: 'wrap',
    gap: 12
  },
  bannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    flex: 1,
    minWidth: 260
  },
  bannerIconBox: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center'
  },
  bannerEmoji: {
    fontSize: 24
  },
  bannerText: {
    flex: 1
  },
  bannerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 3
  },
  bannerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f2452'
  },
  countBadge: {
    backgroundColor: '#e0f2fe',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12
  },
  countBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0369a1'
  },
  bannerSubtitle: {
    fontSize: 13,
    color: '#64748b',
    lineHeight: 18
  },
  bannerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  },
  refreshBtn: {
    width: 38,
    height: 38,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center'
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0f2452',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 8
  },
  addBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700'
  },
  searchBarRow: {
    marginBottom: 16
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#0f2452',
    padding: 0
  },
  searchClearBtn: {
    padding: 4
  },
  tableScroll: {
    flex: 1
  },
  mobileListContainer: {
    gap: 10,
    marginBottom: 24
  },
  mobileItemCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
    gap: 12
  },
  mobileItemHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10
  },
  mobileIndexBadge: {
    backgroundColor: '#f1f5f9',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: '#e2e8f0'
  },
  mobileIndexText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748b'
  },
  mobileItemTitleWrap: {
    flex: 1
  },
  mobileItemFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f8fafc'
  },
  tableCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    overflow: 'hidden',
    marginBottom: 24
  },
  tableHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    paddingVertical: 12,
    paddingHorizontal: 16
  },
  thCell: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
    letterSpacing: 0.5
  },
  thIndex: {
    width: 40
  },
  thName: {
    flex: 2
  },
  thCode: {
    flex: 1.2
  },
  thStatus: {
    width: 90
  },
  thActions: {
    width: 90,
    textAlign: 'right'
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    paddingVertical: 13,
    paddingHorizontal: 16
  },
  tdCell: {
    justifyContent: 'center'
  },
  indexText: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '600'
  },
  itemNameText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f2452'
  },
  itemDescText: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 2
  },
  codeBadge: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start'
  },
  codeBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace'
  },
  activePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    alignSelf: 'flex-start',
    gap: 5
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10b981'
  },
  activePillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#059669'
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: '#fef2f2',
    gap: 4,
    alignSelf: 'flex-end'
  },
  deleteBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ef4444'
  },
  contentScroll: {
    flex: 1
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 20
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9'
  },
  cardHeaderIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#f0f4f8',
    alignItems: 'center',
    justifyContent: 'center'
  },
  cardHeaderText: {
    flex: 1
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f2452',
    marginBottom: 3
  },
  cardSubtitle: {
    fontSize: 13,
    color: '#64748b',
    lineHeight: 18
  },
  formGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16
  },
  formGroup: {
    width: '48%',
    minWidth: 260
  },
  formGroupFull: {
    width: '100%'
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6
  },
  input: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
    color: '#0f2452',
    backgroundColor: '#ffffff'
  },
  textArea: {
    minHeight: 60,
    textAlignVertical: 'top'
  },
  saveBar: {
    marginTop: 24,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    alignItems: 'flex-end'
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0f2452',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    gap: 8
  },
  saveBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700'
  },
  btnDisabled: {
    opacity: 0.6
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20
  },
  modalCard: {
    width: '100%',
    maxWidth: 480,
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9'
  },
  modalHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  modalEmoji: {
    fontSize: 18
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f2452'
  },
  modalCloseBtn: {
    padding: 4
  },
  modalBody: {
    padding: 20
  },
  modalSub: {
    fontSize: 12.5,
    color: '#64748b',
    marginBottom: 16,
    lineHeight: 18
  },
  errorBanner: {
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecdd3',
    borderRadius: 8,
    padding: 10,
    marginBottom: 14
  },
  errorBannerText: {
    fontSize: 12,
    color: '#dc2626',
    fontWeight: '600'
  },
  modalField: {
    marginBottom: 14
  },
  modalLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6
  },
  reqStar: {
    color: '#ef4444'
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
    color: '#0f2452',
    backgroundColor: '#ffffff'
  },
  modalTextArea: {
    minHeight: 50,
    textAlignVertical: 'top'
  },
  modalFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: '#f8fafc',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9'
  },
  modalCancelBtn: {
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#ffffff'
  },
  modalCancelBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b'
  },
  modalSubmitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0f2452',
    paddingVertical: 9,
    paddingHorizontal: 18,
    borderRadius: 8,
    gap: 6
  },
  modalSubmitBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff'
  }
});

export default SettingsPage;
