// ============================================
// GREPRE SMART LIFE - BILL DETAIL SCREEN
// View and manage individual bill details
// ============================================

import { Badge, Button, Card, Divider } from '@/components';
import {
    BILL_CATEGORY_CONFIG,
    BILL_FREQUENCY_CONFIG,
    LAYOUT
} from '@/constants';
import { useTheme } from '@/hooks';
import { useBillStore } from '@/stores';
import { BillStatus } from '@/types';
import { formatCurrency, getDaysUntil } from '@/utils';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { useCallback, useState } from 'react';
import {
    Alert,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export function BillDetailScreen({ route, navigation }: any) {
  const { billId } = route.params;
  const { colors } = useTheme();
  const { bills, deleteBill, markBillAsPaid } = useBillStore();
  
  const bill = bills.find(b => b.id === billId);
  const [isProcessing, setIsProcessing] = useState(false);

  const categoryConfig = bill ? BILL_CATEGORY_CONFIG[bill.category] : null;
  const frequencyConfig = bill ? BILL_FREQUENCY_CONFIG[bill.frequency] : null;
  const daysUntil = bill ? getDaysUntil(bill.dueDate) : 0;

  const getStatusInfo = useCallback(() => {
    if (!bill) return { text: 'Unknown', color: colors.textLight };
    
    switch (bill.status) {
      case BillStatus.PAID:
        return { text: 'Paid', color: colors.success };
      case BillStatus.OVERDUE:
        return { text: 'Overdue', color: colors.error };
      case BillStatus.DUE_SOON:
        return { text: 'Due Soon', color: colors.warning };
      default:
        return { text: 'Upcoming', color: colors.primary };
    }
  }, [bill, colors]);

  const statusInfo = getStatusInfo();

  const handleMarkAsPaid = useCallback(async () => {
    if (!bill) return;
    
    setIsProcessing(true);
    try {
      await markBillAsPaid(bill.id);
      Alert.alert('Success', 'Bill marked as paid!');
    } catch (error) {
      Alert.alert('Error', 'Failed to mark bill as paid');
    } finally {
      setIsProcessing(false);
    }
  }, [bill, markBillAsPaid]);

  const handleDelete = useCallback(() => {
    if (!bill) return;
    
    Alert.alert(
      'Delete Bill',
      `Are you sure you want to delete "${bill.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteBill(bill.id);
            navigation.goBack();
          },
        },
      ]
    );
  }, [bill, deleteBill, navigation]);

  const handleEdit = useCallback(() => {
    navigation.navigate('AddBill', { bill });
  }, [bill, navigation]);

  if (!bill) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
        </View>
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyText, { color: colors.textLight }]}>
            Bill not found
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Bill Details</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.headerButton} onPress={handleEdit}>
            <Ionicons name="pencil" size={20} color={colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerButton} onPress={handleDelete}>
            <Ionicons name="trash-outline" size={20} color={colors.error} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Bill Card Header */}
        <Card style={styles.mainCard}>
          <View style={styles.billHeader}>
            <View
              style={[
                styles.categoryIcon,
                { backgroundColor: categoryConfig?.color + '20' },
              ]}
            >
              <Ionicons
                name={categoryConfig?.icon as any}
                size={32}
                color={categoryConfig?.color}
              />
            </View>
            <View style={styles.billInfo}>
              <Text style={[styles.billName, { color: colors.text }]}>
                {bill.name}
              </Text>
              <Text style={[styles.categoryName, { color: categoryConfig?.color }]}>
                {categoryConfig?.label}
              </Text>
            </View>
            <Badge
              text={statusInfo.text}
              color={statusInfo.color}
              style={styles.statusBadge}
            />
          </View>

          <View style={styles.amountContainer}>
            <Text style={[styles.amountLabel, { color: colors.textLight }]}>
              Amount Due
            </Text>
            <Text style={[styles.amount, { color: colors.text }]}>
              {formatCurrency(bill.amount, bill.currency)}
            </Text>
          </View>

          <Divider />

          <View style={styles.dateInfo}>
            <View style={styles.dateItem}>
              <Ionicons name="calendar-outline" size={20} color={colors.textLight} />
              <View style={styles.dateText}>
                <Text style={[styles.dateLabel, { color: colors.textLight }]}>
                  Due Date
                </Text>
                <Text style={[styles.dateValue, { color: colors.text }]}>
                  {format(new Date(bill.dueDate), 'MMMM d, yyyy')}
                </Text>
                <Text
                  style={[
                    styles.daysText,
                    { color: daysUntil < 0 ? colors.error : daysUntil <= 7 ? colors.warning : colors.success },
                  ]}
                >
                  {daysUntil < 0
                    ? `${Math.abs(daysUntil)} days overdue`
                    : daysUntil === 0
                    ? 'Due today'
                    : `${daysUntil} days remaining`}
                </Text>
              </View>
            </View>

            <View style={styles.dateItem}>
              <Ionicons name="repeat-outline" size={20} color={colors.textLight} />
              <View style={styles.dateText}>
                <Text style={[styles.dateLabel, { color: colors.textLight }]}>
                  Frequency
                </Text>
                <Text style={[styles.dateValue, { color: colors.text }]}>
                  {frequencyConfig?.label}
                </Text>
              </View>
            </View>
          </View>
        </Card>

        {/* Additional Info */}
        <Card style={styles.infoCard}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Additional Information
          </Text>

          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: colors.textLight }]}>
              Auto-Pay
            </Text>
            <Badge
              text={bill.isAutoPay ? 'Enabled' : 'Disabled'}
              color={bill.isAutoPay ? colors.success : colors.textLight}
            />
          </View>

          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: colors.textLight }]}>
              Reminder
            </Text>
            <Text style={[styles.infoValue, { color: colors.text }]}>
              {bill.reminderDays} days before
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: colors.textLight }]}>
              Status
            </Text>
            <Badge
              text={bill.isActive ? 'Active' : 'Inactive'}
              color={bill.isActive ? colors.success : colors.textLight}
            />
          </View>

          {bill.notes && (
            <>
              <Divider style={styles.divider} />
              <Text style={[styles.notesLabel, { color: colors.textLight }]}>
                Notes
              </Text>
              <Text style={[styles.notesText, { color: colors.text }]}>
                {bill.notes}
              </Text>
            </>
          )}
        </Card>

        {/* Payment History */}
        {bill.paymentHistory && bill.paymentHistory.length > 0 && (
          <Card style={styles.historyCard}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Payment History
            </Text>

            {bill.paymentHistory.slice(0, 5).map((payment, index) => (
              <View key={index} style={styles.historyItem}>
                <View style={styles.historyInfo}>
                  <Ionicons name="checkmark-circle" size={20} color={colors.success} />
                  <Text style={[styles.historyDate, { color: colors.text }]}>
                    {format(new Date(payment.paidDate), 'MMM d, yyyy')}
                  </Text>
                </View>
                <Text style={[styles.historyAmount, { color: colors.text }]}>
                  {formatCurrency(payment.amount, bill.currency)}
                </Text>
              </View>
            ))}
          </Card>
        )}

        {/* Actions */}
        <View style={styles.actions}>
          {bill.status !== BillStatus.PAID && (
            <Button
              title="Mark as Paid"
              onPress={handleMarkAsPaid}
              loading={isProcessing}
              icon={<Ionicons name="checkmark-circle-outline" size={20} color="#fff" />}
              style={styles.payButton}
            />
          )}
        </View>
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
    paddingVertical: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 12,
  },
  headerButton: {
    padding: 4,
  },
  content: {
    flex: 1,
    paddingHorizontal: LAYOUT.padding,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 16,
  },
  mainCard: {
    marginBottom: 16,
  },
  billHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  categoryIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  billInfo: {
    flex: 1,
    marginLeft: 16,
  },
  billName: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
  },
  categoryName: {
    fontSize: 14,
    fontWeight: '500',
  },
  statusBadge: {
    alignSelf: 'flex-start',
  },
  amountContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  amountLabel: {
    fontSize: 14,
    marginBottom: 4,
  },
  amount: {
    fontSize: 36,
    fontWeight: '700',
  },
  dateInfo: {
    paddingTop: 16,
    gap: 16,
  },
  dateItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  dateText: {
    flex: 1,
  },
  dateLabel: {
    fontSize: 12,
    marginBottom: 2,
  },
  dateValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  daysText: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  infoCard: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  infoLabel: {
    fontSize: 14,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '500',
  },
  divider: {
    marginVertical: 16,
  },
  notesLabel: {
    fontSize: 12,
    marginBottom: 8,
  },
  notesText: {
    fontSize: 14,
    lineHeight: 20,
  },
  historyCard: {
    marginBottom: 16,
  },
  historyItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  historyInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  historyDate: {
    fontSize: 14,
  },
  historyAmount: {
    fontSize: 14,
    fontWeight: '600',
  },
  actions: {
    paddingVertical: 20,
  },
  payButton: {
    marginBottom: 12,
  },
});
