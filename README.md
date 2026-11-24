# Show-and-tell project

A barebones demo of [WaveSurfer.js](https://wavesurfer.xyz) and its Regions plugin:
chop a song into slices and replay the slices in a new order.

## Run it (WebStorm)

1. Open this folder in WebStorm (File > Open).
2. Open the Terminal tab and run `npm install` (once).
3. Run `npm run dev`, or open `package.json` and click the green arrow next to `dev`.
4. Open the address it prints, normally http://localhost:5173

Needs Node.js 20.19 or newer.

## Use it

1. The bundled song loads with 8 slices already cut, starting where the drums come in.
2. Click a slice on the waveform, or press its number key (1-9), to hear it.
3. Click "Add to sequence" on slices in the order you want, tick Loop, and press "Play sequence".
4. To make your own slices:
   - Click the waveform to move the playhead, then press "Cut from playhead".
   - Drag on an empty part of the waveform to draw a slice.
   - Drag a slice's edge to move a cut.
   - Play a slice, pause inside it (Space), then press S to split it in two.
5. "Choose File" loads any other audio file. Set its BPM yourself.

## Files

| File | What it does |
| --- | --- |
| `src/App.jsx` | The whole page. Creates WaveSurfer and the Regions plugin, makes the slices (every slice is a region), and reacts to region events. |
| `src/audio.js` | Plays slices back to back with the Web Audio API so there are no gaps between them. |
| `src/styles.css` | A few lines of plain CSS. |
| `public/song.mp3` | The bundled song. |

## Where the library is used (in `src/App.jsx`)

| In the app | WaveSurfer / Regions API |
| --- | --- |
| Draw the waveform | `WaveSurfer.create({ container, plugins: [regions] })` |
| Load a song | `ws.loadBlob(file)` |
| Cut slices | `regions.addRegion({ start, end, resize: true })` |
| Draw a slice with the mouse | `regions.enableDragSelection()` |
| Click a slice to hear it | `'region-clicked'` event, then `region.play(true)` |
| Keep the slice list up to date | `'region-created'`, `'region-updated'`, `'region-removed'` events |
| Split a slice | `region.setOptions({ end })`, then `regions.addRegion()` |
| Highlight the playing slice | `region.setOptions({ color })` |
| Play the whole song, zoom | `ws.playPause()`, `ws.zoom()` |

## Deploy

Run `npm run build`. The finished site is the `dist` folder: upload it to any static host
(Netlify, Vercel, GitHub Pages). Paths are relative, so it works from a sub-folder too.

The song in `public/` is copied into `dist` and published with the site. To deploy without it,
delete `public/song.mp3`: the app then starts empty and you load a file with "Choose File".

To bundle a different song, replace `public/song.mp3` and update `DEFAULT_BPM` and
`DEFAULT_START` at the top of `src/App.jsx`.
