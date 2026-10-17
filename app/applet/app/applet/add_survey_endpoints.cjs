const fs = require('fs');

const serverPath = '/app/applet/server.js';
let content = fs.readFileSync(serverPath, 'utf8');

const surveyEndpointsCode = `
// --- PUBLIC CUSTOMER SURVEY ENDPOINTS ---
app.get('/api/public/survey/:id', (req, res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    try {
        const db = getDb();
        const { id } = req.params;
        const cleanId = String(id || '').trim();
        if (!cleanId) {
            return res.status(400).json({ error: 'شماره حواله وارد نشده است' });
        }

        const permits = db.exitPermits || [];
        const found = permits.find(p => 
            String(p.permitNumber || '') === cleanId ||
            String(p.id || '') === cleanId ||
            (p.permitNumber && String(p.permitNumber) === cleanId.replace(/[^0-9]/g, ''))
        );

        const settings = db.settings || {};
        const botLinks = {
            telegramUrl: settings.telegramBotUsername ? \`https://t.me/\${settings.telegramBotUsername.replace(/^@/, '')}\` : 'https://t.me/LepanBaftBot',
            baleUrl: settings.baleBotUsername ? \`https://ble.ir/\${settings.baleBotUsername.replace(/^@/, '')}\` : 'https://ble.ir/lepanbaft_bot',
            whatsappUrl: settings.whatsappChannelUrl || ''
        };

        if (!found) {
            return res.status(404).json({ error: \`محموله یا مجوز خروج با شماره #\${cleanId} یافت نشد.\`, botLinks });
        }

        const itemsToCalc = (found.items && found.items.length > 0)
            ? found.items
            : [{ cartonCount: found.cartonCount || 0, weight: found.weight || 0, goodsName: found.goodsName || 'محصولات کارخانه' }];

        const totalCartons = itemsToCalc.reduce((s, i) => s + (Number(i.deliveredCartonCount ?? i.cartonCount) || 0), 0);
        const totalWeight = Number((itemsToCalc.reduce((s, i) => s + (Number(i.deliveredWeight ?? i.weight) || 0), 0)).toFixed(3));

        return res.json({
            success: true,
            data: {
                permitNumber: String(found.permitNumber || found.id),
                company: found.company || 'شرکت لپان بافت',
                date: utils.toShamsiFull(found.date).split(' ')[0] || found.date,
                exitTime: found.exitTime || '',
                recipientName: found.recipientName || found.customerName || '',
                driverName: found.driverName || '',
                driverPhone: found.driverPhone || '',
                plateNumber: found.plateNumber || '',
                destinationAddress: found.destinationAddress || '',
                description: found.description || '',
                items: itemsToCalc,
                totalWeight,
                totalCartons,
                botLinks
            }
        });
    } catch (err) {
        console.error("Public survey fetch error:", err);
        return res.status(500).json({ error: 'خطا در بارگذاری اطلاعات محموله' });
    }
});

app.post('/api/public/survey/submit', (req, res) => {
    try {
        const db = getDb();
        const {
            permitNumber,
            customerName,
            customerPhone,
            qualityRating,
            deliveryRating,
            courtesyRating,
            overallRating,
            comment
        } = req.body;

        if (!db.customerFeedbacks) db.customerFeedbacks = [];

        const feedback = {
            id: 'fb_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
            permitNumber: String(permitNumber || 'نامشخص'),
            customerName: String(customerName || 'مشتری محترم'),
            customerPhone: String(customerPhone || ''),
            qualityRating: Number(qualityRating) || 5,
            deliveryRating: Number(deliveryRating) || 5,
            courtesyRating: Number(courtesyRating) || 5,
            overallRating: Number(overallRating) || 5,
            comment: String(comment || '').trim(),
            submittedAt: new Date().toISOString()
        };

        db.customerFeedbacks.unshift(feedback);
        saveDb(db);

        console.log(\`[Customer Survey] New feedback submitted for Permit #\${feedback.permitNumber} by \${feedback.customerName}\`);
        return res.json({ success: true, message: 'نظرسنجی شما با موفقیت ثبت شد.' });
    } catch (err) {
        console.error("Public survey submit error:", err);
        return res.status(500).json({ error: 'خطا در ثبت نظرسنجی' });
    }
});

app.get('/api/customer-feedbacks', (req, res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    try {
        const db = getDb();
        res.json(db.customerFeedbacks || []);
    } catch (err) {
        res.status(500).json({ error: 'خطا در دریافت نظرسنجی‌ها' });
    }
});
`;

if (!content.includes('/api/public/survey')) {
    const listenIdx = content.lastIndexOf('const server = app.listen(');
    if (listenIdx !== -1) {
        content = content.slice(0, listenIdx) + surveyEndpointsCode + '\n\n' + content.slice(listenIdx);
        fs.writeFileSync(serverPath, content, 'utf8');
        console.log('Successfully added survey endpoints to server.js');
    } else {
        console.log('app.listen not found in server.js');
    }
} else {
    console.log('Survey endpoints already exist in server.js');
}
