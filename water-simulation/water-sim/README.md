# H₂O SIM — Water Pollution Simulator

Interactive water body pollution simulation using **Mapbox GL JS** and **Overpass API**.

## Features

- 🗺️ **Live water body loading** — fetches rivers, lakes, canals from OpenStreetMap via Overpass API
- 🎨 **Custom color scale** — configure clean/mild/moderate/severe colors with a color picker
- 🌊 **River segmentation** — rivers are split into independent segments, each colorable separately
- 💧 **Pollution simulation** — pollution spreads downstream, decays naturally, and dilutes with rain
- 🏭 **Spill events** — trigger industrial spills at any selected segment
- 🌧️ **Rain events** — toggle rain to dilute pollution across all segments
- 📊 **Live stats** — segment count, polluted count, average and max score
- ✏️ **Highlight controls** — adjust river line width and opacity live

## Getting Started

```bash
# 1. Install dependencies
npm install

# 2. Copy env file and add your token
cp .env.example .env
# Edit .env → add your Mapbox token (free at mapbox.com)

# 3. Run dev server
npm run dev
```

## Usage

1. Paste your **Mapbox token** in the panel (free from mapbox.com)
2. Set **latitude/longitude** for your region of interest
3. Click **Load Water Bodies** — rivers and lakes appear on the map
4. **Click any segment** to select it
5. Use **Spill** to add pollution, **Clean** to remove it
6. Toggle **Auto-run** to watch pollution spread downstream
7. Toggle **Rain** to simulate dilution
8. Customize **colors** and **line style** in real time

## Project Structure

```
water-simulation/
├── src/
│   ├── App.jsx                   # Main app, state management
│   ├── components/
│   │   ├── MapView.jsx           # Mapbox GL JS integration
│   │   ├── ControlPanel.jsx      # Sidebar UI
│   │   └── Legend.jsx            # Color legend
│   ├── simulation/
│   │   └── engine.js             # Pollution model
│   ├── utils/
│   │   └── overpass.js           # OSM/Overpass API calls
│   └── styles/main.css
├── index.html
├── vite.config.js
└── package.json
```

## Tech Stack

| Package | Purpose |
|---|---|
| `mapbox-gl` | Map rendering, layer management |
| `osmtogeojson` | Convert Overpass API response → GeoJSON |
| `react` | UI state and components |
| `vite` | Dev server and build tool |

## Build for Production

```bash
npm run build
# Output → dist/
```
