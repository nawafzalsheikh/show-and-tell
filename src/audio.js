// Plays slices of a song back to back with the Web Audio API.
//
// Why this exists: WaveSurfer plays through an <audio> element, and jumping
// that element to a new position is not instant, so playing slices in a new
// order leaves small gaps. Here each slice is scheduled on the audio clock
// instead, so one slice ends exactly where the next begins.
//
// WaveSurfer and the Regions plugin still own the waveform and the slices.
// This file only reads each slice's start and end time.

const FADE = 0.005 // 5 ms fade in and out, hides the click at each cut

export function createSlicePlayer() {
  const ctx = new AudioContext()
  let buffer = null // the whole song, decoded at full quality
  let sources = []
  let timers = []

  async function load(blob) {
    buffer = null
    buffer = await ctx.decodeAudioData(await blob.arrayBuffer())
  }

  function stop() {
    sources.forEach((source) => source.stop())
    sources = []
    timers.forEach(clearTimeout)
    timers = []
  }

  // Schedule one slice to start at audio-clock time `when`.
  function schedule(slice, when) {
    const length = slice.end - slice.start
    const fade = Math.min(FADE, length / 2)

    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0, when)
    gain.gain.linearRampToValueAtTime(1, when + fade)
    gain.gain.setValueAtTime(1, when + length - fade)
    gain.gain.linearRampToValueAtTime(0, when + length)

    const source = ctx.createBufferSource()
    source.buffer = buffer
    source.connect(gain).connect(ctx.destination)
    source.start(when, slice.start, length)
    source.onended = () => {
      sources = sources.filter((s) => s !== source)
    }
    sources.push(source)
  }

  // Run `fn` when the audio clock reaches `when`.
  function at(when, fn) {
    timers.push(setTimeout(fn, Math.max(0, when - ctx.currentTime) * 1000))
  }

  // Play a list of slices [{ start, end }] in order.
  //   shouldLoop() - asked near the end of each pass; return true to go again
  //   onStep(i)    - called as slice i starts, and with -1 when playback ends
  function play(slices, { shouldLoop = () => false, onStep = () => {} } = {}) {
    stop()
    if (!buffer || slices.length === 0) return
    ctx.resume() // browsers keep audio suspended until the user clicks something

    const playPass = (startTime) => {
      let when = startTime
      slices.forEach((slice, i) => {
        schedule(slice, when)
        at(when, () => onStep(i))
        when += slice.end - slice.start
      })
      // Just before this pass ends, either queue the next pass or finish.
      at(when - 0.1, () => {
        if (shouldLoop()) playPass(when)
        else at(when, () => onStep(-1))
      })
    }

    playPass(ctx.currentTime + 0.05)
  }

  return { load, play, stop, close: () => ctx.close() }
}
