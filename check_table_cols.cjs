const fs = require('fs');

async function checkCols() {
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

    console.log("=== IND_TBL_021 ===");
    console.log(await query("SELECT TOP 1 * FROM IND_TBL_021"));

    console.log("=== IND_TBL_022 ===");
    console.log(await query("SELECT TOP 1 * FROM IND_TBL_022"));

    console.log("=== IND_TBL_002 ===");
    console.log(await query("SELECT TOP 1 * FROM IND_TBL_002"));
}

checkCols();
