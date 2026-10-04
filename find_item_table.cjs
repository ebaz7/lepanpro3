const axios = require('axios');

async function q(sql) {
  const res = await axios.post('http://80.210.31.176:5000/api/external/v1/query', { query: sql }, { 
    headers: { 'Authorization': 'Bearer s_gate_live_vzje5nkn7q4u', 'Content-Type': 'application/json' },
    timeout: 10000
  });
  return res.data.data;
}

async function test() {
  // Let's find tables that have '010301011001'
  const t = await q(`
    SELECT TABLE_NAME, COLUMN_NAME 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_NAME LIKE 'IND_%' OR TABLE_NAME LIKE 'STR_%' OR TABLE_NAME LIKE 'COM_%' OR TABLE_NAME LIKE 'GNR_%'
  `);
  
  // Find which tables have item name/code
  const itemTables = t.filter(x => x.COLUMN_NAME.toLowerCase().includes('name') || x.COLUMN_NAME.toLowerCase().includes('title') || x.TABLE_NAME.includes('001') || x.TABLE_NAME.includes('002') || x.TABLE_NAME.includes('003') || x.TABLE_NAME.includes('022'));
  console.log('Candidate item tables:', itemTables.slice(0, 30));
  
  // Check IND_TBL_022
  try {
    const r22 = await q("SELECT TOP 3 * FROM IND_TBL_022");
    console.log("IND_TBL_022 sample:", r22);
  } catch(e) {}

  // Check IND_TBL_002
  try {
    const r02 = await q("SELECT TOP 3 * FROM IND_TBL_002");
    console.log("IND_TBL_002 sample:", r02);
  } catch(e) {}
}

test().catch(e => console.error(e.response?.data || e.message));
