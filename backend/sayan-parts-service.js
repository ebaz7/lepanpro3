import { getDb, saveDb, robustFetch, sanitizeSayanUrl } from './db-manager.js';

// Pre-defined category mapping based on Sayan 0310* codes
const CATEGORY_MAP = {
    '03': 'قطعات و ماشین‌آلات',
    '031001': 'کاورینگ',
    '031002': 'برق و الکتریکال',
    '031003': 'استرج',
    '031004': 'تسمه و پولی',
    '031005': 'لوازم لوله‌کشی و تاسیسات',
    '031006': 'خط تولید POY',
    '031007': 'بسته‌بندی و ملزومات',
    '031008': 'قطعات شوایتر جدید',
    '031009': 'بلبرینگ و یاتاقان',
    '031010': 'کمپرسور و پنوماتیک',
    '031011': 'پولی و اتصالات دنده‌ای',
    '031012': 'قطعات لیفتراک و خودرویی',
    '031013': 'الکتروموتور، دینام و پمپ',
    '031014': 'چسب و عایق',
    '031015': 'ابزارآلات کارگاهی',
    '031016': 'تجهیزات ایمنی و HSE',
    '031017': 'حراست و انتظامات',
    '031018': 'ملزومات رفاهی و عمومی',
    '031019': 'لوازم اداری و مصرفی',
    '031020': 'فرم‌ها و اوراق',
    '031021': 'سوخت و مواد شیمیایی',
    '031022': 'وسایل رفاهی',
    '031023': 'قطعات کرکره برقی',
    '031024': 'قطعات درب و قفل',
    '031025': 'ملزومات سالن تولید',
    '031026': 'تاسیسات عمرانی و ساختمانی',
    '031027': 'خدمات و نظافت',
    '031028': 'کپسول و آتش‌نشانی',
    '031030': 'دوربین و قطعات شبکه',
    '031031': 'قطعات دیزل ژنراتور',
    '031032': 'لوازم و قطعات هوا برش',
    '031034': 'انبار قطعات و ملزومات کارخانه'
};

export const normalizePersianText = (str) => {
    if (!str || typeof str !== 'string') return '';
    return str
        .replace(/[\u064A\u0649]/g, 'ی')
        .replace(/[\u0643]/g, 'ک')
        .replace(/[\u200B\u200C\u200D\uFEFF]/g, ' ')
        .replace(/[۰-۹]/g, d => '0123456789'['۰۱۲۳۴۵۶۷۸۹'.indexOf(d)])
        .replace(/[٠-٩]/g, d => '0123456789'['٠١٢٣٤٥٦٧٨٩'.indexOf(d)])
        .replace(/[\(\)\[\]\{\}\-_,\.؛:\/\\\|\+]/g, ' ')
        .replace(/\s+/g, ' ')
        .toLowerCase()
        .trim();
};

// In-memory LRU-like cache for match & stock queries (TTL: 2 minutes)
const matchResultCache = new Map();
const matchResultCacheTimestamps = new Map();
const CACHE_TTL_MS = 120000;

/**
 * Execute query on Sayan ERP with robust error handling and timeout
 */
export const querySayanDirect = async (db, sqlQuery, timeoutMs = 25000) => {
    const settings = db.settings || {};
    const sayanUrl = sanitizeSayanUrl(settings.sayanApiUrl || process.env.SAYAN_API_URL || 'http://80.210.31.176:5000/api/external/v1');
    const sayanKey = settings.sayanApiKey || process.env.SAYAN_API_KEY || 's_gate_live_vzje5nkn7q4u';

    if (!sayanUrl || !sayanKey) {
        throw new Error('آدرس و کلید وب‌سرویس سایان در تنظیمات تعریف نشده است.');
    }

    const endpoint = `${sayanUrl}/query`;
    const response = await robustFetch(endpoint, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${sayanKey}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        },
        body: JSON.stringify({ query: sqlQuery }),
        timeout: timeoutMs
    });

    if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error || errJson.message || `خطا در اجرای کوئری سایان (${response.status})`);
    }

    const json = await response.json();
    return json.data || [];
};

/**
 * Detect unit from title or default to 'عدد'
 */
const detectUnit = (title) => {
    if (!title) return 'عدد';
    if (/کیلو|گرم|وزن/i.test(title)) return 'کیلوگرم';
    if (/متر|طاقه/i.test(title)) return 'متر';
    if (/لیتر|گالن/i.test(title)) return 'لیتر';
    if (/شاخه/i.test(title)) return 'شاخه';
    if (/بسته|پک/i.test(title)) return 'بسته';
    if (/جفت/i.test(title)) return 'جفت';
    if (/دستگاه/i.test(title)) return 'دستگاه';
    if (/کارتن/i.test(title)) return 'کارتن';
    return 'عدد';
};

/**
 * Detect category name from code prefix
 */
const detectCategory = (code) => {
    if (!code) return 'قطعات و ملزومات کارخانه';
    for (let len = 6; len >= 2; len -= 2) {
        const prefix = code.slice(0, len);
        if (CATEGORY_MAP[prefix]) {
            return CATEGORY_MAP[prefix];
        }
    }
    return 'قطعات و ملزومات کارخانه';
};

/**
 * Query Sayan for an item name directly in GNR_TBL_003 (with real-time stock from STR_TBL_011)
 * Optimized to execute in ~1 second with exact indexes
 */
export const searchAndMatchSayanPart = async (requestedItemName) => {
    if (!requestedItemName || typeof requestedItemName !== 'string') {
        return { matched: false, part: null, stock: 0 };
    }

    const rawInput = requestedItemName.trim();
    const normInput = normalizePersianText(rawInput);
    if (!normInput || normInput.length < 2) {
        return { matched: false, part: null, stock: 0 };
    }

    // Check memory cache
    const now = Date.now();
    const cacheKey = normInput;
    if (matchResultCache.has(cacheKey)) {
        const ts = matchResultCacheTimestamps.get(cacheKey) || 0;
        if (now - ts < CACHE_TTL_MS) {
            return matchResultCache.get(cacheKey);
        }
    }

    const db = getDb();
    const tokens = normInput.split(/\s+/).filter(t => t.length >= 2);
    const isCode = /^[0-9]{4,}$/.test(rawInput);

    let whereClause = '';
    if (isCode) {
        whereClause = `g03.Field_003 = '${rawInput}'`;
    } else if (tokens.length >= 2) {
        const andParts = tokens.map(t => `g03.Field_008 LIKE N'%${t}%'`).join(' AND ');
        whereClause = `(${andParts}) OR g03.Field_008 LIKE N'%${rawInput}%'`;
    } else {
        whereClause = `g03.Field_008 LIKE N'%${rawInput}%'`;
    }

    const sql = `
        SELECT TOP 10
            RTRIM(LTRIM(g03.Field_003)) as Code,
            RTRIM(LTRIM(g03.Field_008)) as Title,
            ISNULL((
                SELECT SUM(CASE 
                    WHEN RTRIM(LTRIM(t10.Field_009)) IN ('10', '24', '26', '29', '40', '44', '46', '83') THEN t11.Field_006 
                    WHEN RTRIM(LTRIM(t10.Field_009)) IN ('23', '25', '30', '37', '42', '84', '62', '68', '71', '74', '80') THEN -t11.Field_006 
                    ELSE 0 
                END)
                FROM STR_TBL_011 t11 WITH (NOLOCK)
                INNER JOIN STR_TBL_010 t10 WITH (NOLOCK) ON t11.Field_004 = t10.Field_005 
                                           AND t11.Field_003 = t10.Field_004 
                                           AND t11.Field_012 = t10.Field_018
                WHERE t11.Field_005 = g03.Field_003
            ), 0) as StockQty
        FROM GNR_TBL_003 g03 WITH (NOLOCK)
        WHERE (g03.Field_007 IN ('11', '12', '14', '15', '16', '13', '19') OR g03.Field_007 IS NULL)
          AND (${whereClause})
        ORDER BY 
            CASE WHEN g03.Field_008 = N'${rawInput}' THEN 0 ELSE 1 END,
            CASE WHEN g03.Field_003 LIKE '03%' THEN 0 ELSE 1 END,
            CASE WHEN g03.Field_008 LIKE N'${rawInput}%' THEN 0 ELSE 1 END
    `;

    try {
        const rows = await querySayanDirect(db, sql, 12000);
        if (Array.isArray(rows) && rows.length > 0) {
            // Find best matching row
            let best = rows[0];
            let maxScore = -1;

            for (const r of rows) {
                const normTitle = normalizePersianText(r.Title);
                let score = 0;

                // Exact match
                if (normTitle === normInput) score += 100;
                // Starts with
                if (normTitle.startsWith(normInput)) score += 50;
                // Tokens match
                const matchedTokens = tokens.filter(t => normTitle.includes(t)).length;
                score += matchedTokens * 20;
                // Prefer items that actually have positive stock
                if (parseFloat(r.StockQty) > 0) score += 15;
                // Prefer 03% parts (factory parts)
                if (String(r.Code).startsWith('03')) score += 25;

                if (score > maxScore) {
                    maxScore = score;
                    best = r;
                }
            }

            const stock = parseFloat(best.StockQty) || 0;
            const unit = detectUnit(best.Title);
            const category = detectCategory(best.Code);

            const result = {
                matched: true,
                part: {
                    id: `sayan-part-${best.Code}`,
                    code: best.Code,
                    name: best.Title,
                    category,
                    unit,
                    type: 'قطعات کارخانه',
                    warehouseName: 'انبار ملزومات و قطعات',
                    warehouseCode: '14',
                    stock
                },
                stock,
                confidence: maxScore > 50 ? 95 : 75
            };

            matchResultCache.set(cacheKey, result);
            matchResultCacheTimestamps.set(cacheKey, now);
            return result;
        }
    } catch (err) {
        console.warn(`[Sayan Parts Service] Search error for "${requestedItemName}":`, err.message);
    }

    const notFoundResult = { matched: false, part: null, stock: 0 };
    matchResultCache.set(cacheKey, notFoundResult);
    matchResultCacheTimestamps.set(cacheKey, now);
    return notFoundResult;
};

/**
 * Enriches all items in a purchase request with Sayan factory part matches and live warehouse stock
 */
export const enrichPurchaseRequestWithSayanStock = async (purchaseRequest) => {
    if (!purchaseRequest) return purchaseRequest;

    const items = Array.isArray(purchaseRequest.items) ? purchaseRequest.items : [];
    const enrichedItems = [];
    const stockSummaryParts = [];

    for (let i = 0; i < items.length; i++) {
        const it = { ...items[i] };
        const queryName = it.itemName || purchaseRequest.itemName || '';
        const matchResult = await searchAndMatchSayanPart(queryName);

        if (matchResult.matched && matchResult.part) {
            it.itemCode = it.itemCode || matchResult.part.code;
            it.sayanItemCode = matchResult.part.code;
            it.sayanMatchedItem = matchResult.part.name;
            it.sayanStock = matchResult.stock;
            it.warehouseStock = matchResult.stock;
            it.isAvailableInWarehouse = matchResult.stock > 0;
            it.sayanWarehouseName = matchResult.part.warehouseName;
            it.unit = it.unit || matchResult.part.unit;

            if (matchResult.stock > 0) {
                stockSummaryParts.push(`✅ ${it.itemName}: ${matchResult.stock.toLocaleString('fa-IR')} ${it.unit} در انبار سایان`);
            } else {
                stockSummaryParts.push(`⚠️ ${it.itemName}: عدم موجودی در انبار سایان (۰ ${it.unit})`);
            }
        } else {
            it.sayanStock = 0;
            it.warehouseStock = 0;
            it.isAvailableInWarehouse = false;
            it.sayanWarehouseName = 'انبار ملزومات و قطعات';
        }
        enrichedItems.push(it);
    }

    // Also enrich primary item if single-item request
    if (enrichedItems.length === 0 && purchaseRequest.itemName) {
        const singleMatch = await searchAndMatchSayanPart(purchaseRequest.itemName);
        if (singleMatch.matched && singleMatch.part) {
            purchaseRequest.itemCodeAssigned = purchaseRequest.itemCodeAssigned || singleMatch.part.code;
            purchaseRequest.sayanStock = singleMatch.stock;
            purchaseRequest.warehouseStock = singleMatch.stock;
            purchaseRequest.sayanMatchedItem = singleMatch.part.name;
            purchaseRequest.isAvailableInWarehouse = singleMatch.stock > 0;
            if (singleMatch.stock > 0) {
                stockSummaryParts.push(`✅ موجود در انبار سایان: ${singleMatch.stock.toLocaleString('fa-IR')} ${purchaseRequest.unit || 'عدد'}`);
            } else {
                stockSummaryParts.push(`⚠️ عدم موجودی در انبار سایان (۰ ${purchaseRequest.unit || 'عدد'})`);
            }
        }
    }

    purchaseRequest.items = enrichedItems;
    if (stockSummaryParts.length > 0) {
        purchaseRequest.sayanStockSummary = stockSummaryParts.join(' | ');
    }

    return purchaseRequest;
};

/**
 * Fetch top factory parts catalog from Sayan with live stock to populate the "قطعات" tab
 */
export const syncSayanFactoryPartsToDatabase = async (limit = 60) => {
    const db = getDb();
    const sql = `
        SELECT TOP ${limit}
            RTRIM(LTRIM(t11.Field_005)) as Code,
            RTRIM(LTRIM(g03.Field_008)) as Title,
            ISNULL(SUM(CASE 
                WHEN RTRIM(LTRIM(t10.Field_009)) IN ('10', '24', '26', '29', '40', '44', '46', '83') THEN t11.Field_006 
                WHEN RTRIM(LTRIM(t10.Field_009)) IN ('23', '25', '30', '37', '42', '84', '62', '68', '71', '74', '80') THEN -t11.Field_006 
                ELSE 0 
            END), 0) as StockQty
        FROM STR_TBL_011 t11 WITH (NOLOCK)
        INNER JOIN STR_TBL_010 t10 WITH (NOLOCK) ON t11.Field_004 = t10.Field_005 
                                   AND t11.Field_003 = t10.Field_004 
                                   AND t11.Field_012 = t10.Field_018
        INNER JOIN GNR_TBL_003 g03 WITH (NOLOCK) ON t11.Field_005 = g03.Field_003
        WHERE t11.Field_014 IN ('11', '14', '18') 
          AND (t11.Field_005 LIKE '03%' OR t11.Field_005 LIKE '08%' OR t11.Field_005 LIKE '02%')
        GROUP BY t11.Field_005, g03.Field_008
        HAVING SUM(CASE 
            WHEN RTRIM(LTRIM(t10.Field_009)) IN ('10', '24', '26', '29', '40', '44', '46', '83') THEN t11.Field_006 
            WHEN RTRIM(LTRIM(t10.Field_009)) IN ('23', '25', '30', '37', '42', '84', '62', '68', '71', '74', '80') THEN -t11.Field_006 
            ELSE 0 
        END) > 0
        ORDER BY StockQty DESC
    `;

    try {
        const rows = await querySayanDirect(db, sql, 20000);
        if (Array.isArray(rows) && rows.length > 0) {
            const mappedParts = rows.map(r => ({
                id: `sayan-part-${r.Code}`,
                code: r.Code,
                name: r.Title,
                category: detectCategory(r.Code),
                unit: detectUnit(r.Title),
                type: 'قطعات',
                currentStock: parseFloat(r.StockQty) || 0,
                minStock: 5,
                warehouseName: 'انبار ملزومات و قطعات'
            }));

            // Merge into db.partMasterData
            if (!Array.isArray(db.partMasterData)) db.partMasterData = [];
            const existingCodes = new Set(db.partMasterData.map(p => p.code || p.id));
            for (const p of mappedParts) {
                const idx = db.partMasterData.findIndex(x => x.code === p.code || x.id === p.id);
                if (idx >= 0) {
                    db.partMasterData[idx] = { ...db.partMasterData[idx], ...p };
                } else {
                    db.partMasterData.push(p);
                }
            }
            saveDb(db);
            return { success: true, count: mappedParts.length, parts: db.partMasterData };
        }
    } catch (err) {
        console.error('[Sayan Parts Service] Error syncing parts to database:', err.message);
        throw err;
    }
    return { success: false, count: 0, parts: db.partMasterData || [] };
};

/**
 * Get Sayan factory parts catalog, using local database cache or syncing from Sayan if empty/forced
 */
export const getSayanFactoryPartsCatalog = async (force = false) => {
    const db = getDb();
    if (!force && Array.isArray(db.partMasterData) && db.partMasterData.length > 0) {
        return db.partMasterData;
    }
    try {
        const res = await syncSayanFactoryPartsToDatabase(300);
        return res.parts || db.partMasterData || [];
    } catch {
        return db.partMasterData || [];
    }
};
