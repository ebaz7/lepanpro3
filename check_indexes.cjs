const fs = require('fs');

async function checkIndexes() {
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

    console.log("=== Indexes on STR_TBL_011 ===");
    const res1 = await query(`
        SELECT i.name as index_name, c.name as column_name, ic.key_ordinal
        FROM sys.indexes i
        INNER JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
        INNER JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
        WHERE i.object_id = OBJECT_ID('STR_TBL_011')
        ORDER BY i.name, ic.key_ordinal
    `);
    console.log(res1.data);
}

checkIndexes();
