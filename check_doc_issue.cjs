const fs = require('fs');

const SAYAN_URL = 'http://80.210.31.176:5000/api/external/v1/query';
const SAYAN_KEY = 's_gate_live_k7ua5p7hs1h9';

async function executeQuery(sql) {
    const res = await fetch(SAYAN_URL, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${SAYAN_KEY}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ query: sql })
    });
    const d = await res.json();
    if (!d.success) throw new Error(d.error || d.message);
    return d.data || [];
}

async function run() {
    console.log("=== 1. Find document 503752 in STR_TBL_010 ===");
    const doc503752 = await executeQuery(`
        SELECT Field_001, Field_004, Field_005, Field_006, Field_007, Field_008, Field_009, Field_010, Field_017, Field_029
        FROM STR_TBL_010
        WHERE Field_001 = '503752'
    `);
    console.log("Doc 503752:", JSON.stringify(doc503752, null, 2));

    console.log("\n=== 2. Check all Opcode 57 in FY 4 ===");
    const pre57 = await executeQuery(`
        SELECT TOP 20 Field_001, Field_004, Field_005, Field_006, Field_007, Field_008, Field_009, Field_010, Field_017, Field_029
        FROM STR_TBL_010
        WHERE Field_004 = 4 AND Field_009 = 57
        ORDER BY CAST(Field_005 AS INT) DESC
    `);
    console.log("Pre-invoices 57 in FY 4:", JSON.stringify(pre57, null, 2));

    console.log("\n=== 3. How does STR_TBL_011 link to STR_TBL_010? ===");
    // Let's check rows in STR_TBL_011 that correspond to Doc 503752
    // Let's test different candidate columns: Field_003, Field_004, Field_002, Field_010
    const items1 = await executeQuery(`
        SELECT TOP 5 *
        FROM STR_TBL_011
        WHERE Field_003 = '4' AND Field_004 = '107'
    `);
    console.log("STR_TBL_011 WHERE Field_003 = '4' AND Field_004 = '107':", JSON.stringify(items1, null, 2));

    const items2 = await executeQuery(`
        SELECT TOP 5 *
        FROM STR_TBL_011
        WHERE Field_003 = '4' AND Field_004 = '201'
    `);
    console.log("STR_TBL_011 WHERE Field_003 = '4' AND Field_004 = '201':", JSON.stringify(items2, null, 2));

    const items3 = await executeQuery(`
        SELECT TOP 5 *
        FROM STR_TBL_011
        WHERE Field_003 = '503752' OR Field_004 = '503752'
    `);
    console.log("STR_TBL_011 matching 503752 directly:", JSON.stringify(items3, null, 2));
}

run().catch(console.error);
