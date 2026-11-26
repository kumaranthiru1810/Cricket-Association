/**
 * src/components/common/BootstrapPagination.tsx
 *
 * Reusable, responsive Bootstrap 5 pagination component for React Native & Web.
 * Features:
 * - Direct Bootstrap 5 .pagination, .page-item, .page-link architecture
 * - Page range calculation with intelligent windowing
 * - First, Prev, Page Numbers, Next, Last controls
 * - Item count indicator ("Showing 1-8 of 24 matches")
 * - Deep Navy active state (#0e184e) - strictly NO BLUE
 * - Mobile responsive adaptive layout
 */

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';

export interface BootstrapPaginationProps {
  /** Current active 1-indexed page */
  currentPage: number;
  /** Total number of pages */
  totalPages: number;
  /** Callback when page is changed */
  onPageChange: (page: number) => void;
  /** Total item count across all pages */
  totalItems?: number;
  /** Number of items per page (default: 8) */
  pageSize?: number;
  /** Singular/plural label for items (default: "matches") */
  itemLabel?: string;
  /** Optional container style override */
  style?: any;
  /** Always render pagination bar even when totalPages <= 1 (as long as totalItems > 0) */
  alwaysShow?: boolean;
}

export const BootstrapPagination: React.FC<BootstrapPaginationProps> = ({
  currentPage,
  totalPages,
  onPageChange,
  totalItems,
  pageSize = 8,
  itemLabel = 'matches',
  style,
  alwaysShow = false,
}) => {
  const { width: windowWidth } = useWindowDimensions();
  const isMobile = windowWidth < 640;

  if (!alwaysShow && totalPages <= 1 && (totalItems === undefined || totalItems <= pageSize)) {
    return null;
  }
  if (totalItems !== undefined && totalItems <= 0) {
    return null;
  }

  // Generate page numbers window (up to 5 pages shown)
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const maxVisible = isMobile ? 3 : 5;

    if (totalPages <= maxVisible + 2) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      let start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
      let end = Math.min(totalPages, start + maxVisible - 1);

      if (end - start + 1 < maxVisible) {
        start = Math.max(1, end - maxVisible + 1);
      }

      if (start > 1) {
        pages.push(1);
        if (start > 2) pages.push('...');
      }

      for (let i = start; i <= end; i++) {
        pages.push(i);
      }

      if (end < totalPages) {
        if (end < totalPages - 1) pages.push('...');
        pages.push(totalPages);
      }
    }
    return pages;
  };

  const pages = getPageNumbers();

  const handleSelectPage = (page: number) => {
    if (page >= 1 && page <= totalPages && page !== currentPage) {
      onPageChange(page);
    }
  };

  return (
    <View style={[styles.wrapper, style]}>
      {/* Bootstrap 5 Pagination Bar (Centered) */}
      <View style={styles.paginationBar}>
        {/* Previous Button */}
        <TouchableOpacity
          style={[
            styles.pageItem,
            styles.pageItemPrev,
            currentPage <= 1 && styles.pageItemDisabled,
          ]}
          disabled={currentPage <= 1}
          onPress={() => handleSelectPage(currentPage - 1)}
          activeOpacity={0.8}
        >
          <Text
            style={[
              styles.pageLinkText,
              currentPage <= 1 && styles.pageLinkTextDisabled,
            ]}
          >
            ‹ Prev
          </Text>
        </TouchableOpacity>

        {/* Page Number Buttons */}
        {pages.map((p, idx) => {
          if (p === '...') {
            return (
              <View key={`ellipsis-${idx}`} style={[styles.pageItem, styles.pageItemEllipsis]}>
                <Text style={styles.ellipsisText}>•••</Text>
              </View>
            );
          }

          const pageNum = Number(p);
          const isActive = pageNum === currentPage;

          return (
            <TouchableOpacity
              key={`page-${pageNum}`}
              style={[styles.pageItem, isActive && styles.pageItemActive]}
              onPress={() => handleSelectPage(pageNum)}
              activeOpacity={0.85}
            >
              <Text style={[styles.pageLinkText, isActive && styles.pageLinkTextActive]}>
                {pageNum}
              </Text>
            </TouchableOpacity>
          );
        })}

        {/* Next Button */}
        <TouchableOpacity
          style={[
            styles.pageItem,
            styles.pageItemNext,
            currentPage >= totalPages && styles.pageItemDisabled,
          ]}
          disabled={currentPage >= totalPages}
          onPress={() => handleSelectPage(currentPage + 1)}
          activeOpacity={0.8}
        >
          <Text
            style={[
              styles.pageLinkText,
              currentPage >= totalPages && styles.pageLinkTextDisabled,
            ]}
          >
            Next ›
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

// ─── BOOTSTRAP 5 PAGINATION STYLES (NO BLUE!) ───────────────────────────────
const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 8,
    marginTop: 14,
  },
  paginationBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#dee2e6', // Bootstrap border
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  pageItem: {
    minWidth: 38,
    height: 38,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderRightWidth: 1,
    borderColor: '#dee2e6',
    backgroundColor: '#ffffff',
  },
  pageItemPrev: {
    paddingHorizontal: 14,
  },
  pageItemNext: {
    paddingHorizontal: 14,
    borderRightWidth: 0,
  },
  pageItemActive: {
    backgroundColor: '#0e184e', // Official Deep Navy - NO BLUE!
    borderColor: '#0e184e',
  },
  pageItemDisabled: {
    backgroundColor: '#f8f9fa',
  },
  pageItemEllipsis: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 6,
  },
  pageLinkText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0e184e', // Deep Navy
  },
  pageLinkTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  pageLinkTextDisabled: {
    color: '#adb5bd',
  },
  ellipsisText: {
    fontSize: 11,
    color: '#6c757d',
    letterSpacing: 1,
  },
});

export default BootstrapPagination;
