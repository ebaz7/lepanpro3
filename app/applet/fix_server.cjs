const fs = require('fs');
let code = fs.readFileSync('server.js', 'utf8');

const targetSnippet = `        WHERE t11.Field_003 = '\${fyCode}' AND t10.Field_004 = '\${fyCode}'
          AND t10.Field_008 <= '\${targetDate}T23:59:59.000Z'
          AND t10.Field_009 NOT IN ('19', '82')
          AND (t11.Field_005 LIKE '01%' OR t11.Field_005 LIKE '04%')`;

const replacementSnippet = `        WHERE t11.Field_003 = '\${fyCode}' AND t10.Field_004 = '\${fyCode}'
          AND t10.Field_008 >= '2026-03-21T00:00:00.000Z'
          AND t10.Field_008 <= '\${targetDate}T23:59:59.000Z'
          AND t10.Field_009 NOT IN ('19', '82')
          AND (t11.Field_005 LIKE '01%' OR t11.Field_005 LIKE '04%')`;

if (code.includes("t10.Field_008 <= '${targetDate}T23:59:59.000Z'")) {
    code = code.replace(
        "AND t10.Field_008 <= '${targetDate}T23:59:59.000Z'",
        "AND t10.Field_008 >= '2026-03-21T00:00:00.000Z'\n          AND t10.Field_008 <= '${targetDate}T23:59:59.000Z'"
    );
    fs.writeFileSync('server.js', code, 'utf8');
    console.log('Successfully updated server.js with date range!');
} else {
    console.log('Snippet not found.');
}
