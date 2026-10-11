const fs = require('fs');
const jalaali = require('jalaali-js');

async function testDirectJoins() {
    const url = 'http://80.210.31.176:5000/api/external/v1/query';
    const apiKey = 's_gate_live_k7ua5p7hs1h9';

    const gregFromA = '2026-03-21';
    const gregToA = '2026-10-10';

    const gregFromB = '2025-03-21';
    const gregToB = '2025-10-10';

    function buildQuery(gFrom, gTo) {
        return `
            SELECT 
                t10.Field_001 as DocId,
                t10.Field_006 as InvoiceNum,
                t10.Field_008 as Date,
                t10.Field_029 as Notes,
                t10.Field_037 as HeaderPayable,
                t10.Field_009 as OpCode,
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
                COALESCE(RTRIM(LTRIM(t02_g.Field_003)), RTRIM(LTRIM(t02_p.Field_003)), RTRIM(LTRIM(t02.Field_003))) as GroupName,
                RTRIM(LTRIM(t07.Field_006)) as CustomerName
            FROM STR_TBL_010 t10
            INNER JOIN STR_TBL_011 t11 ON t11.Field_004 = t10.Field_005 
                                      AND t11.Field_003 = t10.Field_004
                                      AND t11.Field_012 = t10.Field_018
                                      AND (
                                          (t10.Field_009 IN ('3', '12', '23') AND t11.Field_036 = t10.Field_009)
                                          OR
                                          (t10.Field_009 = '13' AND t11.Field_036 IN ('3', '12', '23', '13'))
                                      )
            LEFT JOIN IND_TBL_022 t22 ON RTRIM(LTRIM(t22.Field_005)) = RTRIM(LTRIM(t11.Field_005))
            LEFT JOIN IND_TBL_021 t21 ON RTRIM(LTRIM(t21.Field_004)) = RTRIM(LTRIM(t11.Field_005))
            LEFT JOIN IND_TBL_002 t02 ON RTRIM(LTRIM(t21.Field_003)) = RTRIM(LTRIM(t02.Field_008))
            LEFT JOIN IND_TBL_002 t02_p ON RTRIM(LTRIM(t02.Field_009)) = RTRIM(LTRIM(t02_p.Field_008))
            LEFT JOIN IND_TBL_002 t02_g ON RTRIM(LTRIM(t02_p.Field_009)) = RTRIM(LTRIM(t02_g.Field_008))
            LEFT JOIN ACT_TBL_007 t07 ON RTRIM(LTRIM(t10.Field_010)) = RTRIM(LTRIM(t07.Field_005)) AND t07.Field_004 IN ('11', '31')
            WHERE t10.Field_009 IN ('12', '13')
              AND t10.Field_008 >= '${gFrom}T00:00:00.000Z'
              AND t10.Field_008 <= '${gTo}T23:59:59.000Z'
              AND (
                (t10.Field_009 = '12' AND t11.Field_007 > 0)
                OR
                t10.Field_009 = '13'
              )
            ORDER BY t10.Field_008 DESC
        `;
    }

    async function query(sql, label) {
        console.log(`[${label}] Executing...`);
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
        console.log(`[${label}] Took ${Date.now() - start}ms, Success: ${d.success}, Count: ${d.data ? d.data.length : 0}`);
        if (!d.success) console.error("Err:", d.error);
        return d.data || [];
    }

    console.log("=== Testing Direct Joins Query ===");
    const [resA, resB] = await Promise.all([
        query(buildQuery(gregFromA, gregToA), "A"),
        query(buildQuery(gregFromB, gregToB), "B")
    ]);

    console.log(`Result counts: A=${resA.length}, B=${resB.length}`);
    if (resA.length > 0) console.log("Sample A:", resA[0]);
    if (resB.length > 0) console.log("Sample B:", resB[0]);
}

testDirectJoins();
