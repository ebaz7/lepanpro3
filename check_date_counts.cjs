const fs = require('fs');

async function checkDateCounts() {
    const url = 'http://80.210.31.176:5000/api/external/v1/query';
    const apiKey = 's_gate_live_k7ua5p7hs1h9';

    async function query(sql) {
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ query: sql })
        });
        return await res.json();
    }

    console.log("=== Sales count by Year/Month ===");
    const res = await query(`
        SELECT YEAR(Field_008) as Y, MONTH(Field_008) as M, COUNT(*) as cnt
        FROM STR_TBL_010
        WHERE Field_009 IN ('12', '13')
        GROUP BY YEAR(Field_008), MONTH(Field_008)
        ORDER BY Y DESC, M DESC
    `);
    console.log(JSON.stringify(res, null, 2));
}

checkDateCounts();
