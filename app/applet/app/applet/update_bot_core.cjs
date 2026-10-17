const fs = require('fs');

let content = fs.readFileSync('backend/bot-core.js', 'utf8');

const targetSnippet = `        const sayanAccountInfo = (sTafsili || sCode) ? \`\\n🔗 *حساب سایان:* کد تفصیلی \${sTafsili || sCode}\` : '';

        // Formulate customer message with all requested details
        const customerCaption = 
            \`🚚 *اعلام بارگیری و خروج بار کارخانه*\\n\\n\` +
            \`👤 *مشتری گرامی:* *\${destName || '-'}\*\${sayanAccountInfo}\\n\` +
            \`🏢 *شرکت صادرکننده:* \${p.company || '-'}\\n\` +
            \`🔢 *شماره حواله خروج:* #\${p.permitNumber}\\n\` +
            \`📅 *تاریخ خروج:* \${toShamsiFull(p.date)}\\n\` +
            (p.exitTime ? \`🕒 *ساعت خروج از کارخانه:* \${p.exitTime}\\n\` : '') +
            \`\\n⚖️ *وزن کل بار:* *\${totalWeight.toLocaleString()} کیلوگرم*\\n\` +
            \`📦 *تعداد کارتن / بسته‌ها:* *\${totalCartons.toLocaleString()} عدد*\\n\` +
            \`\\n👨‍✈️ *مشخصات و نام راننده:* *\${p.driverName || 'ثبت نشده'}*\\n\` +
            \`📞 *شماره تماس راننده:* *\${p.driverPhone || 'ثبت نشده'}*\\n\` +
            \`🆔 *شماره پلاک خودرو:* *\${p.plateNumber || 'ثبت نشده'}*\\n\` +
            \`📍 *مقصد تحویل:* \${dest.address || p.destinationAddress || 'تحویل درب کارخانه'}\\n\` +
            \`\\n📦 *اقلام و کالاهای بارگیری شده:*\\n\${goodsListFormatted}\\n\` +
            (totalAmount > 0 ? \`\\n💵 *مبلغ فاکتور:* \${totalAmount.toLocaleString()} ریال\\n\` : '') +
            (p.description ? \`\\n📝 *توضیحات:* \${p.description}\\n\` : '') +
            \`\\n✅ محموله شما با مشخصات فوق با موفقیت بارگیری و از کارخانه خارج گردید. تصویر فاکتور رسمی خروج کالا نیز پیوست می‌باشد.\\n\\n\` +
            \`شرکت تولیدی و صنعتی ضمن تشکر از همراهی شما، با تکمیل لینک زیر جهت ارزیابی کیفیت محصولات و خدمات، ما را در ارائه خدمات بهتر یاری نمایید 🧵:\\n\` +
            \`\${settings.customerSurveyUrl || 'https://survey.porsline.ir/s/lepan-baft-survey'}\\n\\n\` +
            \`با سپاس از اعتماد و خرید شما 🙏\`;`;

const replacementSnippet = `        const sayanAccountInfo = (sTafsili || sCode) ? \`\\n🔗 *حساب سایان:* کد تفصیلی \${sTafsili || sCode}\` : '';
        const appBaseUrl = (settings.appBaseUrl || 'https://dlkam.ir').replace(/\\/+$/, '');
        const inAppSurveyUrl = \`\${appBaseUrl}/#customer-survey?id=\${p.permitNumber}\`;

        // Formulate customer message with all requested details
        const customerCaption = 
            \`🚚 *اعلام بارگیری و خروج بار کارخانه*\\n\\n\` +
            \`👤 *مشتری گرامی:* *\${destName || '-'}\*\${sayanAccountInfo}\\n\` +
            \`🏢 *شرکت صادرکننده:* \${p.company || 'شرکت لپان بافت'}\\n\` +
            \`🔢 *شماره حواله خروج:* #\${p.permitNumber}\\n\` +
            \`📅 *تاریخ خروج:* \${toShamsiFull(p.date)}\\n\` +
            (p.exitTime ? \`🕒 *ساعت خروج از کارخانه:* \${p.exitTime}\\n\` : '') +
            \`\\n⚖️ *وزن کل بار:* *\${totalWeight.toLocaleString('fa-IR')} کیلوگرم*\\n\` +
            \`📦 *تعداد کارتن / بسته‌ها:* *\${totalCartons.toLocaleString('fa-IR')} عدد*\\n\` +
            \`\\n👨‍✈️ *مشخصات و نام راننده:* *\${p.driverName || 'ثبت نشده'}*\\n\` +
            \`📞 *شماره تماس راننده:* *\${p.driverPhone || 'ثبت نشده'}*\\n\` +
            \`🆔 *شماره پلاک خودرو:* *\${p.plateNumber || 'ثبت نشده'}*\\n\` +
            \`📍 *مقصد تحویل:* \${dest.address || p.destinationAddress || 'تحویل درب کارخانه'}\\n\` +
            \`\\n📦 *اقلام و کالاهای بارگیری شده:*\\n\${goodsListFormatted}\\n\` +
            (totalAmount > 0 ? \`\\n💵 *مبلغ فاکتور:* \${totalAmount.toLocaleString('fa-IR')} ریال\\n\` : '') +
            (p.description ? \`\\n📝 *توضیحات:* \${p.description}\\n\` : '') +
            (imgB64 ? \`\\n✅ محموله شما با مشخصات فوق بارگیری و از کارخانه خارج گردید. تصویر فاکتور رسمی خروج کالا نیز پیوست می‌باشد.\\n\\n\` : \`\\n✅ محموله شما با مشخصات فوق با موفقیت بارگیری و از کارخانه خارج گردید.\\n\\n\`) +
            \`✍️ *مشاهده فاکتور و نظرسنجی رضایت:*\\n\` +
            \`مشتری گرامی، جهت مشاهده مشخصات کامل محموله و ثبت ارزیابی کیفیت، روی لینک زیر کلیک فرمایید 🧵:\\n\` +
            \`\${inAppSurveyUrl}\\n\\n\` +
            \`🤖 *ربات‌های هوشمند پیگیری سفارشات:*\\n\` +
            \`📱 تلگرام: t.me/LepanBaftBot | بله: ble.ir/lepanbaft_bot\\n\\n\` +
            \`با سپاس از اعتماد و همراهی شما 🙏\`;`;

if (content.includes('customerSurveyUrl')) {
    content = content.replace(targetSnippet, replacementSnippet);
    fs.writeFileSync('backend/bot-core.js', content, 'utf8');
    console.log('Successfully updated customerCaption in backend/bot-core.js!');
} else {
    console.log('customerSurveyUrl string not found in bot-core.js');
}
