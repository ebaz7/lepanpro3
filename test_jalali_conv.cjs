const jalaali = require('jalaali-js');

function parseShamsiParts(shamsiStr) {
    if (!shamsiStr) return null;
    const parts = shamsiStr.split(/[\/\.\-]/).map(p => p.trim());
    if (parts.length < 3) return null;
    let jy = parseInt(parts[0], 10);
    let jm = parseInt(parts[1], 10);
    let jd = parseInt(parts[2], 10);
    if (isNaN(jy) || isNaN(jm) || isNaN(jd)) return null;
    if (jy < 100) jy += 1400;
    return { jy, jm, jd };
}

function jalaliToGregorianStr(jalaliStr) {
    if (!jalaliStr) return '';
    try {
        const res = parseShamsiParts(jalaliStr);
        if (!res) return jalaliStr;
        const g = jalaali.toGregorian(res.jy, res.jm, res.jd);
        if (!g || !g.gy || isNaN(g.gy)) return jalaliStr;
        return `${g.gy}-${String(g.gm).padStart(2, '0')}-${String(g.gd).padStart(2, '0')}`;
    } catch {
        return jalaliStr;
    }
}

console.log("1405/07/18 ->", jalaliToGregorianStr("1405/07/18"));
console.log("1404/01/01 ->", jalaliToGregorianStr("1404/01/01"));
console.log("1404/12/29 ->", jalaliToGregorianStr("1404/12/29"));
console.log("Empty or bad: '1404' ->", jalaliToGregorianStr("1404"));
