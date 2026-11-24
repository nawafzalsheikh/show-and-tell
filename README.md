# Show-and-tell project

A barebones demo of [WaveSurfer.js](https://wavesurfer.xyz) and its Regions plugin:
chop a song into slices and replay the slices in a new order.

Built with React, Vite and `wavesurfer.js` 7.12.12.

## What it does

- Draws an audio file as a waveform.
- Cuts the song into slices. Every slice is a region from the Regions plugin.
- Plays a single slice when you click it or press its number key.
- Plays slices back to back in any order you choose, with an optional loop.

## How to use it

1. On load, the app looks for `public/song.mp3`. If it is there, it loads with 8 slices already cut,
   starting where the drums come in. Otherwise, pick a file with "Choose File".
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
| `src/App.jsx` | The whole page. Creates WaveSurfer and the Regions plugin, makes the slices, and reacts to region events. |
| `src/audio.js` | Plays slices back to back with the Web Audio API so there are no gaps between them. |
| `src/styles.css` | A few lines of plain CSS. |
| `public/song.mp3` | The bundled song (optional). |

## Where the library is used

All of this is in `src/App.jsx`.

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

## Why slices play through the Web Audio API

WaveSurfer plays sound through an audio element. Jumping that element to a new position has a small
delay, which leaves gaps when slices play in a new order. So the app reads each region's start and
end time and schedules the slices with the Web Audio API instead. WaveSurfer and the Regions plugin
still own the waveform and the slices.
