// Frontend API Client Adapter for Dual-Role (Standalone, Server Host, Client) network architecture

export type NetworkRole = 'Standalone' | 'Server' | 'Client';

export interface NetworkConfig {
  role: NetworkRole;
  serverUrl: string;
  serverPort: number;
  autoConnect: boolean;
  updateEndpoint: string;
  timeoutMs: number;
}

const DEFAULT_NETWORK_CONFIG: NetworkConfig = {
  role: 'Standalone',
  serverUrl: 'http://localhost:8080',
  serverPort: 8080,
  autoConnect: true,
  updateEndpoint: '',
  timeoutMs: 3000,
};

const STORAGE_KEY = 'sayan_network_config_v1';

// Get active configuration from localStorage or default
export function getNetworkConfig(): NetworkConfig {
  if (typeof window === 'undefined') return DEFAULT_NETWORK_CONFIG;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_NETWORK_CONFIG;
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_NETWORK_CONFIG, ...parsed };
  } catch (e) {
    console.warn('Failed to parse network config, using defaults:', e);
    return DEFAULT_NETWORK_CONFIG;
  }
}

// Save active configuration and synchronize with Tauri backend if available
export async function saveNetworkConfig(config: Partial<NetworkConfig>): Promise<NetworkConfig> {
  const current = getNetworkConfig();
  const updated: NetworkConfig = { ...current, ...config };

  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent('sayan:network-config-changed', { detail: updated }));
  }

  // If in Tauri desktop app, sync with Tauri Rust config state
  if (isTauriAvailable()) {
    try {
      const tauriInvoke = getTauriInvoke();
      if (tauriInvoke) {
        await tauriInvoke('save_client_config', {
          config: {
            role: updated.role,
            local_server_url: updated.serverUrl,
            cloud_server_url: 'http://localhost:3000',
            update_url: updated.updateEndpoint,
            timeout_ms: updated.timeoutMs,
            port: updated.serverPort,
          },
        });
      }
    } catch (err) {
      console.warn('Tauri config sync error:', err);
    }
  }

  return updated;
}

// Detect if app is running inside Tauri native webview
export function isTauriAvailable(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean(
    (window as any).__TAURI__ ||
    (window as any).__TAURI_INTERNALS__ ||
    (window as any).__TAURI_METADATA__
  );
}

// Get Tauri invoke handle dynamically without breaking standard browser bundling
function getTauriInvoke(): ((cmd: string, args?: any) => Promise<any>) | null {
  if (typeof window === 'undefined') return null;
  const w = window as any;
  if (w.__TAURI__ && w.__TAURI__.core && typeof w.__TAURI__.core.invoke === 'function') {
    return w.__TAURI__.core.invoke;
  }
  if (w.__TAURI__ && typeof w.__TAURI__.invoke === 'function') {
    return w.__TAURI__.invoke;
  }
  if (w.__TAURI_INTERNALS__ && typeof w.__TAURI_INTERNALS__.invoke === 'function') {
    return w.__TAURI_INTERNALS__.invoke;
  }
  return null;
}

/**
 * Transparent API Adapter:
 * Automatically routes IPC commands or HTTP REST calls based on active Network Role
 */
export async function apiInvoke<T = any>(
  commandName: string,
  args: Record<string, any> = {}
): Promise<T> {
  const config = getNetworkConfig();
  const tauriInvoke = getTauriInvoke();

  // 1. Client Mode or standard browser outside Tauri: Route via HTTP/REST to Server URL
  if (config.role === 'Client' || !tauriInvoke) {
    const baseUrl = config.serverUrl.replace(/\/+$/, '');
    const endpoint = `${baseUrl}/api/ipc/${commandName}`;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), config.timeoutMs || 5000);

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({ command: commandName, args }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Server returned HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      if (data && typeof data === 'object' && 'success' in data) {
        if (!data.success) {
          throw new Error(data.error || `Remote IPC command '${commandName}' failed`);
        }
        return data.result as T;
      }
      return data as T;
    } catch (err: any) {
      console.error(`Remote API call failed for '${commandName}' on ${endpoint}:`, err);
      // Fallback for local web server if available
      if (typeof window !== 'undefined') {
        const localFallbackRes = await fetch(`/api/${commandName}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(args),
        }).catch(() => null);

        if (localFallbackRes && localFallbackRes.ok) {
          return await localFallbackRes.json();
        }
      }
      throw err;
    }
  }

  // 2. Standalone or Server Mode in Tauri: Call local Tauri Rust IPC invoke directly
  try {
    return await tauriInvoke(commandName, args);
  } catch (err) {
    console.error(`Local Tauri IPC command '${commandName}' error:`, err);
    throw err;
  }
}

/**
 * Test connectivity to specified server URL
 */
export async function testServerConnection(url: string, timeoutMs: number = 3000): Promise<{
  online: boolean;
  role?: string;
  latencyMs?: number;
  error?: string;
}> {
  const cleanUrl = url.replace(/\/+$/, '');
  const healthUrl = `${cleanUrl}/api/health`;
  const startTime = performance.now();

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const res = await fetch(healthUrl, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      signal: controller.signal,
    });

    clearTimeout(timer);
    const latencyMs = Math.round(performance.now() - startTime);

    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      return {
        online: true,
        role: data.role || 'Server',
        latencyMs,
      };
    } else {
      return {
        online: false,
        error: `پاسخ ناموفق سرور (کد ${res.status})`,
      };
    }
  } catch (err: any) {
    return {
      online: false,
      error: err.name === 'AbortError' ? 'خطای مهلت زمانی (Timeout)' : 'عدم برقراری اتصال شبکه',
    };
  }
}
