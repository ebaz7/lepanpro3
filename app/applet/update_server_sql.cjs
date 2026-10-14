const fs = require('fs');

let code = fs.readFileSync('server.js', 'utf8');

const funcStart = code.indexOf('const getWarehouseInventoryForDate = async');
if (funcStart !== -1) {
    const nextFunc = code.indexOf('const fetchSayanWarehouseInventoryData = async', funcStart);
    if (nextFunc !== -1) {
        const replacement = `const getWarehouseInventoryForDate = async (db, targetDate, nameMap) => {
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
          AND t10.Field_009 NOT IN ('19', '82')
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
            itemName: mapped.name || \`\${defaultGrp} - کد \${code.substring(4) || code}\`,
            groupName: standardGroupNames[grpCode] || mapped.group || defaultGrp,
            subGroupName: mapped.subGroup || '',
            openingQty: opening,
            inflowQty: inflow,
            outflowQty: outflow,
            stockQty: weight,
            cartonsQty: cartons
        };
    });
};

`;
        code = code.substring(0, funcStart) + replacement + code.substring(nextFunc);
        console.log('✓ Successfully updated getWarehouseInventoryForDate with NOT IN (19, 82)');
    }
}

fs.writeFileSync('server.js', code, 'utf8');
console.log('server.js saved successfully');
