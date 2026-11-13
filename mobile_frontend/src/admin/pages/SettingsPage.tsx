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
import { adminApi } from '../services/adminApi';
import { useAdminLayout } from '../components/AdminLayout';

export interface DynamicCategoryDef {
  key: string;
  label: string;
  iconText: string;
  singular: string;
  description: string;
  placeholder: string;
  defaultSeedCount?: number;
}

export const DYNAMIC_CATEGORIES: DynamicCategoryDef[] = [
  {
    key: 'taluk_jurisdiction',
    label: 'Taluk Jurisdiction',
    iconText: '📍',
    singular: 'Taluk',
    description: 'Manage geographical taluks and administrative jurisdictions within the district.',
    placeholder: 'e.g. Sivakasi, Virudhunagar, Kariapatti'
  },
  {
    key: 'playing_role',
    label: 'Playing Role',
    iconText: '🏏',
    singular: 'Playing Role',
    description: 'Configure official playing roles and on-field player specializations.',
    placeholder: 'e.g. Batsman, Bowler, All-Rounder, Wicket Keeper'
  },
  {
    key: 'batting_style',
    label: 'Batting Style',
    iconText: '⚡',
    singular: 'Batting Style',
    description: 'Configure recognized batting stances and techniques.',
    placeholder: 'e.g. Right-Handed Batsman, Left-Handed Batsman'
  },
  {
    key: 'age_category',
    label: 'Age Category',
    iconText: '🏆',
    singular: 'Age Category',
    description: 'Official age brackets for tournaments, matches, and player rosters.',
    placeholder: 'e.g. Under-19, Under-16, Senior Men, Under-23'
  },
  {
    key: 'certification_level',
    label: 'Certification Level',
    iconText: '📝',
    singular: 'Scorer Level',
    description: 'Accreditation tiers and federation certifications for official match scorers.',
    placeholder: 'e.g. District Certified, State Panel, Club Scorer'
  },
  {
    key: 'umpire_certification',
    label: 'Umpire Certification / Qualification',
    iconText: '⚖️',
    singular: 'Umpire Qualification',
    description: 'Official match umpire panel tiers, badges, and federation qualifications.',
    placeholder: 'e.g. State Panel A (Senior), BCCI Level 1 Certified'
  },
  {
    key: 'state',
    label: 'State',
    iconText: '🌐',
    singular: 'State',
    description: 'Affiliated states and regional territories for match and player origin.',
    placeholder: 'e.g. Tamil Nadu, Kerala, Karnataka'
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
    { id: 'MSET-TALUK-07', category: 'taluk_jurisdiction', name: 'Watrap', code: 'WTR', description: 'Watrap Taluk Jurisdiction', is_active: true, sort_order: 7 },
    { id: 'MSET-TALUK-08', category: 'taluk_jurisdiction', name: 'Kariapatti', code: 'KPT', description: 'Kariapatti Taluk Jurisdiction', is_active: true, sort_order: 8 },
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

      {/* DYNAMIC CATEGORY PILLS */}
      <View style={styles.tabBarContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabBarScroll}
        >
          {DYNAMIC_CATEGORIES.map(cat => {
            const isActive = activeTab === cat.key;
            return (
              <TouchableOpacity
                key={cat.key}
                style={[styles.tabPill, isActive && styles.tabPillActive]}
                onPress={() => {
                  setActiveTab(cat.key);
                  setSearchQuery('');
                  if (onNavigate) {
                    onNavigate(`/admin/settings/${cat.key.replace(/_/g, '-')}`);
                  }
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.tabPillIcon}>{cat.iconText}</Text>
                <Text style={[styles.tabPillText, isActive && styles.tabPillTextActive]}>
                  {cat.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Dynamic Category Management View */}
      <View style={styles.categoryViewContainer}>
          {/* Category Top Banner */}
          <View style={[styles.categoryBanner, isMobile && { padding: 14, gap: 10 }]}>
            <View style={[styles.bannerLeft, isMobile && { width: '100%', minWidth: 0, gap: 10 }]}>
              <View style={styles.bannerIconBox}>
                <Text style={styles.bannerEmoji}>{activeCategoryDef?.iconText || '🏏'}</Text>
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
                <Text style={styles.modalEmoji}>{activeCategoryDef?.iconText || '✨'}</Text>
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
