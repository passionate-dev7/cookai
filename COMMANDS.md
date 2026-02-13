# CookAI - Development Commands Reference

## Quick Start
```bash
# Start development server
npx expo start

# Run on iOS Simulator
npx expo run:ios

# Run on Android Emulator
npx expo run:android
```

---

## iOS Simulator Commands

### List Available Simulators
```bash
xcrun simctl list devices
```

### List Booted (Running) Simulators
```bash
xcrun simctl list devices | grep "Booted"
```

### Boot a Specific Simulator
```bash
xcrun simctl boot "iPhone 16 Pro"
```

### Shutdown Simulator
```bash
xcrun simctl shutdown booted
```

### List Installed Apps on Simulator
```bash
xcrun simctl listapps booted
```

### Find CookAI App
```bash
xcrun simctl listapps booted | grep -A5 "com.cookai.app"
```

### Install App on Simulator
```bash
xcrun simctl install booted ~/Library/Developer/Xcode/DerivedData/CookAI-*/Build/Products/Debug-iphonesimulator/CookAI.app
```

### Launch App on Simulator
```bash
xcrun simctl launch booted com.cookai.app
```

### Uninstall App from Simulator
```bash
xcrun simctl uninstall booted com.cookai.app
```

### Open Simulator App
```bash
open -a Simulator
```

### Take Screenshot of Simulator
```bash
xcrun simctl io booted screenshot ~/Desktop/screenshot.png
```

### Record Video of Simulator
```bash
xcrun simctl io booted recordVideo ~/Desktop/recording.mp4
# Press Ctrl+C to stop recording
```

---

## Expo Commands

### Start Metro Bundler
```bash
npx expo start
```

### Start with Clear Cache
```bash
npx expo start --clear
```

### Start for iOS
```bash
npx expo start --ios
```

### Start for Android
```bash
npx expo start --android
```

### Run on Specific iOS Device
```bash
npx expo run:ios --device "iPhone 16 Pro"
```

### List Available iOS Devices
```bash
npx expo run:ios --device
```

### Prebuild Native Projects
```bash
npx expo prebuild
```

### Prebuild with Clean
```bash
npx expo prebuild --clean
```

### Prebuild iOS Only
```bash
npx expo prebuild --platform ios --clean
```

### Check Expo Doctor (Diagnose Issues)
```bash
npx expo-doctor
```

### Install Dependencies
```bash
npx expo install <package-name>
```

---

## Build Commands

### Build iOS (Xcode)
```bash
cd ios && xcodebuild -workspace CookAI.xcworkspace -scheme CookAI -configuration Debug -destination 'platform=iOS Simulator,name=iPhone 16 Pro' build
```

### Build iOS Release
```bash
cd ios && xcodebuild -workspace CookAI.xcworkspace -scheme CookAI -configuration Release -destination 'platform=iOS Simulator,name=iPhone 16 Pro' build
```

### Clean Xcode Build
```bash
rm -rf ~/Library/Developer/Xcode/DerivedData/CookAI-*
```

### Clean iOS Folder & Rebuild
```bash
rm -rf ios && npx expo prebuild --platform ios --clean
```

### Clean Everything & Rebuild
```bash
rm -rf node_modules ios android
npm install
npx expo prebuild --clean
```

---

## CocoaPods Commands

### Install Pods
```bash
cd ios && pod install
```

### Update Pods
```bash
cd ios && pod update
```

### Clean Pods & Reinstall
```bash
cd ios && rm -rf Pods Podfile.lock && pod install
```

### Update Pod Repo
```bash
cd ios && pod install --repo-update
```

---

## Debugging

### View Metro Bundler Logs
```bash
npx expo start --dev-client
# Then press 'j' to open debugger
```

### View iOS Simulator Logs
```bash
xcrun simctl spawn booted log stream --predicate 'subsystem == "com.cookai.app"'
```

### View All Simulator Logs
```bash
xcrun simctl spawn booted log stream
```

### Open React Native Debugger
```bash
# In Metro bundler, press 'j' or shake device
# Or open: http://localhost:8081/debugger-ui
```

### Check Bundle Size
```bash
npx react-native-bundle-visualizer
```

---

## Supabase Commands

### Login to Supabase
```bash
supabase login
```

### Link Project
```bash
supabase link --project-ref rjdwktallksurmowcvio
```

### Deploy Edge Function
```bash
supabase functions deploy get-video-transcript --project-ref rjdwktallksurmowcvio
```

### List Edge Functions
```bash
supabase functions list --project-ref rjdwktallksurmowcvio
```

### View Function Logs
```bash
supabase functions logs get-video-transcript --project-ref rjdwktallksurmowcvio
```

### Run Migrations
```bash
supabase db push --project-ref rjdwktallksurmowcvio
```

### Generate Types
```bash
supabase gen types typescript --project-id rjdwktallksurmowcvio > src/types/supabase.ts
```

---

## Package Management

### Install Dependencies
```bash
npm install
```

### Add New Package (Expo-compatible)
```bash
npx expo install <package-name>
```

### Add Dev Dependency
```bash
npm install -D <package-name>
```

### Update All Packages
```bash
npm update
```

### Check Outdated Packages
```bash
npm outdated
```

### Clear npm Cache
```bash
npm cache clean --force
```

---

## Git Commands

### Check Status
```bash
git status
```

### Stage All Changes
```bash
git add .
```

### Commit
```bash
git commit -m "message"
```

### Push
```bash
git push origin main
```

---

## Troubleshooting

### Reset Metro Cache
```bash
npx expo start --clear
```

### Reset Watchman
```bash
watchman watch-del-all
```

### Full Clean Reset
```bash
# Stop all processes first
rm -rf node_modules
rm -rf ios
rm -rf android
rm -rf .expo
npm cache clean --force
npm install
npx expo prebuild --clean
```

### Fix iOS Build Issues
```bash
cd ios
rm -rf Pods Podfile.lock
rm -rf ~/Library/Developer/Xcode/DerivedData/CookAI-*
pod install --repo-update
cd ..
npx expo run:ios
```

### Check Node Version
```bash
node --version  # Should be 18+ for Expo SDK 54
```

### Check Expo SDK Version
```bash
npx expo --version
```

---

## Environment Variables

Location: `.env`

```bash
EXPO_PUBLIC_SUPABASE_URL=https://rjdwktallksurmowcvio.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
EXPO_PUBLIC_REVENUECAT_API_KEY_IOS=your-revenuecat-key
EXPO_PUBLIC_OPENROUTER_API_KEY=your-openrouter-key
```

---

## Project Info

- **Bundle ID**: `com.cookai.app`
- **Supabase Project**: `rjdwktallksurmowcvio`
- **iOS Deployment Target**: 16.0
- **Expo SDK**: 54
