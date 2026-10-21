import React, { useState, useEffect } from 'react';
import {
  Server,
  Monitor,
  Laptop,
  CheckCircle2,
  AlertCircle,
  Wifi,
  RefreshCw,
  Globe,
  Radio,
  Settings2,
  ArrowUpCircle,
  X,
  ShieldCheck,
  Activity,
  HardDrive
} from 'lucide-react';
import {
  getNetworkConfig,
  saveNetworkConfig,
  testServerConnection,
  NetworkRole,
  NetworkConfig,
  isTauriAvailable
} from '../services/apiAdapter';
import { checkServerUpdate, AppVersionInfo, applyApplicationUpdate } from '../services/updateService';

interface NetworkRoleSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NetworkRoleSettingsModal: React.FC<NetworkRoleSettingsModalProps> = ({
  isOpen,
  onClose
}) => {
  const [config, setConfig] = useState<NetworkConfig>(getNetworkConfig());
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ online: boolean; latencyMs?: number; error?: string } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Updater state
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [updateResult, setUpdateResult] = useState<AppVersionInfo | null>(null);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setConfig(getNetworkConfig());
      setTestResult(null);
      setSaveSuccess(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleRoleSelect = (role: NetworkRole) => {
    setConfig(prev => ({ ...prev, role }));
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    const result = await testServerConnection(config.serverUrl, config.timeoutMs);
    setTestResult(result);
    setTesting(false);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await saveNetworkConfig(config);
      setSaveSuccess(true);
      setTimeout(() => {
        setSaveSuccess(false);
        onClose();
      }, 1200);
    } catch (e) {
      console.error('Failed to save network config:', e);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCheckUpdate = async () => {
    setCheckingUpdate(true);
    try {
      const { hasUpdate, serverInfo } = await checkServerUpdate();
      if (hasUpdate && serverInfo) {
        setUpdateResult(serverInfo);
        setShowUpdateModal(true);
      } else {
        alert('شما در حال استفاده از آخرین نسخه نرم‌افزار هستید.');
      }
    } catch (err) {
      alert('خطا در بررسی بروزرسانی آنلاین.');
    } finally {
      setCheckingUpdate(false);
    }
  };

  const handleApplyUpdate = async () => {
    setIsUpdating(true);
    try {
      await applyApplicationUpdate(updateResult);
    } catch (err) {
      alert('خطا در اعمال بروزرسانی.');
      setIsUpdating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in" dir="rtl">
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-5 sm:p-6 bg-gradient-to-r from-blue-600 to-indigo-700 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20">
              <Radio className="w-6 h-6 text-white animate-pulse" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold">پیکربندی شبکه و نقش‌های سیستم (Dual-Role Network)</h2>
              <p className="text-xs text-blue-100 mt-0.5">تنظیم حالت کارکرد: سرور میزبان (Server Host)، کلاینت شبکه (Client)، یا تک‌کاربره (Standalone)</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-white/80 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-6 flex-1 text-zinc-800 dark:text-zinc-200">

          {/* Role Cards Selection */}
          <div>
            <label className="block text-xs sm:text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-3">
              انتخاب نقش دستگاه در شبکه:
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              
              {/* Standalone Card */}
              <button
                type="button"
                onClick={() => handleRoleSelect('Standalone')}
                className={`p-4 rounded-2xl border-2 text-right transition-all flex flex-col justify-between relative ${
                  config.role === 'Standalone'
                    ? 'border-blue-600 bg-blue-50/70 dark:bg-blue-950/40 shadow-md'
                    : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-800/30'
                }`}
              >
                {config.role === 'Standalone' && (
                  <CheckCircle2 size={18} className="absolute top-3 left-3 text-blue-600 dark:text-blue-400" />
                )}
                <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-3">
                  <Monitor size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-zinc-900 dark:text-zinc-100">مستقل (Standalone)</h3>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1 leading-relaxed">
                    اجرا کاملاً محلی بدون اشتراک‌گذاری در شبکه (حالت پیش‌فرض سیستم).
                  </p>
                </div>
              </button>

              {/* Server (Host) Card */}
              <button
                type="button"
                onClick={() => handleRoleSelect('Server')}
                className={`p-4 rounded-2xl border-2 text-right transition-all flex flex-col justify-between relative ${
                  config.role === 'Server'
                    ? 'border-indigo-600 bg-indigo-50/70 dark:bg-indigo-950/40 shadow-md'
                    : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-800/30'
                }`}
              >
                {config.role === 'Server' && (
                  <CheckCircle2 size={18} className="absolute top-3 left-3 text-indigo-600 dark:text-indigo-400" />
                )}
                <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-3">
                  <Server size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-zinc-900 dark:text-zinc-100">سرور میزبان (Server Host)</h3>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1 leading-relaxed">
                    راه‌اندازی سرور Axum توکار روی آی‌پورت LAN جهت اتصال سایر سیستم‌ها.
                  </p>
                </div>
              </button>

              {/* Client Card */}
              <button
                type="button"
                onClick={() => handleRoleSelect('Client')}
                className={`p-4 rounded-2xl border-2 text-right transition-all flex flex-col justify-between relative ${
                  config.role === 'Client'
                    ? 'border-emerald-600 bg-emerald-50/70 dark:bg-emerald-950/40 shadow-md'
                    : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-800/30'
                }`}
              >
                {config.role === 'Client' && (
                  <CheckCircle2 size={18} className="absolute top-3 left-3 text-emerald-600 dark:text-emerald-400" />
                )}
                <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-3">
                  <Laptop size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-zinc-900 dark:text-zinc-100">کلاینت شبکه (Client)</h3>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1 leading-relaxed">
                    اتصال به سرور مرکزی دیگر در شبکه محلی یا اینترنت از طریق Server URL.
                  </p>
                </div>
              </button>

            </div>
          </div>

          {/* Config Details Panel */}
          <div className="bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-700 pb-3">
              <span className="font-bold text-sm flex items-center gap-2">
                <Settings2 size={16} className="text-blue-600 dark:text-blue-400" />
                تنظیمات اختصاصی نقش جاری ({config.role})
              </span>
              {isTauriAvailable() && (
                <span className="text-[11px] font-mono bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-lg font-bold">
                  Tauri Native IPC Active
                </span>
              )}
            </div>

            {config.role === 'Server' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">پورت سرور Axum (پیش‌فرض 8080):</label>
                  <input
                    type="number"
                    value={config.serverPort}
                    onChange={e => setConfig({ ...config, serverPort: Number(e.target.value) || 8080 })}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 font-mono text-left"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">محدوده شنود (Binding):</label>
                  <input
                    type="text"
                    value="0.0.0.0 (تمام اینترفیس‌های LAN)"
                    disabled
                    className="w-full px-3 py-2 text-sm rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 font-mono text-left"
                  />
                </div>
              </div>
            )}

            {config.role === 'Client' && (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">آدرس سرور مرکزی (Server URL):</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={config.serverUrl}
                      onChange={e => setConfig({ ...config, serverUrl: e.target.value })}
                      placeholder="http://192.168.1.100:8080"
                      className="flex-1 px-3 py-2 text-sm rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 font-mono text-left dir-ltr"
                    />
                    <button
                      type="button"
                      onClick={handleTestConnection}
                      disabled={testing}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0"
                    >
                      {testing ? <RefreshCw size={14} className="animate-spin" /> : <Wifi size={14} />}
                      <span>تست اتصال</span>
                    </button>
                  </div>
                </div>

                {/* Ping Result Banner */}
                {testResult && (
                  <div className={`p-3 rounded-xl border text-xs flex items-center justify-between ${
                    testResult.online
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
                      : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200'
                  }`}>
                    <div className="flex items-center gap-2">
                      {testResult.online ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                      <span className="font-bold">
                        {testResult.online ? 'اتصال برقرار است' : 'خطا در برقراری اتصال:'}
                      </span>
                      <span>{testResult.error || `پاسخ‌دهی در ${testResult.latencyMs} میلی‌ثانیه`}</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {config.role === 'Standalone' && (
              <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                در حالت تک‌کاربره، تمام پردازش‌ها و پایگاه داده به صورت داخلی در این دستگاه اجرا شده و نیازی به کارت شبکه یا آدرس آی‌پی وجود ندارد.
              </p>
            )}
          </div>

          {/* Auto-Updater Section */}
          <div className="bg-gradient-to-r from-zinc-50 to-blue-50/30 dark:from-zinc-800/40 dark:to-blue-950/20 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                <ArrowUpCircle size={20} />
              </div>
              <div>
                <h4 className="font-bold text-sm text-zinc-900 dark:text-zinc-100">بررسی به‌روزرسانی خودکار (Auto-Updater)</h4>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">جستجوی آخرین فایل‌های ریلیز و آپدیت آنلاین/شبکه‌ای</p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleCheckUpdate}
              disabled={checkingUpdate}
              className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-white text-white dark:text-zinc-900 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 disabled:opacity-50"
            >
              {checkingUpdate ? <RefreshCw size={14} className="animate-spin" /> : <RefreshCw size={14} />}
              <span>بررسی نسخه جدید</span>
            </button>
          </div>

        </div>

        {/* Modal Footer */}
        <div className="p-4 sm:p-5 bg-zinc-50 dark:bg-zinc-900/90 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between shrink-0">
          <div className="text-xs text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5">
            <ShieldCheck size={14} className="text-emerald-500" />
            <span>تنظیمات ذخیره‌شده به محض ذخیره در دسکتاپ و مرورگر اعمال می‌شوند.</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 text-xs font-bold hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              انصراف
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-1.5 disabled:opacity-50"
            >
              {isSaving ? <RefreshCw size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
              <span>{saveSuccess ? 'ذخیره شد!' : 'ذخیره و اعمال تنظیمات'}</span>
            </button>
          </div>
        </div>

      </div>

      {/* User Prompt Dialog for Auto Updates */}
      {showUpdateModal && updateResult && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fade-in" dir="rtl">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-2xl w-full max-w-md p-6 text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center mx-auto shadow-lg shadow-blue-500/30">
              <ArrowUpCircle size={28} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">نسخه جدید نرم‌افزار آماده است</h3>
              <p className="text-xs text-blue-600 dark:text-blue-400 font-mono font-bold mt-1">
                نسخه v{updateResult.version} (بیلد {updateResult.buildNumber || 'جدید'})
              </p>
            </div>
            <p className="text-xs text-zinc-600 dark:text-zinc-300 bg-zinc-50 dark:bg-zinc-800 p-3 rounded-2xl border border-zinc-200 dark:border-zinc-700 text-right leading-relaxed">
              {updateResult.releaseNotes || 'نسخه جدید شامل بهینه‌سازی عملکرد، پایداری شبکه دوتایی و بروزرسانی خودکار می‌باشد.'}
            </p>
            <p className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
              آیا مایلید اکنون به‌روزرسانی دریافت و اعمال شود؟
            </p>
            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => setShowUpdateModal(false)}
                className="flex-1 py-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 text-xs font-bold hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                بعداً
              </button>
              <button
                onClick={handleApplyUpdate}
                disabled={isUpdating}
                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md transition-all flex items-center justify-center gap-1.5"
              >
                {isUpdating ? <RefreshCw size={14} className="animate-spin" /> : <ArrowUpCircle size={14} />}
                <span>{isUpdating ? 'در حال بروزرسانی...' : 'به‌روزرسانی اکنون'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default NetworkRoleSettingsModal;
