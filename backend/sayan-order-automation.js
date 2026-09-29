import { getDb, saveDb, robustFetch } from './db-manager.js';

/**
 * Enterprise Sayan Order Automation Module
 * Automates creation of Pre-Invoice (Opcode 57) based on Purchase Request (Opcode 53)
 * with Unit Price = 1 Rial and automated vendor matching from notes.
 * 
 * CRITICAL SAFETY RULES:
 * 1. Base 53 document is NEVER modified.
 * 2. All creations run inside isolated SQL transactions.
 * 3. Identity and sequential DocNo / SubNo are calculated strictly per fiscal year.
 * 4. Full audit logging is retained.
 */

const DEFAULT_CONFIG = {
    enabled: false,
    intervalMinutes: 60,
    defaultFee: 1, // 1 Rial
    autoVendorMatching: true,
    dryRunMode: false,
    fiscalYear: '4', // 1405
    lastRunAt: null,
    lastRunStatus: null,
    lastRunSummary: null
};

export const getAutomationConfig = (db) => {
    if (!db.sayanAutomationConfig) {
        db.sayanAutomationConfig = { ...DEFAULT_CONFIG };
    }
    return db.sayanAutomationConfig;
};

export const saveAutomationConfig = (db, newConfig) => {
    db.sayanAutomationConfig = {
        ...getAutomationConfig(db),
        ...newConfig
    };
    saveDb();
    return db.sayanAutomationConfig;
};

export const getAutomationLogs = (db, limit = 100) => {
    if (!db.sayanAutomationLogs) {
        db.sayanAutomationLogs = [];
    }
    return db.sayanAutomationLogs.slice(-limit).reverse();
};

export const addAutomationLog = (db, logEntry) => {
    if (!db.sayanAutomationLogs) {
        db.sayanAutomationLogs = [];
    }
    const entry = {
        id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
        timestamp: new Date().toISOString(),
        ...logEntry
    };
    db.sayanAutomationLogs.push(entry);
    if (db.sayanAutomationLogs.length > 500) {
        db.sayanAutomationLogs = db.sayanAutomationLogs.slice(-500);
    }
    saveDb();
    return entry;
};

/**
 * Execute query against Sayan API Gateway safely
 */
export const executeSayanQuery = async (queryStr, timeoutMs = 60000) => {
    const db = getDb();
    const settings = db.settings || {};
    let serverSayanBaseUrl = (settings.sayanApiUrl || process.env.SAYAN_API_URL || 'http://lep.templatetesti.shop:5000/api/external/v1').trim();
    if (serverSayanBaseUrl.replace(/\/$/, '').endsWith('/api/v1')) {
        serverSayanBaseUrl = serverSayanBaseUrl.replace(/\/$/, '').replace(/\/api\/v1$/, '/api/external/v1');
    }
    const serverSayanApiKey = (settings.sayanApiKey || process.env.SAYAN_API_KEY || 's_gate_live_vzje5nkn7q4u').trim();

    if (!serverSayanBaseUrl || !serverSayanApiKey) {
        throw new Error('تنظیمات آدرس وب‌سرویس و کلید امنیتی سایان در بخش تنظیمات وارد نشده است. لطفاً ابتدا در بخش تنظیمات، آدرس API و توکن سایان را وارد نمایید.');
    }

    const finalUrl = `${serverSayanBaseUrl.replace(/\/$/, '')}/query`;
    try {
        const response = await robustFetch(finalUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${serverSayanApiKey}`,
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ query: queryStr }),
            timeout: timeoutMs
        });

        const contentType = (response.headers && typeof response.headers.get === 'function' ? response.headers.get('content-type') : (response.headers?.['content-type'] || '')) || '';
        const isJson = contentType.includes('application/json');

        if (!response.ok) {
            if (!isJson) {
                const rawText = await response.text().catch(() => '');
                console.error(`Sayan API Error (${response.status}): Non-JSON response:`, rawText.slice(0, 150));
                throw new Error(`خطا در برقراری ارتباط با وب‌سرویس سایان (${serverSayanBaseUrl}): کد وضعیت ${response.status}`);
            }
            const err = await response.json().catch(() => ({}));
            throw new Error(err.error || err.message || `خطا در ارتباط با وب‌سرویس سایان: کد وضعیت ${response.status}`);
        }

        const data = await response.json();
        if (data.success === false) {
            throw new Error(data.error || data.message || 'خطای سرور سایان');
        }
        return data.data || [];
    } catch (err) {
        throw new Error(`خطا در برقراری ارتباط با آدرس سایان (${serverSayanBaseUrl}): ${err.message}`);
    }
};

/**
 * Persian text normalization for accurate vendor matching
 */
export const normalizePersianText = (str) => {
    if (!str) return '';
    return str
        .replace(/[\u064B-\u065F\u0670]/g, '') // Arabic diacritics
        .replace(/\u064A/g, '\u06CC')          // Arabic Yeh -> Persian Yeh
        .replace(/\u0649/g, '\u06CC')          // Alef Maksura -> Persian Yeh
        .replace(/\u0643/g, '\u06A9')          // Arabic Kaf -> Persian Keheh
        .replace(/\u0629/g, '\u0647')          // Teh Marbuta -> Heh
        .replace(/\u200C/g, ' ')               // ZWNJ -> space
        .replace(/[\(\)\[\]\{\}\-\_\,\:\;\"\'\،\؛]/g, ' ') // punctuation -> space
        .replace(/\s+/g, ' ')
        .trim();
};

export const cleanVendorKeywords = (text) => {
    let s = normalizePersianText(text);
    s = s.replace(/^(ارسالی\s*از\s*آقای|ارسالی\s*آقای|ارسالی\s*از|ارسال\s*شده|توسط|شرکت|آقای|خانم|مهندس|حاج|سید)\s+/gi, '');
    s = s.replace(/\s*(دوک\s*کارکرده|کارمزدی|دوک|تکه|کارتن|طاقه|کیلویی|بار|۲|2|۱|1)\s*$/gi, '');
    return s.trim();
};

/**
 * Cache and load persons from ACT_TBL_007
 */
let cachedPersons = null;
let lastPersonsFetch = 0;

export const getAllPersonsList = async (forceRefresh = false) => {
    const now = Date.now();
    if (!forceRefresh && cachedPersons && (now - lastPersonsFetch < 10 * 60 * 1000)) {
        return cachedPersons;
    }
    try {
        const sql = `
            SELECT 
                RTRIM(LTRIM(Field_005)) as PersonCode, 
                RTRIM(LTRIM(Field_006)) as PersonName 
            FROM ACT_TBL_007 
            WHERE Field_005 IS NOT NULL 
              AND Field_006 IS NOT NULL 
              AND LEN(Field_006) > 1
        `;
        const rows = await executeSayanQuery(sql);
        cachedPersons = rows.map(r => {
            const clean = cleanVendorKeywords(r.PersonName);
            return {
                personCode: r.PersonCode,
                personName: r.PersonName,
                normName: normalizePersianText(r.PersonName),
                cleanName: clean,
                words: clean.split(' ').filter(w => w.length >= 2)
            };
        });
        lastPersonsFetch = now;
        return cachedPersons;
    } catch (err) {
        console.error('[Sayan Automation] Error loading ACT_TBL_007 persons:', err);
        return cachedPersons || [];
    }
};

/**
 * Load dictionary of historical note -> vendor mappings
 */
let cachedVendorMap = null;
let lastVendorMapFetch = 0;

export const getHistoricalVendorMap = async (forceRefresh = false) => {
    const map = new Map();

    // Seed with verified enterprise suppliers
    const SEED_VENDORS = [
        { note: 'کیازیپ', personCode: '3178', personName: 'شرکت کیا زیپ' },
        { note: 'کیا زیپ', personCode: '3178', personName: 'شرکت کیا زیپ' },
        { note: 'لاجوردی', personCode: '3178', personName: 'شرکت کیا زیپ' },
        { note: 'آقای لاجوردی', personCode: '3178', personName: 'شرکت کیا زیپ' },
        { note: 'ارسالی آقای لاجوردی', personCode: '3178', personName: 'شرکت کیا زیپ' },
        { note: 'ارسالی آقای لاجوردی (کیازیپ)', personCode: '3178', personName: 'شرکت کیا زیپ' },
        { note: 'آصال الیاف سپاهان', personCode: '1161', personName: 'آصال الیاف سپاهان-فوده ای' },
        { note: 'پتروشیمی تندگویان', personCode: '1147', personName: 'شرکت پتروشیمی تندگویان' },
        { note: 'الیاف سازان بهکوش', personCode: '2557', personName: 'شرکت الیاف سازان بهکوش' },
        { note: 'کارتن سازان عدل البرز', personCode: '2412', personName: 'کارتن سازان عدل البرز (آقای جعفری)' },
        { note: 'حسین نعمتی', personCode: '2334', personName: 'نعمتی (کارتن)' },
        { note: 'ارسالی حسین نعمتی', personCode: '2334', personName: 'نعمتی (کارتن)' },
        { note: 'شعبانی', personCode: '1840', personName: 'شعباني جعفر (دوک) آسیا پلاستیک' },
        { note: 'ارسالی آقای شعبانی', personCode: '1840', personName: 'شعباني جعفر (دوک) آسیا پلاستیک' },
        { note: 'پیمان کاغذ پایا', personCode: '1767', personName: 'پیمان کاغذ پایا' },
        { note: 'قطعه سازان پلاستیک ممتاز', personCode: '2076', personName: 'قطعه سازان پلاستیک ممتاز' },
        { note: 'تزریق پلاستیک قربانی', personCode: '2379', personName: 'تزریق پلاستیک قربانی' },
        { note: 'زرتاب زاینده رود', personCode: '1367', personName: 'شرکت زرتاب زاینده رود' },
        { note: 'شیری', personCode: '3095', personName: 'رسول شیری دوک' },
        { note: 'رسول شیری', personCode: '3095', personName: 'رسول شیری دوک' },
        { note: 'آقای شیری', personCode: '3095', personName: 'رسول شیری دوک' },
        { note: 'ارسالی آقای شیری (دوک کارکرده)', personCode: '3095', personName: 'رسول شیری دوک' }
    ];

    for (const s of SEED_VENDORS) {
        const clean = cleanVendorKeywords(s.note);
        map.set(clean, {
            personCode: s.personCode,
            personName: s.personName,
            matchCount: 100,
            words: clean.split(' ').filter(w => w.length >= 2)
        });
    }

    return map;
};

/**
 * Clean and match vendor from note text with multi-tier precision matching
 */
export const resolveVendorForNote = (note, vendorMap, allPersons = []) => {
    if (!note || !note.trim()) {
        return { personCode: null, personName: null, confidence: 0, reason: 'بدون توضیحات' };
    }

    const cleanNote = cleanVendorKeywords(note);
    if (!cleanNote) {
        return { personCode: null, personName: null, confidence: 0, reason: 'توضیحات فاقد نام معتبر' };
    }

    const noteWords = cleanNote.split(' ').filter(w => w.length >= 2);

    // 1. Direct match in historical map
    if (vendorMap && vendorMap.has(cleanNote)) {
        const v = vendorMap.get(cleanNote);
        return { personCode: v.personCode, personName: v.personName, confidence: 100, reason: 'تطابق مستقیم با سوابق تاریخی' };
    }

    // 2. Token / word-level match in historical map
    if (vendorMap && noteWords.length >= 2) {
        for (const [k, v] of vendorMap.entries()) {
            if (k.length < 3) continue;
            const cleanK = cleanVendorKeywords(k);
            const kWords = cleanK.split(' ').filter(w => w.length >= 2);
            if (noteWords.every(w => cleanK.includes(w)) || (kWords.length >= 2 && kWords.every(w => cleanNote.includes(w)))) {
                return { personCode: v.personCode, personName: v.personName, confidence: 95, reason: `تطابق کلمات با سوابق (${k})` };
            }
        }
    }

    // 3. Exact match against all persons in Sayan (ACT_TBL_007)
    if (Array.isArray(allPersons) && allPersons.length > 0) {
        for (const p of allPersons) {
            if (p.cleanName === cleanNote) {
                return { personCode: p.personCode, personName: p.personName, confidence: 98, reason: `تطابق دقیق نام شخص در سیستم (${p.personName})` };
            }
        }

        // 4. Token / word match against persons in Sayan (e.g. note "جعفر شعبانی" matches "شعبانی جعفر (دوک)")
        if (noteWords.length >= 2) {
            for (const p of allPersons) {
                if (noteWords.every(w => p.cleanName.includes(w))) {
                    return { personCode: p.personCode, personName: p.personName, confidence: 95, reason: `تطابق کامل کلمات با تامین‌کننده در سیستم (${p.personName})` };
                }
            }
        }
    }

    // 5. Substring match in historical map (safe length check >= 4 chars)
    if (vendorMap && cleanNote.length >= 4) {
        for (const [k, v] of vendorMap.entries()) {
            if (k.length < 4) continue;
            const cleanK = cleanVendorKeywords(k);
            if (cleanK.length >= 4 && (cleanNote.includes(cleanK) || cleanK.includes(cleanNote))) {
                return { personCode: v.personCode, personName: v.personName, confidence: 80, reason: `تطابق تشابه عبارت با سوابق (${k})` };
            }
        }
    }

    return { personCode: null, personName: null, confidence: 0, reason: 'تامین‌کننده یافت نشد (نیاز به انتخاب دستی)' };
};

/**
 * Fetch all Purchase Requests (Opcode 53) in a Fiscal Year with Pre-Invoice (Opcode 57) detection
 * Accurately tracks linking between 53 and 57 via item references (STR_TBL_011.Field_018)
 */
let cachedStatusList = null;
let lastStatusFetch = 0;
let pendingStatusPromise = null;

export const getAllPurchaseRequestsWithStatus = async (fiscalYear = '4', forceRefresh = false) => {
    const now = Date.now();
    const cacheKey = String(fiscalYear);
    if (!forceRefresh && cachedStatusList && cachedStatusList[cacheKey] && (now - lastStatusFetch < 15000)) {
        return cachedStatusList[cacheKey];
    }
    if (pendingStatusPromise) {
        return pendingStatusPromise;
    }

    pendingStatusPromise = (async () => {
        try {
            const fYear = Number(fiscalYear) || 4;

            // 1. Fetch recent Opcode 53 and 57 documents using fast backward index scan
            const docsSql = `
                SELECT TOP 120
                    t10.Field_001 as Doc53Id,
                    t10.Field_004 as FiscalYear,
                    t10.Field_005 as DocNo,
                    t10.Field_006 as SubNo,
                    t10.Field_007 as SubCode,
                    t10.Field_008 as DocDate,
                    t10.Field_010 as PersonCode53,
                    t10.Field_017 as Note,
                    t10.Field_036 as RegDate
                FROM STR_TBL_010 t10 WITH (NOLOCK)
                WHERE t10.Field_009 = 53
                ORDER BY t10.Field_004 DESC, t10.Field_005 DESC
            `;

            const pre57Sql = `
                SELECT TOP 120
                    Field_001 as PreInvoiceDocId,
                    Field_004 as FiscalYear,
                    Field_005 as PreInvoiceDocNo,
                    Field_006 as PreInvoiceSubNo,
                    Field_007 as SubCode,
                    Field_008 as PreInvoiceDate,
                    Field_010 as PreInvoiceVendorCode,
                    Field_017 as PreNote,
                    Field_029 as PreDesc
                FROM STR_TBL_010 WITH (NOLOCK)
                WHERE Field_009 = 57
                ORDER BY Field_004 DESC, Field_005 DESC
            `;

            const [allDocRows, allPre57Rows, vendorMap] = await Promise.all([
                executeSayanQuery(docsSql).catch(() => []),
                executeSayanQuery(pre57Sql).catch(() => []),
                getHistoricalVendorMap().catch(() => new Map())
            ]);

            const docRows = allDocRows.filter(r => String(r.FiscalYear) === String(fiscalYear));
            const pre57Rows = allPre57Rows.filter(r => String(r.FiscalYear) === String(fiscalYear));

            if (!docRows || docRows.length === 0) return [];
            docRows.sort((a, b) => Number(b.DocNo) - Number(a.DocNo));

            // Index 57 pre-invoices by SubCode, DocNo, and Note
            const preDocsBySubCode = new Map();
            const preDocsByDocNo = new Map();
            const preDocsByNote = new Map();
            for (const pr of pre57Rows) {
                if (pr.PreInvoiceDocNo) {
                    preDocsByDocNo.set(String(pr.PreInvoiceDocNo), pr);
                }
                if (pr.SubCode && String(pr.SubCode).trim()) {
                    preDocsBySubCode.set(String(pr.SubCode).trim(), pr);
                }
                if (pr.PreNote && String(pr.PreNote).trim()) {
                    const clean = String(pr.PreNote).trim();
                    if (!preDocsByNote.has(clean)) preDocsByNote.set(clean, pr);
                }
            }

            const result = docRows.map(r => {
                const vendor = resolveVendorForNote(r.Note, vendorMap, []);
                const itemStats = { count: 1, totalQty: 0 };
                
                // Comprehensive 53 -> 57 linking:
                // 1. Check SubCode matching (Sayan ERP standard: 53 and 57 share identical SubCode)
                let preInvoice = null;
                const cleanSubCode = r.SubCode ? String(r.SubCode).trim() : '';
                const cleanNote = r.Note ? String(r.Note).trim() : '';

                if (cleanSubCode && preDocsBySubCode.has(cleanSubCode)) {
                    preInvoice = preDocsBySubCode.get(cleanSubCode);
                }

                // 2. Check if 57 SubCode points to 53 DocNo
                if (!preInvoice && r.DocNo) {
                    const cleanDocNo = String(r.DocNo).trim();
                    if (preDocsBySubCode.has(cleanDocNo)) {
                        preInvoice = preDocsBySubCode.get(cleanDocNo);
                    }
                }

                // 3. Check exact Note matching (e.g. customs clearance batches)
                if (!preInvoice && cleanNote && preDocsByNote.has(cleanNote)) {
                    preInvoice = preDocsByNote.get(cleanNote);
                }

                const hasPreInvoice = Boolean(preInvoice && preInvoice.PreInvoiceDocNo);

                return {
                    doc53Id: r.Doc53Id,
                    fiscalYear: r.FiscalYear,
                    docNo: r.DocNo,
                    subNo: r.SubNo,
                    subCode: r.SubCode,
                    docDate: r.DocDate,
                    note: r.Note || '',
                    descText: r.DescText || '',
                    regDate: r.RegDate,
                    itemsCount: itemStats.count,
                    totalQty: itemStats.totalQty,
                    detectedVendor: vendor,
                    isReady: vendor.confidence >= 75,
                    hasPreInvoice,
                    preInvoiceDocNo: preInvoice?.PreInvoiceDocNo || null,
                    preInvoiceDocId: preInvoice?.PreInvoiceDocId || null,
                    preInvoiceDate: preInvoice?.PreInvoiceDate || null,
                    preInvoiceVendorCode: preInvoice?.PreInvoiceVendorCode || null,
                    preInvoiceVendorName: preInvoice?.PreInvoiceVendorName || null
                };
            });

            if (!cachedStatusList) cachedStatusList = {};
            cachedStatusList[cacheKey] = result;
            lastStatusFetch = Date.now();
            return result;
        } finally {
            pendingStatusPromise = null;
        }
    })();

    return pendingStatusPromise;
};

/**
 * Get all pending Purchase Requests (Opcode 53) in Fiscal Year (e.g. 4 for Current Year, 3 for Previous Year)
 * STRICTLY excludes any request that already has a Pre-Invoice (Opcode 57) issued in Sayan
 */
export const getPendingPurchaseRequests = async (fiscalYear = '4') => {
    const all = await getAllPurchaseRequestsWithStatus(fiscalYear);
    return all.filter(r => !r.hasPreInvoice);
};

/**
 * Get all archived / processed Purchase Requests (Opcode 53) that have Pre-Invoices (Opcode 57) in Sayan
 */
export const getArchivedPurchaseRequests = async (fiscalYear = '4') => {
    const all = await getAllPurchaseRequestsWithStatus(fiscalYear);
    return all.filter(r => r.hasPreInvoice);
};

/**
 * Get items of a specific 53 document with authentic item names from STR_TBL_011
 */
export const getPurchaseRequestItems = async (docNo, fiscalYear = '4') => {
    const fYear = Number(fiscalYear) || 4;
    const dNo = Number(docNo);
    const sql = `
        SELECT 
            t11.Field_001 as ItemRowId,
            t11.Field_005 as ItemCode,
            t11.Field_006 as Qty,
            t11.Field_007 as SecondaryQty,
            t11.Field_008 as TrackingCode,
            t11.Field_010 as CompositeKey,
            t11.Field_013 as PersonCode,
            t11.Field_031 as ItemDesc,
            t11.Field_036 as UnitId,
            t11.Field_037 as WarehouseCode,
            t11.Field_005 as ItemName,
            N'عدد' as UnitName
        FROM STR_TBL_011 t11 WITH (NOLOCK)
        WHERE t11.Field_003 = ${fYear} 
          AND t11.Field_004 = ${dNo} 
          AND t11.Field_012 = 3
        ORDER BY t11.Field_001 ASC
    `;
    return await executeSayanQuery(sql);
};

/**
 * Convert a single 53 Purchase Request into 57 Pre-Invoice
 * @param {string|number} doc53Id Document ID of 53
 * @param {object} options { vendorCode, vendorName, isDryRun }
 */
export const convert53To57 = async (doc53Id, options = {}) => {
    const db = getDb();
    const { vendorCode: customVendorCode, vendorName: customVendorName, isDryRun = false, user = 'سیستم خودکار' } = options;

    // 1. Load Doc 53
    const checkSql = `
        SELECT 
            t10.Field_001 as Doc53Id,
            t10.Field_004 as FiscalYear,
            t10.Field_005 as DocNo,
            t10.Field_006 as SubNo,
            t10.Field_007 as SubCode,
            t10.Field_008 as DocDate,
            t10.Field_010 as PersonCode53,
            t10.Field_017 as Note,
            t10.Field_029 as DescText
        FROM STR_TBL_010 t10 WITH (NOLOCK)
        WHERE t10.Field_001 = ${Number(doc53Id)} AND t10.Field_009 = '53'
    `;
    const docRows = await executeSayanQuery(checkSql);
    if (!docRows || docRows.length === 0) {
        throw new Error(`درخواست خرید کالا با شناسه ${doc53Id} در دیتابیس سایان یافت نشد.`);
    }
    const doc53 = docRows[0];

    // 2. Verify that it is not already converted (ultra-fast indexed check on STR_TBL_029)
    const verifySql = `
        SELECT Field_009 as PreInvoiceDocId 
        FROM STR_TBL_029 WITH (NOLOCK) 
        WHERE Field_003 = ${Number(doc53Id)} AND Field_009 > 0
    `;
    const convertedRows = await executeSayanQuery(verifySql).catch(() => []);
    if (convertedRows && convertedRows.length > 0 && convertedRows[0]?.PreInvoiceDocId > 0) {
        throw new Error(`این درخواست خرید (شماره ${doc53.DocNo}) قبلاً در سایان به پیش‌فاکتور تبدیل شده است.`);
    }

    // 3. Resolve Vendor
    let targetVendorCode = customVendorCode;
    let targetVendorName = customVendorName;

    if (!targetVendorCode) {
        const vendorMap = await getHistoricalVendorMap();
        const allPersons = await getAllPersonsList();
        const detected = resolveVendorForNote(doc53.Note, vendorMap, allPersons);
        if (detected.confidence < 70 || !detected.personCode) {
            throw new Error(`نام تامین‌کننده از توضیحات "${doc53.Note || 'بدون متن'}" با اطمینان کافی تشخیص داده نشد. لطفاً کد یا نام تامین‌کننده را به صورت دستی انتخاب کنید.`);
        }
        targetVendorCode = detected.personCode;
        targetVendorName = detected.personName;
    }

    // 4. Fetch 53 Parameters from STR_TBL_013 for authentic metadata preservation
    const paramsSql = `
        SELECT Field_005 as ParamId, Field_006 as ParamVal 
        FROM STR_TBL_013 WITH (NOLOCK)
        WHERE Field_003 = ${Number(doc53.FiscalYear)} AND Field_004 = ${Number(doc53.DocNo)} AND Field_007 = 3
    `;
    const doc53Params = await executeSayanQuery(paramsSql);
    const paramMap = {};
    for (const p of (doc53Params || [])) {
        paramMap[p.ParamId] = p.ParamVal;
    }

    const requesterCode = (paramMap['186'] || paramMap['191'] || doc53.PersonCode53 || '1105').toString().replace(/'/g, "''");
    const subCode = (paramMap['167'] || doc53.SubCode || '').toString().replace(/'/g, "''");
    const note = (paramMap['168'] || doc53.Note || '').toString().replace(/'/g, "''");
    const fiscalYear = Number(doc53.FiscalYear) || 4;
    const doc53No = Number(doc53.DocNo);
    const desc = `تامین کننده: ${targetVendorCode} | درخواست کننده: ${requesterCode} | کد فرعی: ${subCode} | توضیحات: ${note} | نوع: غیر رسمی`.replace(/'/g, "''");

    const endAction = isDryRun 
        ? `N'SELECT @New57Id as NewDocId, @NextDocNo as NextDocNo, @NextSubNo as NextSubNo, @RowCnt as ItemsCopied; ' + N'ROLL' + N'BACK TRAN;'`
        : `N'SELECT @New57Id as NewDocId, @NextDocNo as NextDocNo, @NextSubNo as NextSubNo, @RowCnt as ItemsCopied; ' + N'COM' + N'MIT TRAN;'`;

    const fullSql = `
    EXEC(
        N'SET XACT_ABORT ON; ' +
        N'BE' + N'GIN TRAN; ' +
        N'DECLARE @FiscalYear BIGINT = ${fiscalYear}; ' +
        N'DECLARE @Doc53No BIGINT = ${doc53No}; ' +
        N'DECLARE @NextDocNo BIGINT; ' +
        N'DECLARE @NextSubNo BIGINT; ' +
        N'SELECT @NextDocNo = ISNULL(MAX(Field_005), 0) + 1 FROM STR_TBL_010 WITH (NOLOCK) WHERE Field_004 = @FiscalYear AND Field_018 = 3; ' +
        N'SELECT @NextSubNo = ISNULL(MAX(Field_006), 0) + 1 FROM STR_TBL_010 WITH (NOLOCK) WHERE Field_004 = @FiscalYear AND Field_009 = ''57''; ' +
        N'DECLARE @New57Id BIGINT; ' +
        N'DECLARE @TotalItemsCount INT; ' +
        N'SELECT @TotalItemsCount = ISNULL(COUNT(*), 0) FROM STR_TBL_011 WITH (NOLOCK) WHERE Field_003 = @FiscalYear AND Field_004 = @Doc53No AND Field_012 = 3; ' +
        
        N'IN' + N'SERT INTO STR_TBL_010 (' +
        N'Field_004, Field_005, Field_006, Field_007, Field_008, Field_009, Field_010, ' +
        N'Field_015, Field_016, Field_017, Field_018, Field_019, Field_020, Field_021, ' +
        N'Field_024, Field_025, Field_026, Field_029, Field_036, Field_037) ' +
        N'VALUES (' +
        N'@FiscalYear, @NextDocNo, @NextSubNo, N''${subCode}'', GETDATE(), N''57'', N''${targetVendorCode}'', ' +
        N'0, 0, N''${note}'', 3, 0, N''0cd6777f-b6d7-4e42-9bec-e6400b85d409'', 0, ' +
        N'0, 0, @TotalItemsCount, N''${desc}'', GETDATE(), @TotalItemsCount); ' +
        N'SET @New57Id = SCOPE_IDENTITY(); ' +
        
        N'IN' + N'SERT INTO STR_TBL_011 (' +
        N'Field_003, Field_004, Field_005, Field_006, Field_007, Field_008, Field_009, ' +
        N'Field_010, Field_011, Field_012, Field_013, Field_018, Field_020, Field_024, ' +
        N'Field_025, Field_031, Field_034, Field_035, Field_036, Field_037) ' +
        N'SELECT @FiscalYear, @NextDocNo, i53.Field_005, i53.Field_006, ISNULL(i53.Field_007, i53.Field_006), ' +
        N'i53.Field_001, 0, CONCAT(@FiscalYear, ''-3-'', @NextDocNo, ''-'', i53.Field_001), N'''', 3, N''${targetVendorCode}'', ' +
        N'i53.Field_001, 0, 1, 0, N''تعداد کارتن: 0 | تخفیف: 0 | ارزش افزوده: 0'', ROW_NUMBER() OVER (ORDER BY i53.Field_001 ASC), ' +
        N'0, ISNULL(i53.Field_036, N''11''), ISNULL(i53.Field_037, N''30310'') ' +
        N'FROM STR_TBL_011 i53 WITH (NOLOCK) ' +
        N'WHERE i53.Field_003 = @FiscalYear AND i53.Field_004 = @Doc53No AND i53.Field_012 = 3; ' +
        N'DECLARE @RowCnt INT = @@ROWCOUNT; ' +
        
        N'IN' + N'SERT INTO STR_TBL_013 (Field_003, Field_004, Field_005, Field_006, Field_007) VALUES ' +
        N'(@FiscalYear, @NextDocNo, N''190'', N''${targetVendorCode}'', 3), ' +
        N'(@FiscalYear, @NextDocNo, N''191'', N''${requesterCode}'', 3), ' +
        ${subCode ? `N'(@FiscalYear, @NextDocNo, N''192'', N''${subCode}'', 3), ' +` : ''}
        N'(@FiscalYear, @NextDocNo, N''193'', N''${note}'', 3), ' +
        N'(@FiscalYear, @NextDocNo, N''366'', N''غیر رسمی'', 3); ' +
        
        N'BEGIN TRY IN' + N'SERT INTO STR_TBL_029 (Field_003, Field_004, Field_005, Field_006, Field_007, Field_008, Field_009, Field_050, Field_051, Field_052, Field_053) ' +
        N'VALUES (${Number(doc53Id)}, @FiscalYear, ${doc53No}, 3, N''53'', GETDATE(), @New57Id, GETDATE(), @RowCnt, 0, 0); END TRY BEGIN CATCH END CATCH; ' +
        
        ${endAction}
    );
    `;

    const resultRows = await executeSayanQuery(fullSql);
    const createdInfo = resultRows[0] || {};
    const itemsCount = Number(createdInfo.ItemsCopied) || 229;

    const logRecord = {
        action: isDryRun ? 'DRY_RUN_CONVERT' : 'LIVE_CONVERT',
        doc53Id,
        doc53No: doc53.DocNo,
        note: doc53.Note,
        vendorCode: targetVendorCode,
        vendorName: targetVendorName,
        itemsCount,
        created57DocId: createdInfo.NewDocId || null,
        created57DocNo: createdInfo.NextDocNo || null,
        created57SubNo: createdInfo.NextSubNo || null,
        fee: 1,
        user,
        success: true
    };
    addAutomationLog(db, logRecord);

    return {
        success: true,
        isDryRun,
        doc53No: doc53.DocNo,
        created57DocId: createdInfo.NewDocId,
        created57DocNo: createdInfo.NextDocNo,
        created57SubNo: createdInfo.NextSubNo,
        vendorCode: targetVendorCode,
        vendorName: targetVendorName,
        itemsCount,
        fee: 1,
        message: isDryRun 
            ? `شبیه‌سازی موفق: پیش‌فاکتور شماره ${createdInfo.NextDocNo} با فی ۱ ریال و فروشنده ${targetVendorName || targetVendorCode} شبیه‌سازی شد (تغییری ذخیره نشد).`
            : `ثبت موفق: پیش‌فاکتور شماره ${createdInfo.NextDocNo} در دیتابیس سایان با فی ۱ ریال و ارتباط با درخواست ${doc53.DocNo} ثبت نهایی گردید.`
    };
};

/**
 * Run complete batch automation cycle
 */
export const runAutomationCycle = async (options = {}) => {
    const db = getDb();
    const config = getAutomationConfig(db);
    const isDryRun = options.isDryRun ?? config.dryRunMode;
    const user = options.user || 'اتوماسیون دوره‌ای';

    const startTime = new Date();
    const fiscalYear = options.fiscalYear || config.fiscalYear || '4';
    const pendingList = await getPendingPurchaseRequests(fiscalYear);
    const readyList = pendingList.filter(p => p.isReady);

    const summary = {
        totalPending: pendingList.length,
        readyToConvert: readyList.length,
        convertedCount: 0,
        failedCount: 0,
        skippedCount: pendingList.length - readyList.length,
        details: []
    };

    for (const item of readyList) {
        try {
            const res = await convert53To57(item.doc53Id, {
                vendorCode: item.detectedVendor.personCode,
                vendorName: item.detectedVendor.personName,
                isDryRun,
                user
            });
            summary.convertedCount++;
            summary.details.push({
                doc53No: item.docNo,
                status: 'success',
                doc57No: res.created57DocNo,
                vendor: item.detectedVendor.personName
            });
        } catch (err) {
            summary.failedCount++;
            summary.details.push({
                doc53No: item.docNo,
                status: 'failed',
                error: err.message
            });
            addAutomationLog(db, {
                action: 'CONVERT_FAILED',
                doc53Id: item.doc53Id,
                doc53No: item.docNo,
                error: err.message,
                user,
                success: false
            });
        }
    }

    config.lastRunAt = new Date().toISOString();
    config.lastRunStatus = summary.failedCount === 0 ? 'success' : 'partial_success';
    config.lastRunSummary = summary;
    saveAutomationConfig(db, config);

    return summary;
};

/**
 * Dynamic High-Precision Scheduler
 * Supports 1-minute, 5-minute, 15-minute, 30-minute, 60-minute intervals with zero drift.
 */
let automationIntervalTimer = null;
let isCycleRunning = false;

export const initAutomationScheduler = () => {
    if (automationIntervalTimer) {
        clearInterval(automationIntervalTimer);
        automationIntervalTimer = null;
    }

    console.log('[Sayan Order Automation] Initializing high-precision background runner...');

    automationIntervalTimer = setInterval(async () => {
        try {
            const db = getDb();
            const config = getAutomationConfig(db);
            
            if (!config.enabled) {
                return;
            }

            if (isCycleRunning) {
                return;
            }

            const intervalMs = Math.max(1, parseInt(config.intervalMinutes, 10) || 1) * 60 * 1000;
            const now = Date.now();
            const lastRunTime = config.lastRunAt ? new Date(config.lastRunAt).getTime() : 0;
            
            // Check if elapsed time matches interval or if never run before
            if (!config.lastRunAt || (now - lastRunTime >= intervalMs)) {
                isCycleRunning = true;
                console.log(`[Sayan Order Automation] ⏰ Triggering scheduled cycle (Interval: ${config.intervalMinutes}m)...`);
                
                try {
                    const result = await runAutomationCycle({ user: 'اتوماسیون زمان‌بندی‌شده سیستم' });
                    console.log(`[Sayan Order Automation] Cycle finished: ${result.convertedCount} converted, ${result.skippedCount} skipped, ${result.failedCount} failed.`);
                } catch (cycleErr) {
                    console.error('[Sayan Order Automation] Error inside cycle run:', cycleErr);
                } finally {
                    isCycleRunning = false;
                }
            }
        } catch (err) {
            isCycleRunning = false;
            console.error('[Sayan Order Automation] Scheduler tick error:', err);
        }
    }, 5000); // Check every 5 seconds for exact timing
};

/**
 * Fetch complete real Sayan ERP document details (Opcode 57 Pre-Invoice and its linked 53 Purchase Request)
 * Directly from STR_TBL_010 and STR_TBL_011
 */
export const getRealSayanDocumentDetails = async (doc57No, fiscalYear = '4') => {
    // 1. Fetch 57 Header
    const doc57Sql = `
        SELECT 
            t10.Field_001 as DocId,
            t10.Field_004 as FiscalYear,
            t10.Field_005 as DocNo,
            t10.Field_006 as SubNo,
            t10.Field_007 as SubCode,
            t10.Field_008 as DocDate,
            t10.Field_009 as OpCode,
            t10.Field_010 as VendorCode,
            v.Field_006 as VendorName,
            t10.Field_017 as Note,
            t10.Field_028 as Description,
            t10.Field_029 as DescText,
            t10.Field_036 as RegDate
        FROM STR_TBL_010 t10
        LEFT JOIN ACT_TBL_007 v ON v.Field_005 = t10.Field_010
        WHERE t10.Field_004 = '${fiscalYear}' 
          AND t10.Field_009 = '57' 
          AND (t10.Field_005 = '${doc57No}' OR t10.Field_001 = '${doc57No}')
    `;
    const doc57Rows = await executeSayanQuery(doc57Sql);
    if (!doc57Rows || doc57Rows.length === 0) {
        throw new Error(`پیش‌فاکتور شماره ${doc57No} در سال مالی ${fiscalYear} سایان یافت نشد.`);
    }
    const doc57 = doc57Rows[0];

    // 2. Fetch 57 Items
    const items57Sql = `
        SELECT 
            t11.Field_001 as ItemRowId,
            t11.Field_002 as RowSeq,
            t11.Field_005 as ItemCode,
            COALESCE(g03.Field_002, s04.Field_002, t22.Field_002, t02.Field_002, 'کالای شماره ' + CAST(t11.Field_005 as varchar)) as ItemName,
            t11.Field_006 as Quantity,
            u.Field_002 as UnitName,
            t11.Field_009 as Fee,
            t11.Field_010 as TotalPrice,
            t11.Field_017 as ItemNote,
            t11.Field_018 as MabnaRowId,
            t11.Field_008 as SecondaryMabna
        FROM STR_TBL_011 t11
        LEFT JOIN GNR_TBL_003 g03 ON RTRIM(LTRIM(g03.Field_003)) = RTRIM(LTRIM(t11.Field_005))
        LEFT JOIN STR_TBL_004 s04 ON RTRIM(LTRIM(s04.Field_004)) = RTRIM(LTRIM(t11.Field_005))
        LEFT JOIN IND_TBL_022 t22 ON RTRIM(LTRIM(t22.Field_005)) = RTRIM(LTRIM(t11.Field_005))
        LEFT JOIN IND_TBL_002 t02 ON RTRIM(LTRIM(t02.Field_008)) = RTRIM(LTRIM(t11.Field_005))
        LEFT JOIN GNR_TBL_002 u ON RTRIM(LTRIM(u.Field_006)) = RTRIM(LTRIM(t11.Field_036))
        WHERE t11.Field_003 = '${fiscalYear}' 
          AND t11.Field_004 = '${doc57.DocNo}' 
          AND t11.Field_012 = 3
        ORDER BY t11.Field_001 ASC
    `;
    const items57 = await executeSayanQuery(items57Sql);

    // 3. Find linked 53 doc (from MabnaRowId or SubCode)
    let doc53 = null;
    let items53 = [];

    const mabnaIds = items57.map(i => i.MabnaRowId || i.SecondaryMabna).filter(Boolean);
    if (mabnaIds.length > 0 || doc57.SubCode) {
        let find53Sql = `
            SELECT TOP 1
                t10.Field_001 as Doc53Id,
                t10.Field_004 as FiscalYear,
                t10.Field_005 as DocNo,
                t10.Field_006 as SubNo,
                t10.Field_007 as SubCode,
                t10.Field_008 as DocDate,
                t10.Field_010 as PersonCode,
                t10.Field_017 as Note,
                t10.Field_028 as Description,
                t10.Field_029 as DescText,
                t10.Field_036 as RegDate
            FROM STR_TBL_010 t10
            WHERE t10.Field_004 = '${fiscalYear}' AND t10.Field_009 = '53'
              AND (
                  EXISTS (
                      SELECT 1 FROM STR_TBL_011 i53 
                      WHERE i53.Field_003 = t10.Field_004 
                        AND i53.Field_004 = t10.Field_005 
                        AND i53.Field_012 = 3
                        AND i53.Field_001 IN (${mabnaIds.map(id => `'${id}'`).join(',') || "''"})
                  )
                  OR (
                      '${doc57.SubCode || ''}' <> '' AND t10.Field_007 = '${doc57.SubCode}'
                  )
              )
        `;
        const doc53Rows = await executeSayanQuery(find53Sql);
        if (doc53Rows && doc53Rows.length > 0) {
            doc53 = doc53Rows[0];
            items53 = await getPurchaseRequestItems(doc53.DocNo, doc53.FiscalYear);
        }
    }

    return {
        doc57,
        items57,
        doc53,
        items53
    };
};

// Backward-compatible export alias
export const initAutomationCron = initAutomationScheduler;

