const fs = require('fs');

['database.json', 'db.json'].forEach(dbFile => {
    if (fs.existsSync(dbFile)) {
        try {
            const db = JSON.parse(fs.readFileSync(dbFile, 'utf8'));
            if (db.warehouseOverview) {
                db.warehouseOverview.currentOverrides = {};
                db.warehouseOverview.lastYearOverrides = {};
                db.warehouseOverview.sayanCache = null;
                fs.writeFileSync(dbFile, JSON.stringify(db, null, 2), 'utf8');
                console.log(`✓ Cleared stale overrides in ${dbFile}`);
            }
        } catch (e) {
            console.error(`Error processing ${dbFile}:`, e.message);
        }
    }
});
