// ============================================
// GREPRE SMART LIFE - DOCUMENTS SCREEN
// List all documents with filtering
// ============================================

import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TextInput,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, useDebounce } from '@/hooks';
import { useDocumentStore } from '@/stores';
import { DocumentCard, EmptyState } from '@/components';
import { DocumentCategory } from '@/types';
import { LAYOUT, DOCUMENT_CATEGORY_CONFIG } from '@/constants';

export function DocumentsScreen({ navigation }: any) {
  const { colors } = useTheme();
  const { documents, isLoading, fetchDocuments, storageUsage } = useDocumentStore();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<DocumentCategory | 'all'>('all');
  const debouncedSearch = useDebounce(searchQuery, 300);

  useEffect(() => {
    fetchDocuments();
  }, []);

  // Filter documents
  const filteredDocuments = documents.filter((doc) => {
    // Search filter
    if (debouncedSearch) {
      const query = debouncedSearch.toLowerCase();
      if (!doc.name.toLowerCase().includes(query) && 
          !doc.description?.toLowerCase().includes(query) &&
          !doc.documentNumber?.toLowerCase().includes(query) &&
          !doc.tags.some((tag) => tag.toLowerCase().includes(query))) {
        return false;
      }
    }

    // Category filter
    if (selectedCategory !== 'all' && doc.category !== selectedCategory) {
      return false;
    }

    return true;
  });

  // Get category options
  const categoryOptions = [
    { key: 'all', label: 'All', icon: 'apps', color: '#6B7280' },
    ...Object.entries(DOCUMENT_CATEGORY_CONFIG).map(([key, config]) => ({
      key,
      label: config.label,
      icon: config.icon,
      color: config.color,
    })),
  ];

  const renderDocumentCard = useCallback(({ item }: { item: any }) => (
    <DocumentCard
      document={item}
      onPress={() => navigation.navigate('DocumentDetail', { documentId: item.id })}
    />
  ), [navigation]);

  // Format storage size
  const formatStorageSize = (bytes: number): string => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={[styles.title, { color: colors.text }]}>Documents</Text>
          <Text style={[styles.storageInfo, { color: colors.textSecondary }]}>
            {storageUsage.documentCount} files • {formatStorageSize(storageUsage.totalSize)}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.addButton, { backgroundColor: colors.primary }]}
          onPress={() => navigation.navigate('AddDocument')}
        >
          <Ionicons name="add" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={[styles.searchContainer, { backgroundColor: colors.surface }]}>
        <Ionicons name="search" size={20} color={colors.textSecondary} />
        <TextInput
          style={[styles.searchInput, { color: colors.text }]}
          placeholder="Search documents..."
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

      {/* Category Filter */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.categoryContainer}
      >
        {categoryOptions.map((category) => (
          <TouchableOpacity
            key={category.key}
            style={[
              styles.categoryChip,
              {
                backgroundColor:
                  selectedCategory === category.key
                    ? category.color
                    : colors.surfaceVariant,
              },
            ]}
            onPress={() => setSelectedCategory(category.key as any)}
          >
            <Ionicons
              name={category.icon as any}
              size={16}
              color={selectedCategory === category.key ? '#FFFFFF' : colors.textSecondary}
            />
            <Text
              style={[
                styles.categoryLabel,
                {
                  color:
                    selectedCategory === category.key ? '#FFFFFF' : colors.textSecondary,
                },
              ]}
            >
              {category.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Document List */}
      <FlatList
        data={filteredDocuments}
        keyExtractor={(item) => item.id}
        renderItem={renderDocumentCard}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={fetchDocuments}
            tintColor={colors.primary}
          />
        }
        ListEmptyComponent={
          <EmptyState
            icon="folder-open-outline"
            title={searchQuery || selectedCategory !== 'all' ? 'No Results' : 'No Documents Yet'}
            message={
              searchQuery || selectedCategory !== 'all'
                ? 'Try adjusting your filters'
                : 'Store your important documents securely. IDs, visas, warranties, and more.'
            }
            actionLabel={searchQuery || selectedCategory !== 'all' ? undefined : 'Add Document'}
            onAction={searchQuery || selectedCategory !== 'all' ? undefined : () => navigation.navigate('AddDocument')}
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
  storageInfo: {
    fontSize: 12,
    marginTop: 2,
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
  categoryContainer: {
    paddingHorizontal: LAYOUT.padding,
    paddingBottom: 16,
    gap: 8,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
  },
  categoryLabel: {
    fontSize: 13,
    fontWeight: '500',
    marginLeft: 6,
  },
  listContent: {
    paddingHorizontal: LAYOUT.padding,
    paddingBottom: 100,
  },
});
