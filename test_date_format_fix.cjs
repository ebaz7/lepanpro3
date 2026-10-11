const fs = require('fs');

async function testDateFormatFix() {
    const url = 'http://80.210.31.176:5000/api/external/v1/query';
    const apiKey = 's_gate_live_k7ua5p7hs1h9';

    const gregFrom = '2026-03-21 00:00:00';
    const gregTo = '2026-10-10 23:59:59';

    const sql = `
        SELECT 
            t10.Field_001 as DocId,
            t10.Field_006 as InvoiceNum,
            t10.Field_008 as Date,
            t10.Field_029 as Notes,
            t10.Field_037 as HeaderPayable,
            t10.Field_009 as OpCode,
            t11.Field_005 as ItemCode,
            COALESCE(t22.Field_004, t11.Field_005, 'کالای بدون نام') as ItemName,
            t11.Field_006 as Quantity,
            t11.Field_031 as ItemNotes,
            t11.Field_007 as Amount,
            t11.Field_008 as Discount,
            t11.Field_009 as NetAmount,
            t11.Field_010 as VAT,
            t11.Field_011 as Tax,
            t11.Field_012 as FinalAmount,
            t07.Field_006 as CustomerName
        FROM STR_TBL_010 t10
        INNER JOIN STR_TBL_011 t11 ON t11.Field_004 = t10.Field_005 
                                  AND t11.Field_003 = t10.Field_004
                                  AND t11.Field_012 = t10.Field_018
                                  AND (
                                      (t10.Field_009 IN ('3', '12', '23') AND t11.Field_036 = t10.Field_009)
                                      OR
                                      (t10.Field_009 = '13' AND t11.Field_036 IN ('3', '12', '23', '13'))
                                  )
        LEFT JOIN IND_TBL_022 t22 ON t22.Field_005 = t11.Field_005
        LEFT JOIN ACT_TBL_007 t07 ON t07.Field_005 = t10.Field_010 AND (t07.Field_004 = '11' OR t07.Field_004 = '31')
        WHERE t10.Field_009 IN ('12', '13')
          AND t10.Field_008 >= '${gregFrom}'
          AND t10.Field_008 <= '${gregTo}'
          AND (
            (t10.Field_009 = '12' AND t11.Field_007 > 0)
            OR
            t10.Field_009 = '13'
          )
        ORDER BY t10.Field_008 DESC
    `;

    console.log("Executing query with 'YYYY-MM-DD HH:MM:SS' date format...");
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
    console.log(`[${Date.now() - start}ms] Success: ${d.success}, Count: ${d.data ? d.data.length : 0}`);
    if (d.data && d.data.length > 0) console.log("Sample:", d.data[0]);
    else if (!d.success) console.error("Error:", d.error);
}

testDateFormatFix();
