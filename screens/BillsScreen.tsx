// ============================================
// GREPRE SMART LIFE - BILLS SCREEN
// List all bills with filtering
// ============================================

import { BillCard, EmptyState } from '@/components';
import { LAYOUT } from '@/constants';
import { useDebounce, useTheme } from '@/hooks';
import { useBillStore } from '@/stores';
import { BillStatus } from '@/types';
import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useState } from 'react';
import {
    FlatList,
    RefreshControl,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const FILTER_OPTIONS = [
  { key: 'all', label: 'All' },
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'overdue', label: 'Overdue' },
  { key: 'paid', label: 'Paid' },
];

export function BillsScreen({ navigation }: any) {
  const { colors } = useTheme();
  const { bills, isLoading, fetchBills, markAsPaid } = useBillStore();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const debouncedSearch = useDebounce(searchQuery, 300);

  useEffect(() => {
    fetchBills();
  }, []);

  // Filter bills
  const filteredBills = bills.filter((bill) => {
    // Search filter
    if (debouncedSearch) {
      const query = debouncedSearch.toLowerCase();
      if (!bill.name.toLowerCase().includes(query) && 
          !bill.notes?.toLowerCase().includes(query)) {
        return false;
      }
    }

    // Status filter
    switch (activeFilter) {
      case 'upcoming':
        return bill.status === BillStatus.UPCOMING;
      case 'overdue':
        return bill.status === BillStatus.OVERDUE;
      case 'paid':
        return bill.status === BillStatus.PAID;
      default:
        return true;
    }
  });

  const handleMarkPaid = useCallback(async (billId: string) => {
    try {
      await markAsPaid(billId);
    } catch (error) {
      console.error('Error marking bill as paid:', error);
    }
  }, [markAsPaid]);

  const renderBillCard = useCallback(({ item }: { item: any }) => (
    <BillCard
      bill={item}
      onPress={() => navigation.navigate('BillDetail', { billId: item.id })}
      onMarkPaid={() => handleMarkPaid(item.id)}
    />
  ), [navigation, handleMarkPaid]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Bills</Text>
        <View style={styles.headerButtons}>
          <TouchableOpacity
            style={[styles.scanButton, { backgroundColor: colors.secondary }]}
            onPress={() => navigation.navigate('ScanBill')}
          >
            <Ionicons name="scan" size={22} color="#FFFFFF" />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.addButton, { backgroundColor: colors.primary }]}
            onPress={() => navigation.navigate('AddBill')}
          >
            <Ionicons name="add" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Search Bar */}
      <View style={[styles.searchContainer, { backgroundColor: colors.surface }]}>
        <Ionicons name="search" size={20} color={colors.textSecondary} />
        <TextInput
          style={[styles.searchInput, { color: colors.text }]}
          placeholder="Search bills..."
          placeholderTextColor={colors.textLight}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterContainer}>
        {FILTER_OPTIONS.map((filter) => (
          <TouchableOpacity
            key={filter.key}
            style={[
              styles.filterTab,
              activeFilter === filter.key && { backgroundColor: colors.primary },
              activeFilter !== filter.key && { backgroundColor: colors.surfaceVariant },
            ]}
            onPress={() => setActiveFilter(filter.key)}
          >
            <Text
              style={[
                styles.filterText,
                { color: activeFilter === filter.key ? '#FFFFFF' : colors.textSecondary },
              ]}
            >
              {filter.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Bill List */}
      <FlatList
        data={filteredBills}
        keyExtractor={(item) => item.id}
        renderItem={renderBillCard}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={fetchBills}
            tintColor={colors.primary}
          />
        }
        ListEmptyComponent={
          <EmptyState
            icon="receipt-outline"
            title={searchQuery ? 'No Results' : 'No Bills Yet'}
            message={
              searchQuery
                ? 'Try adjusting your search query'
                : 'Add your first bill to start tracking your payments.'
            }
            actionLabel={searchQuery ? undefined : 'Add Bill'}
            onAction={searchQuery ? undefined : () => navigation.navigate('AddBill')}
          />
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: LAYOUT.padding,
    paddingVertical: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  scanButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: LAYOUT.padding,
    marginBottom: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: LAYOUT.borderRadius,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    marginLeft: 8,
  },
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: LAYOUT.padding,
    marginBottom: 16,
    gap: 8,
  },
  filterTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  filterText: {
    fontSize: 14,
    fontWeight: '500',
  },
  listContent: {
    paddingHorizontal: LAYOUT.padding,
    paddingBottom: 100,
  },
});
