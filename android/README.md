# Mimbula Minerals Telemetry Android Application

A premium, production-ready Android application for **Mimbula Minerals Limited's Processing Department** (developed by Miguel Kaungu). Replicates the complete Distributed Control System (DCS) Telemetry dashboard, custom FOHL recirculating loops, and Gemini-powered smart shift operator reports in a native mobile application.

---

## 📱 Features

1. **Material 3 Display Typography**: Built using high-end glassmorphism panels, Inter-style fluid layouts, and JetBrains Mono code listings.
2. **Animated Splash Screen & Onboarding**: Smooth transitioning visual entries and interactive sliders introducing mobile operators to flow sheet validation checks.
3. **Telemetry Cockpit Dashboard**: Features interactive hydraulic flow routing diagrams (re-routing LP1 feeds to the FOHL plant and showing splits), cylinder level gauges for RAF/ILS/PLS acid ponds, and automated critical alarm banners.
4. **Interactive Verification Spreadsheet**: High-performance grid permitting real-time manual updates, live Wetting Flux calculations ($L/h/m^2$), and range-limit bounds checks.
5. **DCS Simulator Sandbox**: Deviator triggering that updates Room databases instantly (Nominal Steady State, monsoon Storm Surges, pump out alerts, and ILS recirculating states).
6. **Gemini AI Shift Co-Pilot**: Automated operator Shift Log summaries compiling key executive highlights and next-shift safety recommendations, with offline fallback compiler models.
7. **Offline Shift Archive**: Local Room storage list browsing historical entries and synchronization indicators.

---

## 🛠 Tech Stack

- **Primary Language**: Kotlin 1.9.22
- **UI Framework**: Jetpack Compose (Material 3)
- **Architecture Pattern**: MVVM + Clean Architecture with Repository pattern
- **Local Database**: Room DB (Offline storage and sync queues)
- **Dependency Injection**: Dagger Hilt
- **Network Stack**: Retrofit 2 + OkHttp
- **Generative AI**: Google Generative AI Kotlin SDK (Gemini AI Client)

---

## 🚀 Step-by-Step Build & Installation Guide

Follow these steps to compile, run, and export your production Android APK.

### 1. Open in Android Studio
1. Launch **Android Studio** (Hedgehog 2023.1.1 or higher is recommended).
2. Click **Open** or **Import Project**.
3. Select the `/android` directory inside this repository.
4. Allow Android Studio to import the Gradle file structures and compile dependencies.

### 2. Configure Credentials and Keys
To run the **Gemini AI operator shift summarizer**, configure your API Key:
- In `MainActivity.kt` or `AiCoPilotScreen.kt`, input your private Google Gemini API key into the form field, or:
- Create a `.env` file at the root of the Android project:
  ```env
  GEMINI_API_KEY=your_google_gemini_api_key_here
  ```

### 3. Compile & Run the App
- Connect an Android device with **USB Debugging** enabled, or start a Virtual Emulator device.
- Select **`app`** as your run configuration in the toolbar.
- Click the **Run** button (Green Play Icon) or press `Shift + F10`.

### 4. Build Debug APK
To share a debug APK for QA testing:
1. Open the terminal inside Android Studio (or run in root folder):
   ```bash
   ./gradlew assembleDebug
   ```
2. Once successful, find your compiled APK at:
   ```filepath
   app/build/outputs/apk/debug/app-debug.apk
   ```

### 5. Generate Signed Release APK
To compile a signed release APK suitable for distribution:
1. Navigate to the top menu: **Build > Generate Signed Bundle / APK...**
2. Choose **APK** and click **Next**.
3. Create a new KeyStore (if you do not have an existing one) or select your production release KeyStore.
4. Choose **`release`** as the build variant, select Proguard optimizations (R8) if desired, and click **Create**.
5. Once complete, retrieve the signed production APK from:
   ```filepath
   app/build/outputs/apk/release/app-release.apk
   ```

### 6. Publish to Google Play Store
1. Re-run the generation window, choosing **Android App Bundle (AAB)** instead of APK.
2. Compile and locate the generated bundle:
   ```filepath
   app/build/outputs/bundle/release/app-release.aab
   ```
3. Open your **Google Play Console** account.
4. Select your application and navigate to **Production > Releases**.
5. Upload the compiled `app-release.aab` bundle file, specify release tags/notes, and submit for Google Play review!
