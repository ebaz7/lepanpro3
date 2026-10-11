const fs = require('fs');

async function testSuperFast() {
    const url = 'http://80.210.31.176:5000/api/external/v1/query';
    const apiKey = 's_gate_live_k7ua5p7hs1h9';

    const gregFrom = '2025-03-21';
    const gregTo = '2026-03-20';

    const sqlA = `
        WITH FilteredDocs AS (
            SELECT 
                Field_001 as DocId,
                Field_004 as HeaderF4,
                Field_005 as HeaderF5,
                Field_006 as InvoiceNum,
                Field_008 as Date,
                Field_009 as OpCode,
                Field_010 as CustomerId,
                Field_018 as HeaderF18,
                Field_029 as Notes,
                Field_037 as HeaderPayable
            FROM STR_TBL_010
            WHERE Field_009 IN ('12', '13')
              AND Field_008 >= '${gregFrom}T00:00:00.000Z' 
              AND Field_008 <= '${gregTo}T23:59:59.000Z'
        )
        SELECT 
            fd.DocId,
            fd.InvoiceNum,
            fd.Date,
            fd.Notes,
            fd.HeaderPayable,
            fd.OpCode,
            RTRIM(LTRIM(t11.Field_005)) as ItemCode,
            COALESCE(RTRIM(LTRIM(t22.Field_004)), RTRIM(LTRIM(t11.Field_005)), 'کالای بدون نام') as ItemName,
            t11.Field_006 as Quantity,
            t11.Field_031 as ItemNotes,
            t11.Field_007 as Amount,
            t11.Field_008 as Discount,
            t11.Field_009 as NetAmount,
            t11.Field_010 as VAT,
            t11.Field_011 as Tax,
            t11.Field_012 as FinalAmount,
            RTRIM(LTRIM(t07.Field_006)) as CustomerName
        FROM FilteredDocs fd
        INNER JOIN STR_TBL_011 t11 ON t11.Field_004 = fd.HeaderF5 
                                  AND t11.Field_003 = fd.HeaderF4
                                  AND t11.Field_012 = fd.HeaderF18
                                  AND (
                                      (fd.OpCode IN ('3', '12', '23') AND t11.Field_036 = fd.OpCode)
                                      OR
                                      (fd.OpCode = '13' AND t11.Field_036 IN ('3', '12', '23', '13'))
                                  )
        LEFT JOIN IND_TBL_022 t22 ON RTRIM(LTRIM(t22.Field_005)) = RTRIM(LTRIM(t11.Field_005))
        LEFT JOIN ACT_TBL_007 t07 ON RTRIM(LTRIM(fd.CustomerId)) = RTRIM(LTRIM(t07.Field_005)) AND t07.Field_004 IN ('11', '31')
        WHERE (fd.OpCode = '12' AND t11.Field_007 > 0) OR fd.OpCode = '13'
        ORDER BY fd.Date DESC
    `;

    console.log("Executing SuperFast Query...");
    const start = Date.now();
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ query: sqlA })
        });
        const data = await response.json();
        console.log(`[${Date.now() - start}ms] Success: ${data.success}, Rows: ${data.data ? data.data.length : 0}`);
        if (!data.success) console.error("Error:", data.error);
        else if (data.data && data.data.length > 0) {
            console.log("Sample row:", data.data[0]);
        }
    } catch (e) {
        console.error("Exception:", e.message);
    }
}

testSuperFast();
