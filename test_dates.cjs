const fs = require('fs');

async function testDates() {
    const url = 'http://80.210.31.176:5000/api/external/v1/query';
    const apiKey = 's_gate_live_k7ua5p7hs1h9';

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            query: `
                SELECT TOP 10 Field_001, Field_006, Field_008, Field_009 
                FROM STR_TBL_010 
                WHERE Field_009 IN ('12', '13')
                ORDER BY Field_001 DESC
            `
        })
    });
    const data = await response.json();
    console.log(JSON.stringify(data, null, 2));
}

testDates();
