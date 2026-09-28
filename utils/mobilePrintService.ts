import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { FileOpener } from '@capacitor-community/file-opener';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

export interface MobilePrintOptions {
    title?: string;
    fileName?: string;
    orientation?: 'p' | 'portrait' | 'l' | 'landscape';
    scale?: number;
}

/**
 * Cross-platform print & PDF generation helper.
 * On Desktop Web: Uses a dedicated hidden iframe to trigger the browser's native print dialog seamlessly.
 * On Mobile (Capacitor Android/iOS): Converts the element to high-res PDF and invokes Native Share / Print Spooler.
 */
export const executeCrossPlatformPrint = async (
    elementOrHtml: HTMLElement | string | null,
    options: MobilePrintOptions = {}
): Promise<boolean> => {
    const title = options.title || 'سند چاپی سیستم';
    const fileName = options.fileName || `Document_${Date.now()}.pdf`;
    const orientation = options.orientation || 'portrait';

    if (!elementOrHtml) {
        console.warn('executeCrossPlatformPrint: No element or HTML provided');
        return false;
    }

    // 1. Mobile (Android/iOS) Native Handling
    if (Capacitor.isNativePlatform()) {
        try {
            let pdfBlob: Blob | null = null;

            if (typeof elementOrHtml === 'object' && elementOrHtml instanceof HTMLElement) {
                // High-fidelity HTML to Canvas capture
                const canvas = await html2canvas(elementOrHtml, {
                    scale: 2,
                    useCORS: true,
                    logging: false,
                    allowTaint: true,
                    backgroundColor: '#ffffff'
                });

                const imgData = canvas.toDataURL('image/jpeg', 0.95);
                const pdf = new jsPDF({
                    orientation: orientation === 'landscape' || orientation === 'l' ? 'landscape' : 'portrait',
                    unit: 'mm',
                    format: 'a4'
                });

                const pageWidth = pdf.internal.pageSize.getWidth();
                const pageHeight = pdf.internal.pageSize.getHeight();
                const imgWidth = pageWidth;
                const imgHeight = (canvas.height * imgWidth) / canvas.width;

                pdf.addImage(imgData, 'JPEG', 0, 0, imgWidth, Math.min(imgHeight, pageHeight));
                pdfBlob = pdf.output('blob');
            }

            if (pdfBlob) {
                // Convert blob to base64
                const base64Data = await new Promise<string>((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onloadend = () => {
                        const res = reader.result as string;
                        resolve(res.split(',')[1]);
                    };
                    reader.onerror = reject;
                    reader.readAsDataURL(pdfBlob);
                });

                const savedFile = await Filesystem.writeFile({
                    path: fileName,
                    data: base64Data,
                    directory: Directory.Cache
                });

                // Try opening directly with FileOpener or Native Share
                try {
                    await FileOpener.open({ filePath: savedFile.uri });
                    return true;
                } catch {
                    // Fallback to Native Share
                    await Share.share({
                        title,
                        url: savedFile.uri,
                        dialogTitle: `چاپ و اشتراک‌گذاری ${title}`
                    });
                    return true;
                }
            }
        } catch (mobileErr) {
            console.error('Mobile print generation error:', mobileErr);
        }
    }

    // 2. Desktop Web Handling (Hidden IFrame Printing)
    try {
        const printFrame = document.createElement('iframe');
        printFrame.style.position = 'fixed';
        printFrame.style.right = '0';
        printFrame.style.bottom = '0';
        printFrame.style.width = '0px';
        printFrame.style.height = '0px';
        printFrame.style.border = '0';
        printFrame.style.visibility = 'hidden';
        document.body.appendChild(printFrame);

        const frameDoc = printFrame.contentWindow?.document || printFrame.contentDocument;
        if (!frameDoc) {
            throw new Error('عدم دسترسی به فریم پرینت');
        }

        let contentHtml = '';
        if (typeof elementOrHtml === 'string') {
            contentHtml = elementOrHtml;
        } else {
            // Clone element and copy all document styles for 100% visual fidelity
            const clone = elementOrHtml.cloneNode(true) as HTMLElement;
            const docStyles = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
                .map(node => node.outerHTML)
                .join('\n');
            const pageOrientation = (orientation === 'landscape' || orientation === 'l') ? 'landscape' : 'portrait';
            const pageSize = (orientation === 'landscape' || orientation === 'l') ? 'A5 landscape' : 'A4 portrait';

            contentHtml = `
                <!DOCTYPE html>
                <html dir="rtl" lang="fa">
                <head>
                    <meta charset="utf-8">
                    <title>${title}</title>
                    ${docStyles}
                    <style>
                        @page { size: ${pageSize}; margin: 0; }
                        * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important; }
                        body { font-family: 'Vazirmatn', Tahoma, sans-serif; margin: 0; padding: 0; direction: rtl; background: #ffffff !important; }
                    </style>
                </head>
                <body class="bg-white">
                    ${clone.outerHTML}
                </body>
                </html>
            `;
        }

        frameDoc.open();
        frameDoc.write(contentHtml);
        frameDoc.close();

        setTimeout(() => {
            try {
                if (printFrame.contentWindow) {
                    printFrame.contentWindow.focus();
                    printFrame.contentWindow.print();
                }
            } catch (err) {
                console.warn('Hidden frame print error, falling back to window.print():', err);
                window.print();
            } finally {
                setTimeout(() => {
                    if (document.body.contains(printFrame)) {
                        document.body.removeChild(printFrame);
                    }
                }, 3000);
            }
        }, 500);

        return true;
    } catch (webErr) {
        console.error('Web print error:', webErr);
        window.print();
        return false;
    }
};
