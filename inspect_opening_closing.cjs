const axios = require('axios');

async function q(sql) {
  const res = await axios.post('http://80.210.31.176:5000/api/external/v1/query', { query: sql }, { 
    headers: { 'Authorization': 'Bearer s_gate_live_vzje5nkn7q4u', 'Content-Type': 'application/json' },
    timeout: 10000
  });
  return res.data.data;
}

async function test() {
  const opDocs = await q(`
    SELECT t10.Field_004 as FY, t10.Field_005 as DocNo, t10.Field_009 as OpCode, COUNT(t11.Field_001) as ItemCount
    FROM STR_TBL_010 t10 WITH (NOLOCK)
    INNER JOIN STR_TBL_011 t11 WITH (NOLOCK) ON t11.Field_004 = t10.Field_005 AND t11.Field_003 = t10.Field_004 AND t11.Field_012 = t10.Field_018
    WHERE t10.Field_009 IN ('10', '19', '81', '82')
    GROUP BY t10.Field_004, t10.Field_005, t10.Field_009
    ORDER BY t10.Field_004, t10.Field_009
  `);
  console.table(opDocs);
}

test().catch(e => console.error(e.response?.data || e.message));
