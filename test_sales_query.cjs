const fs = require('fs');

async function testSalesQuery() {
    const db = JSON.parse(fs.readFileSync('./database.json', 'utf8'));
    const settings = db.settings || {};
    const serverSayanBaseUrl = settings.sayanApiUrl || 'http://80.210.31.176:5000/api/external/v1';
    const serverSayanApiKey = settings.sayanApiKey || 's_gate_live_vgr182bwtpoa';
    const finalUrl = `${serverSayanBaseUrl.replace(/\/$/, '')}/query`;

    async function executeQuery(sql) {
        console.log("Executing SQL...");
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
        return data;
    }

    const dateFilter = "AND t10.Field_008 >= '2024-03-20T00:00:00.000Z' AND t10.Field_008 <= '2025-03-20T23:59:59.000Z'";

    const sqlA = `
        SELECT 
            t10.Field_001 as DocId,
            t10.Field_006 as InvoiceNum,
            t10.Field_008 as Date,
            t10.Field_029 as Notes,
            t10.Field_037 as HeaderPayable,
            t10.Field_009 as OpCode,
            t11.Field_005 as ItemCode,
            COALESCE(t22.Field_004, t_name.ItemName, t11.Field_005, 'کالای بدون نام') as ItemName,
            t11.Field_006 as Quantity,
            t11.Field_031 as ItemNotes,
            t11.Field_007 as Amount,
            t11.Field_008 as Discount,
            t11.Field_009 as NetAmount,
            t11.Field_010 as VAT,
            t11.Field_011 as Tax,
            t11.Field_012 as FinalAmount,
            t_group.GroupName,
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
        LEFT JOIN IND_TBL_022 t22 ON RTRIM(LTRIM(t22.Field_005)) = RTRIM(LTRIM(t11.Field_005))
        LEFT JOIN (
            SELECT RTRIM(LTRIM(t21_sub.Field_004)) as ItemCode, MIN(t02_sub.Field_003) as ItemName
            FROM IND_TBL_021 t21_sub
            LEFT JOIN IND_TBL_002 t02_sub ON RTRIM(LTRIM(t21_sub.Field_003)) = RTRIM(LTRIM(t02_sub.Field_008))
            GROUP BY t21_sub.Field_004
        ) t_name ON RTRIM(LTRIM(t11.Field_005)) = RTRIM(LTRIM(t_name.ItemCode))
        LEFT JOIN (
            SELECT t21_sub.Field_004 as ItemCode, MIN(COALESCE(t02_grandparent.Field_003, t02_parent.Field_003, t02_sub.Field_003)) as GroupName
            FROM IND_TBL_021 t21_sub
            LEFT JOIN IND_TBL_002 t02_sub ON RTRIM(LTRIM(t21_sub.Field_003)) = RTRIM(LTRIM(t02_sub.Field_008))
            LEFT JOIN IND_TBL_002 t02_parent ON RTRIM(LTRIM(t02_sub.Field_009)) = RTRIM(LTRIM(t02_parent.Field_008))
            LEFT JOIN IND_TBL_002 t02_grandparent ON RTRIM(LTRIM(t02_parent.Field_009)) = RTRIM(LTRIM(t02_grandparent.Field_008))
            GROUP BY t21_sub.Field_004
        ) t_group ON RTRIM(LTRIM(t11.Field_005)) = RTRIM(LTRIM(t_group.ItemCode))
        LEFT JOIN ACT_TBL_007 t07 ON RTRIM(LTRIM(t10.Field_010)) = RTRIM(LTRIM(t07.Field_005)) AND (t07.Field_004 = '11' OR t07.Field_004 = '31')
        WHERE (
            (t10.Field_009 = '12' AND t11.Field_007 > 0)
            OR
            t10.Field_009 = '13'
          )
          ${dateFilter}
        ORDER BY t10.Field_008 DESC
    `;

    try {
        const res = await executeQuery(sqlA);
        console.log("Response:", JSON.stringify(res).substring(0, 500));
    } catch (e) {
        console.error("Exec error:", e);
    }
}

testSalesQuery();
