// ============================================
// GREPRE SMART LIFE - DOCUMENT SERVICE
// Handles document upload, storage, and encryption
// ============================================

import * as FileSystem from 'expo-file-system';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import * as Crypto from 'expo-crypto';
import uuid from 'react-native-uuid';
import type { Document, DocumentFormData } from '@/types';
import { DocumentCategory } from '@/types';
import { documentStorage } from './storage';
import { notificationService } from './notifications';

// Directory for storing documents
const DOCUMENTS_DIR = `${FileSystem.documentDirectory}grepre_documents/`;

export const documentService = {
  /**
   * Initialize the documents directory
   */
  async initializeDirectory(): Promise<void> {
    try {
      const dirInfo = await FileSystem.getInfoAsync(DOCUMENTS_DIR);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(DOCUMENTS_DIR, { intermediates: true });
      }
    } catch (error) {
      console.error('Error initializing documents directory:', error);
    }
  },

  /**
   * Pick a document from the file system
   */
  async pickDocument(): Promise<{ uri: string; name: string; type: string; size: number } | null> {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
        copyToCacheDirectory: true,
      });

      if (result.canceled) {
        return null;
      }

      const asset = result.assets[0];
      return {
        uri: asset.uri,
        name: asset.name,
        type: asset.mimeType || 'application/octet-stream',
        size: asset.size || 0,
      };
    } catch (error) {
      console.error('Error picking document:', error);
      return null;
    }
  },

  /**
   * Take a photo of a document using the camera
   */
  async takePhoto(): Promise<{ uri: string; name: string; type: string; size: number } | null> {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        throw new Error('Camera permission is required to take photos');
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
        allowsEditing: true,
      });

      if (result.canceled) {
        return null;
      }

      const asset = result.assets[0];
      const fileInfo = await FileSystem.getInfoAsync(asset.uri);
      
      return {
        uri: asset.uri,
        name: `document_${Date.now()}.jpg`,
        type: 'image/jpeg',
        size: (fileInfo as any).size || 0,
      };
    } catch (error) {
      console.error('Error taking photo:', error);
      return null;
    }
  },

  /**
   * Pick an image from the gallery
   */
  async pickImage(): Promise<{ uri: string; name: string; type: string; size: number } | null> {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        throw new Error('Gallery permission is required to pick images');
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
        allowsEditing: true,
      });

      if (result.canceled) {
        return null;
      }

      const asset = result.assets[0];
      const fileInfo = await FileSystem.getInfoAsync(asset.uri);
      
      return {
        uri: asset.uri,
        name: `image_${Date.now()}.jpg`,
        type: 'image/jpeg',
        size: (fileInfo as any).size || 0,
      };
    } catch (error) {
      console.error('Error picking image:', error);
      return null;
    }
  },

  /**
   * Save a file to the app's document directory
   */
  async saveFile(sourceUri: string, fileName: string): Promise<string> {
    try {
      await this.initializeDirectory();
      
      const fileId = uuid.v4() as string;
      const extension = fileName.split('.').pop() || 'file';
      const destinationUri = `${DOCUMENTS_DIR}${fileId}.${extension}`;

      await FileSystem.copyAsync({
        from: sourceUri,
        to: destinationUri,
      });

      return destinationUri;
    } catch (error) {
      console.error('Error saving file:', error);
      throw error;
    }
  },

  /**
   * Delete a file from storage
   */
  async deleteFile(fileUri: string): Promise<void> {
    try {
      const fileInfo = await FileSystem.getInfoAsync(fileUri);
      if (fileInfo.exists) {
        await FileSystem.deleteAsync(fileUri);
      }
    } catch (error) {
      console.error('Error deleting file:', error);
    }
  },

  /**
   * Generate a thumbnail for an image
   */
  async generateThumbnail(imageUri: string): Promise<string | null> {
    try {
      // For simplicity, we'll just copy the image as thumbnail
      // In production, you'd want to use an image manipulation library
      const thumbnailId = uuid.v4() as string;
      const thumbnailUri = `${DOCUMENTS_DIR}thumb_${thumbnailId}.jpg`;
      
      await FileSystem.copyAsync({
        from: imageUri,
        to: thumbnailUri,
      });

      return thumbnailUri;
    } catch (error) {
      console.error('Error generating thumbnail:', error);
      return null;
    }
  },

  /**
   * Create a new document
   */
  async createDocument(
    formData: DocumentFormData,
    file: { uri: string; name: string; type: string; size: number }
  ): Promise<Document> {
    try {
      // Save the file
      const savedFileUri = await this.saveFile(file.uri, file.name);
      
      // Generate thumbnail for images
      let thumbnailUri: string | undefined;
      if (file.type.startsWith('image/')) {
        thumbnailUri = (await this.generateThumbnail(savedFileUri)) || undefined;
      }

      const now = new Date().toISOString();
      
      const document: Document = {
        id: uuid.v4() as string,
        name: formData.name,
        category: formData.category,
        description: formData.description,
        fileUri: savedFileUri,
        thumbnailUri,
        fileType: file.type,
        fileSize: file.size,
        expiryDate: formData.expiryDate?.toISOString(),
        issueDate: formData.issueDate?.toISOString(),
        documentNumber: formData.documentNumber,
        issuingAuthority: formData.issuingAuthority,
        isEncrypted: false, // TODO: Implement encryption
        reminderDays: formData.reminderDays,
        tags: formData.tags,
        createdAt: now,
        updatedAt: now,
      };

      // Save to storage
      await documentStorage.add(document);

      // Schedule reminders if expiry date exists
      if (document.expiryDate) {
        await notificationService.scheduleDocumentReminders(document);
      }

      return document;
    } catch (error) {
      console.error('Error creating document:', error);
      throw error;
    }
  },

  /**
   * Update a document
   */
  async updateDocument(documentId: string, updates: Partial<DocumentFormData>): Promise<void> {
    try {
      const updateData: Partial<Document> = {};
      
      if (updates.name !== undefined) updateData.name = updates.name;
      if (updates.category !== undefined) updateData.category = updates.category;
      if (updates.description !== undefined) updateData.description = updates.description;
      if (updates.expiryDate !== undefined) updateData.expiryDate = updates.expiryDate?.toISOString();
      if (updates.issueDate !== undefined) updateData.issueDate = updates.issueDate?.toISOString();
      if (updates.documentNumber !== undefined) updateData.documentNumber = updates.documentNumber;
      if (updates.issuingAuthority !== undefined) updateData.issuingAuthority = updates.issuingAuthority;
      if (updates.tags !== undefined) updateData.tags = updates.tags;
      if (updates.reminderDays !== undefined) updateData.reminderDays = updates.reminderDays;

      await documentStorage.update(documentId, updateData);

      // Reschedule reminders if expiry date changed
      if (updates.expiryDate !== undefined || updates.reminderDays !== undefined) {
        await notificationService.cancelRemindersForItem(documentId);
        const document = await documentStorage.getById(documentId);
        if (document && document.expiryDate) {
          await notificationService.scheduleDocumentReminders(document);
        }
      }
    } catch (error) {
      console.error('Error updating document:', error);
      throw error;
    }
  },

  /**
   * Delete a document
   */
  async deleteDocument(documentId: string): Promise<void> {
    try {
      const document = await documentStorage.getById(documentId);
      
      if (document) {
        // Delete associated files
        await this.deleteFile(document.fileUri);
        if (document.thumbnailUri) {
          await this.deleteFile(document.thumbnailUri);
        }

        // Cancel reminders
        await notificationService.cancelRemindersForItem(documentId);

        // Remove from storage
        await documentStorage.delete(documentId);
      }
    } catch (error) {
      console.error('Error deleting document:', error);
      throw error;
    }
  },

  /**
   * Get all documents
   */
  async getAllDocuments(): Promise<Document[]> {
    return documentStorage.getAll();
  },

  /**
   * Get documents by category
   */
  async getDocumentsByCategory(category: DocumentCategory): Promise<Document[]> {
    const all = await documentStorage.getAll();
    return all.filter((doc) => doc.category === category);
  },

  /**
   * Get expiring documents (within the next n days)
   */
  async getExpiringDocuments(days: number = 30): Promise<Document[]> {
    const all = await documentStorage.getAll();
    const now = new Date();
    const futureDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

    return all.filter((doc) => {
      if (!doc.expiryDate) return false;
      const expiryDate = new Date(doc.expiryDate);
      return expiryDate >= now && expiryDate <= futureDate;
    }).sort((a, b) => new Date(a.expiryDate!).getTime() - new Date(b.expiryDate!).getTime());
  },

  /**
   * Search documents by name or tags
   */
  async searchDocuments(query: string): Promise<Document[]> {
    const all = await documentStorage.getAll();
    const lowerQuery = query.toLowerCase();
    
    return all.filter((doc) => 
      doc.name.toLowerCase().includes(lowerQuery) ||
      doc.tags.some((tag) => tag.toLowerCase().includes(lowerQuery)) ||
      doc.description?.toLowerCase().includes(lowerQuery) ||
      doc.documentNumber?.toLowerCase().includes(lowerQuery)
    );
  },

  /**
   * Get document storage usage
   */
  async getStorageUsage(): Promise<{ totalSize: number; documentCount: number }> {
    const all = await documentStorage.getAll();
    const totalSize = all.reduce((sum, doc) => sum + doc.fileSize, 0);
    return { totalSize, documentCount: all.length };
  },

  /**
   * Format file size for display
   */
  formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  },
};
