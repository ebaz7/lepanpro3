import React, { useState } from 'react';
import { RefreshCw, X, ArrowUpCircle, DownloadCloud, CheckCircle2 } from 'lucide-react';
import { AppVersionInfo, applyApplicationUpdate, isCapacitorAndroid } from '../services/updateService';
import { isTauriDesktop, isWebApp } from '../utils/platformDetection';

interface UpdateBannerProps {
  updateInfo: AppVersionInfo | null;
  onDismiss?: () => void;
  className?: string;
  variant?: 'floating' | 'embedded';
}

export const UpdateBanner: React.FC<UpdateBannerProps> = ({
  updateInfo,
  onDismiss,
  className = '',
  variant = 'embedded'
}) => {
  const [isUpdating, setIsUpdating] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  if (!updateInfo) return null;

  const isAndroid = isCapacitorAndroid();
  const isDesktop = isTauriDesktop();
  const isWeb = isWebApp() && !isAndroid;

  const handleUpdateClick = async () => {
    setIsUpdating(true);
    try {
      await applyApplicationUpdate(updateInfo);
      setIsSuccess(true);
    } catch (e) {
      console.error('Update failed:', e);
      setIsUpdating(false);
    }
  };

  const titleText = updateInfo.title || (isWeb ? 'نسخه جدید تحت‌وب آماده است' : isAndroid ? 'نسخه جدید اندروید آماده دریافت' : 'نسخه جدید نرم‌افزار');
  const buildText = updateInfo.buildNumber 
    ? `بیلد ${updateInfo.buildNumber}` 
    : (updateInfo.version ? `نسخه ${updateInfo.version}` : 'آماده دریافت');

  const actionButtonText = isUpdating
    ? (isWeb ? 'در حال اعمال و بارگذاری...' : isAndroid ? 'در حال دریافت APK...' : 'در حال دریافت...')
    : isSuccess
    ? 'اعمال شد'
    : (isWeb ? 'تازه‌سازی و به‌روزرسانی' : isAndroid ? 'دانلود نسخه اندروید' : 'به‌روزرسانی');

  return (
    <div 
      className={`relative z-50 w-full transition-all duration-300 ${className}`}
      dir="rtl"
    >
      <div className="glass-panel rounded-2xl sm:rounded-3xl p-3 sm:p-3.5 flex items-center justify-between gap-3 overflow-hidden backdrop-blur-xl border border-blue-200/60 dark:border-blue-900/60 shadow-md bg-white/80 dark:bg-zinc-900/80">
        
        {/* Right Section: Icon & Version Info */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="relative shrink-0 flex items-center justify-center">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
              {isSuccess ? (
                <CheckCircle2 size={20} className="text-white" />
              ) : isAndroid ? (
                <DownloadCloud size={20} className="text-white" />
              ) : (
                <ArrowUpCircle size={20} className="text-white" />
              )}
            </div>
            {/* Animated accent dot */}
            {!isSuccess && (
              <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-600"></span>
              </span>
            )}
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-bold text-xs sm:text-sm text-zinc-900 dark:text-zinc-100 tracking-tight leading-tight">
                {titleText}
              </h3>
              {updateInfo.version && (
                <span className="text-[10px] sm:text-xs font-mono font-bold px-2 py-0.5 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200/60 dark:border-blue-800/60">
                  v{updateInfo.version}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-0.5 text-[11px] sm:text-xs text-zinc-500 dark:text-zinc-400 font-medium truncate">
              <span className="font-mono text-zinc-700 dark:text-zinc-300 font-bold">{buildText}</span>
              <span className="hidden xs:inline text-zinc-300 dark:text-zinc-600">•</span>
              <span className="hidden xs:inline truncate text-blue-600 dark:text-blue-400 font-medium">
                {updateInfo.releaseNotes || (isWeb ? 'ارتقای رابط کاربری و عملکرد سامانه تحت‌وب' : 'به‌روزرسانی و بهینه‌سازی سامانه')}
              </span>
            </div>
          </div>
        </div>

        {/* Left Section: Action Button & Close */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleUpdateClick}
            disabled={isUpdating || isSuccess}
            className="bg-blue-600 hover:bg-blue-700 active:bg-blue-800 dark:bg-blue-500 dark:hover:bg-blue-600 text-white font-bold text-xs sm:text-sm px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl sm:rounded-2xl shadow-md shadow-blue-600/20 active:scale-95 transition-all flex items-center gap-1.5 disabled:opacity-75 disabled:cursor-not-allowed whitespace-nowrap cursor-pointer"
          >
            {isUpdating ? (
              <>
                <RefreshCw size={14} className="animate-spin" />
                <span>{actionButtonText}</span>
              </>
            ) : isSuccess ? (
              <>
                <CheckCircle2 size={15} />
                <span>اعمال شد</span>
              </>
            ) : (
              <>
                {isAndroid ? <DownloadCloud size={15} /> : <ArrowUpCircle size={15} className="hidden sm:inline" />}
                <span>{actionButtonText}</span>
              </>
            )}
          </button>

          {onDismiss && (
            <button
              onClick={onDismiss}
              className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-1.5 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
              title="بستن موقت اعلان"
            >
              <X size={16} />
            </button>
          )}
        </div>

      </div>
    </div>
  );
};

export default UpdateBanner;
