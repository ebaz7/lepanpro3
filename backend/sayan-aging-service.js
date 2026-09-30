import { getDb, saveDb, robustFetch, sanitizeSayanUrl } from './db-manager.js';

// Safe Gregorian to Jalali converter
function gregorianToJalali(gy, gm, gd) {
    const g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
    let jy = (gy <= 1600) ? 0 : 979;
    gy -= (gy <= 1600) ? 621 : 1600;
    const gy2 = (gm > 2) ? (gy + 1) : gy;
    let days = (365 * gy) + Math.floor((gy2 + 3) / 4) - Math.floor((gy2 + 99) / 100) + Math.floor((gy2 + 399) / 400) - 80 + gd + g_d_m[gm - 1];
    jy += 33 * Math.floor(days / 12053);
    days %= 12053;
    jy += 4 * Math.floor(days / 1461);
    days %= 1461;
    jy += Math.floor((days - 1) / 365);
    if (days > 0) days = (days - 1) % 365;
    let jm = (days < 186) ? 1 + Math.floor(days / 31) : 7 + Math.floor((days - 186) / 30);
    let jd = 1 + ((days < 186) ? (days % 31) : ((days - 186) % 30));
    return { jy, jm, jd };
}

export function formatToJalaliStr(isoOrDate) {
    if (!isoOrDate) return '---';
    try {
        const d = new Date(isoOrDate);
        if (isNaN(d.getTime())) return '---';
        const { jy, jm, jd } = gregorianToJalali(d.getFullYear(), d.getMonth() + 1, d.getDate());
        const mm = String(jm).padStart(2, '0');
        const dd = String(jd).padStart(2, '0');
        return `${jy}/${mm}/${dd}`;
    } catch {
        return '---';
    }
}

/**
 * Calculates FIFO aging and weighted average date based on balance and transaction rows
 */
export function calculateFifoAging(balance, transactions, nowMs = Date.now()) {
    const balNum = Number(balance || 0);
    const balAbs = Math.abs(balNum);
    const isDebtor = balNum > 0;
    
    if (!balAbs || balAbs < 1 || !Array.isArray(transactions) || transactions.length === 0) {
        return {
            balance: balNum,
            daysOverdue: 0,
            weightedDate: null,
            weightedDateJalali: 'تسویه شده',
            oldestUnpaidDate: null,
            oldestUnpaidDateJalali: '---',
            oldestDaysOverdue: 0,
            lastInvoiceDate: transactions?.[0]?.Date || null,
            lastInvoiceDateJalali: formatToJalaliStr(transactions?.[0]?.Date),
            status: 'settled',
            statusLabel: 'تسویه شده',
            coveredAmt: 0,
            coveragePercent: 100
        };
    }

    // Filter relevant transactions: debtors look at Bed (debits/invoices), creditors look at Bes (credits/purchases)
    const relevant = transactions
        .map(t => {
            const rawAmt = isDebtor ? Number(t.Bed || 0) : Number(t.Bes || 0);
            return {
                ...t,
                targetAmount: rawAmt,
                dateMs: new Date(t.Date).getTime()
            };
        })
        .filter(t => t.targetAmount > 0 && !isNaN(t.dateMs))
        .sort((a, b) => b.dateMs - a.dateMs); // Newest first

    if (relevant.length === 0) {
        return {
            balance: balNum,
            daysOverdue: 0,
            weightedDate: null,
            weightedDateJalali: 'فاقد گردش فاکتور',
            oldestUnpaidDate: null,
            oldestUnpaidDateJalali: '---',
            oldestDaysOverdue: 0,
            lastInvoiceDate: transactions[0]?.Date || null,
            lastInvoiceDateJalali: formatToJalaliStr(transactions[0]?.Date),
            status: 'unknown',
            statusLabel: 'بدون فاکتور اخیر',
            coveredAmt: 0,
            coveragePercent: 0
        };
    }

    let remainingBal = balAbs;
    let weightedSum = 0;
    let coveredAmt = 0;
    let oldestDate = null;
    let newestDate = relevant[0]?.Date;
    const unpaidInvoices = [];

    for (const tx of relevant) {
        const amt = tx.targetAmount;
        const used = Math.min(amt, remainingBal);
        weightedSum += used * tx.dateMs;
        coveredAmt += used;
        remainingBal -= used;
        oldestDate = tx.Date;

        unpaidInvoices.push({
            sanadNo: tx.SanadNo,
            date: tx.Date,
            dateJalali: formatToJalaliStr(tx.Date),
            description: tx.Description,
            totalAmount: amt,
            unpaidPortion: used,
            isFullyUnpaid: used === amt
        });

        if (remainingBal <= 0) break;
    }

    const weightedMs = coveredAmt > 0 ? (weightedSum / coveredAmt) : new Date(newestDate).getTime();
    const weightedDateIso = new Date(weightedMs).toISOString();
    const daysOverdue = Math.max(0, Math.round((nowMs - weightedMs) / (1000 * 60 * 60 * 24)));
    const oldestDaysOverdue = oldestDate ? Math.max(0, Math.round((nowMs - new Date(oldestDate).getTime()) / (1000 * 60 * 60 * 24))) : daysOverdue;
    const coveragePercent = Math.min(100, Math.round((coveredAmt / balAbs) * 100));

    let status = 'normal';
    let statusLabel = `${daysOverdue} روز`;
    if (daysOverdue > 90) {
        status = 'critical';
        statusLabel = `⚠️ ${daysOverdue} روز تاخیر (بحرانی)`;
    } else if (daysOverdue > 60) {
        status = 'warning';
        statusLabel = `⏳ ${daysOverdue} روز تاخیر`;
    } else if (daysOverdue > 30) {
        status = 'caution';
        statusLabel = `${daysOverdue} روز گذشته`;
    } else {
        status = 'normal';
        statusLabel = `✅ ${daysOverdue} روز (جاری)`;
    }

    return {
        balance: balNum,
        daysOverdue,
        weightedDate: weightedDateIso,
        weightedDateJalali: formatToJalaliStr(weightedDateIso),
        oldestUnpaidDate: oldestDate,
        oldestUnpaidDateJalali: formatToJalaliStr(oldestDate),
        oldestDaysOverdue,
        lastInvoiceDate: newestDate,
        lastInvoiceDateJalali: formatToJalaliStr(newestDate),
        status,
        statusLabel,
        coveredAmt,
        coveragePercent,
        unpaidInvoices
    };
}

/**
 * Runs a direct SQL query against Sayan API
 */
async function querySayan(sql) {
    const db = getDb();
    const settings = db.settings || {};
    const sayanUrl = sanitizeSayanUrl(settings.sayanApiUrl || process.env.SAYAN_API_URL || 'http://80.210.31.176:5000/api/external/v1');
    const sayanKey = settings.sayanApiKey || process.env.SAYAN_API_KEY || 's_gate_live_vzje5nkn7q4u';

    if (!sayanUrl || !sayanKey) {
        throw new Error('تنظیمات آدرس و کلید API سایان پیکربندی نشده است.');
    }

    const endpoint = `${sayanUrl}/query`;
    const response = await robustFetch(endpoint, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${sayanKey}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        },
        body: JSON.stringify({ query: sql }),
        timeout: 15000
    });

    if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error || errJson.message || `خطا در اجرای کوئری سایان (${response.status})`);
    }

    const json = await response.json();
    return json.data || [];
}

/**
 * Fetches recent vouchers for a specific party code and computes their aging
 */
export async function getPartyAgingFromSayan(code, balance = 0) {
    if (!code) return null;
    const cleanCode = String(code).trim();

    const sql = `
        SELECT TOP 25 
            t9.Field_004 as SanadNo,
            t8.Field_008 as Date,
            t9.Field_009 as Bed,
            t9.Field_010 as Bes,
            t9.Field_011 as Description
        FROM ACT_TBL_009 t9 WITH (NOLOCK)
        INNER JOIN ACT_TBL_008 t8 WITH (NOLOCK) ON t8.Field_004 = t9.Field_003 AND t8.Field_005 = t9.Field_004
        WHERE (t8.Field_004 = '4' OR t8.Field_004 = '3')
          AND (
              t9.Field_015 LIKE '11:11' + '${cleanCode}' + '%' OR 
              t9.Field_015 LIKE '%:' + '${cleanCode}' + '%' OR
              t9.Field_015 LIKE '31:31' + '${cleanCode}' + '%' OR
              t9.Field_015 LIKE '51:51' + '${cleanCode}' + '%'
          )
          AND t9.Field_007 NOT IN ('102', '103', '107', '109', '114', '116', '117')
          AND t9.Field_005 <> '9'
        ORDER BY t8.Field_008 DESC
    `;

    try {
        const rows = await querySayan(sql);
        const aging = calculateFifoAging(balance, rows);
        return {
            code: cleanCode,
            ...aging
        };
    } catch (err) {
        console.warn(`[Sayan Aging] Failed to query aging for party ${cleanCode}:`, err.message);
        return {
            code: cleanCode,
            balance: Number(balance || 0),
            daysOverdue: 0,
            weightedDate: null,
            weightedDateJalali: '---',
            status: 'unknown',
            statusLabel: 'خطا در واکشی',
            error: err.message
        };
    }
}

/**
 * Computes aging for a batch of parties and stores in cache
 */
export async function getBatchAgingForParties(parties) {
    if (!Array.isArray(parties) || parties.length === 0) return {};

    const db = getDb();
    if (!db.sayanAgingCache) db.sayanAgingCache = {};

    const results = {};
    const toQuery = [];

    const now = Date.now();
    // Cache valid for 3 hours unless forced
    for (const p of parties) {
        const code = String(p.code || p.accountCode || '').trim();
        if (!code) continue;
        const cached = db.sayanAgingCache[code];
        if (cached && (now - (cached.cachedAt || 0) < 3 * 60 * 60 * 1000) && cached.balance === p.balance) {
            results[code] = cached;
        } else {
            toQuery.push({ code, balance: Number(p.balance || 0) });
        }
    }

    // Process in batches of 4 concurrent queries to respect Sayan server capacity
    const BATCH_SIZE = 4;
    for (let i = 0; i < toQuery.length; i += BATCH_SIZE) {
        const chunk = toQuery.slice(i, i + BATCH_SIZE);
        const promises = chunk.map(item => getPartyAgingFromSayan(item.code, item.balance));
        const chunkResults = await Promise.allSettled(promises);

        chunkResults.forEach((res, idx) => {
            const item = chunk[idx];
            if (res.status === 'fulfilled' && res.value) {
                const agingData = { ...res.value, cachedAt: now };
                results[item.code] = agingData;
                db.sayanAgingCache[item.code] = agingData;
            }
        });
    }

    saveDb(db);
    return results;
}
