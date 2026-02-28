# App Icon Setup Guide

## Overview
This guide will help you set up the EZDine logo as the app icon for both iOS and Android using the `flutter_launcher_icons` package.

---

## 📋 Prerequisites

### Logo Requirements
- **Format**: PNG with transparency
- **Size**: 1024x1024 pixels (minimum)
- **Background**: Transparent or solid color
- **Location**: `assets/images/EZDineLOGO.png`

---

## 🚀 Quick Setup (Automated)

### Step 1: Add Package to pubspec.yaml

Add this to your `pubspec.yaml`:

```yaml
dev_dependencies:
  flutter_test:
    sdk: flutter
  flutter_lints: ^6.0.0
  flutter_launcher_icons: ^0.13.1

flutter_launcher_icons:
  android: true
  ios: true
  image_path: "assets/images/EZDineLOGO.png"
  min_sdk_android: 21
  
  # iOS specific
  ios_content_json: true
  
  # Android adaptive icon (optional - for Android 8.0+)
  adaptive_icon_background: "#FFFFFF"
  adaptive_icon_foreground: "assets/images/EZDineLOGO.png"
  
  # Remove old launcher icon
  remove_alpha_ios: true
```

### Step 2: Run the Generator

```bash
cd apps/mobile
flutter pub get
flutter pub run flutter_launcher_icons
```

### Step 3: Rebuild the App

```bash
# iOS
flutter build ios

# Android
flutter build apk

# Or just run
flutter run
```

---

## 📱 Manual Setup (If Automated Fails)

### iOS Manual Setup

#### 1. Prepare Icon Sizes

You need these sizes for iOS:
- 1024x1024 (App Store)
- 180x180 (iPhone)
- 167x167 (iPad Pro)
- 152x152 (iPad)
- 120x120 (iPhone)
- 87x87 (iPhone)
- 80x80 (iPad)
- 76x76 (iPad)
- 60x60 (iPhone)
- 58x58 (iPhone)
- 40x40 (iPhone/iPad)
- 29x29 (iPhone/iPad)
- 20x20 (iPhone/iPad)

#### 2. Generate Icons

Use an online tool or ImageMagick:

```bash
# Using ImageMagick
cd apps/mobile/assets/images

# Generate all sizes
convert EZDineLOGO.png -resize 1024x1024 icon-1024.png
convert EZDineLOGO.png -resize 180x180 icon-180.png
convert EZDineLOGO.png -resize 167x167 icon-167.png
convert EZDineLOGO.png -resize 152x152 icon-152.png
convert EZDineLOGO.png -resize 120x120 icon-120.png
convert EZDineLOGO.png -resize 87x87 icon-87.png
convert EZDineLOGO.png -resize 80x80 icon-80.png
convert EZDineLOGO.png -resize 76x76 icon-76.png
convert EZDineLOGO.png -resize 60x60 icon-60.png
convert EZDineLOGO.png -resize 58x58 icon-58.png
convert EZDineLOGO.png -resize 40x40 icon-40.png
convert EZDineLOGO.png -resize 29x29 icon-29.png
convert EZDineLOGO.png -resize 20x20 icon-20.png
```

#### 3. Add to Xcode

1. Open `ios/Runner.xcworkspace` in Xcode
2. In the left panel, click on `Runner` → `Runner` → `Assets.xcassets`
3. Click on `AppIcon`
4. Drag and drop each icon to its corresponding slot
5. Save and close Xcode

### Android Manual Setup

#### 1. Prepare Icon Sizes

You need these sizes for Android:
- 192x192 (xxxhdpi)
- 144x144 (xxhdpi)
- 96x96 (xhdpi)
- 72x72 (hdpi)
- 48x48 (mdpi)

#### 2. Generate Icons

```bash
cd apps/mobile/assets/images

# Generate all sizes
convert EZDineLOGO.png -resize 192x192 ic_launcher-xxxhdpi.png
convert EZDineLOGO.png -resize 144x144 ic_launcher-xxhdpi.png
convert EZDineLOGO.png -resize 96x96 ic_launcher-xhdpi.png
convert EZDineLOGO.png -resize 72x72 ic_launcher-hdpi.png
convert EZDineLOGO.png -resize 48x48 ic_launcher-mdpi.png
```

#### 3. Copy to Android Folders

```bash
# Copy to mipmap folders
cp ic_launcher-xxxhdpi.png ../../../android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png
cp ic_launcher-xxhdpi.png ../../../android/app/src/main/res/mipmap-xxhdpi/ic_launcher.png
cp ic_launcher-xhdpi.png ../../../android/app/src/main/res/mipmap-xhdpi/ic_launcher.png
cp ic_launcher-hdpi.png ../../../android/app/src/main/res/mipmap-hdpi/ic_launcher.png
cp ic_launcher-mdpi.png ../../../android/app/src/main/res/mipmap-mdpi/ic_launcher.png
```

---

## 🎨 Recommended: Use Online Icon Generator

### Option 1: AppIcon.co
1. Go to https://www.appicon.co/
2. Upload `assets/images/EZDineLOGO.png`
3. Select iOS and Android
4. Download the generated icons
5. Extract and copy to respective folders

### Option 2: Icon Kitchen
1. Go to https://icon.kitchen/
2. Upload your logo
3. Customize background color
4. Download for iOS and Android
5. Replace existing icons

### Option 3: MakeAppIcon
1. Go to https://makeappicon.com/
2. Upload your logo
3. Download the package
4. Follow their instructions to install

---

## 🔧 Update pubspec.yaml

Add the flutter_launcher_icons configuration:

```yaml
dev_dependencies:
  flutter_test:
    sdk: flutter
  flutter_lints: ^6.0.0
  flutter_launcher_icons: ^0.13.1

flutter_launcher_icons:
  android: true
  ios: true
  image_path: "assets/images/EZDineLOGO.png"
  min_sdk_android: 21
  
  # Adaptive icon for Android 8.0+
  adaptive_icon_background: "#FFFFFF"
  adaptive_icon_foreground: "assets/images/EZDineLOGO.png"
  
  # iOS specific
  remove_alpha_ios: true
```

---

## 🏃 Run the Generator

```bash
# Install dependencies
flutter pub get

# Generate icons
flutter pub run flutter_launcher_icons

# You should see output like:
# ════════════════════════════════════════════
#      FLUTTER LAUNCHER ICONS (v0.13.1)
# ════════════════════════════════════════════
# 
# • Creating default icons Android
# • Overwriting default iOS launcher icon with new icon
# 
# ✓ Successfully generated launcher icons
```

---

## ✅ Verify Installation

### iOS
1. Open `ios/Runner/Assets.xcassets/AppIcon.appiconset/`
2. Check that all icon files are present
3. Open `Contents.json` to verify configuration

### Android
1. Check `android/app/src/main/res/mipmap-*/ic_launcher.png`
2. Verify all density folders have the icon
3. Check `android/app/src/main/AndroidManifest.xml`:
   ```xml
   <application
       android:icon="@mipmap/ic_launcher"
       ...>
   ```

---

## 🧪 Test the Icon

### iOS Simulator
```bash
flutter run -d "iPhone 15"
```
- Close the app
- Check the home screen for the icon

### Android Emulator
```bash
flutter run -d emulator-5554
```
- Close the app
- Check the app drawer for the icon

### Physical Device
```bash
# iOS
flutter run -d "Nehal's iPhone 15"

# Android
flutter run -d <device-id>
```

---

## 🎨 Icon Design Best Practices

### Do's
✅ Use simple, recognizable design
✅ Ensure good contrast
✅ Test on light and dark backgrounds
✅ Use high-resolution source (1024x1024+)
✅ Keep important elements centered
✅ Use consistent branding

### Don'ts
❌ Don't use text (hard to read at small sizes)
❌ Don't use gradients (may not scale well)
❌ Don't use photos (too detailed)
❌ Don't use thin lines (may disappear)
❌ Don't use transparency on Android adaptive icons

---

## 🔄 Adaptive Icons (Android 8.0+)

Android adaptive icons have two layers:
1. **Background**: Solid color or image
2. **Foreground**: Your logo

### Configuration
```yaml
flutter_launcher_icons:
  adaptive_icon_background: "#FFFFFF"  # White background
  adaptive_icon_foreground: "assets/images/EZDineLOGO.png"
```

### Safe Zone
- Keep important elements in the center 66% of the icon
- Outer 33% may be masked by the system

---

## 📱 Platform-Specific Notes

### iOS
- Icons must NOT have transparency (will be rejected)
- Use 1024x1024 for App Store
- Xcode will generate all sizes automatically
- Test on different iOS versions

### Android
- Supports transparency
- Adaptive icons are recommended
- Test on different launchers (Pixel, Samsung, etc.)
- Consider rounded corners

---

## 🐛 Troubleshooting

### Icon Not Showing
1. **Clean build**:
   ```bash
   flutter clean
   flutter pub get
   flutter run
   ```

2. **Uninstall and reinstall**:
   ```bash
   # iOS
   flutter clean
   rm -rf ios/Pods ios/Podfile.lock
   cd ios && pod install && cd ..
   flutter run
   
   # Android
   flutter clean
   flutter run
   ```

3. **Check file paths**:
   - Verify `assets/images/EZDineLOGO.png` exists
   - Check file permissions
   - Ensure file is not corrupted

### Icon Looks Blurry
- Use higher resolution source image (2048x2048)
- Ensure PNG is not compressed
- Check if transparency is causing issues

### Icon Has White Border (iOS)
- Add `remove_alpha_ios: true` to config
- Or manually add background to your logo

### Adaptive Icon Not Working (Android)
- Ensure Android SDK 26+ (Android 8.0+)
- Check `android/app/src/main/res/mipmap-anydpi-v26/`
- Verify `ic_launcher.xml` exists

---

## 📝 Complete Setup Script

Save this as `setup_app_icon.sh`:

```bash
#!/bin/bash

echo "🎨 Setting up EZDine Pro app icon..."

# Navigate to mobile directory
cd apps/mobile

# Add flutter_launcher_icons to pubspec.yaml if not present
if ! grep -q "flutter_launcher_icons" pubspec.yaml; then
    echo "Adding flutter_launcher_icons to pubspec.yaml..."
    # You'll need to add this manually
fi

# Install dependencies
echo "📦 Installing dependencies..."
flutter pub get

# Generate icons
echo "🚀 Generating app icons..."
flutter pub run flutter_launcher_icons

# Clean build
echo "🧹 Cleaning build..."
flutter clean

# Rebuild
echo "🔨 Rebuilding app..."
flutter pub get

echo "✅ App icon setup complete!"
echo "📱 Run 'flutter run' to see the new icon"
```

Make it executable:
```bash
chmod +x setup_app_icon.sh
./setup_app_icon.sh
```

---

## 🎯 Quick Checklist

- [ ] Logo file exists at `assets/images/EZDineLOGO.png`
- [ ] Logo is 1024x1024 or larger
- [ ] Added `flutter_launcher_icons` to `pubspec.yaml`
- [ ] Configured icon settings in `pubspec.yaml`
- [ ] Ran `flutter pub get`
- [ ] Ran `flutter pub run flutter_launcher_icons`
- [ ] Verified icons in iOS Assets.xcassets
- [ ] Verified icons in Android mipmap folders
- [ ] Tested on iOS simulator/device
- [ ] Tested on Android emulator/device
- [ ] Icon looks good on home screen
- [ ] Icon looks good in app drawer
- [ ] Icon looks good on different backgrounds

---

## 📚 Additional Resources

- **Flutter Launcher Icons**: https://pub.dev/packages/flutter_launcher_icons
- **iOS Icon Guidelines**: https://developer.apple.com/design/human-interface-guidelines/app-icons
- **Android Icon Guidelines**: https://developer.android.com/guide/practices/ui_guidelines/icon_design_launcher
- **AppIcon Generator**: https://www.appicon.co/
- **Icon Kitchen**: https://icon.kitchen/

---

**Version**: 1.0.0  
**Last Updated**: February 27, 2026  
**Status**: Ready to Implement  
**Estimated Time**: 10-15 minutes
