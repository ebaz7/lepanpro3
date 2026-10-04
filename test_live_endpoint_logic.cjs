const axios = require('axios');

async function executeSayanQuery(sql, timeout = 10000) {
  const res = await axios.post('http://80.210.31.176:5000/api/external/v1/query', { query: sql }, { 
    headers: { 'Authorization': 'Bearer s_gate_live_vzje5nkn7q4u', 'Content-Type': 'application/json' },
    timeout
  });
  return res.data.data;
}

let itemNamesCache = null;
let itemNamesCacheTime = 0;

async function getItemNamesMap() {
  if (itemNamesCache && Date.now() - itemNamesCacheTime < 3600000) {
    return itemNamesCache;
  }
  try {
    const nameRows = await executeSayanQuery(`
      SELECT 
        RTRIM(LTRIM(t21.Field_004)) as ItemCode,
        RTRIM(LTRIM(t02.Field_003)) as ItemName,
        RTRIM(LTRIM(COALESCE(t02_parent.Field_003, t02.Field_003))) as GroupName,
        RTRIM(LTRIM(t02.Field_003)) as SubGroupName
      FROM IND_TBL_021 t21 WITH (NOLOCK)
      INNER JOIN IND_TBL_002 t02 WITH (NOLOCK) ON RTRIM(LTRIM(t21.Field_003)) = RTRIM(LTRIM(t02.Field_008))
      LEFT JOIN IND_TBL_002 t02_parent WITH (NOLOCK) ON RTRIM(LTRIM(t02.Field_009)) = RTRIM(LTRIM(t02_parent.Field_008))
    `, 6000);

    const map = {};
    (nameRows || []).forEach(r => {
      if (r.ItemCode && !map[r.ItemCode]) {
        map[r.ItemCode] = { name: r.ItemName, group: r.GroupName, subGroup: r.SubGroupName };
      }
    });

    const ind22 = await executeSayanQuery(`SELECT RTRIM(LTRIM(Field_005)) as ItemCode, RTRIM(LTRIM(Field_004)) as ItemName FROM IND_TBL_022 WITH (NOLOCK)`, 6000);
    (ind22 || []).forEach(r => {
      if (r.ItemCode && !map[r.ItemCode]) {
        map[r.ItemCode] = { name: r.ItemName, group: '', subGroup: '' };
      }
    });

    itemNamesCache = map;
    itemNamesCacheTime = Date.now();
    return map;
  } catch (err) {
    console.warn("Could not fetch item names map:", err.message);
    return itemNamesCache || {};
  }
}

function getFyCodeForDate(dateStr) {
  if (dateStr <= '2025-03-20') return 2;
  if (dateStr <= '2026-03-20') return 3;
  if (dateStr <= '2027-03-20') return 4;
  if (dateStr <= '2028-03-20') return 5;
  if (dateStr <= '2029-03-20') return 6;
  const year = parseInt(dateStr.substring(0, 4));
  return Math.max(2, year - 2022);
}

const standardGroupNames = {
  '0101': 'چیپس',
  '0102': 'POY',
  '0103': 'dty یا پلی استر',
  '0104': 'لاستیک',
  '0105': 'لاکرا',
  '0106': 'پلی استر اسپان',
  '0107': 'مستر بچ',
  '0108': 'نایلون',
  '0401': 'اسپاندکس (کاور)',
  '0402': 'کش',
  '0403': 'اسپاندکس جوشی ( ساپورت )',
  '0405': 'پلی استر شوایتر',
  '0407': 'نایلون',
  '0408': 'نخ ملت',
  '0409': 'الیاف',
  '0410': 'FDY'
};

const cartonRatios = {
  '0401': 15.0,
  '0402': 16.0,
  '0403': 17.0,
  '0405': 15.5,
  '0410': 20.0,
};

async function getWarehouseInventoryForDate(targetDate) {
  const fyCode = getFyCodeForDate(targetDate);

  // Check if current fyCode has an opening document (OpCode 10/81)
  const openingCheck = await executeSayanQuery(`
    SELECT TOP 1 Field_001 
    FROM STR_TBL_010 WITH (NOLOCK) 
    WHERE Field_004 = '${fyCode}' AND Field_009 IN ('10', '81')
  `, 5000);

  const hasOpening = openingCheck && openingCheck.length > 0;
  console.log(`[Inventory Check] Target Date: ${targetDate} -> FY: ${fyCode}, hasOpening: ${hasOpening}`);

  let fyFilter = '';
  if (hasOpening) {
    // Standard closed year with opening voucher
    fyFilter = `t11.Field_003 = '${fyCode}' AND t10.Field_004 = '${fyCode}'`;
  } else {
    // Unclosed prior year (e.g. first 2-3 months of year) - include prior year(s)
    const prevFy = Math.max(2, fyCode - 1);
    fyFilter = `t11.Field_003 IN ('${prevFy}', '${fyCode}') AND t10.Field_004 IN ('${prevFy}', '${fyCode}')`;
  }

  const stockQuery = `
    SELECT 
      t11.Field_005 as ItemCode,
      SUM(CASE WHEN s06.Field_010 = 1 THEN t11.Field_006 ELSE 0 END) as InflowQty,
      SUM(CASE WHEN s06.Field_010 = -1 THEN t11.Field_006 ELSE 0 END) as OutflowQty,
      SUM(CASE WHEN s06.Field_010 = 1 THEN t11.Field_006 WHEN s06.Field_010 = -1 THEN -t11.Field_006 ELSE 0 END) as StockQty,
      SUM(CASE 
        WHEN t11.Field_005 LIKE '04%' AND t11.Field_031 LIKE N'%تعداد کارتن:%' THEN
          TRY_CAST(
            LTRIM(RTRIM(SUBSTRING(
              t11.Field_031, 
              CHARINDEX(N'تعداد کارتن:', t11.Field_031) + 12, 
              CHARINDEX(N'|', t11.Field_031 + N'|', CHARINDEX(N'تعداد کارتن:', t11.Field_031) + 12) - (CHARINDEX(N'تعداد کارتن:', t11.Field_031) + 12)
            ))) as float
          ) * s06.Field_010
        ELSE 0 
      END) as CartonsQty
    FROM STR_TBL_011 t11 WITH (NOLOCK)
    INNER JOIN STR_TBL_010 t10 WITH (NOLOCK) ON t11.Field_004 = t10.Field_005 AND t11.Field_003 = t10.Field_004 AND t11.Field_012 = t10.Field_018
    INNER JOIN STR_TBL_006 s06 WITH (NOLOCK) ON t10.Field_009 = s06.Field_003
    WHERE ${fyFilter}
      AND t10.Field_008 <= '${targetDate}T23:59:59.000Z'
      AND t10.Field_009 NOT IN ('19', '82')
      AND (t11.Field_005 LIKE '01%' OR t11.Field_005 LIKE '04%')
    GROUP BY t11.Field_005
  `;

  const [rows, nameMap] = await Promise.all([
    executeSayanQuery(stockQuery, 10000),
    getItemNamesMap()
  ]);

  return (rows || []).map(r => {
    const code = String(r.ItemCode || '').trim();
    const grpCode = code.substring(0, 4);
    const mapped = nameMap[code] || {};
    const defaultGrp = standardGroupNames[grpCode] || `گروه ${grpCode}`;
    const weight = parseFloat((r.StockQty || 0).toFixed(3));
    let cartons = Math.round(r.CartonsQty || 0);
    if (!cartons && cartonRatios[grpCode] && weight > 0) {
      cartons = Math.round(weight / cartonRatios[grpCode]);
    }
    return {
      itemCode: code,
      itemName: mapped.name || `${defaultGrp} - کد ${code.substring(4) || code}`,
      groupName: standardGroupNames[grpCode] || mapped.group || defaultGrp,
      subGroupName: mapped.subGroup || '',
      inflowQty: parseFloat((r.InflowQty || 0).toFixed(3)),
      outflowQty: parseFloat((r.OutflowQty || 0).toFixed(3)),
      stockQty: weight,
      cartonsQty: cartons
    };
  });
}

async function test() {
  console.log("Testing live execution for Last Year (2026-03-20) and Current Year (today)...");
  const t0 = Date.now();
  const ly = await getWarehouseInventoryForDate('2026-03-20');
  console.log(`Last Year returned ${ly.length} items in ${Date.now() - t0}ms`);

  const t1 = Date.now();
  const curr = await getWarehouseInventoryForDate('2026-10-04');
  console.log(`Current Year returned ${curr.length} items in ${Date.now() - t1}ms`);

  console.log("Sample LY item:", ly[0]);
  console.log("Sample Curr item:", curr[0]);
}

test().catch(e => console.error(e));
