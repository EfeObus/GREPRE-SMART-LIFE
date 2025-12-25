// ============================================
// GREPRE SMART LIFE - DASHBOARD SCREEN
// Main home screen with overview
// ============================================

import { BillCard, Card, DocumentCard, EmptyState, SectionHeader } from '@/components';
import { LAYOUT } from '@/constants';
import { useRefreshData, useTheme } from '@/hooks';
import { useAppStore, useBillStore, useDocumentStore } from '@/stores';
import { currencyHelpers } from '@/utils';
import { Ionicons } from '@expo/vector-icons';
import { useEffect } from 'react';
import {
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export function DashboardScreen({ navigation }: any) {
  const { colors } = useTheme();
  const { isRefreshing, refresh } = useRefreshData();

  // Store data
  const { bills, upcomingBills, overdueBills, totalMonthlyExpenses, fetchBills } = useBillStore();
  const { documents, expiringDocuments, fetchDocuments } = useDocumentStore();
  const { user, settings, unreadReminderCount } = useAppStore();

  // Load data on mount
  useEffect(() => {
    fetchBills();
    fetchDocuments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Stats summary
  const stats = {
    totalBills: bills.length,
    upcomingCount: upcomingBills.length,
    overdueCount: overdueBills.length,
    totalDocuments: documents.length,
    expiringCount: expiringDocuments.length,
    monthlyExpenses: totalMonthlyExpenses,
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={[styles.greeting, { color: colors.textSecondary }]}>
            Good {new Date().getHours() < 12 ? 'Morning' : new Date().getHours() < 18 ? 'Afternoon' : 'Evening'}
          </Text>
          <Text style={[styles.userName, { color: colors.text }]}>
            {user?.name || 'Welcome!'}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.notificationBtn, { backgroundColor: colors.surface }]}
          onPress={() => navigation.navigate('Reminders')}
        >
          <Ionicons name="notifications-outline" size={24} color={colors.text} />
          {unreadReminderCount > 0 && (
            <View style={[styles.notificationBadge, { backgroundColor: colors.error }]}>
              <Text style={styles.notificationCount}>
                {unreadReminderCount > 9 ? '9+' : unreadReminderCount}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={refresh} tintColor={colors.primary} />
        }
      >
        {/* Monthly Expenses Card */}
        <Card style={styles.expenseCard}>
          <Text style={[styles.expenseLabel, { color: colors.textSecondary }]}>
            Monthly Expenses
          </Text>
          <Text style={[styles.expenseAmount, { color: colors.text }]}>
            {currencyHelpers.format(stats.monthlyExpenses, settings.currency)}
          </Text>
          <View style={styles.expenseStats}>
            <View style={styles.statItem}>
              <View style={[styles.statDot, { backgroundColor: colors.success }]} />
              <Text style={[styles.statText, { color: colors.textSecondary }]}>
                {stats.upcomingCount} upcoming
              </Text>
            </View>
            <View style={styles.statItem}>
              <View style={[styles.statDot, { backgroundColor: colors.error }]} />
              <Text style={[styles.statText, { color: colors.textSecondary }]}>
                {stats.overdueCount} overdue
              </Text>
            </View>
          </View>
        </Card>

        {/* Quick Stats */}
        <View style={styles.quickStats}>
          <TouchableOpacity
            style={[styles.quickStatCard, { backgroundColor: colors.surface }]}
            onPress={() => navigation.navigate('Bills')}
          >
            <View style={[styles.quickStatIcon, { backgroundColor: colors.primary + '20' }]}>
              <Ionicons name="receipt-outline" size={24} color={colors.primary} />
            </View>
            <Text style={[styles.quickStatNumber, { color: colors.text }]}>{stats.totalBills}</Text>
            <Text style={[styles.quickStatLabel, { color: colors.textSecondary }]}>Bills</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.quickStatCard, { backgroundColor: colors.surface }]}
            onPress={() => navigation.navigate('Documents')}
          >
            <View style={[styles.quickStatIcon, { backgroundColor: colors.secondary + '20' }]}>
              <Ionicons name="folder-outline" size={24} color={colors.secondary} />
            </View>
            <Text style={[styles.quickStatNumber, { color: colors.text }]}>{stats.totalDocuments}</Text>
            <Text style={[styles.quickStatLabel, { color: colors.textSecondary }]}>Documents</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.quickStatCard, { backgroundColor: colors.surface }]}
            onPress={() => navigation.navigate('Reminders')}
          >
            <View style={[styles.quickStatIcon, { backgroundColor: colors.warning + '20' }]}>
              <Ionicons name="alarm-outline" size={24} color={colors.warning} />
            </View>
            <Text style={[styles.quickStatNumber, { color: colors.text }]}>{unreadReminderCount}</Text>
            <Text style={[styles.quickStatLabel, { color: colors.textSecondary }]}>Alerts</Text>
          </TouchableOpacity>
        </View>

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <TouchableOpacity
            style={[styles.quickActionBtn, { backgroundColor: colors.primary }]}
            onPress={() => navigation.navigate('ScanBill')}
          >
            <Ionicons name="scan" size={20} color="#FFFFFF" />
            <Text style={styles.quickActionText}>Scan Bill</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.quickActionBtn, { backgroundColor: colors.secondary }]}
            onPress={() => navigation.navigate('AddBill')}
          >
            <Ionicons name="add-circle" size={20} color="#FFFFFF" />
            <Text style={styles.quickActionText}>Add Bill</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.quickActionBtn, { backgroundColor: colors.success }]}
            onPress={() => navigation.navigate('AddDocument')}
          >
            <Ionicons name="document-attach" size={20} color="#FFFFFF" />
            <Text style={styles.quickActionText}>Add Doc</Text>
          </TouchableOpacity>
        </View>

        {/* Overdue Bills */}
        {overdueBills.length > 0 && (
          <View style={styles.section}>
            <SectionHeader
              title="⚠️ Overdue Bills"
              actionLabel="See All"
              onAction={() => navigation.navigate('Bills')}
            />
            {overdueBills.slice(0, 2).map((bill) => (
              <BillCard
                key={bill.id}
                bill={bill}
                onPress={() => navigation.navigate('BillDetail', { billId: bill.id })}
                compact
              />
            ))}
          </View>
        )}

        {/* Upcoming Bills */}
        {upcomingBills.length > 0 && (
          <View style={styles.section}>
            <SectionHeader
              title="📅 Upcoming Bills"
              actionLabel="See All"
              onAction={() => navigation.navigate('Bills')}
            />
            {upcomingBills.slice(0, 3).map((bill) => (
              <BillCard
                key={bill.id}
                bill={bill}
                onPress={() => navigation.navigate('BillDetail', { billId: bill.id })}
                compact
              />
            ))}
          </View>
        )}

        {/* Expiring Documents */}
        {expiringDocuments.length > 0 && (
          <View style={styles.section}>
            <SectionHeader
              title="📋 Expiring Soon"
              actionLabel="See All"
              onAction={() => navigation.navigate('Documents')}
            />
            {expiringDocuments.slice(0, 3).map((doc) => (
              <DocumentCard
                key={doc.id}
                document={doc}
                onPress={() => navigation.navigate('DocumentDetail', { documentId: doc.id })}
                compact
              />
            ))}
          </View>
        )}

        {/* Empty State */}
        {stats.totalBills === 0 && stats.totalDocuments === 0 && (
          <EmptyState
            icon="sparkles"
            title="Get Started"
            message="Add your first bill or document to start tracking your important deadlines."
            actionLabel="Add Bill"
            onAction={() => navigation.navigate('AddBill')}
          />
        )}

        <View style={{ height: 100 }} />
      </ScrollView>
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
  greeting: {
    fontSize: 14,
  },
  userName: {
    fontSize: 24,
    fontWeight: '700',
    marginTop: 2,
  },
  notificationBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationCount: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  content: {
    flex: 1,
    paddingHorizontal: LAYOUT.padding,
  },
  expenseCard: {
    marginBottom: 16,
  },
  expenseLabel: {
    fontSize: 14,
  },
  expenseAmount: {
    fontSize: 36,
    fontWeight: '700',
    marginTop: 4,
  },
  expenseStats: {
    flexDirection: 'row',
    marginTop: 16,
    gap: 24,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statText: {
    fontSize: 13,
  },
  quickStats: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  quickStatCard: {
    flex: 1,
    padding: 16,
    borderRadius: LAYOUT.cardBorderRadius,
    alignItems: 'center',
  },
  quickStatIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  quickStatNumber: {
    fontSize: 24,
    fontWeight: '700',
  },
  quickStatLabel: {
    fontSize: 12,
    marginTop: 2,
  },
  quickActions: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 24,
  },
  quickActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: LAYOUT.borderRadius,
    gap: 6,
  },
  quickActionText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  section: {
    marginBottom: 24,
  },
});
