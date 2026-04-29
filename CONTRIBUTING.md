# Contributing to MediCare

Thanks for helping! This repo is an Expo + React Native app using EAS Build.

## Quick start

1. Install dependencies

   ```bash
   npm install
   ```

2. Create local env file

   - Copy your environment variables into `.env` (do not commit it).
   - This project reads Firebase/Google values from `EXPO_PUBLIC_*` variables.

3. Run the app

   ```bash
   npx expo start
   ```

## iOS build help (what we need)

The Android build works; iOS native builds have been failing due to React Native Firebase / CocoaPods / new architecture interactions.

If you can help, please try one of these and share logs:

- EAS iOS simulator build:

  ```bash
  npx eas build -p ios --profile simulator --clear-cache
  ```

- Local compile on macOS (no signing required):

  ```bash
  npm install
  npx expo prebuild -p ios --clean
  cd ios
  pod install
  cd ..
  xcodebuild -workspace ios/*.xcworkspace -scheme MediCare -configuration Debug -sdk iphonesimulator -destination 'platform=iOS Simulator,name=iPhone 15'
  ```

## What to include in an iOS build issue

- macOS version, Xcode version, CocoaPods version
- Whether you are using `newArchEnabled: true`
- The full Xcode or EAS build error (first error + the few lines above it)

## Don’t commit secrets

Please do not commit:

- `.env` files
- any keystore / signing key files (`.jks`, `.p12`, `.key`)
- any service account JSON

If you spot an accidental secret in the repo history, open an issue asking maintainers to rotate it.
