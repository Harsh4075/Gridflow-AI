import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Upload,
  Trash2,
  Download,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  FileSpreadsheet,
  Image as ImageIcon,
  FileText,
  Edit2,
  X,
  Plus,
  Play,
  Check,
  Sparkles,
  Layers,
  ArrowRight,
  Database,
  Eye,
  Info,
  Layers3,
  CheckSquare,
  Square,
  Coins,
  Wallet,
  Key,
  Clock,
  Copy
} from 'lucide-react';

interface DocumentFile {
  id: string;
  name: string;
  size: number;
  type?: string;
  preview: string; // Object URL or placeholder
  status: 'pending' | 'analyzing' | 'analyzed' | 'extracting' | 'completed' | 'failed';
  error?: string;
  documentTitle?: string;
  detectedHeadings?: string[]; // Column headings detected from the page table
  selectedHeadings?: string[]; // Headings selected by the user to extract
  extractedRows?: Record<string, string>[]; // List of extracted rows (column -> value)
  progress?: number; // Smooth loading percentage
  pageCount?: number;
}

export default function App() {
  // --- STATE ---
  const [files, setFiles] = useState<DocumentFile[]>(() => {
    const saved = localStorage.getItem('ocr_hybrid_files');
    if (!saved) return [];
    try {
      const parsed = JSON.parse(saved);
      return parsed.map((f: any) => {
        // Legacy data migration
        if (f.extractedData && !f.extractedRows) {
          f.extractedRows = [f.extractedData];
          delete f.extractedData;
        }
        // Reset loader status on fresh load
        if (f.status === 'analyzing' || f.status === 'pending' || f.status === 'extracting') {
          f.status = 'analyzed';
        }
        return f;
      });
    } catch {
      return [];
    }
  });

  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [customHeadingInput, setCustomHeadingInput] = useState('');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [isBatchExtracting, setIsBatchExtracting] = useState(false);

  // Wallet, pricing, and billing states
  const [credits, setCredits] = useState<number>(() => {
    const savedCredits = localStorage.getItem('ocr_credits');
    if (savedCredits) return parseInt(savedCredits, 10);
    const savedBalance = localStorage.getItem('ocr_wallet_balance');
    if (savedBalance) {
      // Migrate ₹0.50 = 1 credit
      return Math.floor(parseFloat(savedBalance) / 0.50);
    }
    return 20; // 20 free credits starter
  });

  const [totalExtractedPages, setTotalExtractedPages] = useState<number>(() => {
    const saved = localStorage.getItem('ocr_total_extracted_pages');
    return saved ? parseInt(saved, 10) : 0;
  });

  const [adminPin, setAdminPin] = useState<string>(() => {
    const saved = localStorage.getItem('ocr_admin_pin');
    if (!saved || saved === '1234') {
      localStorage.setItem('ocr_admin_pin', 'Harsh4075');
      return 'Harsh4075';
    }
    return saved;
  });

  const [rechargeAmount, setRechargeAmount] = useState<string>('50');
  const [rechargeCreditsInput, setRechargeCreditsInput] = useState<string>('100');
  const [submittedInvoice, setSubmittedInvoice] = useState<{
    invoiceId: string;
    credits: number;
    amount: number;
    utr: string;
    date: string;
    recipient: string;
  } | null>(null);

  const handleCreditsChange = (val: string) => {
    setRechargeCreditsInput(val);
    const num = parseFloat(val);
    if (!isNaN(num) && num >= 0) {
      setRechargeAmount((num * 0.50).toFixed(2));
    } else {
      setRechargeAmount('');
    }
  };

  const handleAmountChange = (val: string) => {
    setRechargeAmount(val);
    const num = parseFloat(val);
    if (!isNaN(num) && num >= 0) {
      setRechargeCreditsInput(Math.round(num / 0.50).toString());
    } else {
      setRechargeCreditsInput('');
    }
  };

  const [enteredPin, setEnteredPin] = useState<string>('');
  const [rechargeTab, setRechargeTab] = useState<'payment' | 'redeem' | 'admin'>('payment');
  const [newPinInput, setNewPinInput] = useState<string>('');
  const [showPinChange, setShowPinChange] = useState<boolean>(false);
  const [showPurchaseModal, setShowPurchaseModal] = useState<boolean>(false);
  const [showPaymentQR, setShowPaymentQR] = useState<boolean>(false);
  const [adminPasswordInput, setAdminPasswordInput] = useState<string>('');
  const [isPaymentSuccess, setIsPaymentSuccess] = useState<boolean>(false);

  const [sheetWebhookUrl, setSheetWebhookUrl] = useState<string>(() => {
    return localStorage.getItem('ocr_sheet_webhook_url') || '';
  });
  const [redeemCodeInput, setRedeemCodeInput] = useState<string>('');
  const [isRedeeming, setIsRedeeming] = useState<boolean>(false);
  const [isAdminUnlocked, setIsAdminUnlocked] = useState<boolean>(false);

  const [apiCallsCount, setApiCallsCount] = useState<number>(() => {
    const saved = localStorage.getItem('gemini_api_calls_count');
    return saved ? parseInt(saved, 10) : 0;
  });

  const incrementApiCall = () => {
    setApiCallsCount(prev => {
      const next = prev + 1;
      localStorage.setItem('gemini_api_calls_count', next.toString());
      return next;
    });
  };

  useEffect(() => {
    const lastResetStr = localStorage.getItem('gemini_api_calls_last_reset');
    const now = Date.now();
    if (!lastResetStr) {
      localStorage.setItem('gemini_api_calls_last_reset', now.toString());
    } else {
      const lastReset = parseInt(lastResetStr, 10);
      const oneDayMs = 24 * 60 * 60 * 1000;
      if (now - lastReset > oneDayMs) {
        setApiCallsCount(0);
        localStorage.setItem('gemini_api_calls_count', '0');
        localStorage.setItem('gemini_api_calls_last_reset', now.toString());
      }
    }
  }, []);

  useEffect(() => {
    const activeFiles = files.filter(f => f.status === 'analyzing' || f.status === 'extracting');
    if (activeFiles.length === 0) return;

    const interval = setInterval(() => {
      setFiles(prevFiles => {
        let changed = false;
        const updated = prevFiles.map(file => {
          if (file.status === 'analyzing' || file.status === 'extracting') {
            const currentProgress = file.progress || 0;
            if (currentProgress < 95) {
              const increment = currentProgress < 40 ? 12 : (currentProgress < 75 ? 6 : 2);
              changed = true;
              return { ...file, progress: Math.min(95, currentProgress + increment) };
            }
          }
          return file;
        });
        return changed ? updated : prevFiles;
      });
    }, 400);

    return () => clearInterval(interval);
  }, [files]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // High-capacity raw File pointer map for memory efficiency
  const fileObjectsRef = useRef<Map<string, File>>(new Map());

  // Sync to local storage
  useEffect(() => {
    const filesToSave = files.map(file => ({
      id: file.id,
      name: file.name,
      size: file.size,
      type: file.type,
      status: file.status,
      error: file.error,
      documentTitle: file.documentTitle,
      detectedHeadings: file.detectedHeadings,
      selectedHeadings: file.selectedHeadings,
      extractedRows: file.extractedRows,
      preview: 'PERSISTED_IN_MEMORY'
    }));
    localStorage.setItem('ocr_hybrid_files', JSON.stringify(filesToSave));
  }, [files]);

  // Auto-select active file
  useEffect(() => {
    if (files.length > 0 && !selectedFileId) {
      setSelectedFileId(files[0].id);
    }
  }, [files, selectedFileId]);

  // Toast notification helper
  const showNotification = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // --- QUEUES ---
  useEffect(() => {
    const analyzingCount = files.filter(f => f.status === 'analyzing').length;
    if (analyzingCount >= 2) return;

    const nextPending = files.find(f => f.status === 'pending');
    if (nextPending) {
      analyzeImageHeaders(nextPending.id);
    }
  }, [files]);

  useEffect(() => {
    if (!isBatchExtracting) return;

    const extractingCount = files.filter(f => f.status === 'extracting').length;
    if (extractingCount >= 1) return;

    const nextToExtract = files.find(
      f => f.status === 'analyzed' && (f.selectedHeadings || []).length > 0
    );

    if (nextToExtract) {
      extractSelectedData(nextToExtract.id);
    } else {
      setIsBatchExtracting(false);
      showNotification('All pages compiled perfectly into your grid!', 'success');
    }
  }, [files, isBatchExtracting]);

  const compressImage = (file: File, maxWidth = 1600, maxHeight = 1600, quality = 0.85): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          let width = img.width;
          let height = img.height;

          if (width > maxWidth || height > maxHeight) {
            if (width > height) {
              height = Math.round((height * maxWidth) / width);
              width = maxWidth;
            } else {
              width = Math.round((width * maxHeight) / height);
              height = maxHeight;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(e.target?.result as string);
            return;
          }

          ctx.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/jpeg', quality);
          resolve(dataUrl);
        };
        img.onerror = () => {
          resolve(e.target?.result as string);
        };
        img.src = e.target?.result as string;
      };
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(file);
    });
  };

  const getFileBase64 = (fileId: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      const fileObj = fileObjectsRef.current.get(fileId);
      if (!fileObj) {
        reject(new Error('Image reference cleared from current session. Please click browse to re-upload.'));
        return;
      }
      if (fileObj.type.startsWith('image/')) {
        compressImage(fileObj)
          .then(resolve)
          .catch(reject);
      } else {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = (err) => reject(err);
        reader.readAsDataURL(fileObj);
      }
    });
  };

  const safeFetch = async (url: string, options: RequestInit): Promise<any> => {
    const response = await fetch(url, options);
    const contentType = response.headers.get('content-type') || '';
    
    if (!contentType.includes('application/json')) {
      const text = await response.text();
      console.error(`Non-JSON response received from ${url}:`, text);
      
      if (response.status === 413) {
        throw new Error('The file you uploaded is too large for the network limit (413 Payload Too Large). Please upload a smaller image or a single-page/lighter PDF.');
      }
      
      if (text.includes('<html>') || text.includes('<!DOCTYPE html>')) {
        throw new Error('The server is currently busy or returned an HTML error page. Please try again with a lighter page or wait a moment.');
      }
      
      throw new Error(`Invalid server response format: ${text.substring(0, 100)}`);
    }
    
    const result = await response.json();
    return result;
  };

  const countPdfPages = async (file: File): Promise<number> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const arr = new Uint8Array(e.target?.result as ArrayBuffer);
          const textDecoder = new TextDecoder('latin1');
          const str = textDecoder.decode(arr);
          
          let pageCount = 0;
          
          // Method 1: Search for the Pages dictionary which lists the total count of pages in the PDF.
          // PDF dictionaries are enclosed in << and >>. We find any << ... >> that contains /Type /Pages
          // and then extract /Count followed by digits.
          const dictRegex = /<<([\s\S]*?)>>/g;
          let match;
          while ((match = dictRegex.exec(str)) !== null) {
            const dictContent = match[1];
            if (/\/Type\s*\/Pages\b/.test(dictContent)) {
              const countMatch = /\/Count\s*(\d+)/.exec(dictContent);
              if (countMatch) {
                const val = parseInt(countMatch[1], 10);
                if (val > pageCount) {
                  pageCount = val;
                }
              }
            }
          }

          // Method 2: Fallback - look for any /Count \d+ in the file if the pages dict was somehow compressed
          if (pageCount === 0) {
            const countRegex = /\/Count\s*(\d+)/g;
            while ((match = countRegex.exec(str)) !== null) {
              const val = parseInt(match[1], 10);
              if (val > pageCount && val < 50000) { // Limit to a sane page count to avoid parsing random stream lengths
                pageCount = val;
              }
            }
          }

          // Method 3: Fallback - count individual Page object references
          if (pageCount === 0) {
            const pageMatches = str.match(/\/Type\s*\/Page\b/g);
            if (pageMatches) {
              pageCount = pageMatches.length;
            }
          }

          resolve(pageCount || 1);
        } catch (err) {
          console.error('Error counting PDF pages:', err);
          resolve(1);
        }
      };
      reader.onerror = () => resolve(1);
      reader.readAsArrayBuffer(file);
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      addUploadedFiles(e.target.files);
    }
  };

  const addUploadedFiles = async (fileList: FileList) => {
    const newFilesList: DocumentFile[] = [];
    const MAX_SIZE_MB = 20;
    const MAX_SIZE = MAX_SIZE_MB * 1024 * 1024;

    const fileArray = Array.from(fileList);
    for (const file of fileArray) {
      if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
        showNotification('Invalid file type. Please upload high-res document images or PDF files.', 'error');
        continue;
      }

      if (file.size > MAX_SIZE) {
        showNotification(`"${file.name}" is too heavy (${(file.size / (1024 * 1024)).toFixed(1)}MB). Please upload files under ${MAX_SIZE_MB}MB for reliable web parsing.`, 'error');
        continue;
      }

      const fileId = `doc_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      fileObjectsRef.current.set(fileId, file);

      const previewUrl = URL.createObjectURL(file);

      let detectedPageCount = 1;
      if (file.type === 'application/pdf') {
        try {
          detectedPageCount = await countPdfPages(file);
        } catch (err) {
          console.warn('Failed to parse PDF page count, defaulting to 1', err);
        }
      }

      newFilesList.push({
        id: fileId,
        name: file.name,
        size: file.size,
        type: file.type,
        preview: previewUrl,
        status: 'pending',
        progress: 0,
        detectedHeadings: [],
        selectedHeadings: [],
        pageCount: detectedPageCount
      });
    }

    if (newFilesList.length > 0) {
      setFiles(prev => [...prev, ...newFilesList]);
      showNotification(`Successfully added ${newFilesList.length} files to the workspace!`, 'success');
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addUploadedFiles(e.dataTransfer.files);
    }
  };

  const handleDeleteFile = (id: string) => {
    const file = files.find(f => f.id === id);
    if (file && file.preview.startsWith('blob:')) {
      URL.revokeObjectURL(file.preview);
    }
    fileObjectsRef.current.delete(id);
    setFiles(prev => prev.filter(f => f.id !== id));
    if (selectedFileId === id) {
      setSelectedFileId(null);
    }
    showNotification('Page removed from active workspace.', 'info');
  };

  const handleClearAll = () => {
    files.forEach(f => {
      if (f.preview && f.preview.startsWith('blob:')) {
        URL.revokeObjectURL(f.preview);
      }
    });
    fileObjectsRef.current.clear();
    setFiles([]);
    setSelectedFileId(null);
    setIsBatchExtracting(false);
    localStorage.removeItem('ocr_hybrid_files');
    showNotification('Workspace cleared. All temporary caches wiped clean.', 'info');
  };

  // --- STAGE 1: ANALYZE COLUMN HEADERS ---
  const analyzeImageHeaders = async (fileId: string) => {
    setFiles(prev =>
      prev.map(f => (f.id === fileId ? { ...f, status: 'analyzing', progress: 0, error: undefined } : f))
    );
    incrementApiCall();

    try {
      const base64Image = await getFileBase64(fileId);
      const result = await safeFetch('/api/analyze-headers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64Image })
      });

      if (!result.success) {
        throw new Error(result.error || 'Columns detection failed.');
      }

      const detectedHeadings = result.data.headings || [];
      const documentTitle = result.data.documentTitle || 'Untitled Table';

      setFiles(prev =>
        prev.map(f => {
          if (f.id === fileId) {
            return {
              ...f,
              status: 'analyzed',
              progress: 100,
              documentTitle,
              detectedHeadings,
              selectedHeadings: [...detectedHeadings] // Selected by default
            };
          }
          return f;
        })
      );
    } catch (err: any) {
      console.error(`Header discovery failed:`, err);
      setFiles(prev =>
        prev.map(f => (f.id === fileId ? { ...f, status: 'failed', progress: 100, error: err.message || 'Detection failed' } : f))
      );
    }
  };

  const handleToggleHeading = (fileId: string, heading: string) => {
    setFiles(prev =>
      prev.map(file => {
        if (file.id !== fileId) return file;
        const currentSelected = file.selectedHeadings || [];
        const updatedSelected = currentSelected.includes(heading)
          ? currentSelected.filter(h => h !== heading)
          : [...currentSelected, heading];
        return { ...file, selectedHeadings: updatedSelected };
      })
    );
  };

  const handleSelectAllHeadings = (fileId: string, selectAll: boolean) => {
    setFiles(prev =>
      prev.map(file => {
        if (file.id !== fileId) return file;
        return {
          ...file,
          selectedHeadings: selectAll ? [...(file.detectedHeadings || [])] : []
        };
      })
    );
  };

  const handleAddCustomHeading = (fileId: string) => {
    if (!customHeadingInput.trim()) return;
    const cleanHeading = customHeadingInput.trim();

    setFiles(prev =>
      prev.map(file => {
        if (file.id !== fileId) return file;
        const currentDetected = file.detectedHeadings || [];
        const currentSelected = file.selectedHeadings || [];
        
        const updatedDetected = currentDetected.includes(cleanHeading)
          ? currentDetected
          : [...currentDetected, cleanHeading];
        
        const updatedSelected = currentSelected.includes(cleanHeading)
          ? currentSelected
          : [...currentSelected, cleanHeading];

        return {
          ...file,
          detectedHeadings: updatedDetected,
          selectedHeadings: updatedSelected
        };
      })
    );

    setCustomHeadingInput('');
    showNotification(`Custom column "${cleanHeading}" added successfully.`, 'success');
  };

  // --- STAGE 2: ROW EXTRACTION ---
  const extractSelectedData = async (fileId: string) => {
    const file = files.find(f => f.id === fileId);
    if (!file) return;

    const selectedHeadings = file.selectedHeadings || [];
    if (selectedHeadings.length === 0) {
      showNotification('Please select at least one column before extraction.', 'error');
      return;
    }

    // Verify credits before proceeding (1 credit per page/PDF-page)
    const neededCredits = file.type === 'application/pdf' ? (file.pageCount || 1) : 1;
    if (credits < neededCredits) {
      showNotification(`अपर्याप्त क्रेडिट! इस फ़ाइल को प्रोसेस करने के लिए ${neededCredits} क्रेडिट्स चाहिए, आपके पास ${credits} क्रेडिट्स हैं। कृपया रिचार्ज करें।`, 'error');
      setFiles(prev =>
        prev.map(f => (f.id === fileId ? { ...f, status: 'failed', progress: 100, error: `Insufficient credits. This document requires ${neededCredits} credits, but you only have ${credits} credits left.` } : f))
      );
      setIsBatchExtracting(false);
      return;
    }

    setFiles(prev =>
      prev.map(f => (f.id === fileId ? { ...f, status: 'extracting', progress: 0, error: undefined } : f))
    );
    incrementApiCall();

    try {
      const base64Image = await getFileBase64(fileId);
      const extractionFields = selectedHeadings.map(heading => ({
        id: heading,
        name: heading,
        instruction: `Identify the column corresponding to "${heading}" in the main table on this page. Extract the value for every row under this column.`
      }));

      const result = await safeFetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: base64Image,
          fields: extractionFields
        })
      });

      if (!result.success) {
        throw new Error(result.error || 'Extraction failed.');
      }

      setFiles(prev =>
        prev.map(f => {
          if (f.id === fileId) {
            return {
              ...f,
              status: 'completed',
              progress: 100,
              extractedRows: result.data?.rows || []
            };
          }
          return f;
        })
      );

      // Successful Extraction: Deduct needed credits and increment page count
      setCredits(prev => {
        const next = Math.max(0, prev - neededCredits);
        localStorage.setItem('ocr_credits', next.toString());
        return next;
      });
      setTotalExtractedPages(prev => {
        const next = prev + neededCredits;
        localStorage.setItem('ocr_total_extracted_pages', next.toString());
        return next;
      });

      showNotification(`Data parsed into structured rows for ${file.name}`, 'success');
    } catch (err: any) {
      console.error(`Row extraction failure:`, err);
      setFiles(prev =>
        prev.map(f => (f.id === fileId ? { ...f, status: 'failed', progress: 100, error: err.message || 'Extraction failed' } : f))
      );
    }
  };

  // --- SHEET EDITING ---
  const handleCellValueChange = (fileId: string, rowIndex: number, colKey: string, value: string) => {
    setFiles(prev =>
      prev.map(file => {
        if (file.id !== fileId) return file;
        const updatedRows = file.extractedRows ? [...file.extractedRows] : [];
        if (updatedRows[rowIndex]) {
          updatedRows[rowIndex] = { ...updatedRows[rowIndex], [colKey]: value };
        }
        return { ...file, extractedRows: updatedRows };
      })
    );
  };

  const dynamicColumns = Array.from(
    new Set(
      files.flatMap(f => [
        ...(f.extractedRows ? f.extractedRows.flatMap(row => Object.keys(row)) : []),
        ...(f.selectedHeadings || [])
      ])
    )
  ).filter(col => col !== 'documentTitle' && col !== 'file_name') as string[];

  // --- CSV DOWNLOAD ---
  const handleExportToExcel = () => {
    const processedFiles = files.filter(f => f.status === 'completed' && f.extractedRows && f.extractedRows.length > 0);
    if (processedFiles.length === 0) {
      showNotification('No extracted data available to generate spreadsheet.', 'error');
      return;
    }

    const headers = [...dynamicColumns];
    const rows: string[] = [];

    processedFiles.forEach(file => {
      file.extractedRows?.forEach((rowData) => {
        const row = [
          ...dynamicColumns.map(col => rowData[col] || '')
        ];
        rows.push(row.map(val => `"${val.replace(/"/g, '""')}"`).join(','));
      });
    });

    const csvContent = [headers.join(','), ...rows].join('\n');
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Parsed_Tables_Export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showNotification('Perfect spreadsheet exported cleanly!', 'success');
  };

  const selectedFile = files.find(f => f.id === selectedFileId);
  const activeFileInMemory = selectedFile ? fileObjectsRef.current.has(selectedFile.id) : false;

  // Small stats calculators
  const statsTotal = files.length;
  const statsCompleted = files.filter(f => f.status === 'completed').length;
  const statsPending = files.filter(f => f.status === 'pending' || f.status === 'analyzing').length;
  const statsExtracting = files.filter(f => f.status === 'extracting').length;

  return (
    <div className="min-h-screen bg-brand-bg text-brand-text font-sans antialiased flex flex-col selection:bg-brand-primary selection:text-white relative overflow-x-hidden" id="main_root">
      
      {/* Hidden file input always mounted at root level */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        multiple
        accept="image/*,application/pdf"
        className="hidden"
      />

      {/* Dynamic Slide-Up Toast Notification Badge */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 220, damping: 20 }}
            className={`fixed bottom-8 right-8 z-50 flex items-start space-x-3.5 px-5 py-4 rounded-2xl shadow-[0_16px_40px_rgba(0,0,0,0.12)] border text-xs font-semibold max-w-sm transition-all duration-300 ${
              toast.type === 'error' 
                ? 'bg-red-600 border-red-700 text-white' 
                : toast.type === 'success'
                ? 'bg-emerald-600 border-emerald-700 text-white'
                : 'bg-white border-slate-200 text-slate-800'
            }`}
          >
            {toast.type === 'error' ? (
              <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-white flex-shrink-0 font-bold mt-0.5 text-[10px]">
                ⚠️
              </div>
            ) : toast.type === 'success' ? (
              <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-white flex-shrink-0 font-bold mt-0.5 text-[10px]">
                ✓
              </div>
            ) : (
              <div className="w-2.5 h-2.5 rounded-full bg-brand-accent animate-pulse mt-1.5 flex-shrink-0" />
            )}
            <div className="flex-1">
              <p className="leading-relaxed font-bold">{toast.message}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* STYLISH GLASS HEADER */}
      <header className="bg-white/90 backdrop-blur-md border-b border-slate-100 sticky top-0 z-40 shadow-[0_1px_3px_rgba(0,0,0,0.02)]" id="main_header">
        <div className="max-w-[96%] xl:max-w-[94%] mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="bg-brand-primary text-white w-9 h-9 rounded-xl flex items-center justify-center shadow-[0_4px_12px_rgba(37,99,235,0.15)]">
              <FileSpreadsheet className="w-5 h-5 stroke-[2]" />
            </div>
            <div>
              <span className="font-display font-extrabold text-sm tracking-[0.04em] text-brand-primary uppercase">GridFlow AI</span>
              <p className="text-[9px] text-slate-400 font-medium tracking-widest uppercase mt-0.5">High-Precision Upper Table Parser</p>
            </div>
          </div>

          <div className="flex items-center space-x-3.5">
            {/* STYLISH INTERACTIVE CREDITS WIDGET */}
            <button
              onClick={() => setShowPurchaseModal(true)}
              className="flex items-center space-x-2 px-3.5 py-2 bg-amber-500/10 hover:bg-amber-500/15 border border-amber-500/25 text-amber-700 hover:text-amber-800 rounded-xl transition-all duration-300 font-extrabold text-[11px] tracking-wider uppercase cursor-pointer shadow-sm hover:shadow-md hover:-translate-y-0.5"
              title="Click to recharge or buy credits"
            >
              <Coins className="w-4 h-4 text-amber-500 animate-pulse" />
              <span>{credits} Credits</span>
            </button>
          </div>
        </div>
      </header>

      {/* STATE A: NO FILES (Tactile Landing Dashboard Launcher) */}
      {files.length === 0 ? (
        <main className="flex-1 flex flex-col items-center justify-center p-8 max-w-xl mx-auto text-center" id="empty_state">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="space-y-8"
          >
            <div className="inline-flex items-center space-x-2 bg-brand-light text-brand-primary px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-[0.14em] border border-brand-soft shadow-xs">
              <Sparkles className="w-3.5 h-3.5 text-brand-primary animate-pulse" />
              <span>UPPER TABLE INTUITIVE EXTRACTOR</span>
            </div>

            <div className="space-y-3">
              <h1 className="text-3xl sm:text-4xl font-display font-bold text-slate-900 tracking-tight leading-[1.15]">
                Convert messy documents <br className="hidden sm:inline" /> into structured <span className="bg-gradient-to-r from-blue-600 via-indigo-500 to-indigo-600 bg-clip-text text-transparent">sheets.</span>
              </h1>
              <p className="text-slate-500 text-xs leading-relaxed max-w-md mx-auto font-medium">
                Drag-and-drop document pages or PDFs. We auto-detect the column headers of the primary upper table and structure everything cleanly.
              </p>
            </div>

            {/* Premium SaaS styled drag & drop zone */}
            <motion.div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              whileHover={{ y: -4, scale: 1.005 }}
              whileTap={{ scale: 0.995 }}
              transition={{ type: 'spring', stiffness: 260, damping: 25 }}
              className={`border border-dashed rounded-[24px] p-14 cursor-pointer flex flex-col items-center justify-center space-y-5 bg-white transition-all duration-300 ${
                isDragging
                  ? 'border-brand-primary bg-brand-light/60 shadow-[0_12px_40px_rgba(37,99,235,0.08)]'
                  : 'border-slate-200 hover:border-brand-accent hover:shadow-[0_16px_40px_rgba(15,23,42,0.05),0_10px_30px_rgba(37,99,235,0.02)]'
              }`}
            >
              <div className="bg-brand-primary text-white p-4 rounded-2xl shadow-[0_4px_16px_rgba(37,99,235,0.2)]">
                <Upload className="w-6 h-6 stroke-[2]" />
              </div>
              <div className="space-y-2">
                <p className="text-xs font-bold text-slate-800 tracking-tight">Drag and drop document images or PDFs here</p>
                <p className="text-[10px] text-slate-400 font-semibold tracking-wide uppercase">or click to browse local files</p>
                <div className="pt-1.5">
                  <span className="text-[9px] text-red-600 font-bold bg-red-50 px-2.5 py-1 rounded-full border border-red-100 uppercase tracking-wider inline-flex items-center space-x-1.5">
                    <span>⚠️ Maximum 20 MB file size supported</span>
                  </span>
                </div>
              </div>
            </motion.div>

            {/* Footnote */}
            <p className="text-[9px] text-slate-500 font-black tracking-[0.12em] uppercase max-w-xs mx-auto">
              Any secondary lower tables are ignored automatically.
            </p>
          </motion.div>
        </main>
      ) : (
        /* STATE B: FILES LOADED (Pristine Figma Dashboard Interface) */
        <main className="flex-1 max-w-[96%] xl:max-w-[94%] mx-auto w-full px-6 py-8 flex flex-col space-y-8 transition-all duration-500 ease-out" id="workspace_dashboard">
          
          {/* DASHBOARD SPLIT WORKSPACE */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
            
            {/* FILE QUEUE MANAGER (Left Column - 4 cols) */}
            <div className="lg:col-span-4 flex flex-col">
              <div className="premium-card flex-1 flex flex-col overflow-hidden">
                <div className="p-4.5 border-b border-slate-100 flex items-center justify-between bg-brand-light/30">
                  <span className="text-[10px] font-bold text-brand-primary uppercase tracking-[0.12em] flex items-center space-x-2">
                    <Layers3 className="w-4 h-4 stroke-[2]" />
                    <span>Document Queue</span>
                  </span>
                  <span className="text-[10px] bg-brand-primary text-white font-bold px-2.5 py-0.5 rounded-full shadow-xs">
                    {files.length} {files.length === 1 ? 'Page' : 'Pages'}
                  </span>
                </div>

                <div className="flex-1 overflow-y-auto divide-y divide-slate-100 max-h-[380px]">
                  {files.map((file, idx) => {
                    const isSelected = selectedFileId === file.id;
                    const inMemory = fileObjectsRef.current.has(file.id);

                    return (
                      <motion.div
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.04, ease: 'easeOut' }}
                        key={file.id}
                        onClick={() => setSelectedFileId(file.id)}
                        className={`p-3.5 cursor-pointer flex items-center justify-between space-x-3 transition-all duration-300 ease-out ${
                          isSelected 
                            ? 'bg-brand-light/60 border-r-3 border-brand-primary' 
                            : 'hover:bg-brand-light/20'
                        }`}
                      >
                        <div className="flex items-center space-x-3 min-w-0">
                          {/* Smooth micro status lights */}
                          <div className="relative flex-shrink-0">
                            {file.status === 'pending' && (
                              <span className="w-2.5 h-2.5 rounded-full bg-slate-300 animate-pulse block border border-slate-200" />
                            )}
                            {file.status === 'analyzing' && (
                              <span className="w-2.5 h-2.5 rounded-full bg-brand-primary animate-ping block" />
                            )}
                            {file.status === 'analyzed' && (
                              <span className="w-2.5 h-2.5 rounded-full bg-blue-400 block border border-blue-300" />
                            )}
                            {file.status === 'extracting' && (
                              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse block border border-amber-300" />
                            )}
                            {file.status === 'completed' && (
                              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 block border border-emerald-400" />
                            )}
                            {file.status === 'failed' && (
                              <span className="w-2.5 h-2.5 rounded-full bg-red-500 block border border-red-400" />
                            )}
                          </div>

                          <div className="min-w-0">
                            <p className={`text-[11px] font-bold truncate tracking-tight ${isSelected ? 'text-brand-primary font-semibold' : 'text-slate-700'}`}>
                              {file.name}
                            </p>
                            <p className="text-[9px] text-slate-400 font-semibold tracking-wide flex items-center space-x-1.5 mt-0.5 uppercase">
                              <span>{(file.size / 1024).toFixed(0)} KB</span>
                              {(file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) && (
                                <>
                                  <span className="text-brand-soft">•</span>
                                  <span className="text-amber-700 bg-amber-500/10 px-1.5 py-0.5 rounded font-black border border-amber-500/20">{file.pageCount || 1} Pages</span>
                                </>
                              )}
                              <span className="text-brand-soft">•</span>
                              <span className="text-brand-primary">
                                {file.status === 'pending' && 'waiting'}
                                {file.status === 'analyzing' && `detecting (${file.progress || 0}%)`}
                                {file.status === 'analyzed' && 'ready'}
                                {file.status === 'extracting' && `parsing (${file.progress || 0}%)`}
                                {file.status === 'completed' && 'compiled'}
                                {file.status === 'failed' && 'failed'}
                              </span>
                            </p>
                            {(file.status === 'analyzing' || file.status === 'extracting') && (
                              <div className="w-24 bg-slate-100 rounded-full h-1 mt-1.5 overflow-hidden">
                                <div 
                                  className="bg-brand-primary h-full rounded-full transition-all duration-300 ease-out animate-pulse"
                                  style={{ width: `${file.progress || 0}%` }}
                                />
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center space-x-1 flex-shrink-0">
                          {!inMemory && file.status !== 'completed' && (
                            <span className="text-[8px] bg-amber-50 text-amber-600 font-bold px-1.5 py-0.5 rounded border border-amber-200 uppercase tracking-wider shadow-xs">
                              Reload
                            </span>
                          )}
                          <motion.button
                            whileHover={{ scale: 1.15 }}
                            whileTap={{ scale: 0.85 }}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteFile(file.id);
                            }}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all duration-300"
                          >
                            <Trash2 className="w-3.5 h-3.5 stroke-[2]" />
                          </motion.button>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>

                {/* Integrated Upload Bar inside queue list */}
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="p-3.5 bg-brand-light/30 border-t border-slate-100 text-center cursor-pointer hover:bg-brand-light-hover/60 transition-colors duration-300"
                >
                  <span className="text-[10px] font-bold text-brand-primary uppercase tracking-[0.1em] flex items-center justify-center space-x-1.5">
                    <Plus className="w-3.5 h-3.5 stroke-[2]" />
                    <span>Add New Pages</span>
                  </span>
                </div>
              </div>

              {/* Sidebar bottom spacer */}
              <div className="mt-4" />
            </div>

            {/* ACTIVE COLUMN BUILDER (Right Column - 8 cols) */}
            <div className="lg:col-span-8">
              {selectedFile ? (
                <div className="premium-card p-6 flex flex-col h-full justify-between" id="active_workspace">
                  
                  {/* Selected Page Header Status */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4 mb-5">
                    <div>
                      <span className="text-[9px] font-bold uppercase tracking-[0.14em] text-brand-primary">Active Selection</span>
                      <h3 className="text-xs font-semibold text-slate-800 truncate max-w-md mt-0.5">
                        File: <strong className="text-brand-primary font-bold font-display text-xs">{selectedFile.name}</strong>
                      </h3>
                    </div>

                    <div className="flex items-center">
                      <button
                        onClick={() => analyzeImageHeaders(selectedFile.id)}
                        disabled={selectedFile.status === 'analyzing' || selectedFile.status === 'extracting' || !activeFileInMemory}
                        className="px-3.5 py-2 text-[10px] font-bold transition-all duration-300 disabled:opacity-40 premium-btn-white cursor-pointer rounded-xl flex items-center space-x-1.5"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 stroke-[2] ${selectedFile.status === 'analyzing' ? 'animate-spin' : ''}`} />
                        <span>Re-detect Columns</span>
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-12 gap-6 flex-1">
                    
                    {/* Visual Preview panel */}
                    <div className="md:col-span-4 bg-slate-50/50 border border-slate-100 rounded-2xl p-4 flex flex-col items-center justify-center min-h-[180px] max-h-[280px] overflow-hidden shadow-xs">
                      {selectedFile.type === 'application/pdf' || selectedFile.name.toLowerCase().endsWith('.pdf') ? (
                        <div className="text-center p-6 flex flex-col items-center justify-center space-y-3 bg-red-50/20 border border-red-100/40 rounded-xl w-full h-full max-h-[240px]">
                          <div className="bg-red-500 text-white p-3 rounded-xl shadow-md">
                            <FileText className="w-6 h-6 stroke-[2]" />
                          </div>
                          <p className="text-[10px] font-bold text-slate-700 truncate max-w-[140px]" title={selectedFile.name}>{selectedFile.name}</p>
                          <span className="text-[8px] bg-red-50 text-red-500 font-bold px-1.5 py-0.5 rounded border border-red-100 uppercase tracking-wider">PDF Document</span>
                        </div>
                      ) : selectedFile.preview && selectedFile.preview !== 'PERSISTED_IN_MEMORY' ? (
                        <img
                          src={selectedFile.preview}
                          alt="Workspace preview"
                          className="max-h-[240px] max-w-full object-contain rounded-xl border border-slate-150 shadow-[0_4px_12px_rgba(59,94,148,0.08)] hover:scale-105 transition-transform duration-500 ease-out"
                        />
                      ) : (
                        <div className="text-center p-3">
                          <ImageIcon className="w-7 h-7 mx-auto text-brand-primary mb-2 opacity-50" />
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Preview Cached</p>
                        </div>
                      )}
                    </div>

                    {/* Checkbox columns selectors */}
                    <div className="md:col-span-8 flex flex-col justify-between space-y-5">
                      
                      <div className="space-y-4">
                        {/* Upper Table title */}
                        <div className="p-3.5 bg-brand-light/10 border border-brand-soft/60 rounded-xl flex items-center justify-between">
                          <div>
                            <span className="text-[8px] text-brand-primary font-bold uppercase tracking-[0.14em] block">Detected Upper Table Title</span>
                            <span className="text-xs font-semibold text-slate-800 mt-0.5 inline-block font-display">
                              {selectedFile.documentTitle || (selectedFile.status === 'analyzing' ? 'Discovering...' : 'Untitled Upper Table')}
                            </span>
                          </div>
                        </div>

                        {selectedFile.error && (
                          <div className="p-3.5 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex flex-col space-y-1">
                            <span className="font-bold text-[10px] uppercase tracking-wide text-red-800">Extraction / Detection Error</span>
                            <p className="font-medium text-[11px] leading-relaxed">{selectedFile.error}</p>
                            {(selectedFile.error.toLowerCase().includes('quota') || selectedFile.error.toLowerCase().includes('429') || selectedFile.error.toLowerCase().includes('exhausted') || selectedFile.error.toLowerCase().includes('limit')) ? (
                              <p className="text-[10px] text-red-600 mt-1.5 font-semibold">
                                Tip: The free AI Operations daily rate limit (20 requests/day) has been reached. We have implemented an automatic fallback processing engine, but if both are fully exhausted, please wait a short period or try again later.
                              </p>
                            ) : null}
                          </div>
                        )}

                        {/* Available columns checkbox matrix */}
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <label className="block text-[10px] font-bold uppercase tracking-[0.12em] text-brand-primary">
                              Columns to Extract:
                            </label>
                            <div className="flex space-x-2 text-[10px] font-bold">
                              <button
                                onClick={() => handleSelectAllHeadings(selectedFile.id, true)}
                                className="text-brand-primary hover:underline cursor-pointer"
                              >
                                Select All
                              </button>
                              <span className="text-slate-300">|</span>
                              <button
                                onClick={() => handleSelectAllHeadings(selectedFile.id, false)}
                                className="text-slate-500 hover:underline cursor-pointer"
                              >
                                Deselect All
                              </button>
                            </div>
                          </div>

                          {selectedFile.status === 'analyzing' ? (
                            <div className="py-8 text-center border border-brand-soft/40 bg-brand-light/20 rounded-2xl space-y-2">
                              <RefreshCw className="w-5 h-5 animate-spin mx-auto text-brand-primary" />
                              <p className="text-[10px] text-brand-primary font-bold uppercase tracking-wider">Cloud AI scanning page structure...</p>
                            </div>
                          ) : (selectedFile.detectedHeadings || []).length === 0 ? (
                            <div className="py-8 text-center border border-dashed border-slate-200 rounded-2xl text-slate-400 text-[10px] font-medium bg-slate-50/50">
                              No columns detected yet. Add custom column labels below.
                            </div>
                          ) : (
                            <div className="grid grid-cols-2 gap-2 max-h-[110px] overflow-y-auto pr-1">
                              {(selectedFile.detectedHeadings || []).map(heading => {
                                const isChecked = (selectedFile.selectedHeadings || []).includes(heading);
                                return (
                                  <motion.div
                                    key={heading}
                                    onClick={() => handleToggleHeading(selectedFile.id, heading)}
                                    whileHover={{ scale: 1.01 }}
                                    whileTap={{ scale: 0.98 }}
                                    className={`p-2.5 rounded-xl border text-[11px] font-bold cursor-pointer transition-all duration-300 ease-out flex items-center justify-between space-x-2 ${
                                      isChecked
                                        ? 'bg-brand-primary border-brand-primary text-white shadow-[0_4px_12px_rgba(37,99,235,0.15)]'
                                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                                    }`}
                                  >
                                    <span className="truncate tracking-tight">{heading}</span>
                                    <span className={`w-4 h-4 rounded-md border flex items-center justify-center flex-shrink-0 ${
                                      isChecked ? 'border-white bg-white text-brand-primary' : 'border-slate-300 bg-white'
                                    }`}>
                                      {isChecked && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                                    </span>
                                  </motion.div>
                                );
                              })}
                            </div>
                          )}
                        </div>

                        {/* Add Custom Title Column */}
                        <div className="space-y-1.5">
                          <label className="block text-[9px] font-bold uppercase tracking-[0.12em] text-brand-primary">
                            Add custom manual column:
                          </label>
                          <div className="flex space-x-2">
                            <input
                              type="text"
                              placeholder="e.g. Total, Amount, Address"
                              value={customHeadingInput}
                              onChange={(e) => setCustomHeadingInput(e.target.value)}
                              className="flex-1 px-3.5 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-primary text-slate-700 font-medium placeholder:text-slate-400"
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleAddCustomHeading(selectedFile.id);
                              }}
                            />
                            {/* Curved satisfying input button */}
                            <button
                              onClick={() => handleAddCustomHeading(selectedFile.id)}
                              className="px-4 rounded-xl text-xs font-bold tracking-wide flex items-center space-x-1.5 cursor-pointer premium-btn-blue"
                            >
                              <Plus className="w-3.5 h-3.5 stroke-[2]" />
                              <span>Add</span>
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* WORKSPACE ACTIONS ROW */}
                      <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                        
                        {/* Dynamic primary trigger */}
                        <button
                          onClick={() => extractSelectedData(selectedFile.id)}
                          disabled={selectedFile.status === 'extracting' || (selectedFile.selectedHeadings || []).length === 0 || !activeFileInMemory}
                          className={`flex-1 py-3 px-5 font-bold text-xs rounded-xl flex items-center justify-center space-x-2 cursor-pointer transition-all duration-300 ${
                            selectedFile.status === 'extracting' || (selectedFile.selectedHeadings || []).length === 0 || !activeFileInMemory
                              ? 'bg-slate-100 text-slate-400 cursor-not-allowed shadow-none border border-slate-200/50'
                              : 'premium-btn-blue'
                          }`}
                        >
                          {selectedFile.status === 'extracting' ? (
                            <>
                              <RefreshCw className="w-4 h-4 animate-spin" />
                              <span>Extracting Page Data...</span>
                            </>
                          ) : (
                            <>
                              <Play className="w-4 h-4 fill-current text-white/90" />
                              <span className="tracking-wide">Extract Selected Rows</span>
                            </>
                          )}
                        </button>

                        {/* Batch triggers */}
                        <button
                          onClick={() => setIsBatchExtracting(true)}
                          disabled={isBatchExtracting || files.filter(f => f.status === 'analyzed').length === 0}
                          className={`py-3 px-5 font-bold text-xs rounded-xl flex items-center justify-center space-x-2 cursor-pointer transition-all duration-300 ${
                            isBatchExtracting || files.filter(f => f.status === 'analyzed').length === 0
                              ? 'bg-slate-100 text-slate-400 cursor-not-allowed shadow-none border border-slate-200/50'
                              : 'premium-btn-white text-brand-primary border-brand-soft hover:bg-brand-light/30'
                          }`}
                        >
                          {isBatchExtracting ? (
                            <>
                              <RefreshCw className="w-4 h-4 animate-spin text-brand-primary" />
                              <span>Processing batch...</span>
                            </>
                          ) : (
                            <>
                              <Sparkles className="w-4 h-4 text-brand-accent" />
                              <span className="tracking-wide">Extract All ({files.filter(f => f.status === 'analyzed').length})</span>
                            </>
                          )}
                        </button>
                      </div>

                    </div>

                  </div>

                </div>
              ) : (
                <div className="bg-white border border-brand-soft/40 rounded-2xl p-12 text-center text-brand-text-muted h-full flex flex-col items-center justify-center min-h-[240px] shadow-[0_4px_24px_rgba(59,94,148,0.03)]">
                  <ImageIcon className="w-10 h-10 text-brand-soft mb-3" />
                  <p className="text-xs font-bold text-brand-text">Please select a page from the left queue to get started.</p>
                </div>
              )}
            </div>

          </div>

          {/* DYNAMIC INTERACTIVE EXCEL SPREADSHEET (Bottom Panel) */}
          <div className="premium-card overflow-hidden" id="excel_grid">
            
            {/* Spreadsheet header */}
            <div className="p-5 border-b border-slate-100 bg-brand-light/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h2 className="font-display font-bold text-brand-primary text-xs tracking-[0.08em] uppercase flex items-center space-x-2">
                  <Database className="w-4.5 h-4.5 text-brand-accent" />
                  <span>Interactive Live Spreadsheet</span>
                </h2>
                
                {/* Clean TOP STATUS BAR */}
                <div className="flex items-center space-x-3 mt-1.5">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.15em]">Parsing Progress:</span>
                  <div className="flex items-center space-x-3 text-[10px] font-semibold text-slate-500">
                    <span className="flex items-center space-x-1.5">
                      <span className="w-2 h-2 rounded-full bg-slate-300 block" />
                      <span>Total: {statsTotal}</span>
                    </span>
                    <span className="flex items-center space-x-1.5">
                      <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse block" />
                      <span>Pending: {statsPending}</span>
                    </span>
                    {statsExtracting > 0 && (
                      <span className="flex items-center space-x-1.5">
                        <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping block" />
                        <span>Processing: {statsExtracting}</span>
                      </span>
                    )}
                    <span className="flex items-center space-x-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 block" />
                      <span>Completed: {statsCompleted}</span>
                    </span>
                  </div>
                </div>
              </div>

              {/* Excel Action Button */}
              <button
                onClick={handleExportToExcel}
                disabled={files.filter(f => f.status === 'completed').length === 0}
                className={`px-4.5 py-2.5 font-bold text-xs rounded-xl flex items-center space-x-2 cursor-pointer transition-all duration-300 ${
                  files.filter(f => f.status === 'completed').length === 0
                    ? 'bg-slate-100 text-slate-400 border border-slate-200/50 cursor-not-allowed shadow-none'
                    : 'premium-btn-emerald'
                }`}
                id="export_excel_btn"
              >
                <Download className="w-4 h-4 stroke-[2]" />
                <span className="tracking-wide">Export to Excel (CSV)</span>
              </button>
            </div>

            {/* Pristine spreadsheet container */}
            <div className="overflow-x-auto max-h-[340px] overflow-y-auto">
              {files.filter(f => f.status === 'completed').length === 0 ? (
                <div className="py-16 text-center text-slate-400 flex flex-col items-center justify-center bg-white">
                  <div className="bg-brand-light/60 p-4.5 rounded-full mb-3 animate-pulse text-brand-primary">
                    <FileSpreadsheet className="w-8 h-8 stroke-[1.5]" />
                  </div>
                  <p className="font-bold text-xs text-slate-700 uppercase tracking-wider">Spreadsheet is empty</p>
                  <p className="text-[10px] text-slate-400 mt-1.5 max-w-xs leading-relaxed font-medium">Configure columns and extract data from pages above to build your combined spreadsheet.</p>
                </div>
              ) : (
                <table className="w-full text-left border-collapse text-xs min-w-[700px]">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100 text-[10px]">
                      {/* ONLY SHOW SELECTED TABLE COLUMNS */}
                      {dynamicColumns.map((col, index) => (
                        <th
                          key={col}
                          className={`py-3 px-5 text-slate-600 font-semibold uppercase tracking-[0.08em] ${
                            index > 0 ? 'border-l border-slate-100' : ''
                          }`}
                        >
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {files
                      .filter(f => f.status === 'completed' && f.extractedRows && f.extractedRows.length > 0)
                      .flatMap(file => {
                        return file.extractedRows!.map((rowData, rowIndex) => {
                          const rowKey = `${file.id}_row_${rowIndex}`;
                          return (
                            <motion.tr
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              transition={{ duration: 0.5 }}
                              key={rowKey}
                              className={`transition-colors duration-300 ${
                                selectedFileId === file.id ? 'bg-brand-light/10' : 'hover:bg-slate-50/60'
                              }`}
                            >
                              {/* ONLY DISPLAY THE CHOSEN DYNAMIC VALUES */}
                              {dynamicColumns.map((col, colIndex) => {
                                const val = rowData[col];
                                return (
                                  <td
                                    key={col}
                                    className={`py-1.5 px-3 ${colIndex > 0 ? 'border-l border-slate-100' : ''}`}
                                  >
                                    <div className="relative group/cell flex items-center">
                                      <input
                                        type="text"
                                        value={val || ''}
                                        onChange={(e) => handleCellValueChange(file.id, rowIndex, col, e.target.value)}
                                        className="w-full px-2 py-1.5 text-xs bg-transparent hover:bg-slate-50 focus:bg-white border-none rounded-lg focus:ring-2 focus:ring-brand-primary/20 font-medium text-slate-800 transition-all duration-300"
                                        placeholder="-"
                                      />
                                      <Edit2 className="w-3 h-3 text-brand-accent absolute right-2 opacity-0 group-hover/cell:opacity-100 pointer-events-none transition-opacity duration-300" />
                                    </div>
                                  </td>
                                );
                              })}
                            </motion.tr>
                          );
                        });
                      })}
                  </tbody>
                </table>
              )}
            </div>

          </div>

        </main>
      )}

      {/* STYLISH DYNAMIC CREDITS RECHARGE & PURCHASE MODAL */}
      <AnimatePresence>
        {showPurchaseModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Dark glass backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setShowPurchaseModal(false);
                setSubmittedInvoice(null);
              }}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />

            {/* Modal Body Card */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ type: 'spring', duration: 0.5 }}
              className="bg-white rounded-3xl shadow-[0_24px_64px_rgba(15,23,42,0.18)] border border-slate-100 w-full max-w-3xl overflow-hidden relative z-10 flex flex-col md:flex-row max-h-[92vh] md:max-h-none overflow-y-auto md:overflow-visible"
            >
              {/* Left Column (Brand info and current status) */}
              <div className="bg-slate-950 p-6 md:p-8 text-white flex flex-col justify-between md:w-5/12">
                <div className="space-y-6">
                  <div className="flex items-center space-x-2.5">
                    <div className="bg-amber-500 text-slate-950 p-2 rounded-xl">
                      <Coins className="w-5 h-5 stroke-[2]" />
                    </div>
                    <div>
                      <h3 className="text-xs font-black tracking-widest text-amber-400 uppercase">GridFlow Store</h3>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wide">Credits & Billing</p>
                    </div>
                  </div>

                  <div className="space-y-3.5 pt-4">
                    <div className="space-y-0.5">
                      <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Your Balance</span>
                      <p className="text-3xl font-black text-amber-400 font-mono">
                        {credits} <span className="text-xs text-white font-normal uppercase">Credits</span>
                      </p>
                    </div>

                    <div className="space-y-2 text-[10px] text-slate-300 font-medium leading-relaxed bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800/40">
                      <p className="flex items-center justify-between text-slate-400">
                        <span>Rate / दर:</span>
                        <strong className="text-white">₹0.50 / Credit</strong>
                      </p>
                      <p className="flex items-center justify-between text-slate-400">
                        <span>1 Credit:</span>
                        <strong className="text-white">1 Page Extract</strong>
                      </p>
                      <p className="flex items-center justify-between text-slate-400">
                        <span>Total Extracted:</span>
                        <strong className="text-white">{totalExtractedPages} pages</strong>
                      </p>
                    </div>
                  </div>
                </div>

                <div className="pt-8 space-y-2">
                  <div className="flex items-center space-x-2 text-[9px] text-amber-400/80 font-bold tracking-wider uppercase">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span>Instant Credit System</span>
                  </div>
                  <p className="text-[9px] text-slate-400 leading-relaxed">
                    Make secure payment via UPI QR. Enter exactly how many credits you need and the QR code will automatically load the exact money!
                  </p>
                </div>
              </div>

              {/* Right Column (Interactive Purchase Options or Invoice Display) */}
              <div className="p-6 md:p-8 flex-1 bg-slate-50 flex flex-col justify-between max-h-[80vh] md:max-h-[550px] overflow-y-auto">
                {/* Modal Close Button */}
                <button
                  onClick={() => {
                    setShowPurchaseModal(false);
                    setSubmittedInvoice(null);
                    setIsAdminUnlocked(false);
                    setEnteredPin('');
                  }}
                  className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-all cursor-pointer z-20"
                >
                  <X className="w-4 h-4" />
                </button>

                {submittedInvoice ? (
                  /* INVOICE BILL DISPLAY (SO CLIENT CAN COPY & SEND TO HARSH) */
                  <div className="space-y-5">
                    <div className="text-center pb-2 border-b border-slate-200">
                      <div className="inline-flex items-center justify-center bg-emerald-100 text-emerald-800 p-2.5 rounded-full mb-2">
                        <Check className="w-5 h-5 stroke-[2.5]" />
                      </div>
                      <h4 className="text-sm font-bold text-slate-800">Payment Bill Submitted!</h4>
                      <p className="text-[10px] text-slate-500 font-medium">Please share this invoice bill with Harsh to activate credits</p>
                    </div>

                    <div className="bg-white rounded-2xl p-4.5 border border-slate-200/80 shadow-xs space-y-3 font-medium text-[11px] text-slate-700">
                      <div className="flex justify-between items-center text-[10px] text-slate-400 uppercase tracking-wider pb-1 border-b border-slate-100">
                        <span>Invoice / बिल रसीद</span>
                        <span className="font-mono text-slate-800 font-bold">{submittedInvoice.invoiceId}</span>
                      </div>

                      <div className="flex justify-between">
                        <span className="text-slate-500">Requested Credits:</span>
                        <strong className="text-slate-900 font-mono text-xs">{submittedInvoice.credits} Credits</strong>
                      </div>

                      <div className="flex justify-between">
                        <span className="text-slate-500">Amount Paid (राशि):</span>
                        <strong className="text-brand-primary text-xs font-mono">₹{submittedInvoice.amount}</strong>
                      </div>

                      <div className="flex justify-between">
                        <span className="text-slate-500">UPI Ref / UTR No:</span>
                        <span className="text-slate-900 font-mono font-bold select-all bg-slate-100 px-1.5 py-0.5 rounded">{submittedInvoice.utr}</span>
                      </div>

                      <div className="flex justify-between">
                        <span className="text-slate-500">Recipient UPI ID:</span>
                        <span className="text-slate-900 font-mono">{submittedInvoice.recipient}</span>
                      </div>

                      <div className="flex justify-between">
                        <span className="text-slate-500">Date & Time:</span>
                        <span className="text-slate-900">{submittedInvoice.date}</span>
                      </div>

                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-amber-600 bg-amber-500/5 p-2 rounded-lg border border-amber-500/10">
                        <span className="font-bold flex items-center space-x-1">
                          <Clock className="w-3 h-3 animate-spin" />
                          <span>STATUS: PENDING VERIFICATION</span>
                        </span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <button
                        onClick={() => {
                          const billText = `🇮🇳 *GRIDFLOW AI DOCUMENT EXtractor - BILL INVOICE* 🇮🇳\n` +
                                           `------------------------------------\n` +
                                           `🧾 *Invoice ID*: ${submittedInvoice.invoiceId}\n` +
                                           `📅 *Date*: ${submittedInvoice.date}\n` +
                                           `💎 *Requested Credits*: ${submittedInvoice.credits} Credits\n` +
                                           `💰 *Total Amount*: ₹${submittedInvoice.amount}\n` +
                                           `🔗 *UPI Ref / UTR No*: ${submittedInvoice.utr}\n` +
                                           `👤 *Recipient*: ${submittedInvoice.recipient}\n` +
                                           `🔴 *Status*: PENDING ADMIN APPROVAL\n` +
                                           `------------------------------------\n` +
                                           `Hi Harsh, I have paid ₹${submittedInvoice.amount} for ${submittedInvoice.credits} credits. Please check your bank and activate my credits. Thanks!`;
                          navigator.clipboard.writeText(billText);
                          showNotification('Invoice Copied! Send it to Harsh now.', 'success');
                        }}
                        className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[10px] font-bold tracking-wider uppercase flex items-center justify-center space-x-1.5 transition-all cursor-pointer shadow-sm hover:shadow"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy Invoice & Send to Harsh (WhatsApp)</span>
                      </button>

                      <button
                        onClick={() => setSubmittedInvoice(null)}
                        className="w-full py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-[10px] font-bold tracking-wider uppercase transition-all cursor-pointer"
                      >
                        Back to Recharge Store
                      </button>
                    </div>
                  </div>
                ) : (
                  /* CLIENT PAYMENT TAB WITH SIMPLIFIED INTERACTIVE DUAL WORKFLOW */
                  <div className="space-y-4 animate-fadeIn">
                    {isPaymentSuccess ? (
                      /* CELEBRATION / SUCCESS CARD */
                      <div className="text-center py-8 space-y-4 animate-fadeIn bg-emerald-50/50 rounded-2xl p-6 border border-emerald-100">
                        <div className="inline-flex items-center justify-center bg-emerald-500 text-white p-4.5 rounded-full shadow-[0_8px_20px_rgba(16,185,129,0.3)] animate-bounce">
                          <Check className="w-8 h-8 stroke-[3]" />
                        </div>
                        <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">भुगतान सफल / Payment Successful!</h3>
                        <p className="text-xs text-slate-600 font-bold px-4 leading-relaxed">
                          सफलतापूर्वक <strong className="text-emerald-600 text-sm font-black font-mono">{rechargeCreditsInput} क्रेडिट्स</strong> आपके खाते में जोड़ दिए गए हैं।
                        </p>
                        <div className="bg-white px-4 py-2 rounded-xl border border-slate-200 inline-block font-mono text-xs shadow-xs">
                          New Balance: <strong className="text-brand-primary font-black text-sm">{credits} Credits</strong>
                        </div>
                        <div className="pt-2">
                          <button
                            onClick={() => {
                              setIsPaymentSuccess(false);
                              setShowPaymentQR(false);
                              setAdminPasswordInput('');
                              setShowPurchaseModal(false);
                            }}
                            className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[10px] font-bold uppercase tracking-wider cursor-pointer transition-all shadow-md hover:shadow-lg"
                          >
                            Done / ठीक है
                          </button>
                        </div>
                      </div>
                    ) : showPaymentQR ? (
                      /* ACTIVE QR CODE AND ADMIN PASSWORD ACTIVATION VIEW */
                      <div className="space-y-4 animate-fadeIn">
                        <div className="flex items-center justify-between">
                          <button
                            type="button"
                            onClick={() => setShowPaymentQR(false)}
                            className="text-[10px] font-bold text-slate-500 hover:text-slate-800 flex items-center space-x-1 cursor-pointer"
                          >
                            <span>← Back / पीछे जाएँ</span>
                          </button>
                          <span className="text-[10px] bg-amber-500/10 text-amber-700 font-bold px-2.5 py-0.5 rounded-full border border-amber-500/20">
                            {rechargeCreditsInput} Credits = ₹{rechargeAmount}
                          </span>
                        </div>

                        {/* UPI QR Code Container */}
                        <div className="bg-white rounded-2xl p-4.5 border border-slate-200/80 flex flex-col items-center text-center space-y-3 shadow-xs">
                          <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 shadow-xs relative">
                            <img
                              src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&margin=4&data=${encodeURIComponent(
                                `upi://pay?pa=harshjeliya1-3@oksbi&pn=Harsh%2520Jeliya&am=${rechargeAmount}&cu=INR&tn=GridFlow%2520AI%2520Credits`
                              )}`}
                              alt="UPI Scan Code"
                              referrerPolicy="no-referrer"
                              className="w-36 h-36 object-contain"
                            />
                          </div>
                          <div className="space-y-1">
                            <p className="text-[10px] text-slate-800 font-black uppercase tracking-tight">
                              Pay: <strong className="text-brand-primary text-xs font-black font-mono">₹{rechargeAmount}</strong>
                            </p>
                            <p className="text-[9px] text-slate-400 font-semibold tracking-wide flex items-center justify-center space-x-1">
                              <span className="bg-slate-100 font-mono text-slate-800 px-2 py-0.5 rounded select-all font-bold">harshjeliya1-3@oksbi</span>
                            </p>
                          </div>
                          <p className="text-[9px] text-slate-500 max-w-xs leading-relaxed font-medium">
                            Scan using PhonePe, Paytm, GooglePay, BHIM. Exact amount <strong className="text-slate-700 font-mono">₹{rechargeAmount}</strong> will prefill automatically!
                          </p>
                        </div>

                        {/* ADMIN PASSWORD / PIN ACTIVATION CARD */}
                        <div className="bg-slate-50 p-4 border border-slate-200 rounded-2xl space-y-3">
                          <div className="flex items-center space-x-1.5 text-[9px] font-bold uppercase tracking-wider text-rose-600">
                            <span>🔒 Admin Instant Activation / क्रेडिट चालू करें</span>
                          </div>
                          <p className="text-[9px] text-slate-400 font-medium">
                            payment होने के बाद हर्ष (Admin) अपना पासवर्ड <strong className="font-mono text-slate-700 font-black">Harsh4075</strong> डालकर यहाँ से तुरंत क्रेडिट चालू कर सकते हैं।
                          </p>
                          <div className="flex space-x-2">
                            <input
                              type="password"
                              placeholder="Enter Admin Password (Harsh4075) / पासवर्ड"
                              value={adminPasswordInput}
                              onChange={(e) => setAdminPasswordInput(e.target.value)}
                              className="flex-1 px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl text-slate-800 font-mono tracking-widest focus:outline-none focus:border-brand-primary placeholder:text-slate-400 placeholder:tracking-normal"
                            />
                            <button
                              id="instant_activate_btn"
                              onClick={async () => {
                                if (adminPasswordInput !== adminPin) {
                                  showNotification('गलत पासवर्ड! कृपया एडमिन पासवर्ड सही दर्ज करें।', 'error');
                                  return;
                                }

                                const credToAdd = parseInt(rechargeCreditsInput, 10);
                                if (isNaN(credToAdd) || credToAdd <= 0) {
                                  showNotification('मान्य क्रेडिट संख्या दर्ज करें।', 'error');
                                  return;
                                }

                                // Instantly credit wallet balance
                                setCredits(prev => {
                                  const next = prev + credToAdd;
                                  localStorage.setItem('ocr_credits', next.toString());
                                  return next;
                                });

                                // Play successful activation alert
                                setIsPaymentSuccess(true);
                                showNotification(`Instant success! Loaded ${credToAdd} Credits into wallet.`, 'success');

                                // Log to sheets in background for audit trail
                                try {
                                  const invoiceId = 'INSTANT-' + Math.floor(100000 + Math.random() * 900000);
                                  const dateStr = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
                                  await fetch('/api/submit-transaction', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                      webhookUrl: sheetWebhookUrl,
                                      invoiceId,
                                      date: dateStr,
                                      credits: credToAdd,
                                      amount: parseFloat(rechargeAmount),
                                      utr: 'Instant Code Override',
                                      recipient: 'harshjeliya1-3@oksbi (Harsh Jeliya)'
                                    })
                                  });
                                } catch (err) {
                                  console.warn('Sheets transaction log skipped:', err);
                                }
                              }}
                              className="px-4 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer shadow-sm hover:shadow"
                            >
                              Activate Credits
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      /* ENTER CREDITS STEP */
                      <div className="space-y-4 animate-fadeIn">
                        <div className="bg-slate-50 p-4 border border-slate-150 rounded-2xl">
                          <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide mb-1 flex items-center space-x-1.5">
                            <Wallet className="w-4 h-4 text-brand-primary" />
                            <span>Buy Credits / क्रेडिट्स खरीदें</span>
                          </h4>
                          <p className="text-[10px] text-slate-500 leading-relaxed font-medium">
                            कृपया वह क्रेडिट संख्या दर्ज करें जिसे आप खरीदना चाहते हैं। राशि की गणना ₹0.50 प्रति क्रेडिट के हिसाब से तुरंत की जाएगी।
                          </p>
                        </div>

                        {/* CREDITS INPUT AND PREVIEW */}
                        <div className="space-y-3">
                          <div>
                            <label className="block text-[9px] text-slate-550 font-bold uppercase tracking-wider mb-1.5">Credits Required (कितने क्रेडिट चाहिए)</label>
                            <input
                              type="number"
                              min="1"
                              placeholder="e.g. 100"
                              value={rechargeCreditsInput}
                              onChange={(e) => handleCreditsChange(e.target.value)}
                              className="w-full px-3.5 py-2.5 text-xs bg-white border border-slate-200 rounded-xl text-slate-800 font-black focus:outline-none focus:border-brand-primary placeholder:text-slate-400 placeholder:font-normal"
                            />
                          </div>

                          <div className="bg-brand-light/40 border border-brand-soft rounded-2xl p-4 flex items-center justify-between">
                            <div>
                              <span className="text-[8px] text-brand-primary font-black uppercase tracking-wider">Total Amount to Pay</span>
                              <p className="text-xl font-black text-slate-800 mt-0.5 font-mono">₹{rechargeAmount || '0.00'}</p>
                            </div>
                            <div className="text-right text-[9px] text-slate-400 font-bold">
                              <span>Rate: ₹0.50 / credit</span>
                            </div>
                          </div>

                          {/* Popular Credit Pack quick-clicks */}
                          <div className="space-y-1">
                            <span className="text-[8px] text-slate-400 font-bold uppercase tracking-wider">Quick Packs (पैक चुनें):</span>
                            <div className="grid grid-cols-3 gap-2">
                              {[
                                { creds: '40', amt: '20.00' },
                                { creds: '100', amt: '50.00' },
                                { creds: '200', amt: '100.00' }
                              ].map(pkg => (
                                <button
                                  key={pkg.creds}
                                  type="button"
                                  onClick={() => {
                                    setRechargeCreditsInput(pkg.creds);
                                    setRechargeAmount(pkg.amt);
                                  }}
                                  className={`p-2 rounded-xl border text-center transition-all text-[10px] font-bold cursor-pointer ${
                                    rechargeCreditsInput === pkg.creds
                                      ? 'bg-brand-light border-brand-primary text-brand-primary'
                                      : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'
                                  }`}
                                >
                                  {pkg.creds} Credits (₹{Math.round(parseFloat(pkg.amt))})
                                </button>
                              ))}
                            </div>
                          </div>

                          <button
                            type="button"
                            disabled={!rechargeCreditsInput || parseInt(rechargeCreditsInput, 10) <= 0}
                            onClick={() => setShowPaymentQR(true)}
                            className="w-full py-3 bg-brand-primary hover:bg-brand-primary-hover disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white rounded-xl text-[10px] font-extrabold uppercase tracking-wider transition-all cursor-pointer shadow-md hover:shadow-lg flex items-center justify-center space-x-1.5"
                          >
                            <span>Buy Credits / QR कोड दिखाएं (₹{rechargeAmount})</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
