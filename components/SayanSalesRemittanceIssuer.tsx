import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { 
  Barcode, 
  Package, 
  Warehouse, 
  User, 
  Calendar, 
  Trash2, 
  Plus, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Printer, 
  Send, 
  Search, 
  Sparkles, 
  ArrowRight, 
  Volume2, 
  VolumeX, 
  History, 
  FileText, 
  Layers, 
  Scale, 
  Boxes, 
  ExternalLink,
  ChevronDown,
  X,
  Copy,
  Check,
  Building2,
  RefreshCw,
  Truck,
  TrendingUp,
  Clock,
  Filter,
  ArrowUpRight
} from 'lucide-react';
import * as jalaali from 'jalaali-js';
import { apiCall } from '../services/apiService';
import { openSendToChat } from '../services/chatShareService';

interface WarehouseItem {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
}

export interface LiveWarehouseStat {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
  fiscalYear: string;
  docsCount: number;
  itemsCount: number;
  totalQty: number;
  salesRemittancesCount: number;
}

export interface WarehouseRecentDoc {
  docId: string;
  fiscalYear: string;
  docNo: string;
  subNo: string;
  subCode: string;
  docDate: string;
  opCode: string;
  opName: string;
  customerCode: string;
  customerName: string;
  warehouseCode: string;
  warehouseName: string;
  itemsCount: number;
  description: string;
}

interface FiscalYearItem {
  code: string;
  title: string;
  isDefault: boolean;
}

interface CustomerItem {
  tafsiliCode: string;
  personCode: string;
  name: string;
  levelCode: string;
}

interface GoodsItem {
  code: string;
  name: string;
  groupCode?: string;
}

export interface RemittanceItemRow {
  id: string;
  barcode: string;
  batch: string;
  itemCode: string;
  itemName: string;
  netWeight: number;
  grossWeight: number;
  cartonCount: number;
  bobbinCount: number;
  grade: string;
  twistDirection: string;
  rawGrade: string;
  rawTwist: string;
  note: string;
}

export interface ArchiveRecord {
  id: string;
  sayanDocId: string;
  docNo: string;
  subNo: string;
  opCode?: string;
  opName?: string;
  fiscalYear: string;
  warehouseCode: string;
  warehouseName?: string;
  customerCode: string;
  customerName: string;
  remittanceDate: string;
  shamsiDate: string;
  notes: string;
  subCode: string;
  itemsCount: number;
  totalNetWeight: number;
  totalCartons: number;
  totalBobbins: number;
  items: RemittanceItemRow[];
  createdBy: string;
  createdAt: string;
  status: string;
}

interface SayanSalesRemittanceIssuerProps {
  currentUser?: any;
  settings?: any;
  initialSubTab?: 'issuer' | 'archive' | 'warehouses';
  initialWarehouseCode?: string;
  onSuccessRegistered?: (docNo: string, archiveRecord?: any) => void;
  onClose?: () => void;
}

// Simple Web Audio API Synthesizer for instant audible scan feedback (no external files)
const playBeepSound = (type: 'success' | 'error' = 'success') => {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'success') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1400, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1900, ctx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.12);
    } else {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(400, ctx.currentTime);
      osc.frequency.setValueAtTime(300, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.25);
    }
  } catch (e) {
    // Ignore audio errors if blocked by browser policy
  }
};

const getTodayShamsi = () => {
  const d = new Date();
  const j = jalaali.toJalaali(d.getFullYear(), d.getMonth() + 1, d.getDate());
  return `${j.jy}/${String(j.jm).padStart(2, '0')}/${String(j.jd).padStart(2, '0')}`;
};

export const SayanSalesRemittanceIssuer: React.FC<SayanSalesRemittanceIssuerProps> = ({
  currentUser,
  settings,
  initialSubTab = 'issuer',
  initialWarehouseCode = '15',
  onSuccessRegistered,
  onClose
}) => {
  // Navigation / View State
  const [activeSubTab, setActiveSubTab] = useState<'issuer' | 'archive' | 'warehouses'>(initialSubTab);

  // Form Headers
  const [warehouses, setWarehouses] = useState<WarehouseItem[]>([]);
  const [fiscalYears, setFiscalYears] = useState<FiscalYearItem[]>([]);
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>(initialWarehouseCode || '15'); // Default Tehran Store
  const [selectedFiscalYear, setSelectedFiscalYear] = useState<string>('4'); // Default 1404
  const [remittanceDate, setRemittanceDate] = useState<string>(getTodayShamsi());
  const [subCode, setSubCode] = useState<string>('');
  const [headerNotes, setHeaderNotes] = useState<string>('');
  const [operationType, setOperationType] = useState<'23' | '25'>('23');
  const [archiveOpFilter, setArchiveOpFilter] = useState<string>('all');

  // Live Warehouses Stats & Recent Documents
  const [warehouseStats, setWarehouseStats] = useState<LiveWarehouseStat[]>([]);
  const [isLoadingStats, setIsLoadingStats] = useState<boolean>(false);
  const [selectedStatWarehouse, setSelectedStatWarehouse] = useState<string>(initialWarehouseCode || '15');
  const [recentDocs, setRecentDocs] = useState<WarehouseRecentDoc[]>([]);
  const [isLoadingRecentDocs, setIsLoadingRecentDocs] = useState<boolean>(false);
  const [docsSearchQuery, setDocsSearchQuery] = useState<string>('');
  const [docsOpFilter, setDocsOpFilter] = useState<string>('all');

  // Customer Autocomplete
  const [customerSearch, setCustomerSearch] = useState<string>('');
  const [customersList, setCustomersList] = useState<CustomerItem[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerItem | null>(null);
  const [isCustomerDropdownOpen, setIsCustomerDropdownOpen] = useState<boolean>(false);
  const [isSearchingCustomer, setIsSearchingCustomer] = useState<boolean>(false);

  // Active Goods for quick manual picking
  const [goodsList, setGoodsList] = useState<GoodsItem[]>([]);
  const [activeItemCode, setActiveItemCode] = useState<string>('0402010105');
  const [activeItemName, setActiveItemName] = useState<string>('کش 110S سفید بشقابی');

  // Barcode Scanner Station
  const [scannedBarcode, setScannedBarcode] = useState<string>('');
  const [isContinuousScan, setIsContinuousScan] = useState<boolean>(true);
  const [isSoundEnabled, setIsSoundEnabled] = useState<boolean>(true);
  const [isResolvingBarcode, setIsResolvingBarcode] = useState<boolean>(false);
  const [lastScanResult, setLastScanResult] = useState<{ text: string; success: boolean; item?: any } | null>(null);

  // Items List
  const [items, setItems] = useState<RemittanceItemRow[]>([]);

  // Submission & Dialogs
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successResult, setSuccessResult] = useState<any | null>(null);
  const [printModalRecord, setPrintModalRecord] = useState<any | null>(null);

  // Local Archive State
  const [archiveList, setArchiveList] = useState<ArchiveRecord[]>([]);
  const [isLoadingArchive, setIsLoadingArchive] = useState<boolean>(false);
  const [archiveSearch, setArchiveSearch] = useState<string>('');

  const barcodeInputRef = useRef<HTMLInputElement>(null);

  // 1. Initial Data Fetch (Warehouses, Fiscal Years, Common Goods)
  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        const [whRes, fyRes] = await Promise.all([
          apiCall<{ success: boolean; warehouses: WarehouseItem[] }>('/sayan/warehouses', 'GET'),
          apiCall<{ success: boolean; fiscalYears: FiscalYearItem[] }>('/sayan/fiscal-years', 'GET')
        ]);

        if (whRes?.success && Array.isArray(whRes.warehouses)) {
          setWarehouses(whRes.warehouses);
          const tehran = whRes.warehouses.find(w => w.code === '15');
          if (tehran) setSelectedWarehouse('15');
          else if (whRes.warehouses.length > 0) setSelectedWarehouse(whRes.warehouses[0].code);
        }

        if (fyRes?.success && Array.isArray(fyRes.fiscalYears)) {
          setFiscalYears(fyRes.fiscalYears);
          const defYear = fyRes.fiscalYears.find(y => y.isDefault);
          if (defYear) setSelectedFiscalYear(defYear.code);
        }
      } catch (err) {
        console.error('Failed to load warehouses/fiscal years:', err);
      }
    };

    fetchMetadata();
  }, []);

  // 2. Fetch Common Goods on start
  useEffect(() => {
    apiCall<{ success: boolean; items: GoodsItem[] }>('/sayan/goods/search?q=کش', 'GET')
      .then(res => {
        if (res?.success && Array.isArray(res.items) && res.items.length > 0) {
          setGoodsList(res.items);
          setActiveItemCode(res.items[0].code);
          setActiveItemName(res.items[0].name);
        }
      })
      .catch(() => {});
  }, []);

  // 3. Customer live debounced search
  useEffect(() => {
    if (!customerSearch || customerSearch.trim().length < 2) {
      setCustomersList([]);
      return;
    }
    const timer = setTimeout(async () => {
      setIsSearchingCustomer(true);
      try {
        const res = await apiCall<{ success: boolean; customers: CustomerItem[] }>(
          `/sayan/customers/search?q=${encodeURIComponent(customerSearch.trim())}`,
          'GET'
        );
        if (res?.success && Array.isArray(res.customers)) {
          setCustomersList(res.customers);
          setIsCustomerDropdownOpen(true);
        }
      } catch (e) {
        console.error('Customer search error:', e);
      } finally {
        setIsSearchingCustomer(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [customerSearch]);

  // Keep scanner input focused when continuous mode is active
  useEffect(() => {
    if (activeSubTab === 'issuer' && isContinuousScan) {
      const focusTimer = setTimeout(() => {
        barcodeInputRef.current?.focus();
      }, 100);
      return () => clearTimeout(focusTimer);
    }
  }, [activeSubTab, isContinuousScan, items.length]);

  // Load Archive on tab switch
  useEffect(() => {
    if (activeSubTab === 'archive') {
      loadArchive();
    }
  }, [activeSubTab]);

  const loadArchive = async () => {
    setIsLoadingArchive(true);
    try {
      const res = await apiCall<{ success: boolean; archive: ArchiveRecord[] }>('/sayan/sales-remittances/archive', 'GET');
      if (res?.success && Array.isArray(res.archive)) {
        setArchiveList(res.archive);
      }
    } catch (err) {
      console.error('Load archive error:', err);
    } finally {
      setIsLoadingArchive(false);
    }
  };

  // Fetch warehouse live statistics
  const loadWarehouseStats = async (fy = selectedFiscalYear) => {
    setIsLoadingStats(true);
    try {
      const res = await apiCall<{ success: boolean; stats: LiveWarehouseStat[] }>(`/sayan/warehouses/live-stats?fiscalYear=${fy}`, 'GET');
      if (res?.success && Array.isArray(res.stats)) {
        setWarehouseStats(res.stats);
      }
    } catch (err) {
      console.error('Load warehouse stats error:', err);
    } finally {
      setIsLoadingStats(false);
    }
  };

  // Fetch recent documents for selected warehouse
  const loadWarehouseDocuments = async (whCode = selectedStatWarehouse, fy = selectedFiscalYear) => {
    if (!whCode) return;
    setIsLoadingRecentDocs(true);
    try {
      const res = await apiCall<{ success: boolean; documents: WarehouseRecentDoc[] }>(`/sayan/warehouses/${whCode}/documents?fiscalYear=${fy}&limit=30`, 'GET');
      if (res?.success && Array.isArray(res.documents)) {
        setRecentDocs(res.documents);
      }
    } catch (err) {
      console.error('Load warehouse documents error:', err);
    } finally {
      setIsLoadingRecentDocs(false);
    }
  };

  // Effect for warehouse stats tab
  useEffect(() => {
    if (activeSubTab === 'warehouses') {
      loadWarehouseStats(selectedFiscalYear);
    }
  }, [activeSubTab, selectedFiscalYear]);

  // Effect for recent documents
  useEffect(() => {
    if (activeSubTab === 'warehouses' && selectedStatWarehouse) {
      loadWarehouseDocuments(selectedStatWarehouse, selectedFiscalYear);
    }
  }, [activeSubTab, selectedStatWarehouse, selectedFiscalYear]);

  // 4. Handle Barcode Scanning
  const handleBarcodeSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const raw = scannedBarcode.trim();
    if (!raw) return;

    // Check duplicate in current document
    const exists = items.some(it => it.barcode.toLowerCase() === raw.toLowerCase());
    if (exists) {
      if (isSoundEnabled) playBeepSound('error');
      setLastScanResult({
        text: `⚠️ بارکد «${raw}» قبلاً در این حواله اسکن شده است!`,
        success: false
      });
      setScannedBarcode('');
      return;
    }

    setIsResolvingBarcode(true);
    try {
      const res = await apiCall<any>('/sayan/barcode/lookup', 'POST', {
        barcode: raw,
        warehouseCode: selectedWarehouse,
        fiscalYear: selectedFiscalYear
      });

      if (res && res.success) {
        const itemCode = res.itemCode || activeItemCode;
        const itemName = res.itemName || activeItemName;
        const netWeight = res.netWeight > 0 ? res.netWeight : 14.5;
        const grossWeight = res.grossWeight > 0 ? res.grossWeight : Number((netWeight + 4.35).toFixed(2));

        const newItem: RemittanceItemRow = {
          id: `row-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          barcode: raw,
          batch: res.batch || raw,
          itemCode,
          itemName,
          netWeight,
          grossWeight,
          cartonCount: res.cartonCount || 1,
          bobbinCount: res.bobbinCount || 56,
          grade: res.grade || 'A',
          twistDirection: res.twistDirection || 'Z',
          rawGrade: res.rawGrade || '00011002',
          rawTwist: res.rawTwist || '00021001',
          note: res.note || `سری ساخت: ${raw} | همبافت:  | تعداد بوبین: 56 | تعداد کارتن: 1 | گرید: 00011002 | جهت تاب: 00021001 | وزن ناخالص: ${grossWeight}`
        };

        setItems(prev => [newItem, ...prev]);
        if (isSoundEnabled) playBeepSound('success');
        setLastScanResult({
          text: `✅ کارتن ${raw} با وزن خالص ${netWeight} کیلوگرم اضافه شد.`,
          success: true,
          item: newItem
        });
      } else {
        throw new Error('خطا در تحلیل بارکد');
      }
    } catch (err: any) {
      if (isSoundEnabled) playBeepSound('error');
      setLastScanResult({
        text: `❌ خطا در استعلام بارکد: ${err.message || 'نامشخص'}`,
        success: false
      });
    } finally {
      setIsResolvingBarcode(false);
      setScannedBarcode('');
      if (isContinuousScan) {
        setTimeout(() => barcodeInputRef.current?.focus(), 50);
      }
    }
  };

  // 5. KPIs
  const totalNetWeight = useMemo(() => {
    return Number(items.reduce((s, it) => s + (Number(it.netWeight) || 0), 0).toFixed(2));
  }, [items]);

  const totalGrossWeight = useMemo(() => {
    return Number(items.reduce((s, it) => s + (Number(it.grossWeight) || 0), 0).toFixed(2));
  }, [items]);

  const totalCartons = useMemo(() => {
    return items.reduce((s, it) => s + (Number(it.cartonCount) || 1), 0);
  }, [items]);

  const totalBobbins = useMemo(() => {
    return items.reduce((s, it) => s + (Number(it.bobbinCount) || 56), 0);
  }, [items]);

  // 6. Submit Remittance directly to Sayan
  const handleRegisterInSayan = async () => {
    setErrorMsg(null);
    if (!selectedCustomer) {
      setErrorMsg('لطفاً ابتدا خریدار / طرف‌حساب را انتخاب نمایید.');
      return;
    }
    if (items.length === 0) {
      setErrorMsg('حداقل یک کارتن یا قلم کالا برای صدور حواله باید اسکن شود.');
      return;
    }

    const opTitle = operationType === '25' ? 'حواله بین انبار' : 'حواله فروش';
    const confirmText = `آیا از صدور قطعی ${opTitle} در سایان برای «${selectedCustomer.name}» با ${items.length} کارتن (مجموع وزن خالص: ${totalNetWeight.toLocaleString('fa-IR')} کیلوگرم) اطمینان دارید؟`;
    if (!window.confirm(confirmText)) return;

    setIsSubmitting(true);
    try {
      const payload = {
        fiscalYear: selectedFiscalYear,
        opCode: operationType,
        warehouseCode: selectedWarehouse,
        customerCode: selectedCustomer.personCode,
        customerName: selectedCustomer.name,
        remittanceDate,
        subCode,
        notes: headerNotes,
        items
      };

      const res = await apiCall<any>('/sayan/sales-remittances/create', 'POST', payload);

      if (res && res.success) {
        const resultData = {
          ...res,
          opCode: operationType,
          opName: opTitle,
          customerName: selectedCustomer.name,
          warehouseName: warehouses.find(w => w.code === selectedWarehouse)?.name || `انبار ${selectedWarehouse}`,
          totalNetWeight,
          totalCartons,
          totalBobbins,
          remittanceDate,
          items: [...items]
        };
        setSuccessResult(resultData);
        if (onSuccessRegistered) {
          onSuccessRegistered(res.docNo, resultData);
        }
        loadArchive();
      } else {
        throw new Error(res?.message || 'خطا در ثبت حواله در پایگاه داده سایان');
      }
    } catch (err: any) {
      console.error('Registration error:', err);
      setErrorMsg(err.message || 'خطای شبکه در ارتباط با سرور سایان');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Reset for next remittance
  const handleStartNextRemittance = () => {
    setSuccessResult(null);
    setItems([]);
    setLastScanResult(null);
    setHeaderNotes('');
    setSubCode('');
    setErrorMsg(null);
    if (isContinuousScan) {
      setTimeout(() => barcodeInputRef.current?.focus(), 100);
    }
  };

  const handleShareToChat = (record: any) => {
    const title = record.opCode === '25' ? 'حواله بین انبار' : 'حواله فروش';
    openSendToChat({
      title: `ارسال ${title} به گفتگو`,
      defaultMessage: `📄 ${title} رسمی سایان ERP شماره #${record.docNo || record.DocNo} (فرعی ${record.subNo || '-'})
👤 تحویل‌گیرنده / خریدار: ${record.customerName || record.personFullName || 'شخص'}
🏢 انبار مبدا: ${record.warehouseName || record.storeId || 'انبار'}
📅 تاریخ: ${record.shamsiDate || record.remittanceDate}
📦 تعداد کارتن: ${record.totalCartons || record.itemsCount} کارتن
⚖️ وزن خالص: ${Number(record.totalNetWeight || 0).toLocaleString('fa-IR')} کیلوگرم
✅ صادر شده به صورت لایو از نرم‌افزار سازمانی`
    });
  };

  // Filtered Archive
  const filteredArchive = useMemo(() => {
    if (!archiveSearch.trim()) return archiveList;
    const q = archiveSearch.trim().toLowerCase();
    return archiveList.filter(r => 
      r.docNo.includes(q) ||
      (r.customerName && r.customerName.toLowerCase().includes(q)) ||
      (r.customerCode && r.customerCode.includes(q)) ||
      (r.notes && r.notes.toLowerCase().includes(q))
    );
  }, [archiveList, archiveSearch]);

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-zinc-950 text-slate-800 dark:text-zinc-100 select-text" dir="rtl">
      {/* Top Banner Navigation */}
      <div className="flex-none p-4 sm:p-5 border-b border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-blue-500 text-white flex items-center justify-center shadow-lg shadow-blue-500/20">
            <Barcode size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-black tracking-tight text-slate-900 dark:text-white">
                سامانه صدور حواله فروش و خروج انبار (لایو سایان ERP)
              </h2>
              <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 text-[11px] font-bold border border-emerald-300 dark:border-emerald-800 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
                <span>اتصال زنده</span>
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
              صدور فوق‌سریع حواله فروش با بارکدخوان فیزیکی و ثبت اتوماتیک در دیتابیس سایان بدون فریز یا کندی
            </p>
          </div>
        </div>

        {/* Tab Controls */}
        <div className="flex items-center gap-2">
          <div className="p-1 rounded-xl bg-slate-100 dark:bg-zinc-800 flex items-center gap-1">
            <button
              onClick={() => setActiveSubTab('issuer')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-black flex items-center gap-1.5 transition-all ${
                activeSubTab === 'issuer' 
                  ? 'bg-white dark:bg-zinc-900 text-blue-600 dark:text-blue-400 shadow-xs' 
                  : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900'
              }`}
            >
              <Package size={15} />
              <span>صدور حواله با بارکدخوان</span>
            </button>
            <button
              onClick={() => setActiveSubTab('archive')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-black flex items-center gap-1.5 transition-all ${
                activeSubTab === 'archive' 
                  ? 'bg-white dark:bg-zinc-900 text-blue-600 dark:text-blue-400 shadow-xs' 
                  : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900'
              }`}
            >
              <History size={15} />
              <span>بایگانی حواله‌ها ({archiveList.length})</span>
            </button>
            <button
              onClick={() => setActiveSubTab('warehouses')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-black flex items-center gap-1.5 transition-all ${
                activeSubTab === 'warehouses' 
                  ? 'bg-white dark:bg-zinc-900 text-blue-600 dark:text-blue-400 shadow-xs' 
                  : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900'
              }`}
            >
              <Building2 size={15} />
              <span>انبارها و آمار زنده سایان</span>
            </button>
          </div>

          {onClose && (
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200 rounded-xl hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
              title="بستن"
            >
              <X size={20} />
            </button>
          )}
        </div>
      </div>

      {/* Main Workspace */}
      {activeSubTab === 'issuer' ? (
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          {/* Header Controls: Warehouse, Fiscal Year, Customer, Date */}
          <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-xs space-y-4">
            
            {/* Top Bar of Card: Operation Type Selector & Description */}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-zinc-800 text-xs">
              <div className="flex items-center gap-2 font-bold text-slate-700 dark:text-zinc-300">
                <Layers size={16} className={operationType === '25' ? "text-purple-600" : "text-blue-600"} />
                <span>نوع و مشخصات سند انبار (مطابق منوی عملیات سایان ERP)</span>
              </div>

              {/* Operation Type Switcher: 23 (فروش) / 25 (بین انبار) */}
              <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700">
                <button
                  type="button"
                  onClick={() => setOperationType('23')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black flex items-center gap-1.5 transition-all ${
                    operationType === '23'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900'
                  }`}
                >
                  <Package size={14} />
                  <span>حواله فروش (کد ۲۳)</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setOperationType('25');
                    if (!selectedCustomer) {
                      setSelectedCustomer({
                        personCode: '2471',
                        name: 'دفتر تهران-لپان بافت',
                        tafsiliCode: '112471',
                        levelCode: '11'
                      });
                    }
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black flex items-center gap-1.5 transition-all ${
                    operationType === '25'
                      ? 'bg-purple-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900'
                  }`}
                >
                  <ArrowRight size={14} />
                  <span>حواله بین انبار (کد ۲۵)</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              {/* 1. Warehouse Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-zinc-400 mb-1">
                  {operationType === '25' ? 'انبار مبدا (فرستنده) *' : 'انبار مبدا (تحویل کالا) *'}
                </label>
                <div className="relative">
                  <select
                    value={selectedWarehouse}
                    onChange={(e) => setSelectedWarehouse(e.target.value)}
                    className="w-full h-10 px-3 pr-9 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-xs font-bold text-slate-900 dark:text-white outline-none focus:border-blue-500 transition-all cursor-pointer"
                  >
                    {warehouses.map((w) => (
                      <option key={w.code} value={w.code}>
                        کد {w.code} - {w.name}
                      </option>
                    ))}
                  </select>
                  <Warehouse className="w-4 h-4 text-slate-400 absolute right-3 top-3 pointer-events-none" />
                </div>
              </div>

              {/* 2. Fiscal Year Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-zinc-400 mb-1">
                  سال مالی سایان *
                </label>
                <select
                  value={selectedFiscalYear}
                  onChange={(e) => setSelectedFiscalYear(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-xs font-bold text-slate-900 dark:text-white outline-none focus:border-blue-500 transition-all cursor-pointer font-mono"
                >
                  {fiscalYears.map((fy) => (
                    <option key={fy.code} value={fy.code}>
                      {fy.title}
                    </option>
                  ))}
                </select>
              </div>

              {/* 3. Customer / Destination Store Selection */}
              <div className="relative">
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-600 dark:text-zinc-400">
                    {operationType === '25' ? 'انبار مقصد / تحویل‌گیرنده *' : 'مشتری / خریدار *'}
                  </label>
                  {operationType === '25' && (!selectedCustomer || selectedCustomer.personCode !== '2471') && (
                    <button
                      type="button"
                      onClick={() => setSelectedCustomer({
                        personCode: '2471',
                        name: 'دفتر تهران-لپان بافت',
                        tafsiliCode: '112471',
                        levelCode: '11'
                      })}
                      className="text-[10px] text-purple-600 hover:underline font-bold"
                    >
                      + دفتر تهران (۲۴۷۱)
                    </button>
                  )}
                </div>
                <div className="relative">
                  <input
                    type="text"
                    value={selectedCustomer ? selectedCustomer.name : customerSearch}
                    onChange={(e) => {
                      setSelectedCustomer(null);
                      setCustomerSearch(e.target.value);
                    }}
                    onFocus={() => {
                      if (customersList.length > 0) setIsCustomerDropdownOpen(true);
                    }}
                    placeholder={operationType === '25' ? 'نام انبار مقصد یا کد تحویل‌گیرنده...' : 'جستجوی نام یا کد تفصیلی مشتری...'}
                    className="w-full h-10 px-3 pr-9 pl-8 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-xs font-bold text-slate-900 dark:text-white outline-none focus:border-blue-500 transition-all"
                  />
                  <User className="w-4 h-4 text-slate-400 absolute right-3 top-3 pointer-events-none" />
                  {isSearchingCustomer && (
                    <Loader2 className="w-4 h-4 text-blue-600 animate-spin absolute left-3 top-3" />
                  )}
                  {selectedCustomer && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCustomer(null);
                        setCustomerSearch('');
                      }}
                      className="absolute left-2.5 top-2.5 p-0.5 rounded-full hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-400"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>

                {/* Dropdown list */}
                {isCustomerDropdownOpen && customersList.length > 0 && (
                  <div className="absolute z-50 top-full mt-1 w-full max-h-56 overflow-y-auto bg-white dark:bg-zinc-800 rounded-xl shadow-2xl border border-slate-200 dark:border-zinc-700 p-1 divide-y divide-slate-100 dark:divide-zinc-700/60">
                    {customersList.map((c) => (
                      <button
                        key={c.personCode}
                        type="button"
                        onClick={() => {
                          setSelectedCustomer(c);
                          setIsCustomerDropdownOpen(false);
                        }}
                        className="w-full p-2 text-right hover:bg-blue-50 dark:hover:bg-zinc-700/80 rounded-lg flex items-center justify-between text-xs transition-colors"
                      >
                        <span className="font-bold text-slate-900 dark:text-white truncate">
                          {c.name}
                        </span>
                        <span className="font-mono text-[11px] text-slate-500 bg-slate-100 dark:bg-zinc-900 px-1.5 py-0.5 rounded">
                          {c.personCode}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* 4. Remittance Date */}
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-zinc-400 mb-1">
                  تاریخ صدور حواله
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={remittanceDate}
                    onChange={(e) => setRemittanceDate(e.target.value)}
                    placeholder="1404/07/13"
                    className="w-full h-10 px-3 pr-9 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-xs font-bold text-slate-900 dark:text-white font-mono outline-none focus:border-blue-500 transition-all text-left dir-ltr"
                  />
                  <Calendar className="w-4 h-4 text-slate-400 absolute right-3 top-3 pointer-events-none" />
                </div>
              </div>
            </div>

            {/* SubCode & Notes */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-zinc-400 mb-1">
                  کد فرعی حواله (اختیاری)
                </label>
                <input
                  type="text"
                  value={subCode}
                  onChange={(e) => setSubCode(e.target.value)}
                  placeholder="مثال: ۹۹۸ یا بارنامه"
                  className="w-full h-9 px-3 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-xs text-slate-900 dark:text-white outline-none focus:border-blue-500 font-mono"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-500 dark:text-zinc-400 mb-1">
                  توضیحات و یادداشت سربرگ حواله
                </label>
                <input
                  type="text"
                  value={headerNotes}
                  onChange={(e) => setHeaderNotes(e.target.value)}
                  placeholder="توضیحات راننده، آدرس باربری یا شرایط تحویل..."
                  className="w-full h-9 px-3 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-xs text-slate-900 dark:text-white outline-none focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Barcode Scanner Station */}
          <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white shadow-xl space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-blue-500/20 text-blue-300 border border-blue-400/30">
                  <Barcode size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white">ایستگاه اسکن بارکد کارتن‌ها</h3>
                  <p className="text-[11px] text-blue-200">
                    بارکدخوان فیزیکی متصل به سیستم را آماده کنید و کارتن‌ها را یکی پس از دیگری اسکن نمایید.
                  </p>
                </div>
              </div>

              {/* Toggles */}
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-1.5 text-xs text-blue-200 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={isContinuousScan}
                    onChange={(e) => setIsContinuousScan(e.target.checked)}
                    className="w-4 h-4 rounded text-blue-600 focus:ring-0 cursor-pointer"
                  />
                  <span>اسکن متوالی خودکار</span>
                </label>

                <button
                  type="button"
                  onClick={() => setIsSoundEnabled(!isSoundEnabled)}
                  className={`p-1.5 rounded-lg border text-xs flex items-center gap-1 transition-colors ${
                    isSoundEnabled 
                      ? 'bg-emerald-500/20 border-emerald-400/40 text-emerald-300' 
                      : 'bg-white/10 border-white/20 text-slate-400'
                  }`}
                  title="صدای تایید اسکن"
                >
                  {isSoundEnabled ? <Volume2 size={15} /> : <VolumeX size={15} />}
                  <span>{isSoundEnabled ? 'صدا فعال' : 'بی‌صدا'}</span>
                </button>
              </div>
            </div>

            {/* Scanner Input Bar */}
            <form onSubmit={handleBarcodeSubmit} className="flex gap-2">
              <div className="relative flex-1">
                <input
                  ref={barcodeInputRef}
                  type="text"
                  value={scannedBarcode}
                  onChange={(e) => setScannedBarcode(e.target.value)}
                  placeholder="اسکن بارکد یا تایپ بچ (مثال: PO-F-6986-5-14.35)..."
                  disabled={isResolvingBarcode}
                  className="w-full h-12 pr-11 pl-4 rounded-xl bg-white/10 border-2 border-blue-400/40 focus:border-blue-300 text-white placeholder-blue-300/60 font-mono text-sm sm:text-base font-bold outline-none transition-all dir-ltr text-left"
                />
                <Barcode className="w-5 h-5 text-blue-300 absolute right-3.5 top-3.5 pointer-events-none" />
              </div>
              <button
                type="submit"
                disabled={isResolvingBarcode || !scannedBarcode.trim()}
                className="px-5 h-12 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-black text-xs sm:text-sm flex items-center gap-2 shadow-lg shadow-emerald-500/30 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                {isResolvingBarcode ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
                <span>ثبت ردیف</span>
              </button>
            </form>

            {/* Live Scan Notification */}
            {lastScanResult && (
              <div className={`p-2.5 rounded-xl text-xs font-bold border transition-all ${
                lastScanResult.success 
                  ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-200' 
                  : 'bg-rose-950/60 border-rose-500/50 text-rose-200'
              }`}>
                {lastScanResult.text}
              </div>
            )}
          </div>

          {/* Items Table */}
          <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-xs space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <Boxes size={18} className="text-blue-600" />
                <h3 className="text-sm font-black text-slate-900 dark:text-white">
                  اقلام و کارتن‌های اسکن‌شده در این حواله ({items.length} کارتن)
                </h3>
              </div>

              {items.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm('آیا از پاک کردن تمامی ردیف‌های اسکن‌شده اطمینان دارید؟')) {
                      setItems([]);
                      setLastScanResult(null);
                    }
                  }}
                  className="px-2.5 py-1 text-xs text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg font-bold transition-colors"
                >
                  پاکسازی کل لیست
                </button>
              )}
            </div>

            {items.length === 0 ? (
              <div className="py-16 text-center text-slate-400 dark:text-zinc-500 border border-dashed rounded-2xl border-slate-200 dark:border-zinc-800 space-y-2">
                <Barcode className="w-12 h-12 mx-auto text-slate-300 dark:text-zinc-700" />
                <p className="text-sm font-bold">هنوز هیچ کارتنی اسکن نشده است.</p>
                <p className="text-xs text-slate-400">
                  بارکدخوان خود را روی برچسب کارتن قرار داده و شلیک کنید تا وزن و اطلاعات به‌صورت اتوماتیک ثبت شود.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-zinc-700">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 font-black border-b border-slate-200 dark:border-zinc-700">
                    <tr>
                      <th className="py-2.5 px-3 text-center w-12">#</th>
                      <th className="py-2.5 px-3 font-mono">بارکد / سری ساخت</th>
                      <th className="py-2.5 px-3">کد و شرح کالا</th>
                      <th className="py-2.5 px-3 text-left">وزن خالص (kg)</th>
                      <th className="py-2.5 px-3 text-left">وزن ناخالص (kg)</th>
                      <th className="py-2.5 px-3 text-center">کارتن</th>
                      <th className="py-2.5 px-3 text-center">بوبین</th>
                      <th className="py-2.5 px-3 text-center">گرید / تاب</th>
                      <th className="py-2.5 px-3">مشخصات تکمیلی</th>
                      <th className="py-2.5 px-3 text-center w-12">حذف</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                    {items.map((row, idx) => (
                      <tr key={row.id} className="hover:bg-blue-50/40 dark:hover:bg-zinc-800/40 transition-colors">
                        <td className="py-2.5 px-3 text-center font-mono text-slate-400">{idx + 1}</td>
                        <td className="py-2.5 px-3 font-mono font-bold text-slate-900 dark:text-white dir-ltr text-right">
                          {row.barcode}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="font-bold text-slate-900 dark:text-white block">{row.itemName}</span>
                          <span className="font-mono text-[10px] text-slate-400 block">{row.itemCode}</span>
                        </td>
                        <td className="py-2.5 px-3 text-left font-mono font-black text-blue-600 dark:text-blue-400 text-sm">
                          {row.netWeight.toLocaleString('fa-IR')}
                        </td>
                        <td className="py-2.5 px-3 text-left font-mono font-medium text-slate-600 dark:text-zinc-400">
                          {row.grossWeight.toLocaleString('fa-IR')}
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono font-bold">{row.cartonCount}</td>
                        <td className="py-2.5 px-3 text-center font-mono text-slate-600 dark:text-zinc-400">{row.bobbinCount}</td>
                        <td className="py-2.5 px-3 text-center">
                          <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-zinc-800 font-mono font-bold text-[10px]">
                            {row.grade} / {row.twistDirection}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-500 text-[11px] truncate max-w-[200px]" title={row.note}>
                          {row.note}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => setItems(prev => prev.filter(it => it.id !== row.id))}
                            className="p-1 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                            title="حذف ردیف"
                          >
                            <Trash2 size={15} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* KPI Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
              <div className="p-3.5 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/50">
                <span className="text-[11px] font-bold text-blue-600 dark:text-blue-300 block">مجموع وزن خالص</span>
                <span className="text-lg sm:text-2xl font-black font-mono text-blue-900 dark:text-blue-100 mt-1 block">
                  {totalNetWeight.toLocaleString('fa-IR')} <span className="text-xs font-normal">کیلوگرم</span>
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/50">
                <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-300 block">مجموع وزن ناخالص</span>
                <span className="text-lg sm:text-2xl font-black font-mono text-indigo-900 dark:text-indigo-100 mt-1 block">
                  {totalGrossWeight.toLocaleString('fa-IR')} <span className="text-xs font-normal">کیلوگرم</span>
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/50">
                <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-300 block">تعداد کارتن‌ها</span>
                <span className="text-lg sm:text-2xl font-black font-mono text-emerald-900 dark:text-emerald-100 mt-1 block">
                  {totalCartons.toLocaleString('fa-IR')} <span className="text-xs font-normal">بسته</span>
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700">
                <span className="text-[11px] font-bold text-slate-600 dark:text-zinc-400 block">تعداد بوبین‌ها</span>
                <span className="text-lg sm:text-2xl font-black font-mono text-slate-900 dark:text-white mt-1 block">
                  {totalBobbins.toLocaleString('fa-IR')} <span className="text-xs font-normal">عدد</span>
                </span>
              </div>
            </div>

            {/* Error Message */}
            {errorMsg && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs font-bold flex items-center gap-2">
                <AlertCircle size={16} className="shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Final Action Button */}
            <div className="pt-2 flex flex-wrap items-center justify-between gap-3">
              <span className="text-xs text-slate-500">
                با کلیک روی دکمه زیر، سند خروج و حواله فروش بلافاصله در پایگاه‌داده سایان ثبت و شماره سند صادر خواهد شد.
              </span>

              <button
                type="button"
                onClick={handleRegisterInSayan}
                disabled={isSubmitting || items.length === 0}
                className="px-6 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-black text-sm flex items-center gap-2 shadow-lg shadow-blue-600/30 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle2 size={18} />}
                <span>{isSubmitting ? 'در حال صدور و ثبت در سایان...' : 'صدور و ثبت قطعی حواله فروش در سایان'}</span>
              </button>
            </div>
          </div>
        </div>
      ) : activeSubTab === 'archive' ? (
        /* Archive Tab */
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-xs">
            <div className="flex items-center gap-2">
              <History size={18} className="text-blue-600" />
              <h3 className="text-sm font-black text-slate-900 dark:text-white">
                بایگانی حواله‌های صادرشده ({filteredArchive.length} مورد)
              </h3>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative w-64">
                <input
                  type="text"
                  value={archiveSearch}
                  onChange={(e) => setArchiveSearch(e.target.value)}
                  placeholder="جستجو در شماره حواله یا خریدار..."
                  className="w-full h-9 px-3 pr-8 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-xs text-slate-900 dark:text-white outline-none"
                />
                <Search size={14} className="text-slate-400 absolute right-2.5 top-2.5" />
              </div>

              <button
                type="button"
                onClick={loadArchive}
                disabled={isLoadingArchive}
                className="p-2 rounded-xl border border-slate-200 dark:border-zinc-700 hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-600 dark:text-zinc-300 transition-colors"
                title="تازه سازی"
              >
                <Loader2 size={16} className={isLoadingArchive ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>

          {filteredArchive.length === 0 ? (
            <div className="py-16 text-center text-slate-400 border border-dashed rounded-2xl border-slate-200 dark:border-zinc-800">
              هیچ حواله ثبتی در بایگانی یافت نشد.
            </div>
          ) : (
            <div className="space-y-3">
              {filteredArchive.map((rec) => (
                <div
                  key={rec.id}
                  className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-xs hover:border-blue-400 transition-all space-y-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="px-3 py-1 rounded-xl bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 font-mono font-black text-sm border border-blue-200 dark:border-blue-800">
                        شماره حواله #{rec.docNo}
                      </div>
                      <div>
                        <h4 className="font-black text-sm text-slate-900 dark:text-white">{rec.customerName}</h4>
                        <span className="text-[11px] text-slate-400">کد تفصیلی: {rec.customerCode} • فرعی: {rec.subNo}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleShareToChat(rec)}
                        className="px-3 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 text-xs font-bold flex items-center gap-1.5 transition-colors"
                      >
                        <Send size={13} />
                        <span>ارسال به گفتگو</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setPrintModalRecord(rec)}
                        className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-200 hover:bg-slate-200 text-xs font-bold flex items-center gap-1.5 transition-colors"
                      >
                        <Printer size={13} />
                        <span>چاپ سند رسمی</span>
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 border-t border-slate-100 dark:border-zinc-800/60 text-xs">
                    <div>
                      <span className="text-slate-400 block text-[10px]">تاریخ صدور:</span>
                      <span className="font-bold font-mono">{rec.shamsiDate}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">مجموع وزن خالص:</span>
                      <span className="font-black font-mono text-blue-600 dark:text-blue-400">
                        {rec.totalNetWeight.toLocaleString('fa-IR')} kg
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">تعداد کارتن:</span>
                      <span className="font-bold font-mono">{rec.totalCartons} بسته</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">ثبت‌کننده:</span>
                      <span className="font-medium">{rec.createdBy}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* Live Sayan Warehouses & Stock Metrics SubTab */
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          {/* Top Bar: Title, Fiscal Year Selector, Live Refresh */}
          <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-xs flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
                <Building2 size={22} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-black text-slate-900 dark:text-white">
                    وضعیت و آمار زنده تمامی انبارهای سایان ERP
                  </h3>
                  <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 text-[10px] font-mono font-bold">
                    STR_TBL_001
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-zinc-400">
                  اتصال مستقیم به ۸ انبار فعال کارخانه و دفاتر با تفکیک سال مالی
                </p>
              </div>
            </div>

            {/* Fiscal Year & Refresh Action */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <label className="text-xs font-bold text-slate-600 dark:text-zinc-300">
                  سال مالی سایان:
                </label>
                <select
                  value={selectedFiscalYear}
                  onChange={(e) => setSelectedFiscalYear(e.target.value)}
                  className="h-9 px-3 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {fiscalYears.map(fy => (
                    <option key={fy.code} value={fy.code}>{fy.title}</option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                onClick={() => {
                  loadWarehouseStats(selectedFiscalYear);
                  if (selectedStatWarehouse) loadWarehouseDocuments(selectedStatWarehouse, selectedFiscalYear);
                }}
                disabled={isLoadingStats}
                className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-sm cursor-pointer disabled:opacity-50"
              >
                <RefreshCw size={14} className={isLoadingStats ? 'animate-spin' : ''} />
                <span>{isLoadingStats ? 'در حال دریافت...' : 'به‌روزرسانی داده‌ها'}</span>
              </button>
            </div>
          </div>

          {/* Top KPI Metrics Row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-50 to-blue-100/40 dark:from-blue-950/40 dark:to-blue-900/20 border border-blue-200/80 dark:border-blue-800/60 shadow-xs">
              <span className="text-[11px] font-bold text-blue-700 dark:text-blue-300 block">تعداد کل انبارها</span>
              <span className="text-xl sm:text-2xl font-black font-mono text-blue-950 dark:text-blue-100 mt-1 block">
                {warehouseStats.length || 8} انبار فعال
              </span>
              <span className="text-[10px] text-blue-600/80 dark:text-blue-400 mt-0.5 block">پایگاه داده سایان (LepanBaft)</span>
            </div>

            <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-50 to-emerald-100/40 dark:from-emerald-950/40 dark:to-emerald-900/20 border border-emerald-200/80 dark:border-emerald-800/60 shadow-xs">
              <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300 block">کل وزن گردش سال مالی</span>
              <span className="text-xl sm:text-2xl font-black font-mono text-emerald-950 dark:text-emerald-100 mt-1 block">
                {Math.round(warehouseStats.reduce((s, w) => s + (w.totalQty || 0), 0)).toLocaleString('fa-IR')} <span className="text-xs font-normal">ک‌گ</span>
              </span>
              <span className="text-[10px] text-emerald-600/80 dark:text-emerald-400 mt-0.5 block">مجموع تراکنش‌های انبار</span>
            </div>

            <div className="p-4 rounded-2xl bg-gradient-to-br from-purple-50 to-purple-100/40 dark:from-purple-950/40 dark:to-purple-900/20 border border-purple-200/80 dark:border-purple-800/60 shadow-xs">
              <span className="text-[11px] font-bold text-purple-700 dark:text-purple-300 block">کل اسناد انبار</span>
              <span className="text-xl sm:text-2xl font-black font-mono text-purple-950 dark:text-purple-100 mt-1 block">
                {warehouseStats.reduce((s, w) => s + (w.docsCount || 0), 0).toLocaleString('fa-IR')} <span className="text-xs font-normal">سند</span>
              </span>
              <span className="text-[10px] text-purple-600/80 dark:text-purple-400 mt-0.5 block">STR_TBL_010 در سال {selectedFiscalYear}</span>
            </div>

            <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-50 to-amber-100/40 dark:from-amber-950/40 dark:to-amber-900/20 border border-amber-200/80 dark:border-amber-800/60 shadow-xs">
              <span className="text-[11px] font-bold text-amber-700 dark:text-amber-300 block">حواله‌های فروش صادرشده</span>
              <span className="text-xl sm:text-2xl font-black font-mono text-amber-950 dark:text-amber-100 mt-1 block">
                {warehouseStats.reduce((s, w) => s + (w.salesRemittancesCount || 0), 0).toLocaleString('fa-IR')} <span className="text-xs font-normal">حواله</span>
              </span>
              <span className="text-[10px] text-amber-600/80 dark:text-amber-400 mt-0.5 block">عملیات فروش (OpCode 23)</span>
            </div>
          </div>

          {/* 8 Warehouses Interactive Cards */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-black text-slate-700 dark:text-zinc-200 flex items-center gap-1.5">
                <Warehouse size={16} className="text-blue-600" />
                <span>فهرست تمام انبارها به تفکیک کد و آمار گردش (جهت انتخاب کلیک کنید)</span>
              </h4>
              <span className="text-[11px] text-slate-400">انبار فعال انتخاب شده: انبار {selectedStatWarehouse}</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {warehouseStats.map((wh) => {
                const isSelected = selectedStatWarehouse === wh.code;
                return (
                  <div
                    key={wh.code}
                    onClick={() => setSelectedStatWarehouse(wh.code)}
                    className={`p-4 rounded-2xl transition-all cursor-pointer border ${
                      isSelected
                        ? 'bg-blue-50/50 dark:bg-blue-950/30 border-blue-500 shadow-md ring-2 ring-blue-500/20'
                        : 'bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 hover:border-slate-300 hover:shadow-xs'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-zinc-800 font-mono font-black text-xs text-slate-700 dark:text-zinc-300">
                            کد {wh.code}
                          </span>
                          <span className="w-2 h-2 rounded-full bg-emerald-500" title="انبار فعال"></span>
                        </div>
                        <h4 className="font-black text-sm text-slate-900 dark:text-white mt-1.5">
                          {wh.name}
                        </h4>
                      </div>

                      <div className="w-8 h-8 rounded-xl bg-blue-100/60 dark:bg-blue-950/80 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                        <Warehouse size={16} />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-slate-100 dark:border-zinc-800/80 text-[11px]">
                      <div>
                        <span className="text-slate-400 block text-[10px]">تعداد اسناد:</span>
                        <span className="font-mono font-bold text-slate-800 dark:text-zinc-200">
                          {wh.docsCount.toLocaleString('fa-IR')}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px]">حواله فروش (۲۳):</span>
                        <span className="font-mono font-bold text-blue-600 dark:text-blue-400">
                          {wh.salesRemittancesCount.toLocaleString('fa-IR')}
                        </span>
                      </div>
                      <div className="col-span-2">
                        <span className="text-slate-400 block text-[10px]">کل وزن گردش:</span>
                        <span className="font-mono font-black text-emerald-600 dark:text-emerald-400">
                          {Math.round(wh.totalQty).toLocaleString('fa-IR')} کیلوگرم
                        </span>
                      </div>
                    </div>

                    {/* Quick Action Button */}
                    <div className="mt-3 pt-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedWarehouse(wh.code);
                          setActiveSubTab('issuer');
                          setTimeout(() => barcodeInputRef.current?.focus(), 150);
                        }}
                        className="w-full py-1.5 px-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-[11px] flex items-center justify-center gap-1 shadow-xs transition-transform active:scale-95"
                      >
                        <Barcode size={13} />
                        <span>صدور حواله فروش با بارکدخوان</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Selected Warehouse Detailed Recent Documents */}
          <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-xs space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-zinc-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center font-bold">
                  <Clock size={16} />
                </div>
                <div>
                  <h4 className="text-sm font-black text-slate-900 dark:text-white">
                    آخرین اسناد و حواله‌های ثبت‌شده در {warehouseStats.find(w => w.code === selectedStatWarehouse)?.name || `انبار ${selectedStatWarehouse}`}
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    نمایش زنده ۲۰ سند اخیر ثبت‌شده در جدول STR_TBL_010 دیتابیس سایان
                  </p>
                </div>
              </div>

              {/* Filters */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative w-48">
                  <input
                    type="text"
                    value={docsSearchQuery}
                    onChange={(e) => setDocsSearchQuery(e.target.value)}
                    placeholder="جستجو در شماره یا طرف‌حساب..."
                    className="w-full h-8 px-2.5 pr-7 rounded-lg border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-xs text-slate-900 dark:text-white outline-none"
                  />
                  <Search size={12} className="text-slate-400 absolute right-2 top-2" />
                </div>

                <select
                  value={docsOpFilter}
                  onChange={(e) => setDocsOpFilter(e.target.value)}
                  className="h-8 px-2 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg text-xs font-bold text-slate-800 dark:text-zinc-200 outline-none"
                >
                  <option value="all">همه عملیات‌ها</option>
                  <option value="23">فقط حواله فروش (۲۳)</option>
                  <option value="12">حواله خروج (۱۲)</option>
                  <option value="65">رسید انبار / تولید (۶۵)</option>
                  <option value="67">انتقال بین انبار (۶۷)</option>
                  <option value="13">برگشت از فروش (۱۳)</option>
                </select>

                <button
                  type="button"
                  onClick={() => loadWarehouseDocuments(selectedStatWarehouse, selectedFiscalYear)}
                  disabled={isLoadingRecentDocs}
                  className="p-1.5 rounded-lg border border-slate-200 dark:border-zinc-700 hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-600 dark:text-zinc-300"
                  title="تازه‌سازی اسناد"
                >
                  <RefreshCw size={14} className={isLoadingRecentDocs ? 'animate-spin' : ''} />
                </button>
              </div>
            </div>

            {/* Documents Table */}
            {isLoadingRecentDocs ? (
              <div className="py-12 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
                <Loader2 size={24} className="animate-spin text-blue-600" />
                <span className="text-xs">در حال بارگذاری اسناد از سایان ERP...</span>
              </div>
            ) : recentDocs.length === 0 ? (
              <div className="py-12 text-center text-slate-400 border border-dashed rounded-xl border-slate-200 dark:border-zinc-800 text-xs">
                هیچ سندی برای این انبار در سال مالی جاری یافت نشد.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-zinc-800 bg-slate-50/70 dark:bg-zinc-800/40 text-slate-500 font-bold">
                      <th className="py-2.5 px-3">شماره سند</th>
                      <th className="py-2.5 px-3">شماره فرعی</th>
                      <th className="py-2.5 px-3">نوع عملیات انبار</th>
                      <th className="py-2.5 px-3">تاریخ ثبت</th>
                      <th className="py-2.5 px-3">طرف‌حساب / مشتری</th>
                      <th className="py-2.5 px-3">شرح سند</th>
                      <th className="py-2.5 px-3 text-center">اقدام</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                    {recentDocs
                      .filter(d => {
                        if (docsOpFilter !== 'all' && d.opCode !== docsOpFilter) return false;
                        if (!docsSearchQuery.trim()) return true;
                        const q = docsSearchQuery.trim().toLowerCase();
                        return (
                          d.docNo.includes(q) ||
                          (d.customerName && d.customerName.toLowerCase().includes(q)) ||
                          (d.customerCode && d.customerCode.includes(q)) ||
                          (d.description && d.description.toLowerCase().includes(q))
                        );
                      })
                      .map(doc => (
                        <tr key={doc.docId} className="hover:bg-slate-50/50 dark:hover:bg-zinc-800/50 transition-colors">
                          <td className="py-2.5 px-3 font-mono font-black text-blue-600 dark:text-blue-400">
                            #{doc.docNo}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-slate-600 dark:text-zinc-400">
                            {doc.subNo || '-'}
                          </td>
                          <td className="py-2.5 px-3">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              doc.opCode === '23'
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                : doc.opCode === '12'
                                ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                                : 'bg-slate-100 text-slate-700 dark:bg-zinc-800 dark:text-zinc-300'
                            }`}>
                              {doc.opName}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 font-mono text-slate-600 dark:text-zinc-300 text-[11px]">
                            {doc.docDate ? new Date(doc.docDate).toLocaleDateString('fa-IR') : '-'}
                          </td>
                          <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-white">
                            {doc.customerName || doc.customerCode || '-'}
                          </td>
                          <td className="py-2.5 px-3 text-slate-500 max-w-xs truncate" title={doc.description}>
                            {doc.description || '-'}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedWarehouse(doc.warehouseCode || selectedStatWarehouse);
                                setActiveSubTab('issuer');
                                setTimeout(() => barcodeInputRef.current?.focus(), 150);
                              }}
                              className="px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 hover:bg-blue-100 text-[11px] font-bold inline-flex items-center gap-1"
                              title="صدور حواله فروش جدید"
                            >
                              <Plus size={12} />
                              <span>صدور حواله</span>
                            </button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Success Modal */}
      {successResult && createPortal(
        <div className="fixed inset-0 z-[999999999] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200 select-text" dir="rtl">
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl shadow-2xl max-w-lg w-full p-6 text-center space-y-4 animate-in zoom-in-95 duration-150">
            <div className="w-16 h-16 rounded-3xl bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 mx-auto flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <CheckCircle2 size={32} />
            </div>

            <div>
              <h3 className="text-lg font-black text-slate-900 dark:text-white">
                حواله فروش با موفقیت در سایان ثبت شد!
              </h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
                سند انبار و حواله فروش با شماره رسمی زیر به پایگاه داده سایان تزریق گردید.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-800 border border-slate-100 dark:border-zinc-700/60 space-y-2 text-right">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500">شماره حواله سایان:</span>
                <span className="font-mono font-black text-base text-blue-600 dark:text-blue-400">
                  #{successResult.docNo}
                </span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500">شماره فرعی سند:</span>
                <span className="font-mono font-bold text-slate-900 dark:text-white">
                  {successResult.subNo}
                </span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500">خریدار:</span>
                <span className="font-bold text-slate-900 dark:text-white">{successResult.customerName}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500">مجموع وزن خالص:</span>
                <span className="font-mono font-black text-emerald-600 dark:text-emerald-400">
                  {successResult.totalNetWeight?.toLocaleString('fa-IR')} کیلوگرم
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                type="button"
                onClick={() => setPrintModalRecord(successResult)}
                className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 text-slate-800 dark:text-zinc-200 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
              >
                <Printer size={16} />
                <span>چاپ سند رسمی</span>
              </button>

              <button
                type="button"
                onClick={() => handleShareToChat(successResult)}
                className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-indigo-600/20 transition-all active:scale-95"
              >
                <Send size={16} />
                <span>ارسال به گفتگو</span>
              </button>
            </div>

            <button
              type="button"
              onClick={handleStartNextRemittance}
              className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs transition-colors cursor-pointer"
            >
              ثبت و صدور حواله بعدی
            </button>
          </div>
        </div>,
        document.body
      )}

      {/* Printable Voucher Modal */}
      {printModalRecord && createPortal(
        <div className="fixed inset-0 z-[999999999] flex items-center justify-center p-3 sm:p-6 bg-slate-950/85 backdrop-blur-sm select-text overflow-y-auto" dir="rtl">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl p-5 sm:p-6 text-slate-900 space-y-5 border border-slate-300">
            {/* Top Toolbar */}
            <div className="flex justify-between items-center pb-3 border-b border-slate-200">
              <span className="font-black text-sm">پیش‌نمایش چاپ رسمی حواله فروش سایان (#{printModalRecord.docNo})</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm"
                >
                  <Printer size={16} />
                  <span>پرینت برگه</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPrintModalRecord(null)}
                  className="p-2 text-slate-500 hover:text-slate-800 rounded-xl"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Official Printable Sheet (A4 fit) */}
            <div id="sales-remittance-print-voucher" className="p-4 sm:p-6 bg-white border-2 border-slate-900 rounded-xl space-y-4">
              {/* Sheet Header */}
              <div className="flex justify-between items-center border-b-2 border-slate-900 pb-3">
                <div className="w-1/3">
                  <h2 className="text-base font-black text-slate-900">شرکت لپان بافت</h2>
                  <p className="text-xs text-slate-600 font-bold">سامانه مدیریت خروج کالا و انبارداری</p>
                </div>
                <div className="w-1/3 text-center">
                  <span className="px-3 py-1 rounded-lg border-2 border-slate-900 bg-slate-100 font-black text-sm">
                    حواله خروج و فروش کالا (OpCode 23)
                  </span>
                </div>
                <div className="w-1/3 text-left font-mono text-xs space-y-1">
                  <div>شماره حواله: <span className="font-black text-sm">#{printModalRecord.docNo}</span></div>
                  <div>شماره فرعی: <span className="font-bold">{printModalRecord.subNo}</span></div>
                  <div>تاریخ: <span className="font-bold">{printModalRecord.shamsiDate}</span></div>
                </div>
              </div>

              {/* Header Info Grid */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-2 rounded-lg bg-slate-50 border border-slate-300">
                  <span className="text-slate-500 block mb-0.5">تحویل‌گیرنده / خریدار:</span>
                  <span className="font-black text-sm text-slate-900">{printModalRecord.customerName}</span>
                </div>
                <div className="p-2 rounded-lg bg-slate-50 border border-slate-300">
                  <span className="text-slate-500 block mb-0.5">انبار مبدا تحویل:</span>
                  <span className="font-black text-sm text-slate-900">{printModalRecord.warehouseName || 'انبار تهران'}</span>
                </div>
              </div>

              {/* Items Table */}
              <div className="border-2 border-slate-900 rounded-lg overflow-hidden">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-100 border-b-2 border-slate-900 font-black">
                    <tr>
                      <th className="py-2 px-2 text-center w-10">ردیف</th>
                      <th className="py-2 px-2">بارکد / سری ساخت</th>
                      <th className="py-2 px-2">شرح کالا</th>
                      <th className="py-2 px-2 text-left">وزن خالص (kg)</th>
                      <th className="py-2 px-2 text-left">وزن ناخالص (kg)</th>
                      <th className="py-2 px-2 text-center">کارتن</th>
                      <th className="py-2 px-2 text-center">بوبین</th>
                      <th className="py-2 px-2">گرید</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {(printModalRecord.items || []).map((it: any, i: number) => (
                      <tr key={i}>
                        <td className="py-1.5 px-2 text-center font-mono">{i + 1}</td>
                        <td className="py-1.5 px-2 font-mono font-bold dir-ltr text-right">{it.barcode || it.batch}</td>
                        <td className="py-1.5 px-2 font-bold">{it.itemName || it.goodsName}</td>
                        <td className="py-1.5 px-2 text-left font-mono font-black">{Number(it.netWeight || it.netQty || 0).toLocaleString('fa-IR')}</td>
                        <td className="py-1.5 px-2 text-left font-mono">{Number(it.grossWeight || it.grossQty || 0).toLocaleString('fa-IR')}</td>
                        <td className="py-1.5 px-2 text-center font-mono">{it.cartonCount || 1}</td>
                        <td className="py-1.5 px-2 text-center font-mono">{it.bobbinCount || 56}</td>
                        <td className="py-1.5 px-2 font-mono">{it.grade || 'A'}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-100 border-t-2 border-slate-900 font-black">
                    <tr>
                      <td colSpan={3} className="py-2 px-2 text-left">جمع کل محموله:</td>
                      <td className="py-2 px-2 text-left font-mono text-sm text-blue-700">
                        {Number(printModalRecord.totalNetWeight || 0).toLocaleString('fa-IR')} kg
                      </td>
                      <td className="py-2 px-2 text-left font-mono">
                        {Number(printModalRecord.totalGrossWeight || 0).toLocaleString('fa-IR')} kg
                      </td>
                      <td className="py-2 px-2 text-center font-mono">{printModalRecord.totalCartons} کارتن</td>
                      <td className="py-2 px-2 text-center font-mono">{printModalRecord.totalBobbins}</td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Signatures */}
              <div className="grid grid-cols-4 gap-3 pt-6 text-center text-xs">
                <div className="border-t border-slate-400 pt-1">
                  <span className="font-bold text-slate-700">مسئول انبار / بارکدخوان</span>
                </div>
                <div className="border-t border-slate-400 pt-1">
                  <span className="font-bold text-slate-700">راننده / تحویل‌گیرنده</span>
                </div>
                <div className="border-t border-slate-400 pt-1">
                  <span className="font-bold text-slate-700">واحد فروش و بازرگانی</span>
                </div>
                <div className="border-t border-slate-400 pt-1">
                  <span className="font-bold text-slate-700">مدیریت مالی و خروج</span>
                </div>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default SayanSalesRemittanceIssuer;
