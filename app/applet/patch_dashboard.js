const fs = require('fs');

let content = fs.readFileSync('components/sales/SayanSalesDashboard.tsx', 'utf8');

const printCode = `// ----------------------------------------------------------------------
  // TAB-AWARE PRINT & EXPORT GENERATOR
  // ----------------------------------------------------------------------
  const getHtmlForCurrentTab = () => {
    const printDateStr = toShamsiStr(new Date().toISOString());
    const filterSummary = selectedCustomer !== 'all' ? \` | خریدار: \${selectedCustomer}\` : '';
    const searchSummary = searchQuery ? \` | جستجو: \${searchQuery}\` : '';

    if (activeTab === 'hierarchy') {
      const title = 'گزارش سرفصل‌های اصلی کالا (۱۵ گروه سایان ERP)';
      const filename = \`Sayan_Sales_Categories_\${dateFrom.replace(/\\//g, '-')}_to_\${dateTo.replace(/\\//g, '-')}.pdf\`;
      const htmlContent = \`
        <html dir="rtl" lang="fa">
        <head>
          <meta charset="utf-8">
          <title>\${title}</title>
          <style>
            @page { size: A4 portrait; margin: 8mm; }
            body { font-family: 'Tahoma', 'Vazirmatn', sans-serif; padding: 10px; color: #0f172a; direction: rtl; }
            .header { border-bottom: 2px solid #0f172a; padding-bottom: 10px; margin-bottom: 15px; display: flex; justify-content: space-between; align-items: center; }
            .header h1 { font-size: 16px; margin: 0; font-weight: 900; color: #0f172a; }
            .header p { font-size: 10px; color: #64748b; margin-top: 3px; }
            .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 15px; }
            .kpi-card { border: 1px solid #e2e8f0; padding: 8px; border-radius: 6px; background: #f8fafc; text-align: center; }
            .kpi-title { font-size: 9px; color: #64748b; font-weight: bold; }
            .kpi-val { font-size: 12px; font-weight: 900; margin-top: 3px; font-family: monospace; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 10px; border: 1px solid #cbd5e1; }
            th, td { border: 1px solid #cbd5e1; padding: 5px 6px; text-align: center; }
            th { background-color: #0f172a; color: #fff; font-weight: 900; }
            tr:nth-child(even) { background-color: #f8fafc; }
            .total { font-weight: 900; background: #fef3c7 !important; border-top: 2px solid #0f172a; }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <h1>گزارش سرفصل‌های اصلی کالا (۱۵ گروه اصلی سایان ERP)</h1>
              <p>بازه گزارش: از \${dateFrom} تا \${dateTo}\${filterSummary} | تاریخ چاپ: \${printDateStr}</p>
            </div>
          </div>
          <div class="kpi-grid">
            <div class="kpi-card"><div class="kpi-title">تعداد گروه‌های اصلی</div><div class="kpi-val">\${processedMetrics.categoryList.length} گروه</div></div>
            <div class="kpi-card"><div class="kpi-title">مجموع وزن خالص</div><div class="kpi-val">\${formatWeight(processedMetrics.rangeNetWgt)} ک‌گ</div></div>
            <div class="kpi-card"><div class="kpi-title">مجموع فروش خالص</div><div class="kpi-val">\${formatMoney(processedMetrics.rangeNetAmt)} ریال</div></div>
            <div class="kpi-card"><div class="kpi-title">میانگین فی نهایی</div><div class="kpi-val">\${formatMoney(processedMetrics.rangeNetFee)} ریال</div></div>
          </div>
          <table>
            <thead>
              <tr>
                <th style="width: 35px;">#</th>
                <th style="text-align: right;">نام گروه اصلی کالا</th>
                <th>وزن خالص (ک‌گ)</th>
                <th>فروش خالص (ریال)</th>
                <th>میانگین فی (ریال/ک‌گ)</th>
                <th>سهم %</th>
              </tr>
            </thead>
            <tbody>
              \${processedMetrics.categoryList.map((cat, idx) => \`
                <tr>
                  <td>\${idx + 1}</td>
                  <td style="text-align: right; font-weight: bold;">\${cat.name}</td>
                  <td>\${formatWeight(cat.netWgt)}</td>
                  <td style="text-align: left; font-family: monospace;">\${formatMoney(cat.netAmt)}</td>
                  <td style="text-align: left; font-family: monospace;">\${formatMoney(cat.netFee)}</td>
                  <td>\${cat.sharePct.toFixed(1)}%</td>
                </tr>
              \`).join('')}
              <tr class="total">
                <td colspan="2" style="text-align: right;">جمع کل</td>
                <td>\${formatWeight(processedMetrics.rangeNetWgt)}</td>
                <td style="text-align: left; font-family: monospace;">\${formatMoney(processedMetrics.rangeNetAmt)}</td>
                <td style="text-align: left; font-family: monospace;">\${formatMoney(processedMetrics.rangeNetFee)}</td>
                <td>100%</td>
              </tr>
            </tbody>
          </table>
        </body>
        </html>
      \`;
      return { htmlContent, title, filename };
    }

    if (activeTab === 'items') {
      const title = 'گزارش تفکیکی و ریز کالاهای فروخته شده';
      const filename = \`Sayan_Sales_Detailed_Items_\${dateFrom.replace(/\\//g, '-')}_to_\${dateTo.replace(/\\//g, '-')}.pdf\`;
      
      const totQty = filteredItems.reduce((s, i) => s + (i.netQty || 0), 0);
      const totWgt = filteredItems.reduce((s, i) => s + (i.netWgt || 0), 0);
      const totAmt = filteredItems.reduce((s, i) => s + (i.netAmt || 0), 0);
      const avgFee = totWgt > 0 ? Math.round(totAmt / totWgt) : 0;

      const htmlContent = \`
        <html dir="rtl" lang="fa">
        <head>
          <meta charset="utf-8">
          <title>\${title}</title>
          <style>
            @page { size: A4 landscape; margin: 6mm 8mm; }
            body { font-family: 'Tahoma', 'Vazirmatn', sans-serif; padding: 10px; color: #0f172a; direction: rtl; }
            .header { border-bottom: 2px solid #0f172a; padding-bottom: 8px; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center; }
            .header h1 { font-size: 15px; margin: 0; font-weight: 900; }
            .header p { font-size: 10px; color: #64748b; margin-top: 2px; }
            .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 12px; }
            .kpi-card { border: 1px solid #e2e8f0; padding: 6px 8px; border-radius: 6px; background: #f8fafc; text-align: center; }
            .kpi-title { font-size: 9px; color: #64748b; font-weight: bold; }
            .kpi-val { font-size: 11px; font-weight: 900; margin-top: 2px; font-family: monospace; }
            table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 9.5px; border: 1px solid #cbd5e1; }
            th, td { border: 1px solid #cbd5e1; padding: 4px 6px; text-align: center; }
            th { background-color: #0f172a; color: #fff; font-weight: 900; }
            tr:nth-child(even) { background-color: #f8fafc; }
            .total { font-weight: 900; background: #fef3c7 !important; border-top: 2px solid #0f172a; }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <h1>گزارش تفکیکی و ریز کالاهای فروخته شده (سایان ERP)</h1>
              <p>بازه گزارش: از \${dateFrom} تا \${dateTo}\${filterSummary}\${searchSummary} | تاریخ چاپ: \${printDateStr}</p>
            </div>
          </div>
          <div class="kpi-grid">
            <div class="kpi-card"><div class="kpi-title">تعداد عناوین کالاها</div><div class="kpi-val">\${filteredItems.length} قلم</div></div>
            <div class="kpi-card"><div class="kpi-title">مجموع تعداد/بسته</div><div class="kpi-val">\${totQty.toLocaleString('fa-IR')}</div></div>
            <div class="kpi-card"><div class="kpi-title">مجموع وزن خالص</div><div class="kpi-val">\${formatWeight(totWgt)} ک‌گ</div></div>
            <div class="kpi-card"><div class="kpi-title">مجموع مبلغ فروش</div><div class="kpi-val">\${formatMoney(totAmt)} ریال</div></div>
          </div>
          <table>
            <thead>
              <tr>
                <th style="width: 30px;">#</th>
                <th style="width: 75px;">کد کالا</th>
                <th style="text-align: right;">نام کامل کالا</th>
                <th>گروه کالا</th>
                <th>تعداد / بسته</th>
                <th>وزن خالص (ک‌گ)</th>
                <th>مبلغ کل (ریال)</th>
                <th>میانگین فی (ریال/ک‌گ)</th>
              </tr>
            </thead>
            <tbody>
              \${filteredItems.map((item, idx) => \`
                <tr>
                  <td>\${idx + 1}</td>
                  <td style="font-family: monospace;">\${item.itemCode || '-'}</td>
                  <td style="text-align: right; font-weight: bold;">\${item.itemName}</td>
                  <td>\${item.majorCategory || '-'}</td>
                  <td>\${(item.netQty || 0).toLocaleString('fa-IR')}</td>
                  <td>\${formatWeight(item.netWgt || 0)}</td>
                  <td style="text-align: left; font-family: monospace;">\${formatMoney(item.netAmt || 0)}</td>
                  <td style="text-align: left; font-family: monospace;">\${formatMoney(item.netFee || 0)}</td>
                </tr>
              \`).join('')}
              <tr class="total">
                <td colspan="4" style="text-align: right;">جمع کل اقلام</td>
                <td>\${totQty.toLocaleString('fa-IR')}</td>
                <td>\${formatWeight(totWgt)}</td>
                <td style="text-align: left; font-family: monospace;">\${formatMoney(totAmt)}</td>
                <td style="text-align: left; font-family: monospace;">\${formatMoney(avgFee)}</td>
              </tr>
            </tbody>
          </table>
        </body>
        </html>
      \`;
      return { htmlContent, title, filename };
    }

    if (activeTab === 'invoices') {
      const title = 'گزارش کامل لیست فاکتورهای فروش';
      const filename = \`Sayan_Sales_Invoices_\${dateFrom.replace(/\\//g, '-')}_to_\${dateTo.replace(/\\//g, '-')}.pdf\`;
      
      const totWgt = filteredInvoices.reduce((s, i) => s + (i.netWgt || 0), 0);
      const totAmt = filteredInvoices.reduce((s, i) => s + (i.netAmt || 0), 0);

      const htmlContent = \`
        <html dir="rtl" lang="fa">
        <head>
          <meta charset="utf-8">
          <title>\${title}</title>
          <style>
            @page { size: A4 portrait; margin: 8mm; }
            body { font-family: 'Tahoma', 'Vazirmatn', sans-serif; padding: 10px; color: #0f172a; direction: rtl; }
            .header { border-bottom: 2px solid #0f172a; padding-bottom: 10px; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center; }
            .header h1 { font-size: 15px; margin: 0; font-weight: 900; }
            .header p { font-size: 10px; color: #64748b; margin-top: 2px; }
            .kpi-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 12px; }
            .kpi-card { border: 1px solid #e2e8f0; padding: 6px 8px; border-radius: 6px; background: #f8fafc; text-align: center; }
            .kpi-title { font-size: 9px; color: #64748b; font-weight: bold; }
            .kpi-val { font-size: 11px; font-weight: 900; margin-top: 2px; font-family: monospace; }
            table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 9.5px; border: 1px solid #cbd5e1; }
            th, td { border: 1px solid #cbd5e1; padding: 5px 6px; text-align: center; }
            th { background-color: #0f172a; color: #fff; font-weight: 900; }
            tr:nth-child(even) { background-color: #f8fafc; }
            .total { font-weight: 900; background: #fef3c7 !important; border-top: 2px solid #0f172a; }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <h1>گزارش جامع لیست فاکتورهای فروش (سایان ERP)</h1>
              <p>بازه گزارش: از \${dateFrom} تا \${dateTo}\${filterSummary}\${searchSummary} | تاریخ چاپ: \${printDateStr}</p>
            </div>
          </div>
          <div class="kpi-grid">
            <div class="kpi-card"><div class="kpi-title">تعداد کل فاکتورها</div><div class="kpi-val">\${filteredInvoices.length} فقره</div></div>
            <div class="kpi-card"><div class="kpi-title">مجموع وزن فاکتورها</div><div class="kpi-val">\${formatWeight(totWgt)} ک‌گ</div></div>
            <div class="kpi-card"><div class="kpi-title">مجموع مبلغ فاکتورها</div><div class="kpi-val">\${formatMoney(totAmt)} ریال</div></div>
          </div>
          <table>
            <thead>
              <tr>
                <th style="width: 30px;">#</th>
                <th>شماره فاکتور</th>
                <th>تاریخ فاکتور</th>
                <th style="text-align: right;">خریدار / مشتری</th>
                <th>شهر / محل</th>
                <th>وزن خالص (ک‌گ)</th>
                <th>مبلغ فاکتور (ریال)</th>
              </tr>
            </thead>
            <tbody>
              \${filteredInvoices.map((inv, idx) => \`
                <tr>
                  <td>\${idx + 1}</td>
                  <td style="font-weight: bold; font-family: monospace;">\${inv.invoiceNum}</td>
                  <td style="font-family: monospace;">\${inv.invoiceDate || '-'}</td>
                  <td style="text-align: right; font-weight: bold;">\${inv.customerName || 'مشتری متفرقه'}</td>
                  <td>\${inv.city || '-'}</td>
                  <td>\${formatWeight(inv.netWgt || 0)}</td>
                  <td style="text-align: left; font-family: monospace;">\${formatMoney(inv.netAmt || 0)}</td>
                </tr>
              \`).join('')}
              <tr class="total">
                <td colspan="5" style="text-align: right;">جمع کل فاکتورها</td>
                <td>\${formatWeight(totWgt)}</td>
                <td style="text-align: left; font-family: monospace;">\${formatMoney(totAmt)}</td>
              </tr>
            </tbody>
          </table>
        </body>
        </html>
      \`;
      return { htmlContent, title, filename };
    }

    if (activeTab === 'customers') {
      const title = 'گزارش فروش بر اساس مشتریان و اشخاص';
      const filename = \`Sayan_Sales_Customers_\${dateFrom.replace(/\\//g, '-')}_to_\${dateTo.replace(/\\//g, '-')}.pdf\`;
      
      const custs = sortedAndFilteredCustomers;
      const totInvoices = custs.reduce((s, c) => s + c.invoiceCount, 0);
      const totWgt = custs.reduce((s, c) => s + c.netWgt, 0);
      const totAmt = custs.reduce((s, c) => s + c.netAmt, 0);
      const avgFee = totWgt > 0 ? Math.round(totAmt / totWgt) : 0;

      const htmlContent = \`
        <html dir="rtl" lang="fa">
        <head>
          <meta charset="utf-8">
          <title>\${title}</title>
          <style>
            @page { size: A4 portrait; margin: 8mm; }
            body { font-family: 'Tahoma', 'Vazirmatn', sans-serif; padding: 10px; color: #0f172a; direction: rtl; }
            .header { border-bottom: 2px solid #0f172a; padding-bottom: 10px; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center; }
            .header h1 { font-size: 15px; margin: 0; font-weight: 900; }
            .header p { font-size: 10px; color: #64748b; margin-top: 2px; }
            .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 12px; }
            .kpi-card { border: 1px solid #e2e8f0; padding: 6px 8px; border-radius: 6px; background: #f8fafc; text-align: center; }
            .kpi-title { font-size: 9px; color: #64748b; font-weight: bold; }
            .kpi-val { font-size: 11px; font-weight: 900; margin-top: 2px; font-family: monospace; }
            table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 9.5px; border: 1px solid #cbd5e1; }
            th, td { border: 1px solid #cbd5e1; padding: 5px 6px; text-align: center; }
            th { background-color: #0f172a; color: #fff; font-weight: 900; }
            tr:nth-child(even) { background-color: #f8fafc; }
            .total { font-weight: 900; background: #fef3c7 !important; border-top: 2px solid #0f172a; }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <h1>گزارش فروش بر اساس مشتریان و اشخاص (Customer Sales Breakdown)</h1>
              <p>بازه گزارش: از \${dateFrom} تا \${dateTo} | تاریخ چاپ: \${printDateStr}</p>
            </div>
          </div>
          <div class="kpi-grid">
            <div class="kpi-card"><div class="kpi-title">تعداد مشتریان فعال</div><div class="kpi-val">\${custs.length} شخص</div></div>
            <div class="kpi-card"><div class="kpi-title">تعداد فاکتورها</div><div class="kpi-val">\${totInvoices.toLocaleString('fa-IR')}</div></div>
            <div class="kpi-card"><div class="kpi-title">مجموع وزن خرید</div><div class="kpi-val">\${formatWeight(totWgt)} ک‌گ</div></div>
            <div class="kpi-card"><div class="kpi-title">مجموع ارزش خرید</div><div class="kpi-val">\${formatMoney(totAmt)} ریال</div></div>
          </div>
          <table>
            <thead>
              <tr>
                <th style="width: 30px;">#</th>
                <th style="text-align: right;">نام خریدار / مشتری</th>
                <th>تعداد فاکتور</th>
                <th>وزن خرید (ک‌گ)</th>
                <th>ارزش کل خرید (ریال)</th>
                <th>میانگین فی (ریال/ک‌گ)</th>
              </tr>
            </thead>
            <tbody>
              \${custs.map((c, idx) => \`
                <tr>
                  <td>\${idx + 1}</td>
                  <td style="text-align: right; font-weight: bold;">\${c.customerName}</td>
                  <td>\${c.invoiceCount}</td>
                  <td>\${formatWeight(c.netWgt)}</td>
                  <td style="text-align: left; font-family: monospace;">\${formatMoney(c.netAmt)}</td>
                  <td style="text-align: left; font-family: monospace;">\${formatMoney(c.avgFee)}</td>
                </tr>
              \`).join('')}
              <tr class="total">
                <td colspan="2" style="text-align: right;">جمع کل مشتریان</td>
                <td>\${totInvoices.toLocaleString('fa-IR')}</td>
                <td>\${formatWeight(totWgt)}</td>
                <td style="text-align: left; font-family: monospace;">\${formatMoney(totAmt)}</td>
                <td style="text-align: left; font-family: monospace;">\${formatMoney(avgFee)}</td>
              </tr>
            </tbody>
          </table>
        </body>
        </html>
      \`;
      return { htmlContent, title, filename };
    }

    const title = compareMode ? 'گزارش مدیریتی و تحلیلی مقایسه‌ای فروش سایان ERP' : 'داشبورد مدیریتی و خلاصه فروش سایان ERP';
    const filename = \`Sayan_Sales_Executive_\${dateFrom.replace(/\\//g, '-')}_to_\${dateTo.replace(/\\//g, '-')}.pdf\`;

    const docHtml = \`
      <html dir="rtl" lang="fa">
      <head>
        <meta charset="utf-8">
        <title>\${title}</title>
        <style>
          body { font-family: 'Tahoma', 'Vazirmatn', sans-serif; padding: 20px; background: #fff; color: #1e293b; direction: rtl; }
          .header { text-align: center; border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 20px; }
          .header h1 { font-size: 18px; margin: 0; color: #0f172a; font-weight: 900; }
          .header p { font-size: 11px; color: #64748b; margin: 4px 0 0; }
          .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 20px; }
          .kpi-card { border: 1px solid #cbd5e1; padding: 10px; border-radius: 6px; background: #f8fafc; text-align: center; }
          .kpi-title { font-size: 10px; color: #64748b; font-weight: bold; }
          .kpi-val { font-size: 14px; font-weight: bold; color: #0f172a; margin-top: 4px; font-family: monospace; }
          table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 11px; border: 1px solid #cbd5e1; }
          th, td { border: 1px solid #cbd5e1; padding: 6px 8px; text-align: center; }
          th { background-color: #0f172a; color: #fff; font-weight: bold; }
          tr:nth-child(even) { background-color: #f1f5f9; }
          .total { font-weight: bold; background: #fef3c7 !important; border-top: 2px solid #0f172a; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>\${title}</h1>
          <p>بازه گزارش: از \${dateFrom} تا \${dateTo}\${filterSummary} | تاریخ چاپ: \${printDateStr}</p>
        </div>
        <div class="kpi-grid">
          <div class="kpi-card"><div class="kpi-title">فروش خالص بازه</div><div class="kpi-val">\${formatMoney(processedMetrics.rangeNetAmt)} ریال</div></div>
          <div class="kpi-card"><div class="kpi-title">وزن خالص بازه</div><div class="kpi-val">\${formatWeight(processedMetrics.rangeNetWgt)} ک‌گ</div></div>
          <div class="kpi-card"><div class="kpi-title">فی نهایی میانگین</div><div class="kpi-val">\${formatMoney(processedMetrics.rangeNetFee)} ریال/ک‌گ</div></div>
          <div class="kpi-card"><div class="kpi-title">تعداد فاکتورها</div><div class="kpi-val">\${processedMetrics.invoiceCount} عدد</div></div>
        </div>
        <h2>جدول عملکرد گروههای اصلی کالا (15 گروه)</h2>
        <table>
          <thead>
            <tr>
              <th>ردیف</th>
              <th style="text-align: right;">نام گروه اصلی</th>
              <th>وزن خالص (ک‌گ)</th>
              <th>فروش خالص (ریال)</th>
              <th>فی نهایی (ریال/ک‌گ)</th>
              <th>سهم %</th>
            </tr>
          </thead>
          <tbody>
            \${processedMetrics.categoryList.map((cat, idx) => \`
              <tr>
                <td>\${idx + 1}</td>
                <td style="text-align: right; font-weight: bold;">\${cat.name}</td>
                <td>\${formatWeight(cat.netWgt)}</td>
                <td style="text-align: left; font-family: monospace;">\${formatMoney(cat.netAmt)}</td>
                <td style="text-align: left; font-family: monospace;">\${formatMoney(cat.netFee)}</td>
                <td>\${cat.sharePct.toFixed(1)}%</td>
              </tr>
            \`).join('')}
            <tr class="total">
              <td colspan="2" style="text-align: right;">جمع کل</td>
              <td>\${formatWeight(processedMetrics.rangeNetWgt)}</td>
              <td style="text-align: left; font-family: monospace;">\${formatMoney(processedMetrics.rangeNetAmt)}</td>
              <td style="text-align: left; font-family: monospace;">\${formatMoney(processedMetrics.rangeNetFee)}</td>
              <td>100%</td>
            </tr>
          </tbody>
        </table>
      </body>
      </html>
    \`;
    return { htmlContent: docHtml, title, filename };
  };

  const handlePrint = () => {
    const { htmlContent } = getHtmlForCurrentTab();
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(htmlContent);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
      }, 500);
    }
  };`;

const printStart = content.indexOf('// PRINT EXECUTIVE REPORT');
const printEnd = content.indexOf('// DOWNLOAD COMPARATIVE PDF');

if (printStart !== -1 && printEnd !== -1) {
  content = content.slice(0, printStart) + printCode + '\n  // ----------------------------------------------------------------------\n  ' + content.slice(printEnd);
  fs.writeFileSync('components/sales/SayanSalesDashboard.tsx', content);
  console.log('Successfully injected getHtmlForCurrentTab and handlePrint.');
} else {
  console.error('Markers not found.');
}
