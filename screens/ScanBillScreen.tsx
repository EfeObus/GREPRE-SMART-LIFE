// ============================================
// GREPRE SMART LIFE - SCAN BILL SCREEN
// OCR-powered bill scanning to kill data entry wall
// Snap a photo → Auto-extract bill details → Confirm
// ============================================

import { Badge, Button, Card } from '@/components';
import { BILL_CATEGORY_CONFIG, LAYOUT } from '@/constants';
import { useTheme } from '@/hooks';
import { ocrService } from '@/services';
import { useBillStore } from '@/stores';
import { BillCategory, BillFrequency, OCRBillData } from '@/types';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import React, { useCallback, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type ScanStep = 'capture' | 'processing' | 'review' | 'confirm';

export function ScanBillScreen({ navigation }: any) {
  const { colors } = useTheme();
  const { addBill } = useBillStore();
  
  const [step, setStep] = useState<ScanStep>('capture');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [ocrData, setOcrData] = useState<OCRBillData | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Editable fields (user can correct OCR results)
  const [billName, setBillName] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [category, setCategory] = useState<BillCategory>(BillCategory.OTHER);

  const handleTakePhoto = useCallback(async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow camera access to scan bills');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsEditing: true,
    });

    if (!result.canceled && result.assets[0]) {
      processImage(result.assets[0].uri);
    }
  }, []);

  const handlePickImage = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow photo library access');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsEditing: true,
    });

    if (!result.canceled && result.assets[0]) {
      processImage(result.assets[0].uri);
    }
  }, []);

  const processImage = async (uri: string) => {
    setImageUri(uri);
    setStep('processing');
    setIsProcessing(true);

    try {
      const result = await ocrService.scanBill(uri);
      
      if (result.success && result.data) {
        const data = result.data as OCRBillData;
        setOcrData(data);
        
        // Pre-fill fields with OCR data
        if (data.billerName) setBillName(data.billerName);
        if (data.amount) setAmount(data.amount.toString());
        if (data.dueDate) setDueDate(data.dueDate);
        
        // Detect category
        const detectedCategory = ocrService.detectBillCategory(data.rawText);
        setCategory(detectedCategory);
        
        setStep('review');
      } else {
        Alert.alert(
          'Scan Issue',
          'Could not extract bill details. You can enter them manually.',
          [{ text: 'OK', onPress: () => setStep('review') }]
        );
        setStep('review');
      }
    } catch (error) {
      console.error('OCR Error:', error);
      Alert.alert('Error', 'Failed to process image. Please try again.');
      setStep('capture');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirm = useCallback(async () => {
    if (!billName.trim() || !amount) {
      Alert.alert('Missing Info', 'Please enter at least a name and amount');
      return;
    }

    setStep('confirm');
    
    try {
      await addBill({
        name: billName.trim(),
        category,
        amount: parseFloat(amount),
        currency: 'NGN',
        frequency: BillFrequency.MONTHLY,
        dueDate: dueDate || new Date().toISOString().split('T')[0],
        reminderDays: [3, 1],
        autopay: false,
        ocrData: ocrData || undefined,
      });

      Alert.alert(
        '✅ Bill Added!',
        `${billName} has been added to your bills.`,
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to save bill. Please try again.');
      setStep('review');
    }
  }, [billName, amount, dueDate, category, ocrData, addBill, navigation]);

  const handleRetry = useCallback(() => {
    setStep('capture');
    setImageUri(null);
    setOcrData(null);
    setBillName('');
    setAmount('');
    setDueDate('');
    setCategory(BillCategory.OTHER);
  }, []);

  const renderCapture = () => (
    <View style={styles.captureContainer}>
      <View style={[styles.iconContainer, { backgroundColor: colors.primary + '20' }]}>
        <Ionicons name="scan-outline" size={64} color={colors.primary} />
      </View>
      
      <Text style={[styles.title, { color: colors.text }]}>
        Scan Your Bill
      </Text>
      <Text style={[styles.subtitle, { color: colors.textLight }]}>
        Take a photo of your bill and we'll automatically extract the details
      </Text>

      <View style={styles.captureButtons}>
        <Button
          title="Take Photo"
          onPress={handleTakePhoto}
          icon={<Ionicons name="camera-outline" size={20} color="#fff" />}
          style={styles.captureButton}
        />
        <Button
          title="Choose from Gallery"
          onPress={handlePickImage}
          variant="outline"
          icon={<Ionicons name="images-outline" size={20} color={colors.primary} />}
          style={styles.captureButton}
        />
      </View>

      <TouchableOpacity 
        style={styles.manualLink}
        onPress={() => navigation.navigate('AddBill')}
      >
        <Text style={[styles.manualLinkText, { color: colors.primary }]}>
          Or enter manually
        </Text>
      </TouchableOpacity>
    </View>
  );

  const renderProcessing = () => (
    <View style={styles.processingContainer}>
      {imageUri && (
        <Image source={{ uri: imageUri }} style={styles.previewImage} />
      )}
      <View style={styles.processingOverlay}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.processingText, { color: colors.text }]}>
          Scanning bill...
        </Text>
        <Text style={[styles.processingSubtext, { color: colors.textLight }]}>
          Extracting amount, due date, and more
        </Text>
      </View>
    </View>
  );

  const renderReview = () => (
    <ScrollView style={styles.reviewContainer} showsVerticalScrollIndicator={false}>
      {imageUri && (
        <Image source={{ uri: imageUri }} style={styles.reviewImage} />
      )}

      {ocrData && ocrData.confidence > 0 && (
        <View style={styles.confidenceRow}>
          <Badge 
            text={`${Math.round(ocrData.confidence * 100)}% confidence`}
            color={ocrData.confidence > 0.7 ? colors.success : colors.warning}
          />
          <Text style={[styles.confidenceHint, { color: colors.textLight }]}>
            Review and correct if needed
          </Text>
        </View>
      )}

      <Card style={styles.formCard}>
        <Text style={[styles.formLabel, { color: colors.textLight }]}>Bill Name</Text>
        <TextInput
          style={[styles.input, { color: colors.text, borderColor: colors.border }]}
          value={billName}
          onChangeText={setBillName}
          placeholder="e.g., IKEDC Electricity"
          placeholderTextColor={colors.textLight}
        />

        <Text style={[styles.formLabel, { color: colors.textLight }]}>Amount</Text>
        <View style={[styles.amountInput, { borderColor: colors.border }]}>
          <Text style={[styles.currencySymbol, { color: colors.text }]}>₦</Text>
          <TextInput
            style={[styles.amountField, { color: colors.text }]}
            value={amount}
            onChangeText={setAmount}
            placeholder="0.00"
            placeholderTextColor={colors.textLight}
            keyboardType="decimal-pad"
          />
        </View>

        <Text style={[styles.formLabel, { color: colors.textLight }]}>Due Date</Text>
        <TextInput
          style={[styles.input, { color: colors.text, borderColor: colors.border }]}
          value={dueDate}
          onChangeText={setDueDate}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={colors.textLight}
        />

        <Text style={[styles.formLabel, { color: colors.textLight }]}>Category</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
          {Object.entries(BILL_CATEGORY_CONFIG).map(([key, config]) => (
            <TouchableOpacity
              key={key}
              style={[
                styles.categoryChip,
                { 
                  backgroundColor: category === key ? config.color : colors.surface,
                  borderColor: config.color,
                },
              ]}
              onPress={() => setCategory(key as BillCategory)}
            >
              <Ionicons 
                name={config.icon as any} 
                size={16} 
                color={category === key ? '#fff' : config.color} 
              />
              <Text style={[
                styles.categoryChipText,
                { color: category === key ? '#fff' : config.color }
              ]}>
                {config.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </Card>

      <View style={styles.reviewActions}>
        <Button
          title="Add Bill"
          onPress={handleConfirm}
          icon={<Ionicons name="checkmark-circle-outline" size={20} color="#fff" />}
        />
        <Button
          title="Scan Again"
          onPress={handleRetry}
          variant="outline"
          style={{ marginTop: 12 }}
        />
      </View>
    </ScrollView>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="close" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          {step === 'capture' ? 'Scan Bill' : step === 'processing' ? 'Processing...' : 'Review Details'}
        </Text>
        <View style={{ width: 24 }} />
      </View>

      {step === 'capture' && renderCapture()}
      {step === 'processing' && renderProcessing()}
      {(step === 'review' || step === 'confirm') && renderReview()}
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
  },
  captureContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: LAYOUT.padding * 2,
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 40,
    lineHeight: 24,
  },
  captureButtons: {
    width: '100%',
    gap: 12,
  },
  captureButton: {
    width: '100%',
  },
  manualLink: {
    marginTop: 24,
    padding: 12,
  },
  manualLinkText: {
    fontSize: 16,
    fontWeight: '500',
  },
  processingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewImage: {
    width: '100%',
    height: '60%',
    resizeMode: 'contain',
  },
  processingOverlay: {
    position: 'absolute',
    alignItems: 'center',
    padding: 24,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.95)',
  },
  processingText: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
  },
  processingSubtext: {
    fontSize: 14,
    marginTop: 8,
  },
  reviewContainer: {
    flex: 1,
    paddingHorizontal: LAYOUT.padding,
  },
  reviewImage: {
    width: '100%',
    height: 150,
    resizeMode: 'cover',
    borderRadius: LAYOUT.borderRadius,
    marginBottom: 16,
  },
  confidenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
  },
  confidenceHint: {
    fontSize: 13,
  },
  formCard: {
    marginBottom: 16,
  },
  formLabel: {
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 8,
    marginTop: 16,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
  },
  amountInput: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
  },
  currencySymbol: {
    fontSize: 18,
    fontWeight: '600',
    marginRight: 8,
  },
  amountField: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 18,
    fontWeight: '600',
  },
  categoryScroll: {
    marginTop: 8,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 8,
    gap: 6,
  },
  categoryChipText: {
    fontSize: 13,
    fontWeight: '500',
  },
  reviewActions: {
    paddingVertical: 20,
  },
});
