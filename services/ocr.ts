// ============================================
// GREPRE SMART LIFE - OCR SERVICE
// Optical Character Recognition for bills & documents
// Kills the "Data Entry Wall" - scan instead of type!
// ============================================

import { BillCategory, OCRBillData, OCRDocumentData, OCRScanResult } from '@/types';
import * as FileSystem from 'expo-file-system';

// OCR Provider configurations
const OCR_PROVIDERS = {
  google: {
    endpoint: 'https://vision.googleapis.com/v1/images:annotate',
    apiKey: process.env.GOOGLE_CLOUD_API_KEY,
  },
  // AWS Textract can be added here
};

// Common bill patterns for extraction
const BILL_PATTERNS = {
  amount: [
    /(?:total|amount|due|balance|pay)[:\s]*[\$₦€£]?\s*([\d,]+\.?\d*)/gi,
    /[\$₦€£]\s*([\d,]+\.?\d*)/g,
    /(?:NGN|USD|EUR|GBP)\s*([\d,]+\.?\d*)/gi,
  ],
  dueDate: [
    /(?:due\s*date|payment\s*date|pay\s*by|due\s*on)[:\s]*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/gi,
    /(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/g,
    /(\d{1,2}\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\s+\d{2,4})/gi,
  ],
  billerName: [
    /(?:from|biller|company|provider)[:\s]*(.+?)(?:\n|$)/gi,
  ],
  accountNumber: [
    /(?:account|acct|customer)\s*(?:no|number|#)?[:\s]*(\w+)/gi,
  ],
};

// Document patterns
const DOCUMENT_PATTERNS = {
  documentNumber: [
    /(?:no|number|#)[:\s]*([A-Z0-9\-]+)/gi,
    /(?:passport|visa|permit|license)\s*(?:no|number)?[:\s]*([A-Z0-9\-]+)/gi,
  ],
  expiryDate: [
    /(?:expiry|expires|valid\s*until|exp)[:\s]*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/gi,
  ],
  issueDate: [
    /(?:issue|issued|date\s*of\s*issue)[:\s]*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/gi,
  ],
  name: [
    /(?:name|holder)[:\s]*([A-Z][a-zA-Z\s]+)/gi,
  ],
};

// Bill category detection keywords
const CATEGORY_KEYWORDS: Record<BillCategory, string[]> = {
  [BillCategory.RENT]: ['rent', 'lease', 'apartment', 'housing', 'landlord', 'tenancy'],
  [BillCategory.UTILITIES]: ['electricity', 'electric', 'power', 'water', 'gas', 'nepa', 'phcn', 'ikedc', 'ekedc', 'utility'],
  [BillCategory.SUBSCRIPTION]: ['subscription', 'netflix', 'spotify', 'amazon', 'youtube', 'dstv', 'gotv', 'showmax', 'apple'],
  [BillCategory.INSURANCE]: ['insurance', 'policy', 'premium', 'coverage', 'nhis', 'hmo', 'health'],
  [BillCategory.SCHOOL_FEES]: ['school', 'tuition', 'education', 'fee', 'university', 'college', 'academy'],
  [BillCategory.LOAN]: ['loan', 'credit', 'repayment', 'installment', 'finance', 'emi', 'lending'],
  [BillCategory.CREDIT_CARD]: ['credit card', 'card payment', 'mastercard', 'visa', 'verve'],
  [BillCategory.OTHER]: [],
};

export const ocrService = {
  /**
   * Scan a bill image and extract data
   * This is the key feature that kills the "Data Entry Wall"
   */
  async scanBill(imageUri: string): Promise<OCRScanResult> {
    const startTime = Date.now();
    
    try {
      // Get raw text from image
      const rawText = await this.performOCR(imageUri);
      
      // Extract bill data
      const extractedData = this.extractBillData(rawText);
      
      return {
        success: true,
        data: extractedData,
        imageUri,
        processingTimeMs: Date.now() - startTime,
      };
    } catch (error) {
      console.error('OCR Bill Scan Error:', error);
      return {
        success: false,
        data: {
          confidence: 0,
          rawText: '',
          extractedAt: new Date().toISOString(),
        },
        imageUri,
        processingTimeMs: Date.now() - startTime,
      };
    }
  },

  /**
   * Scan a document and extract data
   */
  async scanDocument(imageUri: string): Promise<OCRScanResult> {
    const startTime = Date.now();
    
    try {
      const rawText = await this.performOCR(imageUri);
      const extractedData = this.extractDocumentData(rawText);
      
      return {
        success: true,
        data: extractedData,
        imageUri,
        processingTimeMs: Date.now() - startTime,
      };
    } catch (error) {
      console.error('OCR Document Scan Error:', error);
      return {
        success: false,
        data: {
          confidence: 0,
          rawText: '',
          extractedAt: new Date().toISOString(),
        },
        imageUri,
        processingTimeMs: Date.now() - startTime,
      };
    }
  },

  /**
   * Perform OCR using configured provider
   * Can use Google Cloud Vision, AWS Textract, or on-device ML Kit
   */
  async performOCR(imageUri: string): Promise<string> {
    // Read image as base64
    const imageBase64 = await FileSystem.readAsStringAsync(imageUri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    // Try on-device first (faster, offline capable)
    try {
      const onDeviceResult = await this.performOnDeviceOCR(imageUri);
      if (onDeviceResult && onDeviceResult.length > 50) {
        return onDeviceResult;
      }
    } catch {
      console.log('On-device OCR not available, falling back to cloud');
    }

    // Fall back to cloud OCR
    return this.performCloudOCR(imageBase64);
  },

  /**
   * On-device OCR using ML Kit (react-native-mlkit-ocr)
   * Faster and works offline
   */
  async performOnDeviceOCR(imageUri: string): Promise<string> {
    // This would use @react-native-ml-kit/text-recognition
    // For now, we'll simulate or use cloud fallback
    
    // Placeholder - in production, use:
    // import TextRecognition from '@react-native-ml-kit/text-recognition';
    // const result = await TextRecognition.recognize(imageUri);
    // return result.text;
    
    throw new Error('On-device OCR not configured');
  },

  /**
   * Cloud OCR using Google Cloud Vision
   */
  async performCloudOCR(imageBase64: string): Promise<string> {
    const { endpoint, apiKey } = OCR_PROVIDERS.google;
    
    if (!apiKey) {
      // Return empty for development - use mock data
      console.warn('No OCR API key configured');
      return '';
    }

    const response = await fetch(`${endpoint}?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        requests: [{
          image: { content: imageBase64 },
          features: [{ type: 'TEXT_DETECTION' }],
        }],
      }),
    });

    const result = await response.json();
    
    if (result.responses?.[0]?.fullTextAnnotation?.text) {
      return result.responses[0].fullTextAnnotation.text;
    }
    
    return '';
  },

  /**
   * Extract bill data from OCR text
   */
  extractBillData(rawText: string): OCRBillData {
    const lowerText = rawText.toLowerCase();
    let confidence = 0;
    let matchCount = 0;

    // Extract amount
    let amount: number | undefined;
    for (const pattern of BILL_PATTERNS.amount) {
      const match = pattern.exec(rawText);
      if (match) {
        amount = parseFloat(match[1].replace(/,/g, ''));
        if (!isNaN(amount)) {
          matchCount++;
          break;
        }
      }
      pattern.lastIndex = 0;
    }

    // Extract due date
    let dueDate: string | undefined;
    for (const pattern of BILL_PATTERNS.dueDate) {
      const match = pattern.exec(rawText);
      if (match) {
        dueDate = this.parseDate(match[1]);
        if (dueDate) {
          matchCount++;
          break;
        }
      }
      pattern.lastIndex = 0;
    }

    // Extract biller name
    let billerName: string | undefined;
    for (const pattern of BILL_PATTERNS.billerName) {
      const match = pattern.exec(rawText);
      if (match) {
        billerName = match[1].trim();
        matchCount++;
        break;
      }
      pattern.lastIndex = 0;
    }

    // Extract account number
    let accountNumber: string | undefined;
    for (const pattern of BILL_PATTERNS.accountNumber) {
      const match = pattern.exec(rawText);
      if (match) {
        accountNumber = match[1].trim();
        matchCount++;
        break;
      }
      pattern.lastIndex = 0;
    }

    // Calculate confidence (0-1)
    confidence = Math.min(matchCount / 4, 1);

    // Detect category from keywords
    const detectedCategory = this.detectBillCategory(lowerText);

    return {
      billerName,
      amount,
      dueDate,
      accountNumber,
      confidence,
      rawText,
      extractedAt: new Date().toISOString(),
    };
  },

  /**
   * Extract document data from OCR text
   */
  extractDocumentData(rawText: string): OCRDocumentData {
    let matchCount = 0;

    // Extract document number
    let documentNumber: string | undefined;
    for (const pattern of DOCUMENT_PATTERNS.documentNumber) {
      const match = pattern.exec(rawText);
      if (match) {
        documentNumber = match[1].trim();
        matchCount++;
        break;
      }
      pattern.lastIndex = 0;
    }

    // Extract expiry date
    let expiryDate: string | undefined;
    for (const pattern of DOCUMENT_PATTERNS.expiryDate) {
      const match = pattern.exec(rawText);
      if (match) {
        expiryDate = this.parseDate(match[1]);
        if (expiryDate) matchCount++;
        break;
      }
      pattern.lastIndex = 0;
    }

    // Extract issue date
    let issueDate: string | undefined;
    for (const pattern of DOCUMENT_PATTERNS.issueDate) {
      const match = pattern.exec(rawText);
      if (match) {
        issueDate = this.parseDate(match[1]);
        if (issueDate) matchCount++;
        break;
      }
      pattern.lastIndex = 0;
    }

    // Extract name
    let name: string | undefined;
    for (const pattern of DOCUMENT_PATTERNS.name) {
      const match = pattern.exec(rawText);
      if (match) {
        name = match[1].trim();
        matchCount++;
        break;
      }
      pattern.lastIndex = 0;
    }

    // Detect document type
    const documentType = this.detectDocumentType(rawText.toLowerCase());

    const confidence = Math.min(matchCount / 4, 1);

    return {
      documentType,
      documentNumber,
      name,
      expiryDate,
      issueDate,
      confidence,
      rawText,
      extractedAt: new Date().toISOString(),
    };
  },

  /**
   * Detect bill category from text
   */
  detectBillCategory(text: string): BillCategory {
    const lowerText = text.toLowerCase();
    
    for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
      for (const keyword of keywords) {
        if (lowerText.includes(keyword)) {
          return category as BillCategory;
        }
      }
    }
    
    return BillCategory.OTHER;
  },

  /**
   * Detect document type from text
   */
  detectDocumentType(text: string): string {
    const lowerText = text.toLowerCase();
    
    if (lowerText.includes('passport')) return 'passport';
    if (lowerText.includes('visa')) return 'visa';
    if (lowerText.includes('driver') || lowerText.includes('license')) return 'license';
    if (lowerText.includes('national id') || lowerText.includes('identity')) return 'id';
    if (lowerText.includes('permit')) return 'permit';
    if (lowerText.includes('certificate')) return 'certificate';
    if (lowerText.includes('warranty')) return 'warranty';
    if (lowerText.includes('insurance') || lowerText.includes('policy')) return 'insurance';
    if (lowerText.includes('contract') || lowerText.includes('agreement')) return 'contract';
    
    return 'other';
  },

  /**
   * Parse various date formats to ISO string
   */
  parseDate(dateStr: string): string | undefined {
    try {
      // Try common formats
      const formats = [
        // DD/MM/YYYY
        /^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/,
        // MM/DD/YYYY
        /^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/,
        // YYYY-MM-DD
        /^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})$/,
      ];

      for (const format of formats) {
        const match = dateStr.match(format);
        if (match) {
          // Assume DD/MM/YYYY for Nigerian context
          const day = parseInt(match[1]);
          const month = parseInt(match[2]);
          const year = parseInt(match[3]);
          
          if (day <= 31 && month <= 12 && year >= 2000) {
            const date = new Date(year, month - 1, day);
            return date.toISOString().split('T')[0];
          }
        }
      }

      // Try month name formats
      const monthNameMatch = dateStr.match(/(\d{1,2})\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\s+(\d{4})/i);
      if (monthNameMatch) {
        const months: Record<string, number> = {
          jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
          jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
        };
        const day = parseInt(monthNameMatch[1]);
        const month = months[monthNameMatch[2].toLowerCase().substring(0, 3)];
        const year = parseInt(monthNameMatch[3]);
        
        const date = new Date(year, month, day);
        return date.toISOString().split('T')[0];
      }

      return undefined;
    } catch {
      return undefined;
    }
  },
};

export default ocrService;
