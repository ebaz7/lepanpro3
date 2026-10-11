const fs = require('fs');

async function testPerf() {
    const url = 'http://80.210.31.176:5000/api/external/v1/query';
    const apiKey = 's_gate_live_k7ua5p7hs1h9';

    async function query(sql) {
        const start = Date.now();
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ query: sql })
        });
        const d = await res.json();
        console.log(`[${Date.now() - start}ms] Success: ${d.success}, Count: ${d.data ? d.data.length : 'err'}`);
        return d;
    }

    console.log("--- Query 1: Filter STR_TBL_010 alone by date ---");
    await query(`
        SELECT Field_001, Field_004, Field_005, Field_008, Field_009, Field_018
        FROM STR_TBL_010
        WHERE Field_009 IN ('12', '13')
          AND Field_008 >= '2026-09-01' AND Field_008 <= '2026-10-10'
    `);

    console.log("--- Query 2: Filter STR_TBL_010 with 1 month date range + STR_TBL_011 JOIN ---");
    await query(`
        SELECT 
            t10.Field_001 as DocId,
            t10.Field_006 as InvoiceNum,
            t10.Field_008 as Date,
            t10.Field_009 as OpCode,
            t11.Field_005 as ItemCode,
            t11.Field_006 as Quantity,
            t11.Field_007 as Amount
        FROM STR_TBL_010 t10
        INNER JOIN STR_TBL_011 t11 ON t11.Field_003 = t10.Field_004
                                  AND t11.Field_004 = t10.Field_005 
                                  AND t11.Field_012 = t10.Field_018
        WHERE t10.Field_009 IN ('12', '13')
          AND t10.Field_008 >= '2026-09-01' AND t10.Field_008 <= '2026-10-10'
    `);
}

testPerf();
