const fs = require('fs');

let content = fs.readFileSync('components/WarehouseOverviewTab.tsx', 'utf8');

// 1. Fix getItemValue to ALWAYS prefer live Sayan DB weight when sayan data is present
const getItemValueMarker = "const getItemValue = (";
const getItemValueIdx = content.indexOf(getItemValueMarker);

if (getItemValueIdx !== -1) {
    const endItemValueIdx = content.indexOf("const calculateTotalSayanSum =", getItemValueIdx);
    if (endItemValueIdx !== -1) {
        const newGetItemValue = `const getItemValue = (
        itemKey: string, 
        isLastYear: boolean, 
        field: 'proforma' | 'cartons' | 'weight' | 'containers' | 'dollars',
        isGroup = false
    ): any => {
        // For weight and cartons, directly return live Sayan ERP inventory stock when available
        if (field === 'weight' || field === 'cartons') {
            const liveList = isLastYear ? sayanLastYear : sayanCurrent;
            const liveStockVal = isGroup ? getSayanGroupSum(itemKey, isLastYear, field) : getSayanItemValue(itemKey, isLastYear, field);
            if (liveList && liveList.length > 0) {
                return liveStockVal;
            }
        }
        const overrides = isLastYear ? lastYearOverrides : currentOverrides;
        let itemOverride = overrides[itemKey];
        if (!itemOverride) {
            const allItems = [...sayanLastYear, ...sayanCurrent];
            const foundItem = allItems.find(r => String(r.itemCode || r.ItemCode || '') === itemKey);
            if (foundItem && foundItem.itemName) {
                itemOverride = overrides[foundItem.itemName];
            }
        }
        if (itemOverride && itemOverride[field] !== undefined && itemOverride[field] !== '') {
            return itemOverride[field];
        }
        if (field === 'weight' || field === 'cartons') {
            return isGroup ? getSayanGroupSum(itemKey, isLastYear, field) : getSayanItemValue(itemKey, isLastYear, field);
        }
        return '';
    };

    `;
        content = content.substring(0, getItemValueIdx) + newGetItemValue + content.substring(endItemValueIdx);
        console.log('✓ Successfully updated getItemValue to enforce live Sayan DB weights!');
    }
}

// 2. Restore 7-column renderTableBody
const bodyStartMarker = 'const renderTableBody = (isLastYear: boolean) => {';
const bodyStart = content.indexOf(bodyStartMarker);
const bodyEndMarker = '    const renderVarianceMatrix = () => {';
const bodyEnd = content.indexOf(bodyEndMarker);

if (bodyStart !== -1 && bodyEnd !== -1) {
    const original7ColRenderTableBody = `const renderTableBody = (isLastYear: boolean) => {
        return (
            <tbody className="divide-y divide-slate-100">
                {/* 1. MANUFACTURED GOODS */}
                <tr className="bg-slate-50 text-slate-700 font-extrabold text-right">
                    <td colSpan={7} className="py-2.5 px-3 text-[11px] text-blue-900 bg-blue-50/80 border-y border-blue-100/60 font-bold">
                        ۱. کالاهای تولیدی (ادغام شده در سطح گروه کالا)
                    </td>
                </tr>
                {filteredYarns.length === 0 ? (
                    <tr>
                        <td colSpan={7} className="py-4 text-center text-slate-400">موردی یافت نشد.</td>
                    </tr>
                ) : (
                    filteredYarns.map((group) => {
                        const isExpanded = !!expandedGroups[group.code];
                        const childItems = getGroupChildItems(group.code);
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
                                    <td className="py-2 px-1">
                                        {isEditMode ? (
                                            <select
                                                value={getItemCategory(group.code)}
                                                onChange={(e) => handleCategoryChange(group.code, e.target.value as any)}
                                                className="text-[10px] p-1 border rounded bg-white text-slate-700 focus:outline-none"
                                            >
                                                <option value="raw">تولیدی (نمایش)</option>
                                                <option value="other">پنهان کردن</option>
                                            </select>
                                        ) : (
                                            <span className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded font-bold">تولیدی</span>
                                        )}
                                    </td>
                                    <td className="py-2 px-2">{renderCell(group.code, isLastYear, 'proforma', 'text', true)}</td>
                                    <td className="py-2 px-2 font-mono font-medium">{renderCell(group.code, isLastYear, 'cartons', 'number', true)}</td>
                                    <td className="py-2 px-2 font-mono font-bold text-slate-900">{renderCell(group.code, isLastYear, 'weight', 'number', true)}</td>
                                    <td className="py-2 px-2 font-mono font-medium">{renderCell(group.code, isLastYear, 'containers', 'number', true)}</td>
                                    <td className="py-2 px-2 font-mono font-bold text-emerald-600">{renderCell(group.code, isLastYear, 'dollars', 'dollar', true)}</td>
                                </tr>
                                
                                {isExpanded && childItems.map((child) => (
                                    <tr 
                                        key={\`child-yarn-\${isLastYear ? 'ly' : 'curr'}-\${group.code}-\${child.itemCode}\`}
                                        className="bg-slate-50/40 hover:bg-slate-100/60 transition-colors text-slate-600 text-[11px] border-b border-dashed border-slate-100/80"
                                    >
                                        <td className="py-2 px-3 pr-8 text-right font-normal text-slate-700 flex items-center gap-1.5">
                                            <span className="text-slate-300 font-bold select-none">↳</span>
                                            <span className="font-mono text-[9px] bg-slate-100 text-slate-500 px-1 py-0.5 rounded mr-1 select-all">{child.itemCode}</span>
                                            <span className="font-semibold text-slate-800">{child.itemName}</span>
                                        </td>
                                        <td className="py-2 px-1">
                                            <span className="text-[9px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-semibold select-none">کالا</span>
                                        </td>
                                        <td className="py-2 px-2 font-mono text-slate-500">{renderCell(child.itemCode, isLastYear, 'proforma', 'text', false)}</td>
                                        <td className="py-2 px-2 font-mono text-slate-500">{renderCell(child.itemCode, isLastYear, 'cartons', 'number', false)}</td>
                                        <td className="py-2 px-2 font-mono font-semibold text-slate-700">{renderCell(child.itemCode, isLastYear, 'weight', 'number', false)}</td>
                                        <td className="py-2 px-2 font-mono text-slate-500">{renderCell(child.itemCode, isLastYear, 'containers', 'number', false)}</td>
                                        <td className="py-2 px-2 font-mono font-semibold text-slate-600">{renderCell(child.itemCode, isLastYear, 'dollars', 'dollar', false)}</td>
                                    </tr>
                                ))}
                            </React.Fragment>
                        );
                    })
                )}

                {/* 2. IMPORTED & RAW MATERIALS */}
                <tr className="bg-slate-50 text-slate-700 font-extrabold text-right">
                    <td colSpan={7} className="py-2.5 px-3 text-[11px] text-teal-900 bg-teal-50/80 border-y border-teal-100/60 font-bold">
                        ۲. مواد اولیه وارداتی و کمکی (تفکیک شده بر اساس گروه کالا)
                    </td>
                </tr>
                {filteredImported.length === 0 ? (
                    <tr>
                        <td colSpan={7} className="py-4 text-center text-slate-400">موردی یافت نشد.</td>
                    </tr>
                ) : (
                    filteredImported.map((group) => {
                        const isExpanded = !!expandedGroups[group.code];
                        const childItems = getGroupChildItems(group.code);
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
                                    <td className="py-2 px-1">
                                        {isEditMode ? (
                                            <select
                                                value={getItemCategory(group.code)}
                                                onChange={(e) => handleCategoryChange(group.code, e.target.value as any)}
                                                className="text-[10px] p-1 border rounded bg-white text-slate-700 focus:outline-none"
                                            >
                                                <option value="raw">وارداتی (نمایش)</option>
                                                <option value="other">پنهان کردن</option>
                                            </select>
                                        ) : (
                                            <span className="text-[10px] bg-teal-50 text-teal-600 px-1.5 py-0.5 rounded font-bold">وارداتی</span>
                                        )}
                                    </td>
                                    <td className="py-2 px-2">{renderCell(group.code, isLastYear, 'proforma', 'text', true)}</td>
                                    <td className="py-2 px-2 font-mono font-medium">{renderCell(group.code, isLastYear, 'cartons', 'number', true)}</td>
                                    <td className="py-2 px-2 font-mono font-bold text-slate-900">{renderCell(group.code, isLastYear, 'weight', 'number', true)}</td>
                                    <td className="py-2 px-2 font-mono font-medium">{renderCell(group.code, isLastYear, 'containers', 'number', true)}</td>
                                    <td className="py-2 px-2 font-mono font-bold text-emerald-600">{renderCell(group.code, isLastYear, 'dollars', 'dollar', true)}</td>
                                </tr>
                                
                                {isExpanded && childItems.map((child) => (
                                    <tr 
                                        key={\`child-imp-\${isLastYear ? 'ly' : 'curr'}-\${group.code}-\${child.itemCode}\`}
                                        className="bg-slate-50/40 hover:bg-slate-100/60 transition-colors text-slate-600 text-[11px] border-b border-dashed border-slate-100/80"
                                    >
                                        <td className="py-2 px-3 pr-8 text-right font-normal text-slate-700 flex items-center gap-1.5">
                                            <span className="text-slate-300 font-bold select-none">↳</span>
                                            <span className="font-mono text-[9px] bg-slate-100 text-slate-500 px-1 py-0.5 rounded mr-1 select-all">{child.itemCode}</span>
                                            <span className="font-semibold text-slate-800">{child.itemName}</span>
                                        </td>
                                        <td className="py-2 px-1">
                                            <span className="text-[9px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-semibold select-none">کالا</span>
                                        </td>
                                        <td className="py-2 px-2 font-mono text-slate-500">{renderCell(child.itemCode, isLastYear, 'proforma', 'text', false)}</td>
                                        <td className="py-2 px-2 font-mono text-slate-500">{renderCell(child.itemCode, isLastYear, 'cartons', 'number', false)}</td>
                                        <td className="py-2 px-2 font-mono font-semibold text-slate-700">{renderCell(child.itemCode, isLastYear, 'weight', 'number', false)}</td>
                                        <td className="py-2 px-2 font-mono text-slate-500">{renderCell(child.itemCode, isLastYear, 'containers', 'number', false)}</td>
                                        <td className="py-2 px-2 font-mono font-semibold text-slate-600">{renderCell(child.itemCode, isLastYear, 'dollars', 'dollar', false)}</td>
                                    </tr>
                                ))}
                            </React.Fragment>
                        );
                    })
                )}
            </tbody>
        );
    };

    `;
    content = content.substring(0, bodyStart) + original7ColRenderTableBody + content.substring(bodyEnd);
    console.log('✓ Restored 7-column renderTableBody!');
}

// 3. Restore 7-column table headers
const oldTableHead = `<tr className="bg-slate-100 text-slate-700 font-extrabold border-b border-slate-200 text-xs">
                                    <th className="py-3 px-3 text-right whitespace-nowrap">سرفصل / کد و نام کالا</th>
                                    <th className="py-3 px-2 text-center whitespace-nowrap text-slate-700">موجودی اول دوره (افتتاحیه)</th>
                                    <th className="py-3 px-2 text-center whitespace-nowrap text-emerald-700">وارده (رسید طی دوره)</th>
                                    <th className="py-3 px-2 text-center whitespace-nowrap text-rose-700">صادره (حواله طی دوره)</th>
                                    <th className="py-3 px-2 text-center font-black whitespace-nowrap text-blue-900 bg-blue-50/50">مانده نهایی (پایان دوره)</th>
                                </tr>`;

const newTableHead = `<tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                                    <th className="py-3 px-2 text-right whitespace-nowrap">نوع کالا / نخ</th>
                                    <th className="py-3 px-2 whitespace-nowrap">دسته‌بندی</th>
                                    <th className="py-3 px-2 whitespace-nowrap">پروفرم</th>
                                    <th className="py-3 px-2 whitespace-nowrap">کارتن</th>
                                    <th className="py-3 px-2 font-bold text-slate-900 whitespace-nowrap">وزن (kg)</th>
                                    <th className="py-3 px-2 whitespace-nowrap">کانتینر</th>
                                    <th className="py-3 px-2 whitespace-nowrap">ارزش دلاری</th>
                                </tr>`;

content = content.replaceAll(oldTableHead, newTableHead);

// 4. Restore 7-column table footers
const oldFoot1 = `<td className="py-3 px-3 text-right font-extrabold !text-white" style={{ color: '#ffffff', fontWeight: 900 }}>جمع کل انبارها (سایان)</td>
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

const newFoot1 = `<td className="py-3 px-3 text-right font-extrabold !text-white" style={{ color: '#ffffff', fontWeight: 900 }} colSpan={3}>جمع کل انبارها (سایان)</td>
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

content = content.replace(oldFoot1, newFoot1);

const oldFoot2 = `<td className="py-3 px-3 text-right font-extrabold !text-white" style={{ color: '#ffffff', fontWeight: 900 }}>جمع کل انبارها (سایان)</td>
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

const newFoot2 = `<td className="py-3 px-3 text-right font-extrabold !text-white" style={{ color: '#ffffff', fontWeight: 900 }} colSpan={3}>جمع کل انبارها (سایان)</td>
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

content = content.replace(oldFoot2, newFoot2);

fs.writeFileSync('components/WarehouseOverviewTab.tsx', content, 'utf8');
console.log('✓ Successfully restored 7 columns and enforced live Sayan weights in WarehouseOverviewTab.tsx!');
