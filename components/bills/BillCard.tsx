// ============================================
// GREPRE SMART LIFE - BILL CARD COMPONENT
// ============================================

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks';
import { Card, Badge } from '@/components/ui';
import { BILL_CATEGORY_CONFIG, LAYOUT } from '@/constants';
import { dateHelpers, currencyHelpers, statusHelpers } from '@/utils';
import type { Bill } from '@/types';

interface BillCardProps {
  bill: Bill;
  onPress: () => void;
  onMarkPaid?: () => void;
  compact?: boolean;
}

export function BillCard({ bill, onPress, onMarkPaid, compact = false }: BillCardProps) {
  const { colors } = useTheme();
  const categoryConfig = BILL_CATEGORY_CONFIG[bill.category];
  const urgency = dateHelpers.getUrgencyLabel(bill.nextDueDate);
  const statusColor = statusHelpers.getBillStatusColor(bill.status);
  const statusLabel = statusHelpers.getBillStatusLabel(bill.status);

  if (compact) {
    return (
      <TouchableOpacity
        style={[styles.compactCard, { backgroundColor: colors.surface }]}
        onPress={onPress}
        activeOpacity={0.7}
      >
        <View style={[styles.iconContainer, { backgroundColor: categoryConfig.color + '20' }]}>
          <Ionicons name={categoryConfig.icon as any} size={20} color={categoryConfig.color} />
        </View>
        <View style={styles.compactContent}>
          <Text style={[styles.compactName, { color: colors.text }]} numberOfLines={1}>
            {bill.name}
          </Text>
          <Text style={[styles.compactDate, { color: urgency.color }]}>{urgency.label}</Text>
        </View>
        <Text style={[styles.compactAmount, { color: colors.text }]}>
          {currencyHelpers.format(bill.amount, bill.currency)}
        </Text>
      </TouchableOpacity>
    );
  }

  return (
    <Card style={styles.card} onPress={onPress}>
      <View style={styles.header}>
        <View style={[styles.iconContainer, { backgroundColor: categoryConfig.color + '20' }]}>
          <Ionicons name={categoryConfig.icon as any} size={24} color={categoryConfig.color} />
        </View>
        <View style={styles.headerInfo}>
          <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
            {bill.name}
          </Text>
          <Text style={[styles.category, { color: colors.textSecondary }]}>
            {categoryConfig.label}
          </Text>
        </View>
        <Badge label={statusLabel} color={statusColor} />
      </View>

      <View style={styles.details}>
        <View style={styles.detailRow}>
          <Ionicons name="calendar-outline" size={16} color={colors.textSecondary} />
          <Text style={[styles.detailText, { color: urgency.color }]}>{urgency.label}</Text>
        </View>
        <Text style={[styles.amount, { color: colors.text }]}>
          {currencyHelpers.format(bill.amount, bill.currency)}
        </Text>
      </View>

      {bill.autopay && (
        <View style={[styles.autopayBadge, { backgroundColor: colors.success + '20' }]}>
          <Ionicons name="sync" size={14} color={colors.success} />
          <Text style={[styles.autopayText, { color: colors.success }]}>Auto-pay enabled</Text>
        </View>
      )}

      {onMarkPaid && bill.status !== 'paid' && (
        <TouchableOpacity
          style={[styles.payButton, { backgroundColor: colors.success }]}
          onPress={onMarkPaid}
        >
          <Ionicons name="checkmark" size={18} color="#FFFFFF" />
          <Text style={styles.payButtonText}>Mark as Paid</Text>
        </TouchableOpacity>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerInfo: {
    flex: 1,
    marginLeft: 12,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
  },
  category: {
    fontSize: 12,
    marginTop: 2,
  },
  details: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailText: {
    fontSize: 14,
    marginLeft: 6,
    fontWeight: '500',
  },
  amount: {
    fontSize: 20,
    fontWeight: '700',
  },
  autopayBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginTop: 12,
  },
  autopayText: {
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 4,
  },
  payButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    paddingVertical: 10,
    borderRadius: 10,
  },
  payButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  // Compact styles
  compactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
  },
  compactContent: {
    flex: 1,
    marginLeft: 12,
  },
  compactName: {
    fontSize: 14,
    fontWeight: '600',
  },
  compactDate: {
    fontSize: 12,
    marginTop: 2,
  },
  compactAmount: {
    fontSize: 14,
    fontWeight: '700',
  },
});
