const axios = require('axios');

async function q(sql) {
  const res = await axios.post('http://80.210.31.176:5000/api/external/v1/query', { query: sql }, {
    headers: { 'Authorization': 'Bearer s_gate_live_73f08a91b2c' }
  });
  return res.data.data;
}

async function run() {
  const sql1405_mordad = `
    SELECT 
      SUBSTRING(t11.Field_005, 1, 4) as GroupCode,
      SUM(CASE 
        WHEN RTRIM(LTRIM(t10.Field_009)) IN ('10', '81') THEN t11.Field_006
        WHEN s06.Field_010 = 1 THEN t11.Field_006
        WHEN s06.Field_010 = -1 THEN -t11.Field_006
        ELSE 0 
      END) as StockQty
    FROM STR_TBL_011 t11 WITH (NOLOCK)
    INNER JOIN STR_TBL_010 t10 WITH (NOLOCK) ON t11.Field_004 = t10.Field_005 AND t11.Field_003 = t10.Field_004 AND t11.Field_012 = t10.Field_018
    INNER JOIN STR_TBL_006 s06 WITH (NOLOCK) ON t10.Field_009 = s06.Field_003
    WHERE t10.Field_004 = '4'
      AND t10.Field_008 <= '2026-08-22T23:59:59.000Z'
      AND t10.Field_009 NOT IN ('19', '82')
      AND (t11.Field_005 LIKE '01%' OR t11.Field_005 LIKE '04%')
    GROUP BY SUBSTRING(t11.Field_005, 1, 4)
    ORDER BY GroupCode
  `;

  const sql1405_today = `
    SELECT 
      SUBSTRING(t11.Field_005, 1, 4) as GroupCode,
      SUM(CASE 
        WHEN RTRIM(LTRIM(t10.Field_009)) IN ('10', '81') THEN t11.Field_006
        WHEN s06.Field_010 = 1 THEN t11.Field_006
        WHEN s06.Field_010 = -1 THEN -t11.Field_006
        ELSE 0 
      END) as StockQty
    FROM STR_TBL_011 t11 WITH (NOLOCK)
    INNER JOIN STR_TBL_010 t10 WITH (NOLOCK) ON t11.Field_004 = t10.Field_005 AND t11.Field_003 = t10.Field_004 AND t11.Field_012 = t10.Field_018
    INNER JOIN STR_TBL_006 s06 WITH (NOLOCK) ON t10.Field_009 = s06.Field_003
    WHERE t10.Field_004 = '4'
      AND t10.Field_008 <= '2026-10-14T23:59:59.000Z'
      AND t10.Field_009 NOT IN ('19', '82')
      AND (t11.Field_005 LIKE '01%' OR t11.Field_005 LIKE '04%')
    GROUP BY SUBSTRING(t11.Field_005, 1, 4)
    ORDER BY GroupCode
  `;

  console.log("=== 1405 Mordad (2026-08-22 / 1405-05-31) ===");
  console.table(await q(sql1405_mordad));

  console.log("=== 1405 Today (2026-10-14 / 1405-07-22) ===");
  console.table(await q(sql1405_today));
}

run();
