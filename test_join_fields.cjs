const fs = require('fs');

async function testJoinFields() {
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

    console.log("=== STR_TBL_010 Top 1 ===");
    const d10 = await query("SELECT TOP 1 Field_001, Field_004, Field_005, Field_006, Field_008, Field_009, Field_018 FROM STR_TBL_010 WHERE Field_009 = '12'");
    console.log(d10.data[0]);

    if (d10.data && d10.data[0]) {
        const row = d10.data[0];
        console.log(`=== STR_TBL_011 for Doc F4=${row.Field_004}, F5=${row.Field_005}, F18=${row.Field_018} ===`);
        const d11 = await query(`
            SELECT TOP 5 Field_001, Field_003, Field_004, Field_005, Field_006, Field_007, Field_012, Field_036 
            FROM STR_TBL_011 
            WHERE Field_004 = '${row.Field_005}' AND Field_003 = '${row.Field_004}'
        `);
        console.log(d11.data);
    }
}

testJoinFields();
