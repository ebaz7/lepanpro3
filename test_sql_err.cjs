const fs = require('fs');

async function testSqlErr() {
    const url = 'http://80.210.31.176:5000/api/external/v1/query';
    const apiKey = 's_gate_live_k7ua5p7hs1h9';

    const badSql = `
        SELECT TOP 1 Field_001 
        FROM STR_TBL_010 
        WHERE Field_008 >= '1404T00:00:00.000Z'
    `;

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ query: badSql })
    });
    const data = await response.json();
    console.log("SQL Error result when date is bad:", JSON.stringify(data));
}

testSqlErr();
