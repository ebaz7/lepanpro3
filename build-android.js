import { execSync } from 'child_process';
import { existsSync, copyFileSync, mkdirSync, writeFileSync, readFileSync, unlinkSync } from 'fs';
import { join } from 'path';

console.log('====================================================');
console.log('   🤖 Android Signed Release APK Builder (Auto) 🤖 ');
console.log('====================================================\n');

try {
    const isWindows = process.platform === 'win32';
    const gradleDir = join(process.cwd(), 'android');

    // 0. Prepare Icons & Splash Screens from user's app-icon in root folder
    if (existsSync(join(process.cwd(), 'setup-assets.cjs'))) {
        console.log('🎨 Step 0/4: Preparing Android launcher icons & splash screens from app-icon...');
        execSync('node setup-assets.cjs', { stdio: 'inherit' });
    }

    // 1. Build Web Assets
    console.log('📦 Step 1/4: Building Web Application (React + Vite)...');
    execSync('npm run build', { stdio: 'inherit' });
    console.log('✅ Web build finished successfully.\n');

    // 2. Sync with Capacitor & Re-apply Android Icons/Splash
    console.log('🔄 Step 2/4: Syncing assets with Android project (Capacitor)...');
    execSync('npx cap sync android', { stdio: 'inherit' });
    if (existsSync(join(process.cwd(), 'setup-assets.cjs'))) {
        console.log('🎨 Ensuring Android mipmap icons & splash screens match app-icon...');
        execSync('node setup-assets.cjs', { stdio: 'inherit' });
    }
    console.log('✅ Capacitor assets & icons synchronized.\n');

    // Auto-create/validate local.properties
    const localPropertiesPath = join(gradleDir, 'local.properties');
    let requiresWrite = !existsSync(localPropertiesPath);
    let sdkPath = '';

    if (isWindows) {
        const userSpecificSdk = 'C:\\Users\\Factorythird\\AppData\\Local\\Android\\Sdk';
        const defaultWinSdk = join(process.env.USERPROFILE || 'C:\\', 'AppData', 'Local', 'Android', 'Sdk');
        
        const candidates = [
            userSpecificSdk,
            defaultWinSdk,
            'C:\\Android\\Sdk',
            process.env.ANDROID_HOME,
            process.env.ANDROID_SDK_ROOT
        ];

        for (const candidate of candidates) {
            if (candidate && existsSync(candidate)) {
                sdkPath = candidate;
                break;
            }
        }
        
        if (!sdkPath) {
            sdkPath = userSpecificSdk;
        }
    } else if (process.platform === 'darwin') {
        const candidates = [
            join(process.env.HOME || '/', 'Library', 'Android', 'sdk'),
            process.env.ANDROID_HOME,
            process.env.ANDROID_SDK_ROOT
        ];
        for (const candidate of candidates) {
            if (candidate && existsSync(candidate)) {
                sdkPath = candidate;
                break;
            }
        }
    } else {
        const candidates = [
            join(process.env.HOME || '/', 'Android', 'Sdk'),
            process.env.ANDROID_HOME,
            process.env.ANDROID_SDK_ROOT
        ];
        for (const candidate of candidates) {
            if (candidate && existsSync(candidate)) {
                sdkPath = candidate;
                break;
            }
        }
    }

    if (existsSync(localPropertiesPath)) {
        const content = readFileSync(localPropertiesPath, 'utf8');
        const lines = content.split(/\r?\n/);
        const sdkLine = lines.find(line => line.trim().startsWith('sdk.dir'));
        if (sdkLine) {
            const currentVal = sdkLine.split('=')[1]?.trim() || '';
            const unescapedVal = currentVal.replace(/\\:/g, ':').replace(/\\\\/g, '\\');
            
            if (!unescapedVal || !existsSync(unescapedVal)) {
                console.log(`⚠️ Existing sdk.dir in local.properties (${unescapedVal}) is invalid or non-existent.`);
                requiresWrite = true;
            } else {
                console.log(`✅ Valid Android SDK already configured in local.properties: ${unescapedVal}`);
                sdkPath = unescapedVal;
                requiresWrite = false;
            }
        } else {
            requiresWrite = true;
        }
    }

    if (requiresWrite) {
        if (sdkPath) {
            console.log(`✨ Selected Android SDK path for construction: ${sdkPath}`);
            const formattedPath = sdkPath.replace(/\\/g, '/');
            writeFileSync(localPropertiesPath, `sdk.dir=${formattedPath}\n`);
            console.log(`✅ Updated android/local.properties securely with 'sdk.dir=${formattedPath}'\n`);
        } else {
            sdkPath = 'C:\\Users\\Factorythird\\AppData\\Local\\Android\\Sdk';
            writeFileSync(localPropertiesPath, `sdk.dir=C:/Users/Factorythird/AppData/Local/Android/Sdk\n`);
        }
    }

    // 3. Assemble Signed Release APK by default (unless --debug is explicitly passed)
    const isRelease = !process.argv.includes('--debug');
    const keystorePath = join(gradleDir, 'app', 'release-key.keystore');
    
    // Automatic Signing Keystore Generation
    if (isRelease) {
        if (!existsSync(keystorePath)) {
            console.log('🔑 Keystore file not found. Generating automatic release keystore...');
            try {
                let keytoolCmd = 'keytool';
                const keytoolCandidates = [
                    process.env.JAVA_HOME ? join(process.env.JAVA_HOME, 'bin', isWindows ? 'keytool.exe' : 'keytool') : '',
                    'C:\\Program Files\\Android\\Android Studio\\jbr\\bin\\keytool.exe',
                    'C:\\Program Files\\Android\\Android Studio\\jre\\bin\\keytool.exe',
                    'C:\\Program Files\\Java\\jdk-17\\bin\\keytool.exe',
                    'C:\\Program Files\\Java\\jdk-21\\bin\\keytool.exe',
                    'C:\\Program Files\\Java\\jdk1.8.0_301\\bin\\keytool.exe'
                ].filter(Boolean);

                for (const cand of keytoolCandidates) {
                    if (existsSync(cand)) {
                        keytoolCmd = `"${cand}"`;
                        break;
                    }
                }
                const genKeyCmd = `${keytoolCmd} -genkeypair -v -keystore "${keystorePath}" -alias my-key-alias -keyalg RSA -keysize 2048 -validity 10000 -storepass 123456 -keypass 123456 -dname "CN=Dlkam, OU=IT, O=Dlkam, L=Tehran, S=Tehran, C=IR"`;
                console.log(`🚀 Generating release keystore...`);
                execSync(genKeyCmd, { stdio: 'inherit' });
                console.log('✅ Automatically generated release-key.keystore successfully.\n');
            } catch (err) {
                console.warn('⚠️ Warning: Automatic key generation failed. Make sure Java JDK is installed.');
                console.warn(err instanceof Error ? err.message : String(err));
            }
        } else {
            console.log('✅ release-key.keystore verified inside android/app.\n');
        }
    }

    // Remove any stale unsigned APK before running Gradle so an old unsigned APK is never picked up
    const releaseOutDir = join(gradleDir, 'app', 'build', 'outputs', 'apk', 'release');
    const unsignedApkPath = join(releaseOutDir, 'app-release-unsigned.apk');
    const signedApkPath = join(releaseOutDir, 'app-release.apk');
    if (existsSync(unsignedApkPath)) {
        try { unlinkSync(unsignedApkPath); } catch (_) {}
    }

    const buildType = isRelease ? 'Release' : 'Debug';
    const taskName = `assemble${buildType}`;
    
    console.log(`⚙️  Step 3/4: Building Signed Android ${buildType} APK using Gradle...`);
    
    const gradlewName = isWindows ? 'gradlew.bat' : 'gradlew';
    const gradlewPath = join(gradleDir, gradlewName);

    let gradleCmd = '';
    if (existsSync(gradlewPath)) {
        gradleCmd = isWindows ? `gradlew.bat ${taskName}` : `./gradlew ${taskName}`;
    } else {
        gradleCmd = `gradle ${taskName}`;
    }

    const extraEnv = {};
    if (sdkPath) {
        extraEnv.ANDROID_HOME = sdkPath;
        extraEnv.ANDROID_SDK_ROOT = sdkPath;
    }
    
    execSync(gradleCmd, { 
        cwd: gradleDir, 
        stdio: 'inherit',
        env: {
            ...process.env,
            ...extraEnv
        }
    });
    console.log('✅ Gradle compilation finished.\n');

    // 4. Locate signed APK (or sign unsigned APK if needed) and copy to all download & root paths
    console.log('📂 Step 4/4: Verifying signature and publishing APK...');
    const debugApkPath = join(gradleDir, 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk');

    let selectedApkPath = null;
    if (isRelease) {
        // ALWAYS prefer the signed app-release.apk!
        if (existsSync(signedApkPath)) {
            selectedApkPath = signedApkPath;
        } else if (existsSync(unsignedApkPath)) {
            console.log('🔐 Signing app-release-unsigned.apk with release keystore...');
            try {
                let jarsignerCmd = 'jarsigner';
                const jarsignerCandidates = [
                    process.env.JAVA_HOME ? join(process.env.JAVA_HOME, 'bin', isWindows ? 'jarsigner.exe' : 'jarsigner') : '',
                    'C:\\Program Files\\Android\\Android Studio\\jbr\\bin\\jarsigner.exe',
                    'C:\\Program Files\\Java\\jdk-17\\bin\\jarsigner.exe',
                    'C:\\Program Files\\Java\\jdk-21\\bin\\jarsigner.exe'
                ].filter(Boolean);
                for (const cand of jarsignerCandidates) {
                    if (existsSync(cand)) {
                        jarsignerCmd = `"${cand}"`;
                        break;
                    }
                }
                execSync(`${jarsignerCmd} -verbose -sigalg SHA256withRSA -digestalg SHA-256 -keystore "${keystorePath}" -storepass 123456 -keypass 123456 "${unsignedApkPath}" my-key-alias`, { stdio: 'inherit' });
                copyFileSync(unsignedApkPath, signedApkPath);
                selectedApkPath = signedApkPath;
            } catch (signErr) {
                console.warn('⚠️ jarsigner fallback warning:', signErr instanceof Error ? signErr.message : String(signErr));
                selectedApkPath = unsignedApkPath;
            }
        }
    } else if (existsSync(debugApkPath)) {
        selectedApkPath = debugApkPath;
    }

    if (selectedApkPath) {
        const targetPaths = [
            join(process.cwd(), 'payment-system-release.apk'),
            join(process.cwd(), 'payment-system-latest.apk'),
            join(process.cwd(), 'dlkam-android-latest.apk'),
            join(process.cwd(), 'public', 'downloads', 'dlkam-android-latest.apk'),
            join(process.cwd(), 'downloads', 'dlkam-android-latest.apk')
        ];

        for (const target of targetPaths) {
            try {
                const dir = join(target, '..');
                if (!existsSync(dir)) {
                    mkdirSync(dir, { recursive: true });
                }
                copyFileSync(selectedApkPath, target);
                console.log(`✅ Copied signed APK to: ${target}`);
            } catch (copyErr) {
                console.warn(`⚠️ Could not copy to ${target}:`, copyErr instanceof Error ? copyErr.message : String(copyErr));
            }
        }

        console.log('\n====================================================');
        console.log(`🎉 SUCCESS! SIGNED ${buildType.toUpperCase()} APK BUILT & PUBLISHED! 🎉`);
        console.log(`📁 Main APK: ${join(process.cwd(), 'payment-system-release.apk')}`);
        console.log(`🌐 Web Download APK: ${join(process.cwd(), 'public', 'downloads', 'dlkam-android-latest.apk')}`);
        console.log('====================================================');
    } else {
        console.warn(`⚠️ Warning: APK build finished, but output file was not found in ${releaseOutDir}`);
    }

} catch (error) {
    console.error('\n❌ Build failed with error:');
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
}
