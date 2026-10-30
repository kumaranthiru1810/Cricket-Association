/**
 * src/admin/components/DataTable.tsx
 * Reusable, Professional, Responsive Data Table for Cricket Association Admin Panel.
 */

import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView } from 'react-native';
import { SearchIcon, ChevronLeftIcon, ChevronRightIcon } from './Icons';
import EmptyState from './EmptyState';
import { TableSkeleton } from './LoadingSkeleton';

export interface ColumnDef<T> {
  key?: string;
  header: string;
  width?: number | string;
  sortable?: boolean;
  render?: (item: T, index: number) => React.ReactNode;
  accessor?: (item: T) => React.ReactNode;
}

interface Props<T> {
  data: T[];
  columns: ColumnDef<T>[];
  keyExtractor: (item: T) => string;
  loading?: boolean;
  searchable?: boolean;
  searchPlaceholder?: string;
  searchFields?: (keyof T)[];
  filterKey?: (item: T) => string;
  filters?: React.ReactNode;
  actions?: React.ReactNode;
  emptyTitle?: string;
  emptyDescription?: string;
  pageSize?: number;
}

export function DataTable<T extends Record<string, any>>({
  data,
  columns,
  keyExtractor,
  loading = false,
  searchable = true,
  searchPlaceholder = 'Search records...',
  searchFields = [],
  filterKey,
  filters,
  actions,
  emptyTitle = 'No records found',
  emptyDescription = 'There are no items matching the selected criteria.',
  pageSize = 10
}: Props<T>) {
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Filtered & Sorted Data
  const processedData = useMemo(() => {
    let result = [...data];

    // Search
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(item => {
        if (filterKey) {
          const val = filterKey(item);
          return val ? String(val).toLowerCase().includes(q) : false;
        }
        if (searchFields.length > 0) {
          return searchFields.some(field => {
            const val = item[field];
            return val ? String(val).toLowerCase().includes(q) : false;
          });
        }
        return Object.values(item).some(val =>
          val ? String(val).toLowerCase().includes(q) : false
        );
      });
    }

    // Sort
    if (sortKey) {
      result.sort((a, b) => {
        const valA = a[sortKey];
        const valB = b[sortKey];
        if (valA === valB) return 0;
        if (valA === undefined || valA === null) return 1;
        if (valB === undefined || valB === null) return -1;
        const comp = String(valA).localeCompare(String(valB), undefined, { numeric: true });
        return sortOrder === 'asc' ? comp : -comp;
      });
    }

    return result;
  }, [data, search, searchFields, sortKey, sortOrder]);

  // Pagination
  const totalPages = Math.ceil(processedData.length / pageSize) || 1;
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return processedData.slice(start, start + pageSize);
  }, [processedData, currentPage, pageSize]);

  const handleSort = (key: string, sortable?: boolean) => {
    if (!sortable) return;
    if (sortKey === key) {
      setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortOrder('asc');
    }
  };

  if (loading) {
    return <TableSkeleton rows={pageSize} />;
  }

  return (
    <View style={styles.container}>
      {/* Controls Bar */}
      {(searchable || filters || actions) && (
        <View style={styles.controlsBar}>
          <View style={styles.leftControls}>
            {searchable && (
              <View style={styles.searchWrapper}>
                <SearchIcon size={16} color="#94a3b8" style={{ marginRight: 8 }} />
                <TextInput
                  style={styles.searchInput}
                  value={search}
                  onChangeText={t => {
                    setSearch(t);
                    setCurrentPage(1);
                  }}
                  placeholder={searchPlaceholder}
                  placeholderTextColor="#94a3b8"
                />
                {search.length > 0 && (
                  <TouchableOpacity onPress={() => setSearch('')}>
                    <Text style={styles.clearSearchText}>✕</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
            {filters && <View style={styles.filtersWrapper}>{filters}</View>}
          </View>
          {actions && <View style={styles.actionsWrapper}>{actions}</View>}
        </View>
      )}

      {/* Table Content */}
      {processedData.length === 0 ? (
        <EmptyState title={emptyTitle} description={emptyDescription} />
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={true} style={styles.scrollWrapper}>
          <View style={styles.table}>
            {/* Table Header */}
            <View style={styles.headerRow}>
              {columns.map((col, cIdx) => (
                <TouchableOpacity
                  key={col.key || String(cIdx)}
                  style={[
                    styles.headerCell,
                    col.width ? { width: col.width as any, minWidth: col.width as any } : { flex: 1, minWidth: 120 }
                  ]}
                  onPress={() => col.key && handleSort(col.key, col.sortable)}
                  activeOpacity={col.sortable ? 0.7 : 1}
                >
                  <Text style={styles.headerCellText}>{col.header}</Text>
                  {col.sortable && col.key && sortKey === col.key && (
                    <Text style={styles.sortIndicator}>{sortOrder === 'asc' ? ' ▲' : ' ▼'}</Text>
                  )}
                </TouchableOpacity>
              ))}
            </View>

            {/* Table Body */}
            {paginatedData.map((item, rowIdx) => (
              <View key={keyExtractor(item)} style={[styles.bodyRow, rowIdx % 2 === 1 && styles.rowAlternate]}>
                {columns.map(col => (
                  <View
                    key={col.key}
                    style={[
                      styles.bodyCell,
                      col.width ? { width: col.width as any, minWidth: col.width as any } : { flex: 1, minWidth: 120 }
                    ]}
                  >
                    {col.render ? (
                      col.render(item, rowIdx)
                    ) : col.accessor ? (
                      col.accessor(item)
                    ) : (
                      <Text style={styles.bodyCellText}>{col.key && item[col.key] !== undefined ? String(item[col.key]) : '-'}</Text>
                    )}
                  </View>
                ))}
              </View>
            ))}
          </View>
        </ScrollView>
      )}

      {/* Pagination Footer */}
      {processedData.length > pageSize && (
        <View style={styles.paginationBar}>
          <Text style={styles.paginationInfo}>
            Showing {(currentPage - 1) * pageSize + 1} to{' '}
            {Math.min(currentPage * pageSize, processedData.length)} of {processedData.length} records
          </Text>

          <View style={styles.paginationControls}>
            <TouchableOpacity
              style={[styles.pageBtn, currentPage === 1 && styles.pageBtnDisabled]}
              onPress={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeftIcon size={14} color={currentPage === 1 ? '#cbd5e1' : '#334155'} />
              <Text style={[styles.pageBtnText, currentPage === 1 && styles.pageBtnTextDisabled]}>Prev</Text>
            </TouchableOpacity>

            <Text style={styles.pageNum}>
              Page {currentPage} of {totalPages}
            </Text>

            <TouchableOpacity
              style={[styles.pageBtn, currentPage === totalPages && styles.pageBtnDisabled]}
              onPress={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              <Text style={[styles.pageBtnText, currentPage === totalPages && styles.pageBtnTextDisabled]}>Next</Text>
              <ChevronRightIcon size={14} color={currentPage === totalPages ? '#cbd5e1' : '#334155'} />
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    overflow: 'hidden',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
    marginBottom: 24
  },
  controlsBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    gap: 12
  },
  leftControls: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 10,
    flex: 1
  },
  searchWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 38,
    minWidth: 180,
    maxWidth: 360,
    flex: 1
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#0f172a',
    padding: 0
  },
  clearSearchText: {
    fontSize: 12,
    color: '#94a3b8',
    paddingHorizontal: 4
  },
  filtersWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  actionsWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  scrollWrapper: {
    width: '100%'
  },
  table: {
    minWidth: '100%'
  },
  headerRow: {
    flexDirection: 'row',
    backgroundColor: '#f8fafc',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0'
  },
  headerCell: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14
  },
  headerCellText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: 0.5
  },
  sortIndicator: {
    fontSize: 10,
    color: '#0f2452'
  },
  bodyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    backgroundColor: '#ffffff'
  },
  rowAlternate: {
    backgroundColor: '#fafbfc'
  },
  bodyCell: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    justifyContent: 'center'
  },
  bodyCellText: {
    fontSize: 13,
    color: '#334155'
  },
  paginationBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    padding: 14,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    gap: 10
  },
  paginationInfo: {
    fontSize: 12.5,
    color: '#64748b'
  },
  paginationControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  pageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#ffffff',
    gap: 4
  },
  pageBtnDisabled: {
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc'
  },
  pageBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155'
  },
  pageBtnTextDisabled: {
    color: '#cbd5e1'
  },
  pageNum: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#475569',
    paddingHorizontal: 6
  }
});

export default DataTable;
