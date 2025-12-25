// ============================================
// GREPRE SMART LIFE - DOCUMENT LINKING SERVICE
// Smart Document-Bill Linking
// Quick access to related documents from bills
// ============================================

import { Bill, Document, DocumentCategory, BillCategory } from '@/types';
import { storageService } from './storage';

// Mapping of bill categories to related document categories
const BILL_DOCUMENT_MAPPING: Record<BillCategory, DocumentCategory[]> = {
  [BillCategory.RENT]: [DocumentCategory.CONTRACT, DocumentCategory.RECEIPT],
  [BillCategory.UTILITIES]: [DocumentCategory.RECEIPT, DocumentCategory.CONTRACT],
  [BillCategory.SUBSCRIPTION]: [DocumentCategory.RECEIPT, DocumentCategory.CONTRACT],
  [BillCategory.INSURANCE]: [DocumentCategory.INSURANCE, DocumentCategory.CERTIFICATE, DocumentCategory.CONTRACT],
  [BillCategory.SCHOOL_FEES]: [DocumentCategory.RECEIPT, DocumentCategory.CERTIFICATE],
  [BillCategory.LOAN]: [DocumentCategory.CONTRACT, DocumentCategory.RECEIPT],
  [BillCategory.CREDIT_CARD]: [DocumentCategory.RECEIPT],
  [BillCategory.OTHER]: [DocumentCategory.OTHER, DocumentCategory.RECEIPT],
};

export const linkingService = {
  /**
   * Link a document to a bill
   */
  async linkDocumentToBill(billId: string, documentId: string): Promise<void> {
    const bills = await storageService.bills.getAll();
    const documents = await storageService.documents.getAll();

    // Update bill with linked document
    const billIndex = bills.findIndex(b => b.id === billId);
    if (billIndex >= 0) {
      bills[billIndex].linkedDocumentId = documentId;
      await storageService.bills.saveAll(bills);
    }

    // Update document with linked bill
    const docIndex = documents.findIndex(d => d.id === documentId);
    if (docIndex >= 0) {
      documents[docIndex].linkedBillId = billId;
      await storageService.documents.saveAll(documents);
    }
  },

  /**
   * Unlink a document from a bill
   */
  async unlinkDocumentFromBill(billId: string, documentId: string): Promise<void> {
    const bills = await storageService.bills.getAll();
    const documents = await storageService.documents.getAll();

    // Remove link from bill
    const billIndex = bills.findIndex(b => b.id === billId);
    if (billIndex >= 0 && bills[billIndex].linkedDocumentId === documentId) {
      delete bills[billIndex].linkedDocumentId;
      await storageService.bills.saveAll(bills);
    }

    // Remove link from document
    const docIndex = documents.findIndex(d => d.id === documentId);
    if (docIndex >= 0 && documents[docIndex].linkedBillId === billId) {
      delete documents[docIndex].linkedBillId;
      await storageService.documents.saveAll(documents);
    }
  },

  /**
   * Get document linked to a bill
   */
  async getLinkedDocument(billId: string): Promise<Document | null> {
    const bills = await storageService.bills.getAll();
    const bill = bills.find(b => b.id === billId);
    
    if (!bill?.linkedDocumentId) return null;

    const documents = await storageService.documents.getAll();
    return documents.find(d => d.id === bill.linkedDocumentId) || null;
  },

  /**
   * Get bill linked to a document
   */
  async getLinkedBill(documentId: string): Promise<Bill | null> {
    const documents = await storageService.documents.getAll();
    const doc = documents.find(d => d.id === documentId);
    
    if (!doc?.linkedBillId) return null;

    const bills = await storageService.bills.getAll();
    return bills.find(b => b.id === doc.linkedBillId) || null;
  },

  /**
   * Get suggested documents for a bill based on category
   */
  async getSuggestedDocuments(bill: Bill): Promise<Document[]> {
    const documents = await storageService.documents.getAll();
    const suggestedCategories = BILL_DOCUMENT_MAPPING[bill.category] || [];

    // Filter documents by suggested categories
    const suggested = documents.filter(doc => {
      // Already linked
      if (doc.linkedBillId) return false;
      
      // Check category match
      if (suggestedCategories.includes(doc.category)) return true;
      
      // Check name similarity
      const billNameLower = bill.name.toLowerCase();
      const docNameLower = doc.name.toLowerCase();
      if (docNameLower.includes(billNameLower) || billNameLower.includes(docNameLower)) {
        return true;
      }
      
      // Check tags
      if (doc.tags?.some(tag => billNameLower.includes(tag.toLowerCase()))) {
        return true;
      }

      return false;
    });

    // Sort by relevance (category match first, then name match)
    return suggested.sort((a, b) => {
      const aCategory = suggestedCategories.includes(a.category) ? 1 : 0;
      const bCategory = suggestedCategories.includes(b.category) ? 1 : 0;
      return bCategory - aCategory;
    });
  },

  /**
   * Get suggested bills for a document based on category
   */
  async getSuggestedBills(document: Document): Promise<Bill[]> {
    const bills = await storageService.bills.getAll();

    // Find bill categories that commonly link to this document category
    const billCategories: BillCategory[] = [];
    for (const [billCat, docCats] of Object.entries(BILL_DOCUMENT_MAPPING)) {
      if (docCats.includes(document.category)) {
        billCategories.push(billCat as BillCategory);
      }
    }

    const suggested = bills.filter(bill => {
      // Already linked
      if (bill.linkedDocumentId) return false;
      
      // Check category match
      if (billCategories.includes(bill.category)) return true;
      
      // Check name similarity
      const billNameLower = bill.name.toLowerCase();
      const docNameLower = document.name.toLowerCase();
      if (docNameLower.includes(billNameLower) || billNameLower.includes(docNameLower)) {
        return true;
      }

      return false;
    });

    return suggested;
  },

  /**
   * Auto-link documents based on patterns
   * Runs in background to suggest links
   */
  async autoSuggestLinks(): Promise<Array<{
    bill: Bill;
    document: Document;
    confidence: number;
    reason: string;
  }>> {
    const bills = await storageService.bills.getAll();
    const documents = await storageService.documents.getAll();
    const suggestions: Array<{
      bill: Bill;
      document: Document;
      confidence: number;
      reason: string;
    }> = [];

    for (const bill of bills) {
      // Skip if already linked
      if (bill.linkedDocumentId) continue;

      for (const doc of documents) {
        // Skip if already linked
        if (doc.linkedBillId) continue;

        let confidence = 0;
        let reason = '';

        // Check category compatibility
        const suggestedCategories = BILL_DOCUMENT_MAPPING[bill.category] || [];
        if (suggestedCategories.includes(doc.category)) {
          confidence += 0.3;
          reason = 'Category match';
        }

        // Check name similarity
        const billName = bill.name.toLowerCase();
        const docName = doc.name.toLowerCase();
        
        if (docName.includes(billName) || billName.includes(docName)) {
          confidence += 0.4;
          reason = reason ? `${reason}, name match` : 'Name match';
        }

        // Check for common keywords
        const billWords = billName.split(/\s+/);
        const docWords = docName.split(/\s+/);
        const commonWords = billWords.filter(w => 
          w.length > 3 && docWords.some(dw => dw.includes(w) || w.includes(dw))
        );
        
        if (commonWords.length > 0) {
          confidence += 0.2 * commonWords.length;
          reason = reason ? `${reason}, keyword match` : 'Keyword match';
        }

        // Check tags
        if (doc.tags?.some(tag => billName.includes(tag.toLowerCase()))) {
          confidence += 0.2;
          reason = reason ? `${reason}, tag match` : 'Tag match';
        }

        // Only suggest if confidence is high enough
        if (confidence >= 0.5) {
          suggestions.push({
            bill,
            document: doc,
            confidence: Math.min(confidence, 1),
            reason,
          });
        }
      }
    }

    // Sort by confidence
    return suggestions.sort((a, b) => b.confidence - a.confidence);
  },

  /**
   * Get all linked pairs
   */
  async getAllLinks(): Promise<Array<{ bill: Bill; document: Document }>> {
    const bills = await storageService.bills.getAll();
    const documents = await storageService.documents.getAll();
    const links: Array<{ bill: Bill; document: Document }> = [];

    for (const bill of bills) {
      if (bill.linkedDocumentId) {
        const doc = documents.find(d => d.id === bill.linkedDocumentId);
        if (doc) {
          links.push({ bill, document: doc });
        }
      }
    }

    return links;
  },

  /**
   * Quick access - get document for a bill category (for emergency access)
   */
  async getQuickAccessDocuments(category: BillCategory): Promise<Document[]> {
    const documents = await storageService.documents.getAll();
    const suggestedCategories = BILL_DOCUMENT_MAPPING[category] || [];
    
    return documents.filter(doc => suggestedCategories.includes(doc.category));
  },
};

export default linkingService;
