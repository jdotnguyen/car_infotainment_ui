# car_infotainment_ui
A browser-based concept for a car infotainment system. Version 2 is a touch-first remake inspired by BMW's NBT (iDrive 4/5) era: a dark, widescreen layout with chrome details, a split-screen side panel, and a mock phone-projection (CarPlay-style) mode.

Open `index.html` in any modern browser. No build step and no dependencies (Google Fonts are optional and fall back to system fonts when offline).

## What's in it
* **Main menu**: eight large tiles plus the NBT-style **split screen** on the right (map, entertainment, onboard info, weather). Swipe the panel or use the arrows; toggle it from the status bar.
* **Media / Radio**: FM, SiriusXM, USB and Bluetooth sources, presets (press and hold to store), station and track lists, a scrubbable progress bar, shuffle and repeat. Bluetooth has Music, Podcasts and Books queues.
* **Navigation**: a procedurally drawn "Ottawa-ish" map with 3D tilt, heading-up rotation, drag, pinch or wheel to zoom, and double-tap. Includes routing, turn-by-turn guidance, ETA, a speed limit sign, an on-screen keyboard for destination search and optional spoken guidance. A demo drive runs continuously.
* **Communication**: recents, contacts and keypad, plus a call screen with incoming, mute and minimise to a status-bar pill.
* **Office**: messages (read aloud with the browser's speech engine, quick replies) and today's calendar with "Navigate" buttons.
* **My Vehicle**: tire pressures, fuel and range, a trip computer with a consumption chart, live OBD-II style gauges and service intervals.
* **Check Control**: the original vehicle alerts. Tap to expand; dismiss with ✕ or by swiping left.
* **Settings**: brightness, accent colour (the original **classic red** theme is still there), split screen, EQ, a draggable balance and fader pad, units, time format, navigation options, connections and demo triggers (incoming call, new alert, new message).
* **CarPlay (mock)**: a connection animation, then an app grid, a dashboard, Maps with guidance, Now Playing, Library, Podcasts, Audiobooks, Phone (favourites, recents, contacts, keypad), Messages read-out, Calendar, Settings (light and dark appearance, wallpapers) and a "Vehicle" app to return. Long-press the home button for the voice assistant overlay. All icons are generic, original artwork.

## Hardware keys and shortcuts
Below the screen: BACK · MENU · MEDIA · NAV · TEL · volume − / mute / +. As in a real car, MENU, MEDIA, NAV and TEL leave CarPlay.

Keyboard: `Esc` = back, `↑`/`↓` = volume, `K` = kiosk mode (removes the bezel so the screen fills the window).

URL options: `?kiosk` starts in kiosk mode. `?start=carplay` (or `nav`, `media`, `vehicle`, etc.) opens a screen on launch.

## Design assumptions (carried over from v1)
* The UI only controls entertainment, navigation, communication and vehicle info. Climate stays on physical knobs.
* Touch targets are at least ~48 px on the 1280×480 design canvas, which is about 10 mm or more on a 10.25" screen.
* High-contrast dark theme with a single accent colour for the active state. Red is available for night ergonomics.

## Structure
```
index.html             markup shell + SVG icon sprite
assets/css/app.css     native (NBT-style) UI
assets/css/carplay.css CarPlay mock
assets/js/core.js      settings, formatting, fake data (media, phone, messages, alerts, vehicle)
assets/js/map.js       procedural city, routing, simulated drive, canvas MapView
assets/js/app.js       native UI screens
assets/js/carplay.js   CarPlay mock
assets/js/main.js      boot: scaling, hardware keys, render loop
```

*Not affiliated with BMW or Apple. "CarPlay" is used only to describe the concept, and all data is simulated.*
