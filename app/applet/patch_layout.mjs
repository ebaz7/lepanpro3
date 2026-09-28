import fs from "fs";

let content = fs.readFileSync("./components/SecretariatModule.tsx", "utf8");

// 1. Optimize Modal Outer Wrapper to be edge-to-edge
content = content.replace(
  'className="fixed inset-0 z-50 flex flex-col bg-slate-900/70 p-0 sm:p-1.5 md:p-2 backdrop-blur-xs overflow-hidden"',
  'className="fixed inset-0 z-50 flex flex-col bg-slate-900/80 p-0 sm:p-1 overflow-hidden"'
);

content = content.replace(
  'className="bg-slate-100 dark:bg-slate-900 w-full h-full rounded-none sm:rounded-2xl border-0 sm:border border-slate-200 dark:border-slate-800 p-2.5 sm:p-3 flex flex-col overflow-hidden text-right shadow-2xl"',
  'className="bg-slate-100 dark:bg-slate-900 w-full h-full rounded-none sm:rounded-xl border-0 sm:border border-slate-200 dark:border-slate-800 p-1.5 sm:p-2 flex flex-col overflow-hidden text-right shadow-2xl"'
);

// 2. Add Toggle Collapse Button to Top Bar
const targetSearchStr = '<div className="flex items-center justify-between border-b dark:border-slate-800 pb-2.5 shrink-0">';
const targetIndex = content.indexOf(targetSearchStr);
if (targetIndex !== -1) {
  const nextCloseBtnIndex = content.indexOf('<X size={18} />', targetIndex);
  if (nextCloseBtnIndex !== -1) {
    const endBtnIndex = content.indexOf('</div>', nextCloseBtnIndex);
    const subStr = content.substring(targetIndex, endBtnIndex + 6);
    
    // Replace with compact top bar
    const replacement = `<div className="flex items-center justify-between border-b dark:border-slate-800 pb-1.5 shrink-0">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-purple-600"></span>
                  <h3 className="text-xs sm:text-sm font-black text-gray-800 dark:text-white">
                    {editingLetterId ? "ویرایش نامه اداری" : "ثبت و تدوین نامه اداری جدید"}
                  </h3>
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-purple-50 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300">
                    {selectedCompany?.name}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <button
                    type="button"
                    onClick={() => setIsMetadataExpanded(!isMetadataExpanded)}
                    className="px-2.5 py-1 rounded-lg text-xs font-bold border transition-all flex items-center gap-1 bg-indigo-50 dark:bg-indigo-950/50 border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 shadow-2xs hover:bg-indigo-100"
                    title={isMetadataExpanded ? "جمع کردن مشخصات (فضای بزرگتر برای تایپ)" : "نمایش فرم کامل مشخصات"}
                  >
                    {isMetadataExpanded ? <span>▲ جمع‌کردن مشخصات (فضای بزرگتر)</span> : <span>▼ مشخصات و سربرگ</span>}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const fakeLetter: SecretariatLetter = {
                        ...(newLetterForm as any),
                        id: "preview_only",
                        companyId: selectedCompany.id,
                        status: SecretariatLetterStatus.DRAFT,
                        createdAt: Date.now(),
                        updatedAt: Date.now(),
                        letterNumber: "پیش‌نویس",
                        date: newLetterForm.date || "پیش‌نویس",
                      };
                      setIsPrintMode(fakeLetter);
                    }}
                    className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/50 hover:bg-amber-100 text-amber-700 dark:text-amber-300 text-xs font-bold px-2.5 py-1 rounded-lg transition-all flex items-center gap-1"
                  >
                    <Eye size={13} /> <span className="hidden sm:inline">مشاهده پیش‌نویس</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowNewLetterModal(false)}
                    className="p-1 text-gray-400 hover:text-gray-600 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-colors"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>`;
    content = content.replace(subStr, replacement);
  }
}

// 3. Compact Metadata Ribbon when isMetadataExpanded is false
const metaRibbonStart = '<div className="bg-white dark:bg-slate-800 border dark:border-slate-700/80 rounded-xl p-2.5 shadow-xs shrink-0 space-y-2">';
if (content.includes(metaRibbonStart)) {
  content = content.replace(
    metaRibbonStart,
    `<div className="bg-white dark:bg-slate-800 border dark:border-slate-700/80 rounded-xl p-1.5 sm:p-2 shadow-xs shrink-0 transition-all">
                {!isMetadataExpanded ? (
                  <div className="flex flex-wrap items-center justify-between gap-1.5 text-xs">
                    <div className="flex-1 min-w-[200px] flex items-center gap-1.5">
                      <span className="text-[11px] font-bold text-slate-500 whitespace-nowrap">موضوع:</span>
                      <input
                        required
                        type="text"
                        value={newLetterForm.subject}
                        onChange={(e) =>
                          setNewLetterForm({
                            ...newLetterForm,
                            subject: e.target.value,
                          })
                        }
                        placeholder="موضوع نامه اداری..."
                        className="flex-1 border dark:border-slate-700 dark:bg-slate-900 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-800 dark:text-slate-100"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="hidden md:flex items-center gap-1">
                        <span className="text-[11px] text-slate-500 font-bold">فرستنده:</span>
                        <input
                          type="text"
                          value={newLetterForm.sender}
                          onChange={(e) => setNewLetterForm({ ...newLetterForm, sender: e.target.value })}
                          placeholder="فرستنده..."
                          className="w-32 border dark:border-slate-700 dark:bg-slate-900 rounded-lg px-2 py-0.5 text-xs"
                        />
                      </div>
                      <div className="hidden md:flex items-center gap-1">
                        <span className="text-[11px] text-slate-500 font-bold">گیرنده:</span>
                        <input
                          type="text"
                          value={newLetterForm.receiver}
                          onChange={(e) => setNewLetterForm({ ...newLetterForm, receiver: e.target.value })}
                          placeholder="گیرنده..."
                          className="w-32 border dark:border-slate-700 dark:bg-slate-900 rounded-lg px-2 py-0.5 text-xs"
                        />
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-[11px] text-slate-500 font-bold">تاریخ:</span>
                        <input
                          type="text"
                          value={newLetterForm.date}
                          onChange={(e) => setNewLetterForm({ ...newLetterForm, date: e.target.value })}
                          className="w-24 border dark:border-slate-700 dark:bg-slate-900 rounded-lg px-1.5 py-0.5 text-xs text-center font-mono"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowDrawer(true)}
                        className="px-2 py-1 rounded-lg border border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 text-[11px] font-bold flex items-center gap-1"
                        title="تنظیمات تکمیلی، امضاها، مهر و ضمائم"
                      >
                        <Settings size={12} />
                        <span>امضا و ضمائم ({newLetterForm.signers?.length || 0})</span>
                      </button>
                    </div>
                  </div>
                ) : (`
  );
  
  // Close the ternary condition after the checkboxes block
  content = content.replace(
    '</datalist>\n                  </div>\n\n                  {/* Inline quick checkboxes and advanced settings trigger */}',
    '</datalist>\n                  </div>\n\n                  {/* Inline quick checkboxes and advanced settings trigger */}'
  );
}

// Find where the metadata ribbon ended and close the ternary
const oldClosingRibbon = '</span>\n                    </button>\n                  </div>\n                </div>';
if (content.includes(oldClosingRibbon)) {
  content = content.replace(
    oldClosingRibbon,
    '</span>\n                    </button>\n                  </div>\n                </div>\n                )}'
  );
}

// 4. In office paper workspace, increase width and reduce top gap
content = content.replace(
  'className="flex-1 min-h-0 p-4 sm:p-8 overflow-y-auto flex justify-center w-full relative custom-scrollbar"',
  'className="flex-1 min-h-0 p-1 sm:p-2.5 overflow-y-auto flex justify-center w-full relative custom-scrollbar"'
);

fs.writeFileSync("./components/SecretariatModule.tsx", content, "utf8");
console.log("Layout successfully enlarged!");
