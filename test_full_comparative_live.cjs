const fs = require('fs');
const jalaali = require('jalaali-js');

async function testFullComparativeLive() {
    const url = 'http://80.210.31.176:5000/api/external/v1/query';
    const apiKey = 's_gate_live_k7ua5p7hs1h9';

    function parseShamsiParts(shamsiStr) {
        if (!shamsiStr) return null;
        const parts = shamsiStr.split(/[\/\.\-]/).map(p => p.trim());
        if (parts.length < 3) return null;
        let jy = parseInt(parts[0], 10);
        let jm = parseInt(parts[1], 10);
        let jd = parseInt(parts[2], 10);
        if (isNaN(jy) || isNaN(jm) || isNaN(jd)) return null;
        if (jy < 100) jy += 1400;
        return { jy, jm, jd };
    }

    function jalaliToGregorianStr(jalaliStr) {
        if (!jalaliStr) return '';
        try {
            const res = parseShamsiParts(jalaliStr);
            if (!res) return '';
            const g = jalaali.toGregorian(res.jy, res.jm, res.jd);
            if (!g || !g.gy || isNaN(g.gy)) return '';
            return `${g.gy}-${String(g.gm).padStart(2, '0')}-${String(g.gd).padStart(2, '0')}`;
        } catch {
            return '';
        }
    }

    const dateFromA = "1405/01/01";
    const dateToA = "1405/07/18";
    const dateFromB = "1404/01/01";
    const dateToB = "1404/07/18";

    const gregFromA = jalaliToGregorianStr(dateFromA);
    const gregToA = jalaliToGregorianStr(dateToA);
    const gregFromB = jalaliToGregorianStr(dateFromB);
    const gregToB = jalaliToGregorianStr(dateToB);

    console.log("Period A Gregorian:", gregFromA, "to", gregToA);
    console.log("Period B Gregorian:", gregFromB, "to", gregToB);

    function buildSalesQuery(gregFrom, gregTo) {
        const dateFilter = (gregFrom && gregTo) 
            ? `AND t10.Field_008 >= '${gregFrom}T00:00:00.000Z' AND t10.Field_008 <= '${gregTo}T23:59:59.000Z'` 
            : '';

        return `
            WITH ItemNames AS (
                SELECT 
                    RTRIM(LTRIM(Field_005)) as ItemCode,
                    MIN(RTRIM(LTRIM(Field_004))) as ItemName
                FROM IND_TBL_022
                WHERE Field_004 IS NOT NULL AND RTRIM(LTRIM(Field_004)) <> ''
                GROUP BY RTRIM(LTRIM(Field_005))
            ),
            ItemGroups AS (
                SELECT 
                    RTRIM(LTRIM(t21.Field_004)) as ItemCode,
                    MIN(RTRIM(LTRIM(COALESCE(t02_g.Field_003, t02_p.Field_003, t02.Field_003)))) as GroupName
                FROM IND_TBL_021 t21
                LEFT JOIN IND_TBL_002 t02 ON RTRIM(LTRIM(t21.Field_003)) = RTRIM(LTRIM(t02.Field_008))
                LEFT JOIN IND_TBL_002 t02_p ON RTRIM(LTRIM(t02.Field_009)) = RTRIM(LTRIM(t02_p.Field_008))
                LEFT JOIN IND_TBL_002 t02_g ON RTRIM(LTRIM(t02_p.Field_009)) = RTRIM(LTRIM(t02_g.Field_008))
                GROUP BY RTRIM(LTRIM(t21.Field_004))
            ),
            Customers AS (
                SELECT 
                    RTRIM(LTRIM(Field_005)) as CustCode,
                    MIN(RTRIM(LTRIM(Field_006))) as CustomerName
                FROM ACT_TBL_007
                WHERE Field_004 IN ('11', '31')
                GROUP BY RTRIM(LTRIM(Field_005))
            )
            SELECT 
                t10.Field_001 as DocId,
                t10.Field_006 as InvoiceNum,
                t10.Field_008 as Date,
                t10.Field_029 as Notes,
                t10.Field_037 as HeaderPayable,
                t10.Field_009 as OpCode,
                RTRIM(LTRIM(t11.Field_005)) as ItemCode,
                COALESCE(iName.ItemName, RTRIM(LTRIM(t11.Field_005)), 'کالای بدون نام') as ItemName,
                t11.Field_006 as Quantity,
                t11.Field_031 as ItemNotes,
                t11.Field_007 as Amount,
                t11.Field_008 as Discount,
                t11.Field_009 as NetAmount,
                t11.Field_010 as VAT,
                t11.Field_011 as Tax,
                t11.Field_012 as FinalAmount,
                iGrp.GroupName,
                cust.CustomerName
            FROM STR_TBL_010 t10
            INNER JOIN STR_TBL_011 t11 ON t11.Field_004 = t10.Field_005 
                                      AND t11.Field_003 = t10.Field_004
                                      AND t11.Field_012 = t10.Field_018
                                      AND (
                                          (t10.Field_009 IN ('3', '12', '23') AND t11.Field_036 = t10.Field_009)
                                          OR
                                          (t10.Field_009 = '13' AND t11.Field_036 IN ('3', '12', '23', '13'))
                                      )
            LEFT JOIN ItemNames iName ON iName.ItemCode = RTRIM(LTRIM(t11.Field_005))
            LEFT JOIN ItemGroups iGrp ON iGrp.ItemCode = RTRIM(LTRIM(t11.Field_005))
            LEFT JOIN Customers cust ON cust.CustCode = RTRIM(LTRIM(t10.Field_010))
            WHERE t10.Field_009 IN ('12', '13')
              AND (
                (t10.Field_009 = '12' AND t11.Field_007 > 0)
                OR
                t10.Field_009 = '13'
              )
              ${dateFilter}
            ORDER BY t10.Field_008 DESC
        `;
    }

    async function executeQuery(sql, label) {
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
        const data = await res.json();
        console.log(`[${label}] Completed in ${Date.now() - start}ms. Success: ${data.success}, Count: ${data.data ? data.data.length : 0}`);
        if (!data.success) {
            console.error(`[${label}] Error:`, data.error);
        } else if (data.data && data.data.length > 0) {
            console.log(`[${label}] Sample row:`, data.data[0]);
        }
        return data.data || [];
    }

    const sqlA = buildSalesQuery(gregFromA, gregToA);
    const sqlB = buildSalesQuery(gregFromB, gregToB);

    console.log("Testing Period A & Period B in parallel...");
    const [rowsA, rowsB] = await Promise.all([
        executeQuery(sqlA, "Period A"),
        executeQuery(sqlB, "Period B")
    ]);

    console.log(`=== SUMMARY ===\nPeriod A count: ${rowsA.length}\nPeriod B count: ${rowsB.length}`);
}

testFullComparativeLive();
