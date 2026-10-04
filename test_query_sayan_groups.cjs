const axios = require('axios');

async function q(sql) {
  const res = await axios.post('http://80.210.31.176:5000/api/external/v1/query', { query: sql }, { headers: { 'Authorization': 'Bearer s_gate_live_vzje5nkn7q4u' } });
  return res.data.data;
}

async function run() {
  const sql = `
  SELECT 
    t10.Field_004 as FY,
    t10.Field_009 as OpCode,
    s06.Field_004 as OpName,
    s06.Field_010 as InOut,
    COUNT(*) as [cnt],
    SUM(t11.Field_006) as TotalQty,
    SUM(t11.Field_007) as TotalAmt
  FROM STR_TBL_011 t11
  INNER JOIN STR_TBL_010 t10 ON t11.Field_004 = t10.Field_005 AND t11.Field_003 = t10.Field_004 AND t11.Field_012 = t10.Field_018
  LEFT JOIN STR_TBL_006 s06 ON t10.Field_009 = s06.Field_003
  WHERE t11.Field_005 LIKE '0101%'
  GROUP BY t10.Field_004, t10.Field_009, s06.Field_004, s06.Field_010
  ORDER BY t10.Field_004, t10.Field_009
  `;
  const rows = await q(sql);
  console.table(rows);
}

run();
