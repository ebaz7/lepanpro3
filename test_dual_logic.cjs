const axios = require('axios');

async function testDualLogic() {
    const targetDate = '2026-08-22';
    const fyCode = '4';

    const sql = `
    WITH ItemsWithOpening AS (
        SELECT DISTINCT t11.Field_005 as ItemCode
        FROM STR_TBL_011 t11 WITH (NOLOCK)
        INNER JOIN STR_TBL_010 t10 WITH (NOLOCK) ON t11.Field_004 = t10.Field_005 
                                   AND t11.Field_003 = t10.Field_004 
                                   AND t11.Field_012 = t10.Field_018
        WHERE t10.Field_004 = '${fyCode}'
          AND t10.Field_009 IN ('10', '81')
          AND t10.Field_008 <= '${targetDate}T23:59:59.000Z'
    )
    SELECT COUNT(*) as openingItemsCount FROM ItemsWithOpening
    `;

    try {
        console.log("Testing dual logic Opening Check on Sayan...");
        const res = await axios.post('http://80.210.31.176:5000/api/external/v1/query', 
            { query: sql }, 
            { headers: { 'Authorization': 'Bearer s_gate_live_vzje5nkn7q4u' }, timeout: 8000 }
        );
        console.log("Opening items in FY 4:", res.data.data);
    } catch(e) {
        console.log("Sayan test caught expected error/timeout:", e.response?.data || e.message);
    }
}

testDualLogic();
