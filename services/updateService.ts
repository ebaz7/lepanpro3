import { getEffectiveApiUrl } from './apiService';
import { isTauriDesktop, isMobileApp, isWebApp } from '../utils/platformDetection';
import toast from 'react-hot-toast';

export interface AppVersionInfo {
  version: string;
  desktopLatestVersion?: string;
  androidLatestVersion?: string;
  buildNumber: string;
  title?: string;
  releaseNotes?: string;
  timestamp?: number;
  downloadUrl?: string;
  androidDownloadUrl?: string;
  forceUpdate?: boolean;
  updateIntervalMinutes?: number;
  autoCheck?: boolean;
}

// Current client build embedded in the bundle
export const CURRENT_CLIENT_BUILD: AppVersionInfo = {
  version: '1.0.6',
  buildNumber: '100',
  title: 'نسخه جاری',
  releaseNotes: 'نسخه پایدار سامانه مالی و بازرگانی'
};

// Helper: compare semantic versions (e.g. "1.3.2" vs "1.3.3")
export function compareSemVer(v1: string, v2: string): number {
  const p1 = (v1 || '').replace(/[^0-9.]/g, '').split('.').map(n => parseInt(n, 10) || 0);
  const p2 = (v2 || '').replace(/[^0-9.]/g, '').split('.').map(n => parseInt(n, 10) || 0);
  const len = Math.max(p1.length, p2.length);
  for (let i = 0; i < len; i++) {
    const num1 = p1[i] || 0;
    const num2 = p2[i] || 0;
    if (num1 > num2) return 1;
    if (num1 < num2) return -1;
  }
  return 0;
}

// Detect if running inside Android Capacitor Native Shell
export function isCapacitorAndroid(): boolean {
  if (typeof window === 'undefined') return false;
  const win = window as any;
  return Boolean(
    (win.Capacitor?.isNativePlatform?.() && win.Capacitor?.getPlatform?.() === 'android') ||
    (win.Capacitor?.platform === 'android') ||
    (isMobileApp() && /android/i.test(navigator.userAgent))
  );
}

// Dismiss an update so it does not keep showing up in current session
export function dismissUpdate(serverInfo?: AppVersionInfo | null): void {
  if (typeof window === 'undefined') return;
  const serverVer = serverInfo?.version || '';
  const serverBuild = serverInfo?.buildNumber || serverVer;
  const serverTimestamp = Number(serverInfo?.timestamp) || 0;
  const sig = `${serverVer}_${serverBuild}_${serverTimestamp}`;
  try {
    sessionStorage.setItem('dismissed_update_sig', sig);
    // DO NOT write dismissed_update_sig to localStorage so native apps will ask again on next app launch if binary is unupdated
    localStorage.removeItem('dismissed_update_sig');
  } catch (_) {}
}

// Get native client version asynchronously if running on Tauri or Android Capacitor
export async function getNativeClientVersion(): Promise<{ version: string; buildNumber: string }> {
  if (typeof window === 'undefined') {
    return { version: CURRENT_CLIENT_BUILD.version, buildNumber: CURRENT_CLIENT_BUILD.buildNumber };
  }

  const win = window as any;
  let detectedVersion = CURRENT_CLIENT_BUILD.version;
  let detectedBuild = CURRENT_CLIENT_BUILD.buildNumber;

  // 1. Check Tauri app.getVersion()
  try {
    if (isTauriDesktop()) {
      if (win.__TAURI__?.app?.getVersion) {
        const ver = await win.__TAURI__.app.getVersion();
        if (ver && compareSemVer(ver, detectedVersion) > 0) {
          detectedVersion = ver;
          detectedBuild = ver;
        }
      }
      return { version: detectedVersion, buildNumber: detectedBuild };
    }
  } catch (_) {}

  // 2. Check Capacitor App.getInfo()
  try {
    if (isCapacitorAndroid()) {
      if (win.Capacitor?.Plugins?.App?.getInfo) {
        const info = await win.Capacitor.Plugins.App.getInfo();
        if (info?.version && compareSemVer(info.version, detectedVersion) > 0) {
          detectedVersion = info.version;
          detectedBuild = info.build || info.version;
        }
      }
      return { version: detectedVersion, buildNumber: detectedBuild };
    }
  } catch (_) {}

  return { version: detectedVersion, buildNumber: detectedBuild };
}

// Check for updates by querying /api/version and /api/desktop/check-update
export async function checkServerUpdate(): Promise<{ hasUpdate: boolean; serverInfo: AppVersionInfo | null }> {
  try {
    const versionApiUrl = getEffectiveApiUrl(`/api/version?t=${Date.now()}`);
    let data: AppVersionInfo | null = null;
    let desktopDownloadUrl = '';
    let androidDownloadUrl = '';

    try {
      const res = await fetch(versionApiUrl, {
        headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' }
      });
      if (res.ok) {
        data = await res.json();
        if (data?.androidDownloadUrl) {
          androidDownloadUrl = data.androidDownloadUrl;
        }
      }
    } catch (e) {
      console.debug('Failed fetching /api/version:', e);
    }

    // If on Desktop, also query desktop specific endpoint
    const isDesktop = isTauriDesktop();
    if (isDesktop) {
      try {
        const desktopApiUrl = getEffectiveApiUrl(`/api/desktop/check-update?t=${Date.now()}`);
        const desktopRes = await fetch(desktopApiUrl, {
          headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' }
        });
        if (desktopRes.ok) {
          const desktopData = await desktopRes.json();
          if (desktopData) {
            desktopDownloadUrl = desktopData.directDownloadUrl || desktopData.updateUrl || '';
            if (!data || !data.version) {
              data = {
                version: desktopData.latestVersion || '',
                buildNumber: desktopData.latestVersion || '',
                releaseNotes: desktopData.releaseNotes || 'به‌روزرسانی نرم‌افزار دسکتاپ',
                title: 'نسخه جدید سامانه'
              };
            }
          }
        }
      } catch (e) {
        console.debug('Failed fetching /api/desktop/check-update:', e);
      }
    }

    if (!data || (!data.version && !data.buildNumber)) {
      return { hasUpdate: false, serverInfo: null };
    }

    const defaultAndroidUrl = getEffectiveApiUrl('/downloads/dlkam-android-latest.apk');
    const defaultDesktopUrl = getEffectiveApiUrl('/downloads/dlkam-desktop-setup.msi');

    data.androidDownloadUrl = androidDownloadUrl || data.androidDownloadUrl || defaultAndroidUrl;

    if (isCapacitorAndroid()) {
      data.downloadUrl = data.androidDownloadUrl;
    } else if (isDesktop) {
      data.downloadUrl = data.downloadUrl || desktopDownloadUrl || defaultDesktopUrl;
    } else {
      // Pure Web: no file download URL needed, update is web-based reload/cache clear
      data.downloadUrl = '';
    }

    const isAndroid = isCapacitorAndroid();
    const isNative = isDesktop || isAndroid;
    const targetServerVer = isAndroid
      ? (data.androidLatestVersion || data.version || data.buildNumber)
      : isDesktop
        ? (data.desktopLatestVersion || data.version || data.buildNumber)
        : (data.version || data.buildNumber);

    data.version = targetServerVer;
    const serverBuild = data.buildNumber || targetServerVer;
    const serverVer = targetServerVer;
    const serverTimestamp = Number(data.timestamp) || 0;

    if (typeof window === 'undefined') {
      return { hasUpdate: false, serverInfo: data };
    }

    // Determine actual native client version (Tauri, Capacitor, or Web baseline)
    const nativeClient = await getNativeClientVersion();
    const clientBuild = nativeClient.buildNumber;
    const clientVer = nativeClient.version;
    const currentServerSig = `${serverVer}_${serverBuild}_${serverTimestamp}`;

    // 1. Check if user dismissed this exact update in CURRENT session only
    const sessionDismissedSig = sessionStorage.getItem('dismissed_update_sig');
    if (sessionDismissedSig && sessionDismissedSig === currentServerSig) {
      return { hasUpdate: false, serverInfo: data };
    }

    // 2. Compare version semantically
    const semVerComp = compareSemVer(serverVer, clientVer);

    // For Native Android & Tauri Desktop:
    // Strictly compare native binary version against server version!
    // As long as server version > client version (semVerComp > 0), the update banner MUST be displayed
    // until the user actually installs the new APK/MSI binary.
    if (isNative) {
      if (semVerComp > 0) {
        return { hasUpdate: true, serverInfo: data };
      }
      return { hasUpdate: false, serverInfo: data };
    }

    // 3. Web-only checks: check if user already applied this exact server release signature on web
    const lastAppliedSig = localStorage.getItem('last_applied_release_sig');
    if (lastAppliedSig && lastAppliedSig === currentServerSig) {
      return { hasUpdate: false, serverInfo: data };
    }

    const appliedVer = localStorage.getItem('applied_server_version');
    const appliedBuild = localStorage.getItem('applied_server_build');
    if (appliedVer === serverVer && appliedBuild === serverBuild) {
      return { hasUpdate: false, serverInfo: data };
    }

    const baselineBuild = localStorage.getItem('baseline_server_build');
    const baselineTimestamp = Number(localStorage.getItem('baseline_server_timestamp')) || 0;

    // If server version is strictly older than client version, no update
    if (semVerComp < 0) {
      return { hasUpdate: false, serverInfo: data };
    }

    // If server version is strictly newer than client version
    if (semVerComp > 0) {
      return { hasUpdate: true, serverInfo: data };
    }

    // When semVer is equal (e.g. 1.0.0 == 1.0.0) on Web, check timestamp if server was updated after baseline
    if (serverBuild !== clientBuild && baselineBuild && baselineBuild !== serverBuild) {
      if (serverTimestamp > 0 && baselineTimestamp > 0 && serverTimestamp > baselineTimestamp) {
        return { hasUpdate: true, serverInfo: data };
      }
    }

    return {
      hasUpdate: false,
      serverInfo: data
    };
  } catch (error) {
    console.debug('Update check failed (offline or network error):', error);
    return { hasUpdate: false, serverInfo: null };
  }
}

// Publish a new update to all clients
export async function publishApplicationUpdate(payload: {
  version: string;
  title?: string;
  releaseNotes?: string;
  sendToBots?: boolean;
}): Promise<{ success: boolean; data?: AppVersionInfo; error?: string }> {
  try {
    const publishUrl = getEffectiveApiUrl('/api/version/publish');
    const res = await fetch(publishUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      return { success: false, error: data.error || 'خطا در انتشار به‌روزرسانی' };
    }

    // Notify window components immediately and reset baseline so clients detect it as new
    if (typeof window !== 'undefined') {
      localStorage.removeItem('last_applied_release_sig');
      localStorage.removeItem('applied_server_version');
      localStorage.removeItem('applied_server_build');
      sessionStorage.removeItem('dismissed_update_sig');
      localStorage.removeItem('dismissed_update_sig');
      localStorage.setItem('baseline_server_build', 'old_version_baseline');
      localStorage.setItem('baseline_server_timestamp', '0');
      window.dispatchEvent(new CustomEvent('app:update-published', { detail: data }));
    }

    return { success: true, data };
  } catch (e: any) {
    return { success: false, error: e.message || 'خطا در برقراری ارتباط با سرور' };
  }
}

// Apply update: clear caches, instruct SW to skip waiting, download APK if Android, download MSI if Desktop
export async function applyApplicationUpdate(serverInfo?: AppVersionInfo | null): Promise<void> {
  const isAndroid = isCapacitorAndroid();
  const isDesktop = isTauriDesktop();
  const isWeb = !isAndroid && !isDesktop;
  const win = typeof window !== 'undefined' ? (window as any) : {};

  try {
    // 1. Send automated backup to bots asynchronously with strict 1.5s timeout
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1500);
      const backupUrl = getEffectiveApiUrl('/api/backups/send-to-bot');
      fetch(backupUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason: `پشتیبان خودکار ${isAndroid ? 'اندروید' : isDesktop ? 'دسکتاپ' : 'تحت‌وب'} قبل از بروزرسانی به نسخه ${serverInfo?.version || serverInfo?.buildNumber || 'جدید'}`
        }),
        signal: controller.signal
      }).catch(() => {}).finally(() => clearTimeout(timeoutId));
    } catch (_) {}

    // 2. Mark update signature in localStorage ONLY for Web platform
    if (serverInfo && isWeb) {
      const serverBuild = serverInfo.buildNumber || serverInfo.version;
      const serverVer = serverInfo.version || serverBuild;
      const serverTimestamp = Number(serverInfo.timestamp) || 0;
      const serverSig = `${serverVer}_${serverBuild}_${serverTimestamp}`;
      localStorage.setItem('last_applied_release_sig', serverSig);
      localStorage.setItem('applied_server_version', serverVer);
      localStorage.setItem('applied_server_build', serverBuild);
      localStorage.setItem('baseline_server_build', serverBuild);
      localStorage.setItem('baseline_server_timestamp', serverTimestamp.toString());
      sessionStorage.removeItem('dismissed_update_sig');
      localStorage.removeItem('dismissed_update_sig');
    }

    // 3. Android platform: Trigger direct download/installation of APK
    if (isAndroid) {
      let rawApk = serverInfo?.androidDownloadUrl || serverInfo?.downloadUrl || '/downloads/latest-android';
      if (!rawApk.startsWith('http://') && !rawApk.startsWith('https://')) {
        rawApk = getEffectiveApiUrl(rawApk);
      }
      const apkUrl = rawApk.includes('?') ? `${rawApk}&t=${Date.now()}` : `${rawApk}?t=${Date.now()}`;

      // 3a. Show user feedback
      try {
        toast.success(`شروع دریافت فایل نصبی اندروید (نسخه ${serverInfo?.version || 'جدید'})...`, { duration: 6000 });
      } catch (_) {}

      // 3b. Capacitor Browser plugin
      try {
        if (win.Capacitor?.Plugins?.Browser?.open) {
          await win.Capacitor.Plugins.Browser.open({ url: apkUrl });
        }
      } catch (_) {}

      // 3c. Capacitor App plugin openUrl
      try {
        if (win.Capacitor?.Plugins?.App?.openUrl) {
          await win.Capacitor.Plugins.App.openUrl({ url: apkUrl });
        }
      } catch (_) {}

      // 3d. System window / Location navigation (opens system browser & download manager on Android WebView)
      try {
        win.open(apkUrl, '_system');
      } catch (_) {}

      try {
        window.location.href = apkUrl;
      } catch (_) {}

      // 3e. Programmatic anchor download link
      try {
        const a = document.createElement('a');
        a.href = apkUrl;
        a.download = `dlkam-android-v${serverInfo?.version || 'latest'}.apk`;
        a.target = '_system';
        a.rel = 'noopener noreferrer';
        document.body.appendChild(a);
        a.click();
        setTimeout(() => a.remove(), 1000);
      } catch (_) {}

      return;
    }

    // 4. Desktop Tauri platform: trigger native updater or open download URL
    if (isDesktop) {
      let rawDesktop = serverInfo?.downloadUrl || '/downloads/latest-desktop';
      if (!rawDesktop.startsWith('http://') && !rawDesktop.startsWith('https://')) {
        rawDesktop = getEffectiveApiUrl(rawDesktop);
      }
      const downloadUrl = rawDesktop.includes('?') ? `${rawDesktop}&t=${Date.now()}` : `${rawDesktop}?t=${Date.now()}`;

      // 4a. Show user feedback
      try {
        toast.success(`شروع دریافت فایل نصبی ویندوز (نسخه ${serverInfo?.version || 'جدید'})...`, { duration: 6000 });
      } catch (_) {}

      // 4b. If Tauri built-in auto-updater is active
      if (win.__TAURI__?.updater?.installUpdate) {
        try {
          await win.__TAURI__.updater.installUpdate();
          if (win.__TAURI__?.process?.relaunch) {
            await win.__TAURI__.process.relaunch();
            return;
          }
        } catch (e) {
          console.warn('Tauri updater failed, falling back to direct browser download:', e);
        }
      }

      // 4c. Open download link using Tauri shell API
      let openedByTauri = false;
      try {
        if (win.__TAURI__?.shell?.open) {
          await win.__TAURI__.shell.open(downloadUrl);
          openedByTauri = true;
        } else if (win.__TAURI_IPC__) {
          const { invoke } = win.__TAURI__?.tauri || win.__TAURI__ || {};
          if (invoke) {
            await invoke('tauri', {
              __tauriModule: 'Shell',
              message: { cmd: 'openWith', path: downloadUrl }
            });
            openedByTauri = true;
          }
        }
      } catch (err) {
        console.warn('Tauri shell.open failed:', err);
      }

      // 4d. Fallback: trigger direct file download via anchor & system window
      if (!openedByTauri) {
        try {
          win.open(downloadUrl, '_system');
        } catch (_) {}

        try {
          window.location.href = downloadUrl;
        } catch (_) {}

        try {
          const link = document.createElement('a');
          link.href = downloadUrl;
          link.target = '_blank';
          link.rel = 'noopener noreferrer';
          link.download = `dlkam-desktop-v${serverInfo?.version || 'latest'}.msi`;
          document.body.appendChild(link);
          link.click();
          setTimeout(() => link.remove(), 1000);
        } catch (_) {
          window.open(downloadUrl, '_blank');
        }
      }

      return;
    }

    // 5. Web Browser Platform: Purge caches, instruct ServiceWorker, and hard-refresh
    if (isWeb) {
      if ('caches' in window) {
        try {
          const cacheKeys = await caches.keys();
          await Promise.all(
            cacheKeys.map(key => {
              if (key !== 'auth-session-v1' && key !== 'shown-notifications-v1') {
                return caches.delete(key);
              }
              return Promise.resolve(true);
            })
          );
        } catch (e) {
          console.warn('Failed clearing caches:', e);
        }
      }

      if ('serviceWorker' in navigator) {
        try {
          const registrations = await navigator.serviceWorker.getRegistrations();
          for (const reg of registrations) {
            if (reg.waiting) {
              reg.waiting.postMessage({ type: 'SKIP_WAITING' });
            }
            try {
              await reg.update();
            } catch (_) {}
          }
        } catch (_) {}
      }
    }
  } catch (e) {
    console.error('Error during applyApplicationUpdate:', e);
  } finally {
    // Hard refresh ONLY on pure web application (never on desktop/android installer download)
    if (isWeb) {
      setTimeout(() => {
        const cleanUrl = window.location.origin + window.location.pathname;
        window.location.replace(`${cleanUrl}?v=${Date.now()}`);
      }, 400);
    }
  }
}

