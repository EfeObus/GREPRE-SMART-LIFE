// ============================================
// GREPRE SMART LIFE - ADD BILL SCREEN
// Form to add/edit bills
// ============================================

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useTheme, useForm } from '@/hooks';
import { useBillStore, useAppStore } from '@/stores';
import { Button, Card } from '@/components';
import { BillCategory, BillFrequency } from '@/types';
import {
  LAYOUT,
  BILL_CATEGORY_CONFIG,
  BILL_FREQUENCY_CONFIG,
  DEFAULT_REMINDER_OPTIONS,
  CURRENCY_OPTIONS,
} from '@/constants';

interface FormValues {
  name: string;
  category: BillCategory;
  amount: string;
  currency: string;
  frequency: BillFrequency;
  dueDate: Date;
  autopay: boolean;
  notes: string;
  reminderDays: number[];
}

export function AddBillScreen({ navigation, route }: any) {
  const { colors } = useTheme();
  const { addBill, updateBill, getBillById, isLoading } = useBillStore();
  const { settings } = useAppStore();

  const billId = route.params?.billId;
  const isEditing = !!billId;

  const { values, setValue, errors, setFieldError, reset } = useForm<FormValues>({
    name: '',
    category: BillCategory.OTHER,
    amount: '',
    currency: settings.currency,
    frequency: BillFrequency.MONTHLY,
    dueDate: new Date(),
    autopay: false,
    notes: '',
    reminderDays: settings.defaultReminderDays,
  });

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [showFrequencyPicker, setShowFrequencyPicker] = useState(false);

  // Load existing bill if editing
  useEffect(() => {
    if (isEditing) {
      const bill = getBillById(billId);
      if (bill) {
        setValue('name', bill.name);
        setValue('category', bill.category);
        setValue('amount', bill.amount.toString());
        setValue('currency', bill.currency);
        setValue('frequency', bill.frequency);
        setValue('dueDate', new Date(bill.dueDate));
        setValue('autopay', bill.autopay);
        setValue('notes', bill.notes || '');
        setValue('reminderDays', bill.reminderDays);
      }
    }
  }, [billId]);

  const validateForm = (): boolean => {
    let isValid = true;

    if (!values.name.trim()) {
      setFieldError('name', 'Bill name is required');
      isValid = false;
    }

    if (!values.amount || parseFloat(values.amount) <= 0) {
      setFieldError('amount', 'Please enter a valid amount');
      isValid = false;
    }

    return isValid;
  };

  const handleSave = async () => {
    if (!validateForm()) return;

    try {
      const billData = {
        name: values.name.trim(),
        category: values.category,
        amount: values.amount,
        currency: values.currency,
        frequency: values.frequency,
        dueDate: values.dueDate,
        autopay: values.autopay,
        notes: values.notes.trim() || undefined,
        reminderDays: values.reminderDays,
      };

      if (isEditing) {
        await updateBill(billId, billData);
        Alert.alert('Success', 'Bill updated successfully');
      } else {
        await addBill(billData);
        Alert.alert('Success', 'Bill added successfully');
      }

      navigation.goBack();
    } catch (error) {
      Alert.alert('Error', 'Failed to save bill. Please try again.');
    }
  };

  const toggleReminderDay = (day: number) => {
    const current = values.reminderDays;
    if (current.includes(day)) {
      setValue('reminderDays', current.filter((d) => d !== day));
    } else {
      setValue('reminderDays', [...current, day].sort((a, b) => a - b));
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="close" size={28} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.text }]}>
            {isEditing ? 'Edit Bill' : 'Add Bill'}
          </Text>
          <View style={{ width: 28 }} />
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Bill Name */}
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.text }]}>Bill Name *</Text>
            <TextInput
              style={[
                styles.input,
                { backgroundColor: colors.surface, color: colors.text, borderColor: errors.name ? colors.error : colors.border },
              ]}
              placeholder="e.g., Netflix, Rent, Electric Bill"
              placeholderTextColor={colors.textLight}
              value={values.name}
              onChangeText={(text) => setValue('name', text)}
            />
            {errors.name && <Text style={[styles.errorText, { color: colors.error }]}>{errors.name}</Text>}
          </View>

          {/* Category */}
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.text }]}>Category</Text>
            <TouchableOpacity
              style={[styles.selectButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() => setShowCategoryPicker(!showCategoryPicker)}
            >
              <View style={styles.selectContent}>
                <View
                  style={[
                    styles.categoryIcon,
                    { backgroundColor: BILL_CATEGORY_CONFIG[values.category].color + '20' },
                  ]}
                >
                  <Ionicons
                    name={BILL_CATEGORY_CONFIG[values.category].icon as any}
                    size={20}
                    color={BILL_CATEGORY_CONFIG[values.category].color}
                  />
                </View>
                <Text style={[styles.selectText, { color: colors.text }]}>
                  {BILL_CATEGORY_CONFIG[values.category].label}
                </Text>
              </View>
              <Ionicons name="chevron-down" size={20} color={colors.textSecondary} />
            </TouchableOpacity>

            {showCategoryPicker && (
              <Card style={styles.pickerCard}>
                {Object.entries(BILL_CATEGORY_CONFIG).map(([key, config]) => (
                  <TouchableOpacity
                    key={key}
                    style={styles.pickerOption}
                    onPress={() => {
                      setValue('category', key as BillCategory);
                      setShowCategoryPicker(false);
                    }}
                  >
                    <View style={[styles.categoryIcon, { backgroundColor: config.color + '20' }]}>
                      <Ionicons name={config.icon as any} size={18} color={config.color} />
                    </View>
                    <Text style={[styles.pickerOptionText, { color: colors.text }]}>{config.label}</Text>
                    {values.category === key && (
                      <Ionicons name="checkmark" size={20} color={colors.primary} />
                    )}
                  </TouchableOpacity>
                ))}
              </Card>
            )}
          </View>

          {/* Amount */}
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.text }]}>Amount *</Text>
            <View style={styles.amountRow}>
              <TouchableOpacity
                style={[styles.currencyButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
              >
                <Text style={[styles.currencyText, { color: colors.text }]}>
                  {CURRENCY_OPTIONS.find((c) => c.code === values.currency)?.symbol || values.currency}
                </Text>
              </TouchableOpacity>
              <TextInput
                style={[
                  styles.input,
                  styles.amountInput,
                  { backgroundColor: colors.surface, color: colors.text, borderColor: errors.amount ? colors.error : colors.border },
                ]}
                placeholder="0.00"
                placeholderTextColor={colors.textLight}
                keyboardType="decimal-pad"
                value={values.amount}
                onChangeText={(text) => setValue('amount', text)}
              />
            </View>
            {errors.amount && <Text style={[styles.errorText, { color: colors.error }]}>{errors.amount}</Text>}
          </View>

          {/* Frequency */}
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.text }]}>Frequency</Text>
            <TouchableOpacity
              style={[styles.selectButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() => setShowFrequencyPicker(!showFrequencyPicker)}
            >
              <Text style={[styles.selectText, { color: colors.text }]}>
                {BILL_FREQUENCY_CONFIG[values.frequency].label}
              </Text>
              <Ionicons name="chevron-down" size={20} color={colors.textSecondary} />
            </TouchableOpacity>

            {showFrequencyPicker && (
              <Card style={styles.pickerCard}>
                {Object.entries(BILL_FREQUENCY_CONFIG).map(([key, config]) => (
                  <TouchableOpacity
                    key={key}
                    style={styles.pickerOption}
                    onPress={() => {
                      setValue('frequency', key as BillFrequency);
                      setShowFrequencyPicker(false);
                    }}
                  >
                    <Text style={[styles.pickerOptionText, { color: colors.text }]}>{config.label}</Text>
                    {values.frequency === key && (
                      <Ionicons name="checkmark" size={20} color={colors.primary} />
                    )}
                  </TouchableOpacity>
                ))}
              </Card>
            )}
          </View>

          {/* Due Date */}
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.text }]}>Due Date</Text>
            <TouchableOpacity
              style={[styles.selectButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() => setShowDatePicker(true)}
            >
              <Ionicons name="calendar-outline" size={20} color={colors.textSecondary} />
              <Text style={[styles.selectText, { color: colors.text, marginLeft: 8 }]}>
                {values.dueDate.toLocaleDateString('en-US', {
                  weekday: 'short',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </Text>
            </TouchableOpacity>
          </View>

          {showDatePicker && (
            <DateTimePicker
              value={values.dueDate}
              mode="date"
              display="spinner"
              onChange={(event, date) => {
                setShowDatePicker(false);
                if (date) setValue('dueDate', date);
              }}
            />
          )}

          {/* Reminders */}
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.text }]}>Reminders</Text>
            <View style={styles.reminderOptions}>
              {DEFAULT_REMINDER_OPTIONS.map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.reminderChip,
                    {
                      backgroundColor: values.reminderDays.includes(option.value)
                        ? colors.primary
                        : colors.surfaceVariant,
                    },
                  ]}
                  onPress={() => toggleReminderDay(option.value)}
                >
                  <Text
                    style={[
                      styles.reminderChipText,
                      {
                        color: values.reminderDays.includes(option.value)
                          ? '#FFFFFF'
                          : colors.textSecondary,
                      },
                    ]}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Auto-pay Toggle */}
          <TouchableOpacity
            style={[styles.toggleRow, { backgroundColor: colors.surface }]}
            onPress={() => setValue('autopay', !values.autopay)}
          >
            <View style={styles.toggleContent}>
              <Ionicons name="sync" size={20} color={colors.primary} />
              <View style={styles.toggleTextContainer}>
                <Text style={[styles.toggleLabel, { color: colors.text }]}>Auto-pay enabled</Text>
                <Text style={[styles.toggleDescription, { color: colors.textSecondary }]}>
                  Mark this bill as auto-pay
                </Text>
              </View>
            </View>
            <View
              style={[
                styles.checkbox,
                {
                  backgroundColor: values.autopay ? colors.primary : 'transparent',
                  borderColor: values.autopay ? colors.primary : colors.border,
                },
              ]}
            >
              {values.autopay && <Ionicons name="checkmark" size={16} color="#FFFFFF" />}
            </View>
          </TouchableOpacity>

          {/* Notes */}
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.text }]}>Notes (Optional)</Text>
            <TextInput
              style={[
                styles.input,
                styles.textArea,
                { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border },
              ]}
              placeholder="Add any additional notes..."
              placeholderTextColor={colors.textLight}
              value={values.notes}
              onChangeText={(text) => setValue('notes', text)}
              multiline
              numberOfLines={3}
            />
          </View>

          <View style={{ height: 100 }} />
        </ScrollView>

        {/* Save Button */}
        <View style={[styles.footer, { backgroundColor: colors.background }]}>
          <Button
            title={isEditing ? 'Save Changes' : 'Add Bill'}
            onPress={handleSave}
            loading={isLoading}
            icon={isEditing ? 'checkmark' : 'add'}
          />
        </View>
      </KeyboardAvoidingView>
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
    fontSize: 18,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    paddingHorizontal: LAYOUT.padding,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: LAYOUT.borderRadius,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  errorText: {
    fontSize: 12,
    marginTop: 4,
  },
  selectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: LAYOUT.borderRadius,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  selectContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  selectText: {
    fontSize: 16,
  },
  categoryIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  pickerCard: {
    marginTop: 8,
    padding: 8,
  },
  pickerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  pickerOptionText: {
    flex: 1,
    fontSize: 16,
  },
  amountRow: {
    flexDirection: 'row',
    gap: 12,
  },
  currencyButton: {
    borderWidth: 1,
    borderRadius: LAYOUT.borderRadius,
    paddingHorizontal: 16,
    paddingVertical: 14,
    minWidth: 60,
    alignItems: 'center',
  },
  currencyText: {
    fontSize: 16,
    fontWeight: '600',
  },
  amountInput: {
    flex: 1,
  },
  reminderOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  reminderChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  reminderChipText: {
    fontSize: 13,
    fontWeight: '500',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: LAYOUT.borderRadius,
    marginBottom: 20,
  },
  toggleContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  toggleTextContainer: {
    marginLeft: 12,
  },
  toggleLabel: {
    fontSize: 16,
    fontWeight: '500',
  },
  toggleDescription: {
    fontSize: 12,
    marginTop: 2,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    padding: LAYOUT.padding,
    paddingBottom: 24,
  },
});
