const fs = require('fs');

async function checkRowCounts() {
    const url = 'http://80.210.31.176:5000/api/external/v1/query';
    const apiKey = 's_gate_live_k7ua5p7hs1h9';

    async function getCount(tbl) {
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ query: `SELECT COUNT(*) as cnt FROM ${tbl}` })
        });
        const d = await res.json();
        return d.data && d.data[0] ? d.data[0].cnt : 'err';
    }

    console.log("STR_TBL_010 count:", await getCount("STR_TBL_010"));
    console.log("STR_TBL_011 count:", await getCount("STR_TBL_011"));
    console.log("IND_TBL_021 count:", await getCount("IND_TBL_021"));
    console.log("IND_TBL_022 count:", await getCount("IND_TBL_022"));
    console.log("IND_TBL_002 count:", await getCount("IND_TBL_002"));
    console.log("ACT_TBL_007 count:", await getCount("ACT_TBL_007"));
}

checkRowCounts();
