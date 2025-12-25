// ============================================
// GREPRE SMART LIFE - DOCUMENT DETAIL SCREEN
// View and manage individual document details
// ============================================

import { Badge, Button, Card, Divider } from '@/components';
import { DOCUMENT_CATEGORY_CONFIG, LAYOUT } from '@/constants';
import { useTheme } from '@/hooks';
import { biometricService } from '@/services';
import { useAppStore, useDocumentStore } from '@/stores';
import { formatFileSize, getDaysUntil } from '@/utils';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { useCallback, useState } from 'react';
import {
    Alert,
    Dimensions,
    Image,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export function DocumentDetailScreen({ route, navigation }: any) {
  const { documentId } = route.params;
  const { colors } = useTheme();
  const { documents, deleteDocument } = useDocumentStore();
  const { settings } = useAppStore();
  
  const document = documents.find(d => d.id === documentId);
  
  const [isAuthenticated, setIsAuthenticated] = useState(!document?.requiresBiometric);
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  const categoryConfig = document ? DOCUMENT_CATEGORY_CONFIG[document.category] : null;
  const daysUntilExpiry = document?.expiryDate ? getDaysUntil(document.expiryDate) : null;

  const getExpiryStatus = useCallback(() => {
    if (!daysUntilExpiry) return null;
    
    if (daysUntilExpiry < 0) {
      return { text: 'Expired', color: colors.error };
    } else if (daysUntilExpiry <= 30) {
      return { text: 'Expiring Soon', color: colors.warning };
    } else {
      return { text: 'Valid', color: colors.success };
    }
  }, [daysUntilExpiry, colors]);

  const expiryStatus = getExpiryStatus();

  const handleAuthenticate = useCallback(async () => {
    setIsAuthenticating(true);
    try {
      const result = await biometricService.authenticate('Authenticate to view document');
      if (result.success) {
        setIsAuthenticated(true);
      } else {
        Alert.alert('Authentication Failed', result.error || 'Please try again');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to authenticate');
    } finally {
      setIsAuthenticating(false);
    }
  }, []);

  const handleDelete = useCallback(() => {
    if (!document) return;
    
    Alert.alert(
      'Delete Document',
      `Are you sure you want to delete "${document.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteDocument(document.id);
            navigation.goBack();
          },
        },
      ]
    );
  }, [document, deleteDocument, navigation]);

  const handleEdit = useCallback(() => {
    navigation.navigate('AddDocument', { document });
  }, [document, navigation]);

  const handleShare = useCallback(() => {
    // TODO: Implement share functionality
    Alert.alert('Coming Soon', 'Document sharing will be available soon!');
  }, []);

  if (!document) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
        </View>
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyText, { color: colors.textLight }]}>
            Document not found
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // Show authentication screen if biometric is required
  if (!isAuthenticated) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
        </View>
        <View style={styles.authContainer}>
          <View style={[styles.lockIcon, { backgroundColor: colors.primary + '20' }]}>
            <Ionicons name="lock-closed" size={48} color={colors.primary} />
          </View>
          <Text style={[styles.authTitle, { color: colors.text }]}>
            Protected Document
          </Text>
          <Text style={[styles.authSubtitle, { color: colors.textLight }]}>
            This document requires authentication to view
          </Text>
          <Button
            title={isAuthenticating ? 'Authenticating...' : 'Authenticate'}
            onPress={handleAuthenticate}
            loading={isAuthenticating}
            icon={<Ionicons name="finger-print" size={20} color="#fff" />}
            style={styles.authButton}
          />
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
        <Text style={[styles.headerTitle, { color: colors.text }]}>Document Details</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.headerButton} onPress={handleShare}>
            <Ionicons name="share-outline" size={20} color={colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerButton} onPress={handleEdit}>
            <Ionicons name="pencil" size={20} color={colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerButton} onPress={handleDelete}>
            <Ionicons name="trash-outline" size={20} color={colors.error} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Document Preview */}
        {document.thumbnailUri && (
          <Card style={styles.previewCard}>
            <Image
              source={{ uri: document.thumbnailUri }}
              style={styles.previewImage}
              resizeMode="contain"
            />
          </Card>
        )}

        {/* Document Info Card */}
        <Card style={styles.infoCard}>
          <View style={styles.docHeader}>
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
            <View style={styles.docInfo}>
              <Text style={[styles.docName, { color: colors.text }]}>
                {document.name}
              </Text>
              <Text style={[styles.categoryName, { color: categoryConfig?.color }]}>
                {categoryConfig?.label}
              </Text>
            </View>
            {document.requiresBiometric && (
              <View style={[styles.secureIcon, { backgroundColor: colors.success + '20' }]}>
                <Ionicons name="shield-checkmark" size={20} color={colors.success} />
              </View>
            )}
          </View>

          <Divider style={styles.divider} />

          {/* Document Number */}
          {document.documentNumber && (
            <View style={styles.detailRow}>
              <View style={styles.detailIcon}>
                <Ionicons name="document-text-outline" size={20} color={colors.textLight} />
              </View>
              <View style={styles.detailContent}>
                <Text style={[styles.detailLabel, { color: colors.textLight }]}>
                  Document Number
                </Text>
                <Text style={[styles.detailValue, { color: colors.text }]}>
                  {document.documentNumber}
                </Text>
              </View>
            </View>
          )}

          {/* Issue Date */}
          {document.issueDate && (
            <View style={styles.detailRow}>
              <View style={styles.detailIcon}>
                <Ionicons name="calendar-outline" size={20} color={colors.textLight} />
              </View>
              <View style={styles.detailContent}>
                <Text style={[styles.detailLabel, { color: colors.textLight }]}>
                  Issue Date
                </Text>
                <Text style={[styles.detailValue, { color: colors.text }]}>
                  {format(new Date(document.issueDate), 'MMMM d, yyyy')}
                </Text>
              </View>
            </View>
          )}

          {/* Expiry Date */}
          {document.expiryDate && (
            <View style={styles.detailRow}>
              <View style={styles.detailIcon}>
                <Ionicons name="time-outline" size={20} color={colors.textLight} />
              </View>
              <View style={styles.detailContent}>
                <Text style={[styles.detailLabel, { color: colors.textLight }]}>
                  Expiry Date
                </Text>
                <View style={styles.expiryRow}>
                  <Text style={[styles.detailValue, { color: colors.text }]}>
                    {format(new Date(document.expiryDate), 'MMMM d, yyyy')}
                  </Text>
                  {expiryStatus && (
                    <Badge
                      text={expiryStatus.text}
                      color={expiryStatus.color}
                      style={styles.expiryBadge}
                    />
                  )}
                </View>
                {daysUntilExpiry !== null && (
                  <Text
                    style={[
                      styles.expiryText,
                      { color: daysUntilExpiry < 0 ? colors.error : daysUntilExpiry <= 30 ? colors.warning : colors.success },
                    ]}
                  >
                    {daysUntilExpiry < 0
                      ? `Expired ${Math.abs(daysUntilExpiry)} days ago`
                      : daysUntilExpiry === 0
                      ? 'Expires today'
                      : `Expires in ${daysUntilExpiry} days`}
                  </Text>
                )}
              </View>
            </View>
          )}

          {/* File Info */}
          <View style={styles.detailRow}>
            <View style={styles.detailIcon}>
              <Ionicons name="attach-outline" size={20} color={colors.textLight} />
            </View>
            <View style={styles.detailContent}>
              <Text style={[styles.detailLabel, { color: colors.textLight }]}>
                File
              </Text>
              <Text style={[styles.detailValue, { color: colors.text }]}>
                {document.fileType.toUpperCase()} • {formatFileSize(document.fileSize)}
              </Text>
            </View>
          </View>
        </Card>

        {/* Tags */}
        {document.tags && document.tags.length > 0 && (
          <Card style={styles.tagsCard}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Tags</Text>
            <View style={styles.tagsContainer}>
              {document.tags.map((tag, index) => (
                <Badge
                  key={index}
                  text={tag}
                  color={colors.primary}
                  style={styles.tag}
                />
              ))}
            </View>
          </Card>
        )}

        {/* Notes */}
        {document.notes && (
          <Card style={styles.notesCard}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Notes</Text>
            <Text style={[styles.notesText, { color: colors.text }]}>
              {document.notes}
            </Text>
          </Card>
        )}

        {/* Metadata */}
        <Card style={styles.metaCard}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Details</Text>
          
          <View style={styles.metaRow}>
            <Text style={[styles.metaLabel, { color: colors.textLight }]}>Added</Text>
            <Text style={[styles.metaValue, { color: colors.text }]}>
              {format(new Date(document.createdAt), 'MMM d, yyyy • h:mm a')}
            </Text>
          </View>
          
          <View style={styles.metaRow}>
            <Text style={[styles.metaLabel, { color: colors.textLight }]}>Last Updated</Text>
            <Text style={[styles.metaValue, { color: colors.text }]}>
              {format(new Date(document.updatedAt), 'MMM d, yyyy • h:mm a')}
            </Text>
          </View>
        </Card>

        <View style={styles.bottomSpacer} />
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
  authContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: LAYOUT.padding,
  },
  lockIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  authTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  authSubtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 32,
  },
  authButton: {
    minWidth: 200,
  },
  previewCard: {
    marginBottom: 16,
    padding: 0,
    overflow: 'hidden',
  },
  previewImage: {
    width: '100%',
    height: 200,
    borderRadius: LAYOUT.borderRadius,
  },
  infoCard: {
    marginBottom: 16,
  },
  docHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  categoryIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  docInfo: {
    flex: 1,
    marginLeft: 12,
  },
  docName: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  categoryName: {
    fontSize: 14,
    fontWeight: '500',
  },
  secureIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  divider: {
    marginVertical: 16,
  },
  detailRow: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  detailIcon: {
    width: 32,
    alignItems: 'center',
    paddingTop: 2,
  },
  detailContent: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 15,
    fontWeight: '500',
  },
  expiryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  expiryBadge: {
    marginLeft: 8,
  },
  expiryText: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 4,
  },
  tagsCard: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tag: {
    marginBottom: 4,
  },
  notesCard: {
    marginBottom: 16,
  },
  notesText: {
    fontSize: 14,
    lineHeight: 22,
  },
  metaCard: {
    marginBottom: 16,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  metaLabel: {
    fontSize: 14,
  },
  metaValue: {
    fontSize: 14,
  },
  bottomSpacer: {
    height: 40,
  },
});
