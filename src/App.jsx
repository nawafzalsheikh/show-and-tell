import { useEffect, useRef, useState } from 'react'
import WaveSurfer from 'wavesurfer.js'
import RegionsPlugin from 'wavesurfer.js/dist/plugins/regions.esm.js'
import { createSlicePlayer } from './audio.js'

const COLOR = 'rgba(50, 87, 214, 0.2)' // a slice
const ACTIVE = 'rgba(240, 140, 0, 0.45)' // the slice that is playing

// Settings for the bundled song (public/song.mp3): its tempo, and the time
// where the drums come in. Change these if you swap the bundled song.
const DEFAULT_BPM = 90.49
const DEFAULT_START = 21.17

const seconds = (t) => t.toFixed(2) + 's'

export default function App() {
  const containerRef = useRef(null) // the empty <div> WaveSurfer draws into
  const wsRef = useRef(null) // the WaveSurfer instance
  const regionsRef = useRef(null) // the Regions plugin instance
  const playerRef = useRef(null) // the Web Audio slice player (audio.js)
  const loopRef = useRef(false)
  const keysRef = useRef({}) // latest handlers, for the keyboard shortcuts

  const [status, setStatus] = useState('Loading song...')
  const [ready, setReady] = useState(false)
  const [slices, setSlices] = useState([]) // [{ id, start, end }], sorted by start
  const [sequence, setSequence] = useState([]) // slice ids, in playing order
  const [activeId, setActiveId] = useState(null)
  const [loop, setLoop] = useState(false)
  const [songPlaying, setSongPlaying] = useState(false)
  const [bpm, setBpm] = useState(DEFAULT_BPM)
  const [count, setCount] = useState(8)
  const [beats, setBeats] = useState(2)

  // ---------------------------------------------------------------------
  // 1. Create WaveSurfer + the Regions plugin once, when the page loads.
  // ---------------------------------------------------------------------
  useEffect(() => {
    let destroyed = false

    const regions = RegionsPlugin.create()
    const ws = WaveSurfer.create({
      container: containerRef.current,
      height: 140,
      waveColor: '#9aa7b8',
      progressColor: '#3257d6',
      plugins: [regions],
    })
    const player = createSlicePlayer()
    wsRef.current = ws
    regionsRef.current = regions
    playerRef.current = player

    // Whenever a region is created, changed or removed, copy the regions
    // into React state so the slice list below the waveform stays in sync.
    const sync = () => {
      const sorted = [...regions.getRegions()].sort((a, b) => a.start - b.start)
      sorted.forEach((region, i) => region.setContent(String(i + 1)))
      setSlices(sorted.map(({ id, start, end }) => ({ id, start, end })))
      setSequence((ids) => ids.filter((id) => sorted.some((region) => region.id === id)))
    }
    regions.on('region-created', sync)
    regions.on('region-updated', sync)
    regions.on('region-removed', sync)

    // Clicking a slice on the waveform plays just that slice.
    regions.on('region-clicked', (region, e) => {
      e.stopPropagation() // don't also move the playhead to the click
      player.stop()
      region.play(true) // true = stop at the end of the region
    })

    // Dragging on an empty part of the waveform draws a new slice.
    regions.enableDragSelection({ color: COLOR, drag: false })

    ws.on('play', () => setSongPlaying(true))
    ws.on('pause', () => setSongPlaying(false))

    // Load the bundled song, then cut some default slices into it.
    fetch(import.meta.env.BASE_URL + 'song.mp3')
      .then((res) => {
        const isAudio = (res.headers.get('content-type') || '').startsWith('audio')
        if (!res.ok || !isAudio) throw new Error('no bundled song')
        return res.blob()
      })
      .then((blob) => !destroyed && loadSong(blob, 'song.mp3'))
      .then((ok) => {
        if (!ok || destroyed) return
        cutSlices(DEFAULT_START, 8, 2, DEFAULT_BPM)
        ws.setTime(DEFAULT_START)
      })
      .catch(() => !destroyed && setStatus('Choose an MP3 to start.'))

    return () => {
      destroyed = true
      player.stop()
      player.close()
      ws.destroy()
    }
  }, [])

  // ---------------------------------------------------------------------
  // 2. Loading audio
  // ---------------------------------------------------------------------
  async function loadSong(blob, name) {
    const ws = wsRef.current
    stopAll()
    regionsRef.current.clearRegions()
    setReady(false)
    setStatus(`Loading ${name}...`)
    try {
      // WaveSurfer draws and plays the file; the slice player decodes its own copy.
      await Promise.all([ws.loadBlob(blob), playerRef.current.load(blob)])
      if (wsRef.current !== ws) return false // the component was reset meanwhile
      setReady(true)
      setStatus(`${name} (${seconds(ws.getDuration())})`)
      return true
    } catch (err) {
      if (wsRef.current === ws) setStatus(`Could not load ${name}: ${err.message}`)
      return false
    }
  }

  // ---------------------------------------------------------------------
  // 3. Making slices (every slice is a region)
  // ---------------------------------------------------------------------
  const addSlice = (start, end) =>
    regionsRef.current.addRegion({ start, end, color: COLOR, drag: false, resize: true })

  // Replace all slices with `count` equal slices, starting at `from` seconds.
  function cutSlices(from, count, beats, bpm) {
    const length = (60 / bpm) * beats
    const duration = wsRef.current.getDuration()
    stopAll()
    regionsRef.current.clearRegions()
    for (let i = 0; i < count; i++) {
      const start = from + i * length
      if (start + length > duration) break
      addSlice(start, start + length)
    }
  }

  // Cut the slice under the playhead into two slices.
  function splitAtPlayhead() {
    const time = wsRef.current.getCurrentTime()
    const region = regionsRef.current.getRegions().find((r) => r.start < time && time < r.end)
    if (!region) return setStatus('Split: move the playhead inside a slice first.')
    const end = region.end
    region.setOptions({ end: time })
    addSlice(time, end)
  }

  const removeSlice = (id) =>
    regionsRef.current
      .getRegions()
      .find((r) => r.id === id)
      ?.remove()

  // ---------------------------------------------------------------------
  // 4. Playing
  // ---------------------------------------------------------------------
  // Colour the slice that is playing; pass null to clear the highlight.
  function highlight(id) {
    regionsRef.current?.getRegions().forEach((r) => r.setOptions({ color: r.id === id ? ACTIVE : COLOR }))
    setActiveId(id)
  }

  function stopAll() {
    playerRef.current?.stop()
    wsRef.current?.pause()
    highlight(null)
  }

  function togglePlaySong() {
    playerRef.current.stop()
    highlight(null)
    wsRef.current.playPause()
  }

  // Play a list of slices in the given order.
  function playSlices(list, shouldLoop = () => false) {
    wsRef.current.pause()
    playerRef.current.play(list, {
      shouldLoop,
      onStep: (i) => highlight(i < 0 ? null : list[i].id),
    })
  }

  const playSequence = () =>
    playSlices(
      sequence.map((id) => slices.find((s) => s.id === id)).filter(Boolean),
      () => loopRef.current,
    )

  // ---------------------------------------------------------------------
  // 5. Keyboard: 1-9 play a slice, Space plays or pauses the song, S splits
  // ---------------------------------------------------------------------
  keysRef.current = { slices, playSlices, togglePlaySong, splitAtPlayhead }
  useEffect(() => {
    const onKeyDown = (e) => {
      if ((e.target.tagName === 'INPUT' && e.target.type !== 'range') || e.repeat) return
      const { slices, playSlices, togglePlaySong, splitAtPlayhead } = keysRef.current
      const slice = slices[Number(e.key) - 1]
      if (slice) playSlices([slice])
      else if (e.code === 'Space') {
        e.preventDefault()
        togglePlaySong()
      } else if (e.key.toLowerCase() === 's') splitAtPlayhead()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  // ---------------------------------------------------------------------
  // 6. The page
  // ---------------------------------------------------------------------
  const numberOf = (id) => slices.findIndex((s) => s.id === id) + 1

  return (
    <main>
      <h1>Show-and-tell project</h1>
      <p>WaveSurfer.js + the Regions plugin: chop a song into slices and replay them in a new order.</p>

      <p>
        <input
          type="file"
          accept="audio/*"
          onChange={(e) => e.target.files[0] && loadSong(e.target.files[0], e.target.files[0].name)}
        />{' '}
        <span id="status">{status}</span>
      </p>

      <div id="waveform" ref={containerRef} />

      <p>
        <button onClick={togglePlaySong} disabled={!ready}>
          {songPlaying ? 'Pause song' : 'Play song'}
        </button>{' '}
        <button onClick={stopAll} disabled={!ready}>
          Stop
        </button>{' '}
        <label>
          Zoom{' '}
          <input
            type="range"
            min="0"
            max="200"
            defaultValue="0"
            disabled={!ready}
            onChange={(e) => wsRef.current.zoom(Number(e.target.value))}
          />
        </label>
      </p>

      <h2>1. Slice</h2>
      <p>
        Cut <input type="number" min="1" max="32" value={count} onChange={(e) => setCount(Number(e.target.value))} />{' '}
        slices of <input type="number" min="0.25" step="0.25" value={beats} onChange={(e) => setBeats(Number(e.target.value))} />{' '}
        beats at <input type="number" min="30" step="0.01" value={bpm} onChange={(e) => setBpm(Number(e.target.value))} />{' '}
        BPM{' '}
        <button
          disabled={!ready || !(count > 0 && beats > 0 && bpm > 0)}
          onClick={() => cutSlices(wsRef.current.getCurrentTime(), count, beats, bpm)}
        >
          Cut from playhead
        </button>{' '}
        <button onClick={splitAtPlayhead} disabled={!ready}>
          Split at playhead (S)
        </button>{' '}
        <button onClick={() => regionsRef.current.clearRegions()} disabled={!slices.length}>
          Clear slices
        </button>
      </p>
      <p className="hint">
        Click the waveform to move the playhead. Drag on an empty part to draw a slice. Drag a slice's edge to move a
        cut. Click a slice to hear it.
      </p>

      <h2>2. Slices</h2>
      {slices.length === 0 && <p className="hint">No slices yet.</p>}
      <table>
        <tbody>
          {slices.map((slice, i) => (
            <tr key={slice.id} className={slice.id === activeId ? 'active' : ''}>
              <td>
                <b>{i + 1}</b>
              </td>
              <td>
                {seconds(slice.start)} to {seconds(slice.end)}
              </td>
              <td>
                <button onClick={() => playSlices([slice])}>Play{i < 9 ? ` (${i + 1})` : ''}</button>{' '}
                <button onClick={() => setSequence([...sequence, slice.id])}>Add to sequence</button>{' '}
                <button onClick={() => removeSlice(slice.id)}>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>3. Sequence</h2>
      <p id="sequence">
        {sequence.length === 0 && <span className="hint">Empty. Add slices in the order you want to hear them.</span>}
        {sequence.map((id, i) => (
          <button
            key={i}
            className={id === activeId ? 'active' : ''}
            title="Remove from sequence"
            onClick={() => setSequence(sequence.filter((_, j) => j !== i))}
          >
            {numberOf(id)}
          </button>
        ))}
      </p>
      <p>
        <button onClick={playSequence} disabled={!sequence.length}>
          Play sequence
        </button>{' '}
        <button onClick={stopAll} disabled={!ready}>
          Stop
        </button>{' '}
        <label>
          <input
            type="checkbox"
            checked={loop}
            onChange={(e) => {
              loopRef.current = e.target.checked
              setLoop(e.target.checked)
            }}
          />{' '}
          Loop
        </label>{' '}
        <button onClick={() => setSequence([])} disabled={!sequence.length}>
          Clear sequence
        </button>
      </p>
    </main>
  )
}
