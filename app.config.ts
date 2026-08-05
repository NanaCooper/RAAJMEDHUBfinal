import { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => {
  const appName = 'RAAJ Connect';
  const cameraDesc = 'RAAJ Connect uses your camera to scan documents and upload attachments.';
  const photoDesc = 'RAAJ Connect allows you to upload documents and images from your photo library.';
  const micDesc = 'RAAJ Connect uses your microphone for voice notes if required.';

  return {
    ...config,
    name: appName,
    slug: 'MediCare',
    version: '1.0.2',
    orientation: 'default',
    icon: './assets/images/icon.png',
    scheme: 'com.cooper.medicare',
    userInterfaceStyle: 'automatic',
    newArchEnabled: true,
    runtimeVersion: {
      policy: 'appVersion',
    },
    ios: {
      supportsTablet: false,
      bundleIdentifier: 'com.cooper.medicare',
      buildNumber: '1',
      googleServicesFile: './GoogleService-Info.plist',
      infoPlist: {
        CFBundleURLTypes: [
          {
            CFBundleURLSchemes: [
              'com.cooper.medicare',
              'com.googleusercontent.apps.631948568273-fbk4afbh7tcbrt6h4ock3vh2sn19j231',
            ],
          },
          {
            CFBundleURLSchemes: [
              'com.cooper.medicare',
              'com.googleusercontent.apps.631948568273-fbk4afbh7tcbrt6h4ock3vh2sn19j231',
            ],
          },
        ],
        NSCameraUsageDescription: cameraDesc,
        NSPhotoLibraryUsageDescription: photoDesc,
        NSMicrophoneUsageDescription: micDesc,
        ITSAppUsesNonExemptEncryption: false,
      },
    },
    android: {
      adaptiveIcon: {
        backgroundColor: '#E6F4FE',
        foregroundImage: './assets/images/android-icon-foreground.png',
        backgroundImage: './assets/images/android-icon-background.png',
        monochromeImage: './assets/images/android-icon-monochrome.png',
      },
      edgeToEdgeEnabled: true,
      predictiveBackGestureEnabled: false,
      package: 'com.cooper.medicare',
      versionCode: 30,
      googleServicesFile: './google-services.json',
    },
    web: {
      output: 'static',
      favicon: './assets/images/favicon.png',
    },
    extra: {
      googleClientId: '631948568273-fbk4afbh7tcbrt6h4ock3vh2sn19j231.apps.googleusercontent.com',
      geminiApiKey: process.env.EXPO_PUBLIC_GEMINI_API_KEY || '',
      router: {},
      eas: {
        projectId: 'ce56fd7d-9b8c-4a4a-b5cc-1fcc10a92a90',
      },
    },
    plugins: [
      'expo-router',
      [
        'expo-splash-screen',
        {
          image: './assets/images/splash-icon.png',
          imageWidth: 200,
          resizeMode: 'contain',
          backgroundColor: '#ffffff',
          dark: {
            backgroundColor: '#000000',
          },
        },
      ],
      'expo-secure-store',
      'expo-web-browser',
      [
        'expo-notifications',
        {
          icon: './assets/images/icon.png',
        },
      ],
      '@react-native-firebase/app',
      [
        'expo-build-properties',
        {
          ios: {
            useFrameworks: 'static',
            deploymentTarget: '15.1',
            buildReactNativeFromSource: true,
          },
          android: {
            useAndroidX: true,
            enableProguardInReleaseBuilds: true,
            extraMavenRepos: ['../../node_modules/@notifee/react-native/android/libs'],
            enableMinifyInReleaseBuilds: true,
          },
        },
      ],
      '@react-native-google-signin/google-signin',
      './withRNFirebaseStaticFramework.js',
      './withFirebaseAuthSwiftHeaderFix.js',
      './withFirebaseModularDeps.js',
      './withFirebaseNewArchFix.js',
    ],
    experiments: {
      typedRoutes: true,
      reactCompiler: true,
    },
    owner: 'raajmedhub',
    updates: {
      url: 'https://u.expo.dev/ce56fd7d-9b8c-4a4a-b5cc-1fcc10a92a90',
      fallbackToCacheTimeout: 0,
    },
  };
};
