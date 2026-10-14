const fs = require('fs');

let content = fs.readFileSync('components/WarehouseOverviewTab.tsx', 'utf8');

// 1. Add accounting helper functions inside WarehouseOverviewTab component
const helperMarker = "const getSayanGroupSum = (groupCode: string, isLastYear: boolean, field: 'weight' | 'cartons'): number => {";
const helperIdx = content.indexOf(helperMarker);

if (helperIdx !== -1) {
    const accountingHelpers = `
    // Sayan Accounting Breakdown Helpers
    const getSayanGroupOpening = (groupCode: string, isLastYear: boolean): number => {
        const list = isLastYear ? sayanLastYear : sayanCurrent;
        return list.reduce((sum, r) => {
            const code = String(r.itemCode || r.ItemCode || '');
            if (code.startsWith(groupCode)) {
                return sum + (Number(r.openingQty) || 0);
            }
            return sum;
        }, 0);
    };

    const getSayanGroupInflow = (groupCode: string, isLastYear: boolean): number => {
        const list = isLastYear ? sayanLastYear : sayanCurrent;
        return list.reduce((sum, r) => {
            const code = String(r.itemCode || r.ItemCode || '');
            if (code.startsWith(groupCode)) {
                return sum + (Number(r.inflowQty) || 0);
            }
            return sum;
        }, 0);
    };

    const getSayanGroupOutflow = (groupCode: string, isLastYear: boolean): number => {
        const list = isLastYear ? sayanLastYear : sayanCurrent;
        return list.reduce((sum, r) => {
            const code = String(r.itemCode || r.ItemCode || '');
            if (code.startsWith(groupCode)) {
                return sum + (Number(r.outflowQty) || 0);
            }
            return sum;
        }, 0);
    };

    const getSayanGroupEnding = (groupCode: string, isLastYear: boolean): number => {
        const list = isLastYear ? sayanLastYear : sayanCurrent;
        return list.reduce((sum, r) => {
            const code = String(r.itemCode || r.ItemCode || '');
            if (code.startsWith(groupCode)) {
                return sum + (Number(r.stockQty) || 0);
            }
            return sum;
        }, 0);
    };

    const getSayanItemOpening = (itemCode: string, isLastYear: boolean): number => {
        const list = isLastYear ? sayanLastYear : sayanCurrent;
        const found = list.find(r => String(r.itemCode || r.ItemCode || '') === itemCode);
        return found ? (Number(found.openingQty) || 0) : 0;
    };

    const getSayanItemInflow = (itemCode: string, isLastYear: boolean): number => {
        const list = isLastYear ? sayanLastYear : sayanCurrent;
        const found = list.find(r => String(r.itemCode || r.ItemCode || '') === itemCode);
        return found ? (Number(found.inflowQty) || 0) : 0;
    };

    const getSayanItemOutflow = (itemCode: string, isLastYear: boolean): number => {
        const list = isLastYear ? sayanLastYear : sayanCurrent;
        const found = list.find(r => String(r.itemCode || r.ItemCode || '') === itemCode);
        return found ? (Number(found.outflowQty) || 0) : 0;
    };

    const getSayanItemEnding = (itemCode: string, isLastYear: boolean): number => {
        const list = isLastYear ? sayanLastYear : sayanCurrent;
        const found = list.find(r => String(r.itemCode || r.ItemCode || '') === itemCode);
        return found ? (Number(found.stockQty) || 0) : 0;
    };

    const calculateTotalSayanOpeningSum = (isLastYear: boolean): number => {
        const list = isLastYear ? sayanLastYear : sayanCurrent;
        return list.reduce((sum, r) => sum + (Number(r.openingQty) || 0), 0);
    };

    const calculateTotalSayanInflowSum = (isLastYear: boolean): number => {
        const list = isLastYear ? sayanLastYear : sayanCurrent;
        return list.reduce((sum, r) => sum + (Number(r.inflowQty) || 0), 0);
    };

    const calculateTotalSayanOutflowSum = (isLastYear: boolean): number => {
        const list = isLastYear ? sayanLastYear : sayanCurrent;
        return list.reduce((sum, r) => sum + (Number(r.outflowQty) || 0), 0);
    };

    const calculateTotalSayanEndingSum = (isLastYear: boolean): number => {
        const list = isLastYear ? sayanLastYear : sayanCurrent;
        return list.reduce((sum, r) => sum + (Number(r.stockQty) || 0), 0);
    };

`;
    content = content.substring(0, helperIdx) + accountingHelpers + content.substring(helperIdx);
    console.log('✓ Added accounting helper functions to WarehouseOverviewTab.tsx');
}

// 2. Replace renderTableBody with standard Sayan Accounting 5-column layout
const bodyStartMarker = 'const renderTableBody = (isLastYear: boolean) => {';
const bodyStart = content.indexOf(bodyStartMarker);
const bodyEndMarker = '    const renderVarianceMatrix = () => {';
const bodyEnd = content.indexOf(bodyEndMarker);

if (bodyStart !== -1 && bodyEnd !== -1) {
    const newRenderTableBody = `const renderTableBody = (isLastYear: boolean) => {
        return (
            <tbody className="divide-y divide-slate-100">
                {/* 1. MANUFACTURED GOODS */}
                <tr className="bg-blue-50/80 text-blue-900 font-extrabold text-right">
                    <td colSpan={5} className="py-2.5 px-3 text-[11px] border-y border-blue-100/60 font-bold">
                        ۱. کالاهای تولیدی (ادغام شده در سطح گروه کالا)
                    </td>
                </tr>
                {filteredYarns.length === 0 ? (
                    <tr>
                        <td colSpan={5} className="py-4 text-center text-slate-400">موردی یافت نشد.</td>
                    </tr>
                ) : (
                    filteredYarns.map((group) => {
                        const isExpanded = !!expandedGroups[group.code];
                        const childItems = getGroupChildItems(group.code);
                        const op = getSayanGroupOpening(group.code, isLastYear);
                        const inf = getSayanGroupInflow(group.code, isLastYear);
                        const out = getSayanGroupOutflow(group.code, isLastYear);
                        const end = getSayanGroupEnding(group.code, isLastYear);

                        return (
                            <React.Fragment key={\`group-yarn-\${isLastYear ? 'ly' : 'curr'}-\${group.code}\`}>
                                <tr className="hover:bg-slate-50 text-slate-700 border-b border-slate-100 transition-colors">
                                    <td 
                                        className="py-2.5 px-3 text-right font-bold text-slate-800 flex items-center gap-1.5 cursor-pointer hover:text-blue-600 transition-colors select-none"
                                        onClick={() => toggleGroup(group.code)}
                                    >
                                        <span className="inline-flex items-center justify-center w-5 h-5 rounded hover:bg-slate-100 transition-colors">
                                            {isExpanded ? (
                                                <ChevronDown className="w-3.5 h-3.5 text-blue-600" />
                                            ) : (
                                                <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                                            )}
                                        </span>
                                        <span className="font-mono text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded font-bold mr-1">{group.code}</span>
                                        <span className="font-bold text-slate-900">{group.name}</span>
                                        <span className="text-[10px] text-slate-400 font-normal mr-1">({childItems.length} کالا)</span>
                                    </td>
                                    <td className="py-2.5 px-2 font-mono text-center font-semibold text-slate-700">
                                        {op !== 0 ? op.toLocaleString('fa-IR', { maximumFractionDigits: 3 }) : '—'}
                                    </td>
                                    <td className="py-2.5 px-2 font-mono text-center font-semibold text-emerald-700">
                                        {inf !== 0 ? inf.toLocaleString('fa-IR', { maximumFractionDigits: 3 }) : '—'}
                                    </td>
                                    <td className="py-2.5 px-2 font-mono text-center font-semibold text-rose-700">
                                        {out !== 0 ? out.toLocaleString('fa-IR', { maximumFractionDigits: 3 }) : '—'}
                                    </td>
                                    <td className="py-2.5 px-2 font-mono text-center font-extrabold text-blue-900 bg-blue-50/40">
                                        {end !== 0 ? end.toLocaleString('fa-IR', { maximumFractionDigits: 3 }) : '—'}
                                    </td>
                                </tr>
                                
                                {isExpanded && childItems.map((child) => {
                                    const cop = getSayanItemOpening(child.itemCode, isLastYear);
                                    const cinf = getSayanItemInflow(child.itemCode, isLastYear);
                                    const cout = getSayanItemOutflow(child.itemCode, isLastYear);
                                    const cend = getSayanItemEnding(child.itemCode, isLastYear);

                                    return (
                                        <tr 
                                            key={\`child-yarn-\${isLastYear ? 'ly' : 'curr'}-\${group.code}-\${child.itemCode}\`}
                                            className="bg-slate-50/40 hover:bg-slate-100/60 transition-colors text-slate-600 text-[11px] border-b border-dashed border-slate-100/80"
                                        >
                                            <td className="py-2 px-3 pr-8 text-right font-normal text-slate-700 flex items-center gap-1.5">
                                                <span className="text-slate-300 font-bold select-none">↳</span>
                                                <span className="font-mono text-[9px] bg-slate-100 text-slate-500 px-1 py-0.5 rounded mr-1 select-all">{child.itemCode}</span>
                                                <span className="font-semibold text-slate-800">{child.itemName}</span>
                                            </td>
                                            <td className="py-2 px-2 font-mono text-center text-slate-600">
                                                {cop !== 0 ? cop.toLocaleString('fa-IR', { maximumFractionDigits: 3 }) : '—'}
                                            </td>
                                            <td className="py-2 px-2 font-mono text-center text-emerald-600">
                                                {cinf !== 0 ? cinf.toLocaleString('fa-IR', { maximumFractionDigits: 3 }) : '—'}
                                            </td>
                                            <td className="py-2 px-2 font-mono text-center text-rose-600">
                                                {cout !== 0 ? cout.toLocaleString('fa-IR', { maximumFractionDigits: 3 }) : '—'}
                                            </td>
                                            <td className="py-2 px-2 font-mono text-center font-bold text-slate-900 bg-slate-100/50">
                                                {cend !== 0 ? cend.toLocaleString('fa-IR', { maximumFractionDigits: 3 }) : '—'}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </React.Fragment>
                        );
                    })
                )}

                {/* 2. IMPORTED & RAW MATERIALS */}
                <tr className="bg-teal-50/80 text-teal-900 font-extrabold text-right">
                    <td colSpan={5} className="py-2.5 px-3 text-[11px] border-y border-teal-100/60 font-bold">
                        ۲. مواد اولیه وارداتی و کمکی (تفکیک شده بر اساس گروه کالا)
                    </td>
                </tr>
                {filteredImported.length === 0 ? (
                    <tr>
                        <td colSpan={5} className="py-4 text-center text-slate-400">موردی یافت نشد.</td>
                    </tr>
                ) : (
                    filteredImported.map((group) => {
                        const isExpanded = !!expandedGroups[group.code];
                        const childItems = getGroupChildItems(group.code);
                        const op = getSayanGroupOpening(group.code, isLastYear);
                        const inf = getSayanGroupInflow(group.code, isLastYear);
                        const out = getSayanGroupOutflow(group.code, isLastYear);
                        const end = getSayanGroupEnding(group.code, isLastYear);

                        return (
                            <React.Fragment key={\`group-imp-\${isLastYear ? 'ly' : 'curr'}-\${group.code}\`}>
                                <tr className="hover:bg-slate-50 text-slate-700 border-b border-slate-100 transition-colors">
                                    <td 
                                        className="py-2.5 px-3 text-right font-bold text-slate-800 flex items-center gap-1.5 cursor-pointer hover:text-teal-600 transition-colors select-none"
                                        onClick={() => toggleGroup(group.code)}
                                    >
                                        <span className="inline-flex items-center justify-center w-5 h-5 rounded hover:bg-slate-100 transition-colors">
                                            {isExpanded ? (
                                                <ChevronDown className="w-3.5 h-3.5 text-teal-600" />
                                            ) : (
                                                <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                                            )}
                                        </span>
                                        <span className="font-mono text-[10px] bg-teal-50 text-teal-600 px-1.5 py-0.5 rounded font-bold mr-1">{group.code}</span>
                                        <span className="font-bold text-slate-900">{group.name}</span>
                                        <span className="text-[10px] text-slate-400 font-normal mr-1">({childItems.length} کالا)</span>
                                    </td>
                                    <td className="py-2.5 px-2 font-mono text-center font-semibold text-slate-700">
                                        {op !== 0 ? op.toLocaleString('fa-IR', { maximumFractionDigits: 3 }) : '—'}
                                    </td>
                                    <td className="py-2.5 px-2 font-mono text-center font-semibold text-emerald-700">
                                        {inf !== 0 ? inf.toLocaleString('fa-IR', { maximumFractionDigits: 3 }) : '—'}
                                    </td>
                                    <td className="py-2.5 px-2 font-mono text-center font-semibold text-rose-700">
                                        {out !== 0 ? out.toLocaleString('fa-IR', { maximumFractionDigits: 3 }) : '—'}
                                    </td>
                                    <td className="py-2.5 px-2 font-mono text-center font-extrabold text-teal-900 bg-teal-50/40">
                                        {end !== 0 ? end.toLocaleString('fa-IR', { maximumFractionDigits: 3 }) : '—'}
                                    </td>
                                </tr>
                                
                                {isExpanded && childItems.map((child) => {
                                    const cop = getSayanItemOpening(child.itemCode, isLastYear);
                                    const cinf = getSayanItemInflow(child.itemCode, isLastYear);
                                    const cout = getSayanItemOutflow(child.itemCode, isLastYear);
                                    const cend = getSayanItemEnding(child.itemCode, isLastYear);

                                    return (
                                        <tr 
                                            key={\`child-imp-\${isLastYear ? 'ly' : 'curr'}-\${group.code}-\${child.itemCode}\`}
                                            className="bg-slate-50/40 hover:bg-slate-100/60 transition-colors text-slate-600 text-[11px] border-b border-dashed border-slate-100/80"
                                        >
                                            <td className="py-2 px-3 pr-8 text-right font-normal text-slate-700 flex items-center gap-1.5">
                                                <span className="text-slate-300 font-bold select-none">↳</span>
                                                <span className="font-mono text-[9px] bg-slate-100 text-slate-500 px-1 py-0.5 rounded mr-1 select-all">{child.itemCode}</span>
                                                <span className="font-semibold text-slate-800">{child.itemName}</span>
                                            </td>
                                            <td className="py-2 px-2 font-mono text-center text-slate-600">
                                                {cop !== 0 ? cop.toLocaleString('fa-IR', { maximumFractionDigits: 3 }) : '—'}
                                            </td>
                                            <td className="py-2 px-2 font-mono text-center text-emerald-600">
                                                {cinf !== 0 ? cinf.toLocaleString('fa-IR', { maximumFractionDigits: 3 }) : '—'}
                                            </td>
                                            <td className="py-2 px-2 font-mono text-center text-rose-600">
                                                {cout !== 0 ? cout.toLocaleString('fa-IR', { maximumFractionDigits: 3 }) : '—'}
                                            </td>
                                            <td className="py-2 px-2 font-mono text-center font-bold text-slate-900 bg-slate-100/50">
                                                {cend !== 0 ? cend.toLocaleString('fa-IR', { maximumFractionDigits: 3 }) : '—'}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </React.Fragment>
                        );
                    })
                )}
            </tbody>
        );
    };

    `;
    content = content.substring(0, bodyStart) + newRenderTableBody + content.substring(bodyEnd);
    console.log('✓ Successfully replaced renderTableBody with 5 Sayan accounting columns!');
}

// 3. Update Table Header and Footer in JSX
const oldTableHead = `<tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                                    <th className="py-3 px-2 text-right whitespace-nowrap">نوع کالا / نخ</th>
                                    <th className="py-3 px-2 whitespace-nowrap">دسته‌بندی</th>
                                    <th className="py-3 px-2 whitespace-nowrap">پروفرم</th>
                                    <th className="py-3 px-2 whitespace-nowrap">کارتن</th>
                                    <th className="py-3 px-2 font-bold text-slate-900 whitespace-nowrap">وزن (kg)</th>
                                    <th className="py-3 px-2 whitespace-nowrap">کانتینر</th>
                                    <th className="py-3 px-2 whitespace-nowrap">ارزش دلاری</th>
                                </tr>`;

const newTableHead = `<tr className="bg-slate-100 text-slate-700 font-extrabold border-b border-slate-200 text-xs">
                                    <th className="py-3 px-3 text-right whitespace-nowrap">سرفصل / کد و نام کالا</th>
                                    <th className="py-3 px-2 text-center whitespace-nowrap text-slate-700">موجودی اول دوره (افتتاحیه)</th>
                                    <th className="py-3 px-2 text-center whitespace-nowrap text-emerald-700">وارده (رسید طی دوره)</th>
                                    <th className="py-3 px-2 text-center whitespace-nowrap text-rose-700">صادره (حواله طی دوره)</th>
                                    <th className="py-3 px-2 text-center font-black whitespace-nowrap text-blue-900 bg-blue-50/50">مانده نهایی (پایان دوره)</th>
                                </tr>`;

content = content.replaceAll(oldTableHead, newTableHead);

// Replace tfoot with 5 accounting totals
const oldFoot1 = `<td className="py-3 px-3 text-right font-extrabold !text-white" style={{ color: '#ffffff', fontWeight: 900 }} colSpan={3}>جمع کل انبارها (سایان)</td>
                                    <td className="py-3 px-2 font-mono text-center !text-white" style={{ color: '#ffffff', fontWeight: 800 }}>
                                        {calculateTotalSayanSum(true, 'cartons').toLocaleString('fa-IR')}
                                    </td>
                                    <td className="py-3 px-2 font-mono text-center !text-amber-300 font-bold" style={{ color: '#fcd34d', fontWeight: 900 }}>
                                        {calculateTotalSayanSum(true, 'weight').toLocaleString('fa-IR')}
                                    </td>
                                    <td className="py-3 px-2 font-mono text-center !text-white" style={{ color: '#ffffff', fontWeight: 800 }}>
                                        {calculateTotalSayanSum(true, 'containers').toLocaleString('fa-IR')}
                                    </td>
                                    <td className="py-3 px-2 font-mono text-center !text-emerald-300 font-bold" style={{ color: '#6ee7b7', fontWeight: 900 }}>
                                        \${calculateTotalSayanSum(true, 'dollars').toLocaleString('en-US')}
                                    </td>`;

const newFoot1 = `<td className="py-3 px-3 text-right font-extrabold !text-white" style={{ color: '#ffffff', fontWeight: 900 }}>جمع کل انبارها (سایان)</td>
                                    <td className="py-3 px-2 font-mono text-center !text-slate-200 font-bold">
                                        {calculateTotalSayanOpeningSum(true).toLocaleString('fa-IR', { maximumFractionDigits: 3 })}
                                    </td>
                                    <td className="py-3 px-2 font-mono text-center !text-emerald-300 font-bold">
                                        {calculateTotalSayanInflowSum(true).toLocaleString('fa-IR', { maximumFractionDigits: 3 })}
                                    </td>
                                    <td className="py-3 px-2 font-mono text-center !text-rose-300 font-bold">
                                        {calculateTotalSayanOutflowSum(true).toLocaleString('fa-IR', { maximumFractionDigits: 3 })}
                                    </td>
                                    <td className="py-3 px-2 font-mono text-center !text-amber-300 font-extrabold text-sm">
                                        {calculateTotalSayanEndingSum(true).toLocaleString('fa-IR', { maximumFractionDigits: 3 })}
                                    </td>`;

content = content.replace(oldFoot1, newFoot1);

const oldFoot2 = `<td className="py-3 px-3 text-right font-extrabold !text-white" style={{ color: '#ffffff', fontWeight: 900 }} colSpan={3}>جمع کل انبارها (سایان)</td>
                                    <td className="py-3 px-2 font-mono text-center !text-white" style={{ color: '#ffffff', fontWeight: 800 }}>
                                        {calculateTotalSayanSum(false, 'cartons').toLocaleString('fa-IR')}
                                    </td>
                                    <td className="py-3 px-2 font-mono text-center !text-amber-300 font-bold" style={{ color: '#fcd34d', fontWeight: 900 }}>
                                        {calculateTotalSayanSum(false, 'weight').toLocaleString('fa-IR')}
                                    </td>
                                    <td className="py-3 px-2 font-mono text-center !text-white" style={{ color: '#ffffff', fontWeight: 800 }}>
                                        {calculateTotalSayanSum(false, 'containers').toLocaleString('fa-IR')}
                                    </td>
                                    <td className="py-3 px-2 font-mono text-center !text-emerald-300 font-bold" style={{ color: '#6ee7b7', fontWeight: 900 }}>
                                        \${calculateTotalSayanSum(false, 'dollars').toLocaleString('en-US')}
                                    </td>`;

const newFoot2 = `<td className="py-3 px-3 text-right font-extrabold !text-white" style={{ color: '#ffffff', fontWeight: 900 }}>جمع کل انبارها (سایان)</td>
                                    <td className="py-3 px-2 font-mono text-center !text-slate-200 font-bold">
                                        {calculateTotalSayanOpeningSum(false).toLocaleString('fa-IR', { maximumFractionDigits: 3 })}
                                    </td>
                                    <td className="py-3 px-2 font-mono text-center !text-emerald-300 font-bold">
                                        {calculateTotalSayanInflowSum(false).toLocaleString('fa-IR', { maximumFractionDigits: 3 })}
                                    </td>
                                    <td className="py-3 px-2 font-mono text-center !text-rose-300 font-bold">
                                        {calculateTotalSayanOutflowSum(false).toLocaleString('fa-IR', { maximumFractionDigits: 3 })}
                                    </td>
                                    <td className="py-3 px-2 font-mono text-center !text-amber-300 font-extrabold text-sm">
                                        {calculateTotalSayanEndingSum(false).toLocaleString('fa-IR', { maximumFractionDigits: 3 })}
                                    </td>`;

content = content.replace(oldFoot2, newFoot2);

fs.writeFileSync('components/WarehouseOverviewTab.tsx', content, 'utf8');
console.log('✓ Successfully updated WarehouseOverviewTab.tsx UI!');
