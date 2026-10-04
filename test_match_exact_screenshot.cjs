const axios = require('axios');

async function q(sql) {
  const res = await axios.post('http://80.210.31.176:5000/api/external/v1/query', { query: sql }, { headers: { 'Authorization': 'Bearer s_gate_live_vzje5nkn7q4u' } });
  return res.data.data;
}

async function run() {
  console.log("Checking what formulas give the exact numbers in user screenshot...");
  
  // Let's check OpCodes in FY 3 and FY 4
  // First, what OpCodes are Inflow vs Outflow?
  // Let's test standard warehouse Inflow vs Outflow:
  // Inflow: 10 (opening), 14 (purchase invoice if recorded in wh), 24 (sales return), 26 (transfer in), 27 (parts receipt), 29 (purchase receipt), 40 (receipt from prod), 44 (return from prod), 46 (prod receipt), 61 (poy prod), 67 (dty prod), 70 (schweiter prod), 73 (spandex prod), 76 (support prod), 79 (elastic prod), 81 (parts opening), 83 (surplus in), 85 (parts return)
  // Outflow: 12 (sales invoice), 19 (closing), 23 (sales remittance), 25 (transfer out), 28 (parts consumption), 30 (purchase return), 31 (parts return), 37 (issue to prod), 42 (return to prod), 62 (poy cons), 65 (prod to wh?), 68 (dty cons), 71 (schweiter cons), 74 (spandex cons), 77 (support cons), 80 (elastic cons), 82 (parts closing), 84 (deficit out)

  // But in STR_TBL_006, Field_010 is literally 1 for Inflow, -1 for Outflow, 0 for commercial/order!
  // Let's verify what Field_010 gives for each group in FY 3 up to 2026-03-20
  
  const testSql1 = `
    SELECT 
      SUBSTRING(t11.Field_005, 1, 4) as GroupPrefix,
      SUM(CASE WHEN s06.Field_010 = 1 THEN t11.Field_006 WHEN s06.Field_010 = -1 THEN -t11.Field_006 ELSE 0 END) as NetQty,
      SUM(CASE WHEN s06.Field_010 = 1 THEN t11.Field_007 WHEN s06.Field_010 = -1 THEN -t11.Field_007 ELSE 0 END) as NetAmt
    FROM STR_TBL_011 t11 WITH (NOLOCK)
    INNER JOIN STR_TBL_010 t10 WITH (NOLOCK) ON t11.Field_004 = t10.Field_005 AND t11.Field_003 = t10.Field_004 AND t11.Field_012 = t10.Field_018
    INNER JOIN STR_TBL_006 s06 WITH (NOLOCK) ON t10.Field_009 = s06.Field_003
    WHERE t10.Field_004 = '4'
      AND t10.Field_008 <= '2026-08-22T23:59:59.000Z'
      AND t10.Field_009 NOT IN ('19', '82')
      AND (t11.Field_005 LIKE '01%' OR t11.Field_005 LIKE '04%')
    GROUP BY SUBSTRING(t11.Field_005, 1, 4)
    ORDER BY GroupPrefix
  `;

  console.log("Testing FY 3 with STR_TBL_006.Field_010:");
  const res1 = await q(testSql1);
  console.table(res1);
}

run().catch(e => console.error(e.response?.data || e.message));
