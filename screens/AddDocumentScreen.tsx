// ============================================
// GREPRE SMART LIFE - ADD DOCUMENT SCREEN
// Form to add/edit documents
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
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useTheme, useForm } from '@/hooks';
import { useDocumentStore, useAppStore } from '@/stores';
import { documentService } from '@/services';
import { Button, Card } from '@/components';
import { DocumentCategory } from '@/types';
import { LAYOUT, DOCUMENT_CATEGORY_CONFIG, DEFAULT_REMINDER_OPTIONS } from '@/constants';

interface FormValues {
  name: string;
  category: DocumentCategory;
  description: string;
  expiryDate: Date | null;
  issueDate: Date | null;
  documentNumber: string;
  issuingAuthority: string;
  tags: string[];
  reminderDays: number[];
}

export function AddDocumentScreen({ navigation, route }: any) {
  const { colors } = useTheme();
  const { addDocument, isLoading } = useDocumentStore();
  const { settings } = useAppStore();

  const documentId = route.params?.documentId;
  const isEditing = !!documentId;

  const { values, setValue, errors, setFieldError } = useForm<FormValues>({
    name: '',
    category: DocumentCategory.OTHER,
    description: '',
    expiryDate: null,
    issueDate: null,
    documentNumber: '',
    issuingAuthority: '',
    tags: [],
    reminderDays: settings.defaultReminderDays,
  });

  const [file, setFile] = useState<{ uri: string; name: string; type: string; size: number } | null>(null);
  const [showExpiryDatePicker, setShowExpiryDatePicker] = useState(false);
  const [showIssueDatePicker, setShowIssueDatePicker] = useState(false);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [tagInput, setTagInput] = useState('');

  const pickDocument = async () => {
    const result = await documentService.pickDocument();
    if (result) {
      setFile(result);
      if (!values.name) {
        setValue('name', result.name.replace(/\.[^/.]+$/, '')); // Remove extension
      }
    }
  };

  const takePhoto = async () => {
    const result = await documentService.takePhoto();
    if (result) {
      setFile(result);
    }
  };

  const pickImage = async () => {
    const result = await documentService.pickImage();
    if (result) {
      setFile(result);
    }
  };

  const showFileOptions = () => {
    Alert.alert(
      'Add Document',
      'Choose how to add your document',
      [
        { text: 'Take Photo', onPress: takePhoto },
        { text: 'Choose from Gallery', onPress: pickImage },
        { text: 'Pick File', onPress: pickDocument },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const addTag = () => {
    const tag = tagInput.trim();
    if (tag && !values.tags.includes(tag)) {
      setValue('tags', [...values.tags, tag]);
      setTagInput('');
    }
  };

  const removeTag = (tag: string) => {
    setValue('tags', values.tags.filter((t) => t !== tag));
  };

  const toggleReminderDay = (day: number) => {
    const current = values.reminderDays;
    if (current.includes(day)) {
      setValue('reminderDays', current.filter((d) => d !== day));
    } else {
      setValue('reminderDays', [...current, day].sort((a, b) => a - b));
    }
  };

  const validateForm = (): boolean => {
    let isValid = true;

    if (!values.name.trim()) {
      setFieldError('name', 'Document name is required');
      isValid = false;
    }

    if (!file && !isEditing) {
      Alert.alert('Error', 'Please add a document file');
      isValid = false;
    }

    return isValid;
  };

  const handleSave = async () => {
    if (!validateForm()) return;

    try {
      const formData = {
        name: values.name.trim(),
        category: values.category,
        description: values.description.trim() || undefined,
        expiryDate: values.expiryDate || undefined,
        issueDate: values.issueDate || undefined,
        documentNumber: values.documentNumber.trim() || undefined,
        issuingAuthority: values.issuingAuthority.trim() || undefined,
        tags: values.tags,
        reminderDays: values.reminderDays,
      };

      if (file) {
        await addDocument(formData, file);
      }

      Alert.alert('Success', 'Document added successfully');
      navigation.goBack();
    } catch (error) {
      Alert.alert('Error', 'Failed to save document. Please try again.');
    }
  };

  const isImage = file?.type.startsWith('image/');

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
            {isEditing ? 'Edit Document' : 'Add Document'}
          </Text>
          <View style={{ width: 28 }} />
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* File Upload */}
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.text }]}>Document File *</Text>
            {file ? (
              <View style={[styles.filePreview, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                {isImage ? (
                  <Image source={{ uri: file.uri }} style={styles.imagePreview} />
                ) : (
                  <View style={[styles.fileIcon, { backgroundColor: colors.primary + '20' }]}>
                    <Ionicons name="document" size={32} color={colors.primary} />
                  </View>
                )}
                <View style={styles.fileInfo}>
                  <Text style={[styles.fileName, { color: colors.text }]} numberOfLines={1}>
                    {file.name}
                  </Text>
                  <Text style={[styles.fileSize, { color: colors.textSecondary }]}>
                    {documentService.formatFileSize(file.size)}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => setFile(null)}>
                  <Ionicons name="close-circle" size={24} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={[styles.uploadArea, { backgroundColor: colors.surface, borderColor: colors.border }]}
                onPress={showFileOptions}
              >
                <Ionicons name="cloud-upload-outline" size={48} color={colors.primary} />
                <Text style={[styles.uploadText, { color: colors.text }]}>
                  Tap to add document
                </Text>
                <Text style={[styles.uploadHint, { color: colors.textSecondary }]}>
                  Take photo, pick from gallery, or choose file
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Document Name */}
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.text }]}>Document Name *</Text>
            <TextInput
              style={[
                styles.input,
                { backgroundColor: colors.surface, color: colors.text, borderColor: errors.name ? colors.error : colors.border },
              ]}
              placeholder="e.g., Passport, Driver's License"
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
                    { backgroundColor: DOCUMENT_CATEGORY_CONFIG[values.category].color + '20' },
                  ]}
                >
                  <Ionicons
                    name={DOCUMENT_CATEGORY_CONFIG[values.category].icon as any}
                    size={20}
                    color={DOCUMENT_CATEGORY_CONFIG[values.category].color}
                  />
                </View>
                <Text style={[styles.selectText, { color: colors.text }]}>
                  {DOCUMENT_CATEGORY_CONFIG[values.category].label}
                </Text>
              </View>
              <Ionicons name="chevron-down" size={20} color={colors.textSecondary} />
            </TouchableOpacity>

            {showCategoryPicker && (
              <Card style={styles.pickerCard}>
                <ScrollView style={{ maxHeight: 250 }}>
                  {Object.entries(DOCUMENT_CATEGORY_CONFIG).map(([key, config]) => (
                    <TouchableOpacity
                      key={key}
                      style={styles.pickerOption}
                      onPress={() => {
                        setValue('category', key as DocumentCategory);
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
                </ScrollView>
              </Card>
            )}
          </View>

          {/* Document Number */}
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.text }]}>Document Number</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
              placeholder="e.g., AB123456"
              placeholderTextColor={colors.textLight}
              value={values.documentNumber}
              onChangeText={(text) => setValue('documentNumber', text)}
            />
          </View>

          {/* Issuing Authority */}
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.text }]}>Issuing Authority</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
              placeholder="e.g., Government of USA"
              placeholderTextColor={colors.textLight}
              value={values.issuingAuthority}
              onChangeText={(text) => setValue('issuingAuthority', text)}
            />
          </View>

          {/* Issue Date */}
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.text }]}>Issue Date</Text>
            <TouchableOpacity
              style={[styles.selectButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() => setShowIssueDatePicker(true)}
            >
              <Ionicons name="calendar-outline" size={20} color={colors.textSecondary} />
              <Text style={[styles.selectText, { color: values.issueDate ? colors.text : colors.textLight, marginLeft: 8 }]}>
                {values.issueDate
                  ? values.issueDate.toLocaleDateString()
                  : 'Select issue date (optional)'}
              </Text>
            </TouchableOpacity>
          </View>

          {showIssueDatePicker && (
            <DateTimePicker
              value={values.issueDate || new Date()}
              mode="date"
              display="spinner"
              maximumDate={new Date()}
              onChange={(event, date) => {
                setShowIssueDatePicker(false);
                if (date) setValue('issueDate', date);
              }}
            />
          )}

          {/* Expiry Date */}
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.text }]}>Expiry Date</Text>
            <TouchableOpacity
              style={[styles.selectButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() => setShowExpiryDatePicker(true)}
            >
              <Ionicons name="time-outline" size={20} color={colors.textSecondary} />
              <Text style={[styles.selectText, { color: values.expiryDate ? colors.text : colors.textLight, marginLeft: 8 }]}>
                {values.expiryDate
                  ? values.expiryDate.toLocaleDateString()
                  : 'Select expiry date (optional)'}
              </Text>
            </TouchableOpacity>
          </View>

          {showExpiryDatePicker && (
            <DateTimePicker
              value={values.expiryDate || new Date()}
              mode="date"
              display="spinner"
              onChange={(event, date) => {
                setShowExpiryDatePicker(false);
                if (date) setValue('expiryDate', date);
              }}
            />
          )}

          {/* Reminders (only if expiry date is set) */}
          {values.expiryDate && (
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.text }]}>Expiry Reminders</Text>
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
          )}

          {/* Tags */}
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.text }]}>Tags</Text>
            <View style={[styles.tagInput, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <TextInput
                style={[styles.tagTextInput, { color: colors.text }]}
                placeholder="Add tags..."
                placeholderTextColor={colors.textLight}
                value={tagInput}
                onChangeText={setTagInput}
                onSubmitEditing={addTag}
              />
              <TouchableOpacity onPress={addTag} disabled={!tagInput.trim()}>
                <Ionicons name="add-circle" size={24} color={tagInput.trim() ? colors.primary : colors.textLight} />
              </TouchableOpacity>
            </View>
            {values.tags.length > 0 && (
              <View style={styles.tagsContainer}>
                {values.tags.map((tag) => (
                  <TouchableOpacity
                    key={tag}
                    style={[styles.tag, { backgroundColor: colors.surfaceVariant }]}
                    onPress={() => removeTag(tag)}
                  >
                    <Text style={[styles.tagText, { color: colors.textSecondary }]}>{tag}</Text>
                    <Ionicons name="close" size={14} color={colors.textSecondary} />
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {/* Description */}
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.text }]}>Description</Text>
            <TextInput
              style={[
                styles.input,
                styles.textArea,
                { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border },
              ]}
              placeholder="Add any additional notes..."
              placeholderTextColor={colors.textLight}
              value={values.description}
              onChangeText={(text) => setValue('description', text)}
              multiline
              numberOfLines={3}
            />
          </View>

          <View style={{ height: 100 }} />
        </ScrollView>

        {/* Save Button */}
        <View style={[styles.footer, { backgroundColor: colors.background }]}>
          <Button
            title={isEditing ? 'Save Changes' : 'Add Document'}
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
  uploadArea: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderRadius: LAYOUT.borderRadius,
    padding: 32,
    alignItems: 'center',
  },
  uploadText: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 12,
  },
  uploadHint: {
    fontSize: 13,
    marginTop: 4,
  },
  filePreview: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderWidth: 1,
    borderRadius: LAYOUT.borderRadius,
  },
  imagePreview: {
    width: 56,
    height: 56,
    borderRadius: 8,
  },
  fileIcon: {
    width: 56,
    height: 56,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fileInfo: {
    flex: 1,
    marginLeft: 12,
  },
  fileName: {
    fontSize: 14,
    fontWeight: '500',
  },
  fileSize: {
    fontSize: 12,
    marginTop: 2,
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
  tagInput: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: LAYOUT.borderRadius,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  tagTextInput: {
    flex: 1,
    fontSize: 16,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
  },
  tagText: {
    fontSize: 13,
  },
  footer: {
    padding: LAYOUT.padding,
    paddingBottom: 24,
  },
});
