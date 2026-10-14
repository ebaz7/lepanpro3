const fs = require('fs');

let code = fs.readFileSync('server.js', 'utf8');

// 1. Update getWarehouseInventoryForDate query
const oldSnippet = `const getWarehouseInventoryForDate = async (db, targetDate, nameMap) => {
    const fyCode = getFyCodeForDate(targetDate);
    const sql = \`
        SELECT 
            t11.Field_005 as ItemCode,
            SUM(CASE 
                WHEN RTRIM(LTRIM(t10.Field_009)) IN ('10', '13', '14', '24', '26', '28', '40', '44', '61', '65', '67', '70', '73', '79', '83') THEN t11.Field_006
                WHEN RTRIM(LTRIM(t10.Field_009)) IN ('12', '25', '27', '30', '37', '42', '46', '62', '68', '71', '74', '80', '84') THEN -t11.Field_006
                ELSE 0 
            END) as StockQty,
            SUM(CASE 
                WHEN RTRIM(LTRIM(t10.Field_009)) IN ('10', '13', '14', '24', '26', '28', '40', '44', '61', '65', '67', '70', '73', '79', '83') THEN t11.Field_006
                ELSE 0 
            END) as InflowQty,
            SUM(CASE 
                WHEN RTRIM(LTRIM(t10.Field_009)) IN ('12', '25', '27', '30', '37', '42', '46', '62', '68', '71', '74', '80', '84') THEN t11.Field_006
                ELSE 0 
            END) as OutflowQty
        FROM STR_TBL_011 t11 WITH (NOLOCK)
        INNER JOIN STR_TBL_010 t10 WITH (NOLOCK) ON t11.Field_004 = t10.Field_005 
                                   AND t11.Field_003 = t10.Field_004 
                                   AND t11.Field_012 = t10.Field_018
        WHERE t11.Field_003 = '\${fyCode}' AND t10.Field_004 = '\${fyCode}'
          AND t10.Field_008 <= '\${targetDate}T23:59:59.000Z'
          AND (t11.Field_005 LIKE '01%' OR t11.Field_005 LIKE '04%')
        GROUP BY t11.Field_005
    \`;
    const rows = await executeSayanQuery(db, sql, 20000);
    return (rows || []).map(r => {
        const code = String(r.ItemCode || '').trim();
        const grpCode = code.substring(0, 4);
        const mapped = nameMap[code] || {};
        const defaultGrp = standardGroupNames[grpCode] || \`گروه \${grpCode}\`;
        const weight = parseFloat((r.StockQty || 0).toFixed(3));
        let cartons = 0;
        if (cartonRatios[grpCode] && weight > 0) {
            cartons = Math.round(weight / cartonRatios[grpCode]);
        }
        return {
            itemCode: code,`;

const newSnippet = `const getWarehouseInventoryForDate = async (db, targetDate, nameMap) => {
    const fyCode = getFyCodeForDate(targetDate);
    const sql = \`
        SELECT 
            t11.Field_005 as ItemCode,
            SUM(CASE 
                WHEN RTRIM(LTRIM(t10.Field_009)) IN ('10', '81') THEN t11.Field_006
                WHEN s06.Field_010 = 1 THEN t11.Field_006
                WHEN s06.Field_010 = -1 THEN -t11.Field_006
                ELSE 0 
            END) as StockQty,
            SUM(CASE 
                WHEN RTRIM(LTRIM(t10.Field_009)) IN ('10', '81') THEN t11.Field_006
                ELSE 0
            END) as OpeningQty,
            SUM(CASE 
                WHEN RTRIM(LTRIM(t10.Field_009)) NOT IN ('10', '81') AND s06.Field_010 = 1 THEN t11.Field_006
                ELSE 0 
            END) as InflowQty,
            SUM(CASE 
                WHEN RTRIM(LTRIM(t10.Field_009)) NOT IN ('10', '81') AND s06.Field_010 = -1 THEN t11.Field_006
                ELSE 0 
            END) as OutflowQty
        FROM STR_TBL_011 t11 WITH (NOLOCK)
        INNER JOIN STR_TBL_010 t10 WITH (NOLOCK) ON t11.Field_004 = t10.Field_005 
                                   AND t11.Field_003 = t10.Field_004 
                                   AND t11.Field_012 = t10.Field_018
        INNER JOIN STR_TBL_006 s06 WITH (NOLOCK) ON t10.Field_009 = s06.Field_003
        WHERE t11.Field_003 = '\${fyCode}' AND t10.Field_004 = '\${fyCode}'
          AND t10.Field_008 <= '\${targetDate}T23:59:59.000Z'
          AND (t11.Field_005 LIKE '01%' OR t11.Field_005 LIKE '04%')
        GROUP BY t11.Field_005
    \`;
    const rows = await executeSayanQuery(db, sql, 20000);
    return (rows || []).map(r => {
        const code = String(r.ItemCode || '').trim();
        const grpCode = code.substring(0, 4);
        const mapped = nameMap[code] || {};
        const defaultGrp = standardGroupNames[grpCode] || \`گروه \${grpCode}\`;
        const weight = parseFloat((r.StockQty || 0).toFixed(3));
        const opening = parseFloat((r.OpeningQty || 0).toFixed(3));
        const inflow = parseFloat((r.InflowQty || 0).toFixed(3));
        const outflow = parseFloat((r.OutflowQty || 0).toFixed(3));
        let cartons = 0;
        if (cartonRatios[grpCode] && weight > 0) {
            cartons = Math.round(weight / cartonRatios[grpCode]);
        }
        return {
            itemCode: code,
            openingQty: opening,
            inflowQty: inflow,
            outflowQty: outflow,`;

if (code.includes(oldSnippet)) {
    code = code.replace(oldSnippet, newSnippet);
    console.log('✓ Updated getWarehouseInventoryForDate query!');
} else {
    console.log('X oldSnippet not found');
}

// 2. Pass force into fetchSayanWarehouseInventoryData call inside calculateWarehouseLiveStatus
code = code.replace(
    'const invResult = await fetchSayanWarehouseInventoryData(db, lastYearDateTo, currentYearDateTo);',
    'const invResult = await fetchSayanWarehouseInventoryData(db, lastYearDateTo, currentYearDateTo, force);'
);

// 3. Update route force parameter handling
const oldRoute = `app.get('/api/sayan/warehouse-inventory', async (req, res) => {
    try {
        const db = getDb();
        let lastYearDateTo = req.query.lastYearDateTo;
        if (!lastYearDateTo || !/^\\d{4}-\\d{2}-\\d{2}$/.test(lastYearDateTo)) {
            lastYearDateTo = '2026-03-20';
        }
        let currentYearDateTo = req.query.currentYearDateTo;
        if (!currentYearDateTo || !/^\\d{4}-\\d{2}-\\d{2}$/.test(currentYearDateTo)) {
            currentYearDateTo = new Date().toISOString().split('T')[0];
        }
        const result = await fetchSayanWarehouseInventoryData(db, lastYearDateTo, currentYearDateTo);`;

const newRoute = `app.get('/api/sayan/warehouse-inventory', async (req, res) => {
    try {
        const db = getDb();
        let lastYearDateTo = req.query.lastYearDateTo;
        if (!lastYearDateTo || !/^\\d{4}-\\d{2}-\\d{2}$/.test(lastYearDateTo)) {
            lastYearDateTo = '2026-03-20';
        }
        let currentYearDateTo = req.query.currentYearDateTo;
        if (!currentYearDateTo || !/^\\d{4}-\\d{2}-\\d{2}$/.test(currentYearDateTo)) {
            currentYearDateTo = new Date().toISOString().split('T')[0];
        }
        const force = req.query.force === '1' || req.query.force === 'true' || req.query.refresh === '1' || req.query.refresh === 'true';
        const result = await fetchSayanWarehouseInventoryData(db, lastYearDateTo, currentYearDateTo, force);`;

code = code.replace(oldRoute, newRoute);

// 4. Replace لپان بافت -> لیان بافت
code = code.replace(/لپان بافت/g, 'لیان بافت');

fs.writeFileSync('server.js', code, 'utf8');
console.log('Done updating server.js!');
