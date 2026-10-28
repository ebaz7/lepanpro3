import { executeSayanQuery } from './backend/sayan-order-automation.js';
import { getDb } from './backend/db-manager.js';

async function run() {
  console.log('--- Searching Sayan Persons GNR_TBL_001 for Moghorazi / مقراضی ---');
  try {
    const persons = await executeSayanQuery(`
      SELECT Field_001, Field_003, Field_006, Field_007, Field_004
      FROM GNR_TBL_001 WITH (NOLOCK)
      WHERE Field_007 LIKE N'%مقراضی%' OR Field_006 LIKE N'%مقراضی%' OR Field_004 LIKE N'%مقراضی%'
    `);
    console.log('Persons found:', JSON.stringify(persons, null, 2));

    if (persons && persons.length > 0) {
      for (const p of persons) {
        const pCode = (p.Field_003 || p.Field_001 || '').trim();
        console.log(`\n--- Searching Cheque Receipts (BUR_TBL_008) for PersonCode: ${pCode} ---`);
        const docs = await executeSayanQuery(`
          SELECT h.Field_001 as HeaderId, h.Field_004 as FY, h.Field_005 as ArchiveCode, h.Field_006 as DocNo, h.Field_008 as DocDate, h.Field_010 as PersonCode, h.Field_025 as TotalAmount, h.Field_028 as Description
          FROM BUR_TBL_008 h WITH (NOLOCK)
          WHERE h.Field_010 = '${pCode}' AND h.Field_009 = '11'
          ORDER BY CAST(h.Field_001 as bigint) DESC
        `);
        console.log(`Docs for ${pCode}:`, JSON.stringify(docs, null, 2));

        for (const doc of docs || []) {
          const rows = await executeSayanQuery(`
            SELECT r.Field_001, r.Field_004 as ArchiveCode, r.Field_006 as Amount, r.Field_007 as ChequeId, c.Field_005 as ChequeNo, c.Field_006 as DueDate, c.Field_009 as BankName, c.Field_016 as PoshtNomreh
            FROM BUR_TBL_009 r WITH (NOLOCK)
            LEFT JOIN BUR_TBL_012 c WITH (NOLOCK) ON c.Field_001 = r.Field_007
            WHERE r.Field_004 = '${doc.ArchiveCode}'
          `);
          console.log(`Detail rows for ArchiveCode ${doc.ArchiveCode}:`, JSON.stringify(rows, null, 2));
        }
      }
    }
  } catch (err) {
    console.error('SQL Error:', err);
  }

  console.log('\n--- Searching Local JSON Database ---');
  const db = getDb();
  for (const k of Object.keys(db)) {
    if (Array.isArray(db[k])) {
      const match = db[k].filter(item => JSON.stringify(item).includes('مقراضی') || JSON.stringify(item).includes('مقراضی'));
      if (match.length > 0) {
        console.log(`Key "${k}" matches (${match.length}):`, JSON.stringify(match, null, 2));
      }
    }
  }
  process.exit(0);
}

run();
