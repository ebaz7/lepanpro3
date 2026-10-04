const axios = require('axios');

async function testFullQuery() {
    const targetDate = '2026-08-22';
    const fyCode = '4';

    const sql = `
    WITH ItemsWithOpening AS (
        SELECT DISTINCT t11.Field_005 as ItemCode
        FROM STR_TBL_011 t11 WITH (NOLOCK)
        INNER JOIN STR_TBL_010 t10 WITH (NOLOCK) ON t11.Field_004 = t10.Field_005 
                                   AND t11.Field_003 = t10.Field_004 
                                   AND t11.Field_012 = t10.Field_018
        WHERE t10.Field_004 = '${fyCode}'
          AND t10.Field_009 IN ('10', '81')
          AND t10.Field_008 <= '${targetDate}T23:59:59.000Z'
    ),
    FilteredDocs AS (
        SELECT 
            t11.Field_005 as ItemCode,
            CASE 
                WHEN RTRIM(LTRIM(t10.Field_009)) IN ('10', '13', '14', '24', '26', '27', '29', '40', '44', '46', '61', '67', '70', '73', '76', '79', '81', '83', '85') THEN t11.Field_006
                WHEN RTRIM(LTRIM(t10.Field_009)) IN ('12', '23', '25', '28', '30', '31', '37', '42', '62', '65', '68', '71', '74', '77', '80', '84') THEN -t11.Field_006
                ELSE 0
            END as NetQty,
            CASE 
                WHEN RTRIM(LTRIM(t10.Field_009)) IN ('10', '13', '14', '24', '26', '27', '29', '40', '44', '46', '61', '67', '70', '73', '76', '79', '81', '83', '85') THEN t11.Field_007
                WHEN RTRIM(LTRIM(t10.Field_009)) IN ('12', '23', '25', '28', '30', '31', '37', '42', '62', '65', '68', '71', '74', '77', '80', '84') THEN -t11.Field_007
                ELSE 0
            END as NetAmt
        FROM STR_TBL_011 t11 WITH (NOLOCK)
        INNER JOIN STR_TBL_010 t10 WITH (NOLOCK) ON t11.Field_004 = t10.Field_005 
                                   AND t11.Field_003 = t10.Field_004 
                                   AND t11.Field_012 = t10.Field_018
        LEFT JOIN ItemsWithOpening op ON op.ItemCode = t11.Field_005
        WHERE t10.Field_008 <= '${targetDate}T23:59:59.000Z'
          AND t10.Field_009 NOT IN ('19', '82')
          AND (
              (op.ItemCode IS NOT NULL AND t10.Field_004 = '${fyCode}')
              OR
              (op.ItemCode IS NULL AND t10.Field_004 <= '${fyCode}')
          )
    )
    SELECT 
        SUBSTRING(ItemCode, 1, 4) as GroupPrefix,
        COUNT(DISTINCT ItemCode) as DistinctItems,
        SUM(NetQty) as TotalQty,
        SUM(NetAmt) as TotalAmt
    FROM FilteredDocs
    WHERE ItemCode LIKE '01%' OR ItemCode LIKE '04%'
    GROUP BY SUBSTRING(ItemCode, 1, 4)
    ORDER BY GroupPrefix
    `;

    try {
        console.log("Testing full dual logic on Sayan...");
        const start = Date.now();
        const res = await axios.post('http://80.210.31.176:5000/api/external/v1/query', 
            { query: sql }, 
            { headers: { 'Authorization': 'Bearer s_gate_live_vzje5nkn7q4u' }, timeout: 15000 }
        );
        console.log(`Executed in ${Date.now() - start}ms`);
        console.table(res.data.data);
    } catch(e) {
        console.error("Error/timeout:", e.response?.data || e.message);
    }
}

testFullQuery();
