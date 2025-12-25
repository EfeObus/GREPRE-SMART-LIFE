// ============================================
// GREPRE SMART LIFE - DOCUMENT STORE
// State management for documents
// ============================================

import { create } from 'zustand';
import type { Document, DocumentFormData } from '@/types';
import { DocumentCategory } from '@/types';
import { documentService } from '@/services';

interface DocumentState {
  // Data
  documents: Document[];
  selectedDocument: Document | null;
  isLoading: boolean;
  error: string | null;

  // Computed values
  expiringDocuments: Document[];
  storageUsage: { totalSize: number; documentCount: number };

  // Actions
  fetchDocuments: () => Promise<void>;
  addDocument: (
    formData: DocumentFormData,
    file: { uri: string; name: string; type: string; size: number }
  ) => Promise<Document>;
  updateDocument: (documentId: string, updates: Partial<DocumentFormData>) => Promise<void>;
  deleteDocument: (documentId: string) => Promise<void>;
  selectDocument: (document: Document | null) => void;
  getDocumentById: (documentId: string) => Document | undefined;
  getDocumentsByCategory: (category: DocumentCategory) => Document[];
  searchDocuments: (query: string) => Document[];
  clearError: () => void;
}

export const useDocumentStore = create<DocumentState>((set, get) => ({
  // Initial state
  documents: [],
  selectedDocument: null,
  isLoading: false,
  error: null,
  expiringDocuments: [],
  storageUsage: { totalSize: 0, documentCount: 0 },

  // Fetch all documents
  fetchDocuments: async () => {
    set({ isLoading: true, error: null });
    try {
      const documents = await documentService.getAllDocuments();
      const expiringDocuments = await documentService.getExpiringDocuments(30);
      const storageUsage = await documentService.getStorageUsage();

      set({
        documents,
        expiringDocuments,
        storageUsage,
        isLoading: false,
      });
    } catch (error) {
      set({ error: 'Failed to fetch documents', isLoading: false });
      console.error('Error fetching documents:', error);
    }
  },

  // Add a new document
  addDocument: async (
    formData: DocumentFormData,
    file: { uri: string; name: string; type: string; size: number }
  ) => {
    set({ isLoading: true, error: null });
    try {
      const newDocument = await documentService.createDocument(formData, file);
      await get().fetchDocuments(); // Refresh all data
      return newDocument;
    } catch (error) {
      set({ error: 'Failed to add document', isLoading: false });
      throw error;
    }
  },

  // Update a document
  updateDocument: async (documentId: string, updates: Partial<DocumentFormData>) => {
    set({ isLoading: true, error: null });
    try {
      await documentService.updateDocument(documentId, updates);
      await get().fetchDocuments(); // Refresh all data
    } catch (error) {
      set({ error: 'Failed to update document', isLoading: false });
      throw error;
    }
  },

  // Delete a document
  deleteDocument: async (documentId: string) => {
    set({ isLoading: true, error: null });
    try {
      await documentService.deleteDocument(documentId);
      await get().fetchDocuments(); // Refresh all data
    } catch (error) {
      set({ error: 'Failed to delete document', isLoading: false });
      throw error;
    }
  },

  // Select a document
  selectDocument: (document: Document | null) => {
    set({ selectedDocument: document });
  },

  // Get document by ID
  getDocumentById: (documentId: string) => {
    return get().documents.find((d) => d.id === documentId);
  },

  // Get documents by category
  getDocumentsByCategory: (category: DocumentCategory) => {
    return get().documents.filter((d) => d.category === category);
  },

  // Search documents
  searchDocuments: (query: string) => {
    const lowerQuery = query.toLowerCase();
    return get().documents.filter(
      (d) =>
        d.name.toLowerCase().includes(lowerQuery) ||
        d.description?.toLowerCase().includes(lowerQuery) ||
        d.tags.some((tag) => tag.toLowerCase().includes(lowerQuery)) ||
        d.documentNumber?.toLowerCase().includes(lowerQuery)
    );
  },

  // Clear error
  clearError: () => {
    set({ error: null });
  },
}));
