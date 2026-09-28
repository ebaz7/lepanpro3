const http = require('http');

const gregFrom = '2026-03-21';
const gregTo = '2026-09-28';
const sql = `
  SELECT 
      t9.Field_015 as TafsiliRaw,
      SUM(CAST(t9.Field_009 AS FLOAT)) as TotalBed,
      SUM(CAST(t9.Field_010 AS FLOAT)) as TotalBes
  FROM ACT_TBL_009 t9
  LEFT JOIN ACT_TBL_008 t8 ON t8.Field_004 = t9.Field_003 AND t8.Field_005 = t9.Field_004
  WHERE (
      t9.Field_015 LIKE '11:%' OR t9.Field_015 LIKE '%-11:%' OR
      t9.Field_015 LIKE '51:%' OR t9.Field_015 LIKE '%-51:%' OR
      t9.Field_015 LIKE '52:%' OR t9.Field_015 LIKE '%-52:%' OR
      t9.Field_015 LIKE '53:%' OR t9.Field_015 LIKE '%-53:%' OR
      t9.Field_015 LIKE '54:%' OR t9.Field_015 LIKE '%-54:%' OR
      t9.Field_015 LIKE '55:%' OR t9.Field_015 LIKE '%-55:%' OR
      t9.Field_015 LIKE '31:%' OR t9.Field_015 LIKE '%-31:%'
  )
    AND t9.Field_007 NOT IN ('102', '103', '107', '109', '114', '116', '117') 
    AND t9.Field_005 <> '9'
    AND t8.Field_008 >= '${gregFrom}T00:00:00.000Z' 
    AND t8.Field_008 <= '${gregTo}T23:59:59.000Z'
  GROUP BY t9.Field_015
`;

const postData = JSON.stringify({ query: sql });

const req = http.request({
  hostname: '80.210.31.176',
  port: 5000,
  path: '/api/external/v1/query',
  method: 'POST',
  headers: {
    'Authorization': 'Bearer s_gate_live_vzje5nkn7q4u',
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData),
    'Connection': 'close'
  }
}, (res) => {
  console.log('STATUS:', res.statusCode);
  console.log('HEADERS:', JSON.stringify(res.headers));
  let bytesReceived = 0;
  let chunkCount = 0;
  res.on('data', (chunk) => {
    bytesReceived += chunk.length;
    chunkCount++;
    console.log(`Received chunk #${chunkCount}: ${chunk.length} bytes (total: ${bytesReceived})`);
  });
  res.on('end', () => {
    console.log('BODY COMPLETE! Total bytes:', bytesReceived);
    process.exit(0);
  });
});

req.on('error', (e) => {
  console.error('Request error:', e.message);
  process.exit(1);
});

req.write(postData);
req.end();
