/**
 * src/admin/pages/ContentPage.tsx
 * Content Management Page for Cricket Association Professional Admin Panel.
 * Supports publishing public website news, press articles, tournament events,
 * and managing official Association about information.
 */

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, TextInput } from 'react-native';
import PageHeader from '../components/PageHeader';
import DataTable, { ColumnDef } from '../components/DataTable';
import StatusBadge from '../components/StatusBadge';
import ConfirmDialog from '../components/ConfirmDialog';
import { ContentIcon, PlusIcon, EditIcon, TrashIcon, CloseIcon } from '../components/Icons';
import { adminApi } from '../services/adminApi';
import { useAdminLayout } from '../components/AdminLayout';

export const ContentPage: React.FC = () => {
  const { showToast } = useAdminLayout();
  const [contentList, setContentList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState('ALL');

  // Modals
  const [activeItem, setActiveItem] = useState<any | null>(null);
  const [isAddMode, setIsAddMode] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);

  // Form State
  const [formTitle, setFormTitle] = useState('');
  const [formCategory, setFormCategory] = useState('NEWS');
  const [formSummary, setFormSummary] = useState('');
  const [formBody, setFormBody] = useState('');
  const [formStatus, setFormStatus] = useState('PUBLISHED');

  // Delete State
  const [deleteDialog, setDeleteDialog] = useState<{
    visible: boolean;
    item: any;
  }>({
    visible: false,
    item: null
  });

  const loadContent = async () => {
    setLoading(true);
    try {
      const res = await adminApi.getContent();
      if (res && res.success) {
        setContentList(res.content || []);
      }
    } catch (e: any) {
      showToast(`Failed to load content: ${e.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadContent();
  }, []);

  const handleOpenAdd = () => {
    setActiveItem(null);
    setFormTitle('');
    setFormCategory('NEWS');
    setFormSummary('');
    setFormBody('');
    setFormStatus('PUBLISHED');
    setIsAddMode(true);
    setIsEditMode(false);
  };

  const handleOpenEdit = (item: any) => {
    setActiveItem(item);
    setFormTitle(item.title || '');
    setFormCategory(item.category || 'NEWS');
    setFormSummary(item.summary || '');
    setFormBody(item.content || item.body || '');
    setFormStatus(item.status || 'PUBLISHED');
    setIsEditMode(true);
    setIsAddMode(false);
  };

  const handleSave = async () => {
    if (!formTitle.trim()) {
      showToast('Title is required.', 'error');
      return;
    }

    try {
      if (isAddMode) {
        await adminApi.createContent({
          title: formTitle.trim(),
          category: formCategory,
          summary: formSummary.trim(),
          content: formBody.trim(),
          status: formStatus
        });
        showToast('Article created successfully.', 'success');
      } else if (isEditMode && activeItem) {
        await adminApi.updateContent(activeItem.id, {
          title: formTitle.trim(),
          category: formCategory,
          summary: formSummary.trim(),
          content: formBody.trim(),
          status: formStatus
        });
        showToast('Article updated successfully.', 'success');
      }
      setIsAddMode(false);
      setIsEditMode(false);
      setActiveItem(null);
      loadContent();
    } catch (e: any) {
      showToast(`Save error: ${e.message}`, 'error');
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteDialog.item) return;
    try {
      await adminApi.deleteContent(deleteDialog.item.id);
      showToast('Article deleted successfully.', 'success');
      setDeleteDialog({ visible: false, item: null });
      loadContent();
    } catch (e: any) {
      showToast(`Delete error: ${e.message}`, 'error');
    }
  };

  const filteredContent = contentList.filter((item) => {
    if (categoryFilter === 'ALL') return true;
    return (item.category || '').toUpperCase() === categoryFilter.toUpperCase();
  });

  const columns: ColumnDef<any>[] = [
    {
      header: 'Title / Article',
      accessor: (item) => (
        <View style={styles.titleCell}>
          <Text style={styles.itemTitle}>{item.title}</Text>
          <Text style={styles.itemSummary} numberOfLines={2}>
            {item.summary || item.content}
          </Text>
        </View>
      )
    },
    {
      header: 'Category',
      accessor: (item) => (
        <span
          style={{
            display: 'inline-block',
            padding: '3px 8px',
            borderRadius: 4,
            fontSize: 11,
            fontWeight: 700,
            backgroundColor: '#EFF6FF',
            color: '#1D4ED8'
          }}
        >
          {item.category || 'NEWS'}
        </span>
      )
    },
    {
      header: 'Date Published',
      accessor: (item) => (
        <Text style={styles.dateText}>
          {item.created_at ? new Date(item.created_at).toLocaleDateString() : 'Recent'}
        </Text>
      )
    },
    {
      header: 'Status',
      accessor: (item) => <StatusBadge status={item.status || 'PUBLISHED'} />
    },
    {
      header: 'Actions',
      accessor: (item) => (
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => handleOpenEdit(item)}
            accessibilityLabel="Edit Article"
          >
            <EditIcon size={14} color="#0284C7" />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, styles.deleteBtn]}
            onPress={() => setDeleteDialog({ visible: true, item })}
            accessibilityLabel="Delete Article"
          >
            <TrashIcon size={14} color="#DC2626" />
          </TouchableOpacity>
        </View>
      )
    }
  ];

  return (
    <View style={styles.container}>
      <PageHeader
        title="Content Management"
        subtitle="Manage news articles, public announcements, upcoming tournament events, and Association media."
        breadcrumbs={[
          { label: 'Admin', link: '/admin/dashboard' },
          { label: 'Content' }
        ]}
        actions={
          <TouchableOpacity style={styles.addBtn} onPress={handleOpenAdd}>
            <PlusIcon size={16} color="#FFFFFF" />
            <Text style={styles.addBtnText}>Create Article</Text>
          </TouchableOpacity>
        }
      />

      {/* Filter Tabs */}
      <View style={styles.toolbarCard}>
        <View style={styles.tabsRow}>
          {['ALL', 'NEWS', 'EVENT', 'ANNOUNCEMENT'].map((cat) => (
            <TouchableOpacity
              key={cat}
              style={[
                styles.tabBtn,
                categoryFilter === cat && styles.tabBtnActive
              ]}
              onPress={() => setCategoryFilter(cat)}
            >
              <Text
                style={[
                  styles.tabText,
                  categoryFilter === cat && styles.tabTextActive
                ]}
              >
                {cat === 'ALL' ? 'All Content' : cat}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Content Data Table */}
      <DataTable
        columns={columns}
        data={filteredContent}
        keyExtractor={(item) => String(item.id)}
        searchable
        searchPlaceholder="Search news, events, or content..."
        filterKey={(item) => `${item.title} ${item.summary} ${item.category}`}
        loading={loading}
        emptyTitle="No content found"
        emptyDescription="Create your first news update or tournament announcement."
      />

      {/* Add / Edit Modal */}
      {(isAddMode || isEditMode) && (
        <Modal transparent animationType="fade" visible>
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  {isAddMode ? 'Create New Article' : 'Edit Article Content'}
                </Text>
                <TouchableOpacity
                  onPress={() => {
                    setIsAddMode(false);
                    setIsEditMode(false);
                    setActiveItem(null);
                  }}
                >
                  <CloseIcon size={18} color="#64748B" />
                </TouchableOpacity>
              </View>

              <View style={styles.modalBody}>
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Article Headline *</Text>
                  <TextInput
                    style={styles.input}
                    value={formTitle}
                    onChangeText={setFormTitle}
                    placeholder="e.g. Virudhunagar Premier League 2026 Inauguration Date Finalized"
                    placeholderTextColor="#94A3B8"
                  />
                </View>

                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <View style={[styles.fieldGroup, { flex: 1 }]}>
                    <Text style={styles.fieldLabel}>Category</Text>
                    <select
                      value={formCategory}
                      onChange={(e) => setFormCategory(e.target.value)}
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
                      <option value="NEWS">News</option>
                      <option value="EVENT">Event</option>
                      <option value="ANNOUNCEMENT">Announcement</option>
                      <option value="ABOUT">About Info</option>
                    </select>
                  </View>

                  <View style={[styles.fieldGroup, { flex: 1 }]}>
                    <Text style={styles.fieldLabel}>Publication Status</Text>
                    <select
                      value={formStatus}
                      onChange={(e) => setFormStatus(e.target.value)}
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
                      <option value="PUBLISHED">Published</option>
                      <option value="DRAFT">Draft</option>
                    </select>
                  </View>
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Brief Summary</Text>
                  <TextInput
                    style={styles.input}
                    value={formSummary}
                    onChangeText={setFormSummary}
                    placeholder="Short one-line summary for cards..."
                    placeholderTextColor="#94A3B8"
                  />
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Body Content</Text>
                  <TextInput
                    style={styles.textarea}
                    value={formBody}
                    onChangeText={setFormBody}
                    placeholder="Full article content or announcement details..."
                    placeholderTextColor="#94A3B8"
                    multiline
                  />
                </View>
              </View>

              <View style={styles.modalFooter}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={() => {
                    setIsAddMode(false);
                    setIsEditMode(false);
                    setActiveItem(null);
                  }}
                >
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
                  <Text style={styles.saveBtnText}>
                    {isAddMode ? 'Publish Article' : 'Save Changes'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* Delete Confirmation */}
      <ConfirmDialog
        visible={deleteDialog.visible}
        title="Delete Content"
        message={`Are you sure you want to delete "${deleteDialog.item?.title}"? This will remove it from the public website.`}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteDialog({ visible: false, item: null })}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  toolbarCard: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16
  },
  tabsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  tabBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 6,
    backgroundColor: '#F8FAFC'
  },
  tabBtnActive: {
    backgroundColor: '#0A2540'
  },
  tabText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B'
  },
  tabTextActive: {
    color: '#FFFFFF'
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#0A2540',
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 6
  },
  addBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600'
  },
  titleCell: {
    maxWidth: 400
  },
  itemTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A'
  },
  itemSummary: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2
  },
  dateText: {
    fontSize: 12,
    color: '#64748B'
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  actionBtn: {
    width: 30,
    height: 30,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center'
  },
  deleteBtn: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA'
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20
  },
  modalCard: {
    width: '100%',
    maxWidth: 560,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden'
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    backgroundColor: '#F8FAFC'
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0A2540'
  },
  modalBody: {
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
  textarea: {
    height: 100,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 6,
    padding: 12,
    fontSize: 13,
    color: '#0F172A',
    backgroundColor: '#FFFFFF',
    textAlignVertical: 'top'
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    backgroundColor: '#F8FAFC'
  },
  cancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF'
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569'
  },
  saveBtn: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: '#0A2540'
  },
  saveBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF'
  }
});

export default ContentPage;
