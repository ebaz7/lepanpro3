package com.payment.system;

import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.media.MediaScannerConnection;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import android.util.Log;
import android.webkit.JavascriptInterface;
import android.webkit.MimeTypeMap;
import android.webkit.WebView;
import androidx.core.content.FileProvider;
import com.getcapacitor.BridgeActivity;
import androidx.work.Constraints;
import androidx.work.ExistingPeriodicWorkPolicy;
import androidx.work.NetworkType;
import androidx.work.PeriodicWorkRequest;
import androidx.work.WorkManager;
import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;
import java.util.concurrent.TimeUnit;

public class MainActivity extends BridgeActivity {
    private static final String TAG = "MainActivity";
    private static final String PREFS_NAME = "CapacitorStorage";
    private static final String APP_FILES_FOLDER = "DlkamFiles";

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        Log.d(TAG, "Initializing MainActivity...");

        // Save server URL in native SharedPreferences on start so SyncWorker has immediate access to it
        saveWebServerUrlToSharedPreferences();

        // Register Native File & Gallery Bridge on WebView
        try {
            if (this.getBridge() != null && this.getBridge().getWebView() != null) {
                WebView webView = this.getBridge().getWebView();
                webView.addJavascriptInterface(new DlkamAndroidBridge(this), "DlkamAndroid");
            }
        } catch (Exception e) {
            Log.e(TAG, "Failed to register DlkamAndroid JavascriptInterface", e);
        }

        // Enqueue the WorkManager background synchronization task
        setupScheduler();
    }

    private File getDedicatedAppFolder() {
        File baseDir = getExternalFilesDir(null);
        if (baseDir == null) {
            baseDir = getFilesDir();
        }
        File folder = new File(baseDir, APP_FILES_FOLDER);
        if (!folder.exists()) {
            folder.mkdirs();
        }
        return folder;
    }

    private String sanitizeFileName(String name) {
        if (name == null || name.trim().isEmpty()) {
            return "file_" + System.currentTimeMillis();
        }
        return name.replaceAll("[\\\\/:*?\"<>|]", "_").trim();
    }

    private String resolveMimeType(String fileName, String fallbackMime) {
        if (fallbackMime != null && !fallbackMime.isEmpty() && !fallbackMime.equals("application/octet-stream")) {
            return fallbackMime;
        }
        int dot = fileName.lastIndexOf('.');
        if (dot >= 0 && dot < fileName.length() - 1) {
            String ext = fileName.substring(dot + 1).toLowerCase();
            String guessed = MimeTypeMap.getSingleton().getMimeTypeFromExtension(ext);
            if (guessed != null) return guessed;
            if (ext.equals("pdf")) return "application/pdf";
            if (ext.equals("xlsx")) return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
            if (ext.equals("xls")) return "application/vnd.ms-excel";
            if (ext.equals("jpg") || ext.equals("jpeg")) return "image/jpeg";
            if (ext.equals("png")) return "image/png";
        }
        return "application/octet-stream";
    }

    public class DlkamAndroidBridge {
        private final Context context;

        public DlkamAndroidBridge(Context context) {
            this.context = context;
        }

        @JavascriptInterface
        public boolean hasFileInAppFolder(String fileName) {
            try {
                File target = new File(getDedicatedAppFolder(), sanitizeFileName(fileName));
                return target.exists() && target.length() > 0;
            } catch (Exception e) {
                return false;
            }
        }

        @JavascriptInterface
        public String getAppFolderFilePath(String fileName) {
            try {
                File target = new File(getDedicatedAppFolder(), sanitizeFileName(fileName));
                return target.getAbsolutePath();
            } catch (Exception e) {
                return "";
            }
        }

        @JavascriptInterface
        public boolean saveFileToAppFolder(String base64Data, String fileName, String mimeType) {
            try {
                String cleanBase64 = base64Data;
                int commaIdx = cleanBase64.indexOf(',');
                if (commaIdx >= 0) {
                    cleanBase64 = cleanBase64.substring(commaIdx + 1);
                }
                byte[] bytes = Base64.decode(cleanBase64, Base64.DEFAULT);
                String safeName = sanitizeFileName(fileName);
                File target = new File(getDedicatedAppFolder(), safeName);
                try (FileOutputStream fos = new FileOutputStream(target)) {
                    fos.write(bytes);
                    fos.flush();
                }

                // Also export a copy into public Downloads/Dlkam on Android 10+ so user can access it from File Manager too
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    try {
                        ContentResolver resolver = context.getContentResolver();
                        ContentValues values = new ContentValues();
                        values.put(MediaStore.Downloads.DISPLAY_NAME, safeName);
                        values.put(MediaStore.Downloads.MIME_TYPE, resolveMimeType(safeName, mimeType));
                        values.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/Dlkam");
                        Uri uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
                        if (uri != null) {
                            try (OutputStream os = resolver.openOutputStream(uri)) {
                                if (os != null) {
                                    os.write(bytes);
                                    os.flush();
                                }
                            }
                        }
                    } catch (Exception ignored) {}
                }
                return true;
            } catch (Exception e) {
                Log.e(TAG, "saveFileToAppFolder error", e);
                return false;
            }
        }

        @JavascriptInterface
        public boolean openFileFromAppFolder(String fileName, String mimeType) {
            try {
                String safeName = sanitizeFileName(fileName);
                File target = new File(getDedicatedAppFolder(), safeName);
                if (!target.exists() || target.length() == 0) {
                    return false;
                }
                String resolvedMime = resolveMimeType(safeName, mimeType);
                Uri contentUri = FileProvider.getUriForFile(
                        context,
                        context.getPackageName() + ".fileprovider",
                        target
                );
                Intent viewIntent = new Intent(Intent.ACTION_VIEW);
                viewIntent.setDataAndType(contentUri, resolvedMime);
                viewIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
                try {
                    context.startActivity(viewIntent);
                    return true;
                } catch (Exception openErr) {
                    Intent chooser = Intent.createChooser(viewIntent, safeName);
                    chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    context.startActivity(chooser);
                    return true;
                }
            } catch (Exception e) {
                Log.e(TAG, "openFileFromAppFolder error", e);
                return false;
            }
        }

        @JavascriptInterface
        public boolean saveImageToGallery(String base64Data, String fileName, String mimeType) {
            try {
                String cleanBase64 = base64Data;
                int commaIdx = cleanBase64.indexOf(',');
                if (commaIdx >= 0) {
                    cleanBase64 = cleanBase64.substring(commaIdx + 1);
                }
                byte[] bytes = Base64.decode(cleanBase64, Base64.DEFAULT);
                String safeName = sanitizeFileName(fileName);
                if (!safeName.toLowerCase().matches(".*\\.(jpg|jpeg|png|webp|gif)$")) {
                    safeName = safeName + ".jpg";
                }
                String resolvedMime = resolveMimeType(safeName, (mimeType == null || mimeType.isEmpty()) ? "image/jpeg" : mimeType);

                // Also save in app folder so app knows it's cached locally
                try {
                    File appCopy = new File(getDedicatedAppFolder(), safeName);
                    try (FileOutputStream fos = new FileOutputStream(appCopy)) {
                        fos.write(bytes);
                        fos.flush();
                    }
                } catch (Exception ignored) {}

                ContentResolver resolver = context.getContentResolver();
                ContentValues values = new ContentValues();
                values.put(MediaStore.Images.Media.DISPLAY_NAME, safeName);
                values.put(MediaStore.Images.Media.MIME_TYPE, resolvedMime);

                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    values.put(MediaStore.Images.Media.RELATIVE_PATH, Environment.DIRECTORY_PICTURES + "/Dlkam");
                    values.put(MediaStore.Images.Media.IS_PENDING, 1);
                    Uri uri = resolver.insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, values);
                    if (uri == null) return false;
                    try (OutputStream os = resolver.openOutputStream(uri)) {
                        if (os == null) return false;
                        os.write(bytes);
                        os.flush();
                    }
                    values.clear();
                    values.put(MediaStore.Images.Media.IS_PENDING, 0);
                    resolver.update(uri, values, null, null);
                    return true;
                } else {
                    File picturesDir = new File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_PICTURES), "Dlkam");
                    if (!picturesDir.exists()) picturesDir.mkdirs();
                    File imageFile = new File(picturesDir, safeName);
                    try (FileOutputStream fos = new FileOutputStream(imageFile)) {
                        fos.write(bytes);
                        fos.flush();
                    }
                    MediaScannerConnection.scanFile(context, new String[]{imageFile.getAbsolutePath()}, new String[]{resolvedMime}, null);
                    return true;
                }
            } catch (Exception e) {
                Log.e(TAG, "saveImageToGallery error", e);
                return false;
            }
        }
    }

    private void saveWebServerUrlToSharedPreferences() {
        try {
            SharedPreferences prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            // Save the production server URL as default so that it is persists immediately
            String existingUrl = prefs.getString("server_url", "");
            if (existingUrl == null || existingUrl.isEmpty()) {
                prefs.edit().putString("server_url", "https://dlkam.ir").apply();
                Log.d(TAG, "Stored fallback server URL (https://dlkam.ir) in Capacitor SharedPreferences.");
            }
        } catch (Exception e) {
            Log.e(TAG, "Failed to store server URL in SharedPreferences", e);
        }
    }

    private void setupScheduler() {
        Log.i(TAG, "Scheduling WorkManager Background Sync Task...");
        try {
            // Setup WorkManager Constraints
            Constraints constraints = new Constraints.Builder()
                    .setRequiredNetworkType(NetworkType.CONNECTED)
                    .build();

            // Setup Periodic Work Request (Minimum interval is 15 minutes by Android specification)
            PeriodicWorkRequest syncRequest = new PeriodicWorkRequest.Builder(
                    SyncWorker.class,
                    15, TimeUnit.MINUTES
            )
            .setConstraints(constraints)
            .build();

            // Enqueue unique periodic work to avoid duplicate schedulers on restart
            WorkManager.getInstance(this).enqueueUniquePeriodicWork(
                    "BackgroundDataSync",
                    ExistingPeriodicWorkPolicy.KEEP,
                    syncRequest
            );
            
            Log.i(TAG, "WorkManager Background Sync Task successfully registered.");
        } catch (Exception e) {
            Log.e(TAG, "Error setting up WorkManager Background Sync Task", e);
        }
    }
}
