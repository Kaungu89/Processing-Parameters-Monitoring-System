# Mimbula Minerals Telemetry PWA (Standalone Website Package)

A production-grade, highly optimized, and offline-resilient Progressive Web App (PWA) client developed for **Mimbula Minerals Limited** (Processing and Hydrometallurgical Leach Pad Department).

This standalone static package is optimized for lightning-fast speeds (Lighthouse > 95) and runs without external framework compilation dependencies—making it ideal for instant deployment on static hosting providers or wrapping into Android/iOS container apps.

## 📂 File Structure

The `/pwa/` folder forms the complete, standalone package:

```text
pwa/
├── index.html          # Core HTML5 semantic template & layout
├── style.css           # Custom responsive glassmorphic styles with Light/Dark themes
├── script.js           # Real-time calculation engine, simulation scenarios, & Web API adapters
├── manifest.json       # Web App Manifest for mobile installation
├── service-worker.js   # Cache-first service worker for full offline resilience
├── 404.html            # Signal disconnect error handler page
├── maintenance.html    # Process calibration/maintenance holding page
├── README.md           # Deployment and testing instructions
└── assets/
    └── logo.svg        # Scalable vectors corporate emblem
```

## 🚀 Key Features Built-In

1. **Cinematic Loading Screen**: Displays smooth progress bar loading states combined with DCS diagnostic terminal logs, resolving on screen entry.
2. **Interactive Flow-Sheet Spreadsheet**: Real-time validation, automatic wetting flux calculation, bounds checking, and validation alerts with instant correction click handles.
3. **PWA Offline Resilience**: A custom Service Worker caches all scripts, stylesheets, markup, and visual SVG emblems. Operators can record logs deep underground or inside remote pits with zero signal strength.
4. **Offline Database & Handover Exports**: Shift records are automatically structured and saved using LocalStorage. You can reload logs, wipe entries, or export reports into structured **CSV sheets** or custom **JSON databases** instantly.
5. **DCS Scenario Sandbox Injectors**: Instant simulation presets (Nominal, Storm Monsoon Flood, Acid Reservoir Depletion, Valve Mechanical Blockage) designed to sync the spreadsheet, levels, and pipes seamlessly.
6. **Hardware Web APIs**:
   - **Speech Synthesis (Voice Alarms)**: Synthesizes browser voice reports of active warnings to keep field crews alert.
   - **Geolocation GPS Tracking**: Resolves operator walk-about coordinates, centered over the actual Mimbula mine location.
   - **Camera Stream (Visual Attachments)**: Accesses mobile camera streams to take visual snap captures of leaking valves or damaged pipelines.

---

## 💻 How to Run Locally

You can run this website on any modern web browser:

1. **Vite Development Server (Default)**:
   Access the PWA directly inside your running development environment:
   ```bash
   http://localhost:3000/pwa/index.html
   ```

2. **Standard Local Host (Alternative)**:
   Because Web App Manifests and Service Workers require secure contexts (HTTPS or localhost) to register, open the PWA using a simple local HTTP server:
   ```bash
   npx serve ./pwa
   ```
   Or open with VS Code's **Live Server** extension.

---

## ☁️ Deployment Instructions

This directory is ready to deploy immediately to any major static host:

### Option 1: GitHub Pages (Free)
1. Commit the `/pwa/` folder to your GitHub repository.
2. Go to **Settings > Pages** inside your repository.
3. Under **Build and deployment**, select **GitHub Actions** or deploy from the specific branch pointing to the `/pwa` folder.
4. Click Save.

### Option 2: Firebase Hosting
1. Install Firebase CLI: `npm install -g firebase-tools`
2. Initialize Firebase inside the project: `firebase init`
3. Specify `pwa` as your public folder.
4. Deploy the site: `firebase deploy`

---

## 📱 Mobile Installation (PWA)

To install this applet directly onto a physical tablet or smartphone:

- **Android (Chrome)**: Open the URL, tap the **three dots** in the top right, and click **"Add to Home Screen"**.
- **iOS (Safari)**: Open the URL, tap the **Share** button in the navigation rail, scroll down, and tap **"Add to Home Screen"**.

Once installed, it operates as a full-screen, standalone application with persistent state and full offline capabilities!
