const fs = require('fs');

async function main() {
    const db = JSON.parse(fs.readFileSync('./database.json', 'utf8'));
    const settings = db.settings || {};
    const serverSayanBaseUrl = settings.sayanApiUrl || 'http://80.210.31.176:5000/api/external/v1';
    const serverSayanApiKey = settings.sayanApiKey || 's_gate_live_vgr182bwtpoa';
    const finalUrl = `${serverSayanBaseUrl.replace(/\/$/, '')}/query`;

    async function executeQuery(sql) {
        const start = Date.now();
        const response = await fetch(finalUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${serverSayanApiKey}`,
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ query: sql })
        });
        const data = await response.json();
        console.log(`Query finished in ${Date.now() - start}ms, rows: ${Array.isArray(data.data) ? data.data.length : 'error'}`);
        if (!data.success && data.error) console.error("SQL Error:", data.error);
        return data.data || [];
    }

    console.log("--- Test 1: Simple STR_TBL_010 with TOP 10 ---");
    await executeQuery(`SELECT TOP 10 * FROM STR_TBL_010`);

    console.log("--- Test 2: STR_TBL_010 JOIN STR_TBL_011 TOP 10 ---");
    await executeQuery(`
        SELECT TOP 10
            t10.Field_001 as DocId,
            t10.Field_006 as InvoiceNum,
            t10.Field_008 as Date,
            t11.Field_005 as ItemCode,
            t11.Field_006 as Quantity,
            t11.Field_007 as Amount
        FROM STR_TBL_010 t10
        INNER JOIN STR_TBL_011 t11 ON t11.Field_004 = t10.Field_005 
                                  AND t11.Field_003 = t10.Field_004
                                  AND t11.Field_012 = t10.Field_018
        WHERE t10.Field_009 IN ('12', '13')
    `);
}

main();
