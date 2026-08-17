# Zentral — Unified Apps Grid & Enhanced Tab Groups (Sine Mod Edition)

**Zentral** is a high-performance, feature-packed `userChrome.js` mod for [Zen Browser](https://zen-browser.app/) natively packaged for the **Sine Mod Engine**. It unifies your favorite web applications and tab groups into a sleek, customizable sidebar experience with floating panels, workspace isolation, custom color pickers, and native Sine Mod preference settings.

---

## ✨ Features

### 1. Floating Apps Grid & Panels
- **Grid Layout**: Display web app icons in a responsive sidebar grid or horizontal toolbar.
- **Workspace Isolation**: Right-click any app button to set visibility to **Current Space** or **All Spaces**.
- **Smooth Panel Transitions**: Slide-out panels powered by customizable easing curves (`slide`, `spring-gentle`, `spring-bouncy`, `elastic`).
- **Interactive Controls**: Pin panels, expand to full width, or drag resize handles dynamically.
- **Unread Notification Badges**: Automatic title tracking displays red badges or dot indicators for unread updates.
- **Background Preloading**: Staggered background preloading for instant app access.

### 2. Enhanced Tab Groups
- **Group Color Picker**: Integrated popup color wheel, preset swatches, RGB/Hex inputs, and a native screen eyedropper tool.
- **Initials Badges**: Automatic 2-letter uppercase initials displayed when the sidebar is collapsed.
- **Group Tooltips**: Hover over tab group pills to inspect instant tab lists.
- **State Persistence**: Remembers group hierarchy, nesting, and collapsed states across browser restarts.
- **Folder Conversion**: Seamlessly convert native Zen folders into Tab Groups and vice versa.

### 3. Native Sine Mod Settings & Dynamic Unload
- **Sine Preferences UI**: Customize animation speeds, app row caps, apps per row, and group defaults directly inside Zen Browser's native Sine Mod Settings page.
- **Instant Hot Unload (`supportsUnload: true`)**: Enable or disable Zentral dynamically without restarting Zen Browser.
- **Diagnostic Logging Buffer**: Access integrated logging buffer (`window.ZenzeiLogger`) directly in Web Console.

---

## ⚡ Installation (Sine Mod)

### Option A: Ad Hoc Installation via GitHub URL
1. In Zen Browser, open **Settings** (`ctrl+,`) -> **Mods / Themes**.
2. Click **Install from GitHub / URL** or open the Command Palette.
3. Paste:
   ```text
   https://github.com/Michele501st/Zentral-Sine
   ```
4. Sine will download and install Zentral automatically!

### Option B: Local Sine Installation
1. Clone or copy this repository into your Zen profile's `sine-mods` directory:
   ```text
   <Zen-Profile-Directory>/chrome/sine-mods/zentral/
   ```
2. Restart Zen Browser or enable the mod in **Sine Mod Settings**.

---

## 🛠️ Architecture & Manifest Structure

Zentral is structured for native execution within the Sine Engine:

```text
zentral/
├── theme.json            # Sine Mod manifest (id: "zentral", supportsUnload: true)
├── preferences.json      # Declarative settings controls for Zen Mod UI
├── chrome.css            # Full visual stylesheet
└── JS/
    └── Zentral.uc.js     # Modular engine with dynamic teardown & logging
```

---

## License

Distributed under the [Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International License (CC BY-NC-SA 4.0)](LICENSE).

- **Attribution**: Credit must be given to the original author (Michele Pierini).
- **Non-Commercial**: Strictly forbidden to sell, monetize, or bundle Zentral for commercial gain.
- **ShareAlike**: Modified versions must be shared under the exact same CC BY-NC-SA 4.0 license.
