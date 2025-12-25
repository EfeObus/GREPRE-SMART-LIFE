// ============================================
// GREPRE SMART LIFE - DOCUMENT CARD COMPONENT
// ============================================

import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks';
import { Card, Badge } from '@/components/ui';
import { DOCUMENT_CATEGORY_CONFIG, LAYOUT } from '@/constants';
import { dateHelpers, stringHelpers } from '@/utils';
import type { Document } from '@/types';

interface DocumentCardProps {
  document: Document;
  onPress: () => void;
  compact?: boolean;
}

export function DocumentCard({ document, onPress, compact = false }: DocumentCardProps) {
  const { colors } = useTheme();
  const categoryConfig = DOCUMENT_CATEGORY_CONFIG[document.category];

  const getExpiryInfo = () => {
    if (!document.expiryDate) {
      return { label: 'No expiry', color: colors.textSecondary, isUrgent: false };
    }
    return dateHelpers.getUrgencyLabel(document.expiryDate);
  };

  const expiryInfo = getExpiryInfo();
  const isImage = document.fileType.startsWith('image/');

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
            {document.name}
          </Text>
          <Text
            style={[styles.compactDate, { color: expiryInfo.color }]}
            numberOfLines={1}
          >
            {document.expiryDate ? `Expires: ${expiryInfo.label}` : 'No expiry'}
          </Text>
        </View>
        {document.isEncrypted && (
          <Ionicons name="lock-closed" size={16} color={colors.textSecondary} />
        )}
      </TouchableOpacity>
    );
  }

  return (
    <Card style={styles.card} onPress={onPress}>
      <View style={styles.header}>
        {isImage && document.thumbnailUri ? (
          <Image source={{ uri: document.thumbnailUri }} style={styles.thumbnail} />
        ) : (
          <View style={[styles.iconContainer, { backgroundColor: categoryConfig.color + '20' }]}>
            <Ionicons name={categoryConfig.icon as any} size={28} color={categoryConfig.color} />
          </View>
        )}
        <View style={styles.headerInfo}>
          <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
            {document.name}
          </Text>
          <Text style={[styles.category, { color: colors.textSecondary }]}>
            {categoryConfig.label}
          </Text>
        </View>
        {document.isEncrypted && (
          <View style={[styles.encryptedBadge, { backgroundColor: colors.surfaceVariant }]}>
            <Ionicons name="lock-closed" size={14} color={colors.textSecondary} />
          </View>
        )}
      </View>

      {document.description && (
        <Text
          style={[styles.description, { color: colors.textSecondary }]}
          numberOfLines={2}
        >
          {document.description}
        </Text>
      )}

      <View style={styles.details}>
        {document.expiryDate ? (
          <View style={styles.detailRow}>
            <Ionicons name="time-outline" size={14} color={expiryInfo.color} />
            <Text style={[styles.detailText, { color: expiryInfo.color }]}>
              {expiryInfo.isUrgent ? expiryInfo.label : `Expires ${dateHelpers.formatDate(document.expiryDate)}`}
            </Text>
          </View>
        ) : (
          <View style={styles.detailRow}>
            <Ionicons name="infinite" size={14} color={colors.textSecondary} />
            <Text style={[styles.detailText, { color: colors.textSecondary }]}>
              No expiry date
            </Text>
          </View>
        )}

        {document.documentNumber && (
          <Text style={[styles.docNumber, { color: colors.textLight }]}>
            #{stringHelpers.truncate(document.documentNumber, 15)}
          </Text>
        )}
      </View>

      {document.tags.length > 0 && (
        <View style={styles.tags}>
          {document.tags.slice(0, 3).map((tag, index) => (
            <Badge key={index} label={tag} size="small" color={colors.surfaceVariant} textColor={colors.textSecondary} />
          ))}
          {document.tags.length > 3 && (
            <Text style={[styles.moreTags, { color: colors.textSecondary }]}>
              +{document.tags.length - 3} more
            </Text>
          )}
        </View>
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
  thumbnail: {
    width: 56,
    height: 56,
    borderRadius: 12,
  },
  iconContainer: {
    width: 56,
    height: 56,
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
  encryptedBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  description: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 12,
  },
  details: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailText: {
    fontSize: 12,
    marginLeft: 4,
    fontWeight: '500',
  },
  docNumber: {
    fontSize: 11,
    fontFamily: 'monospace',
  },
  tags: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginTop: 12,
    gap: 6,
  },
  moreTags: {
    fontSize: 11,
    marginLeft: 4,
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
});
