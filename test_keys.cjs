const fs = require('fs');

async function testKeys() {
    const url = 'http://80.210.31.176:5000/api/external/v1/query';
    const keys = [
        's_gate_live_k7ua5p7hs1h9',
        's_gate_live_vgr182bwtpoa',
        's_gate_live_vzje5nkn7q4u'
    ];

    for (const key of keys) {
        console.log(`Testing key: ${key}`);
        try {
            const controller = new AbortController();
            const tid = setTimeout(() => controller.abort(), 5000);
            const res = await fetch(url, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${key}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ query: 'SELECT TOP 1 * FROM PAY_TBL_009' }),
                signal: controller.signal
            });
            clearTimeout(tid);
            const data = await res.json();
            console.log(`Key ${key} -> status ${res.status}, success: ${data.success}, rows: ${data.data ? data.data.length : 'none'}`);
        } catch (e) {
            console.log(`Key ${key} -> Error: ${e.message}`);
        }
    }
}

testKeys();
