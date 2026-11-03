import {
  TTSProvider,
  TTSVoice,
  TTSProviderCapabilities,
  TTSSpeakOptions,
  TTSUtterance,
  TTSPreparedUtterance,
  TTSState,
} from './tts-provider'
import urls from '@/functions/urls'

interface AudiobookSegment {
  i: number
  href: string
  charStart: number
  charEnd: number
  start: number
  end: number
  text: string
}

interface AudiobookMetadata {
  available: boolean
  voice?: string
  durationSec?: number
  segmentMode?: string
  segments: AudiobookSegment[]
}

function normalize(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

// Plays a prebuilt audiobook (generated ahead of time, stored as sidecars next
// to the book file) instead of synthesizing speech in real time. Komga serves
// the sync map at /api/v1/books/{id}/audiobook and the MP3 (with HTTP Range)
// at /api/v1/books/{id}/audiobook/file.
//
// The TTSController still drives playback segment by segment, using segments
// it extracted from the EPUB itself - audiobooks are generated with the same
// segmentation rules (smart chunking), so each spoken text maps to exactly one
// sync-map segment with *exact* start/end times. This provider keeps a single
// <audio> element for the whole file and, per segment, seeks to its start and
// stops at its end - timing is never estimated.
export class AudiobookTTSProvider implements TTSProvider {
  readonly id = 'audiobook'
  readonly name = 'Prebuilt Audiobook'
  private _state: TTSState = 'idle'

  private bookId = ''
  private metadata: AudiobookMetadata | null = null
  private fileUrl = ''
  private audio: HTMLAudioElement | null = null
  private watchIntervalId: number | null = null
  private cancelCurrent: (() => void) | null = null
  private lastMatchedIndex = -1

  onBoundary: (event: any) => void = () => {}
  onEnd: () => void = () => {}
  onError: (error: Error) => void = () => {}

  get state(): TTSState {
    return this._state
  }

  async initialize(config: Record<string, any>): Promise<void> {
    this.cancel()
    this.metadata = null
    this.lastMatchedIndex = -1
    this.bookId = config.bookId || ''
    if (!this.bookId) return

    const response = await fetch(`${urls.originNoSlash}/api/v1/books/${this.bookId}/audiobook`, {
      credentials: 'include',
    })
    if (!response.ok) {
      throw new Error(`Audiobook metadata request failed (${response.status})`)
    }
    this.metadata = await response.json()
    this.fileUrl = `${urls.originNoSlash}/api/v1/books/${this.bookId}/audiobook/file`
  }

  getCapabilities(): TTSProviderCapabilities {
    return {
      supportsWordBoundary: false,
      supportsSentenceBoundary: true,
      supportsSSML: false,
      supportsStreaming: false,
      maxChunkLength: Number.MAX_SAFE_INTEGER,
    }
  }

  async getVoices(): Promise<TTSVoice[]> {
    const voice = this.metadata?.voice
    if (!voice) return []
    return [{
      id: voice,
      name: `${voice} (audiobook)`,
      language: 'multi',
      provider: 'audiobook',
      isDefault: true,
    }]
  }

  private findSegment(text: string): AudiobookSegment | null {
    const segments = this.metadata?.segments ?? []
    if (!segments.length) return null
    const target = normalize(text)
    // Search forward from the last matched segment first (playback is
    // overwhelmingly sequential), then wrap around the whole list.
    for (let step = 0; step < segments.length; step++) {
      const candidate = segments[(this.lastMatchedIndex + 1 + step) % segments.length]
      if (normalize(candidate.text) === target) {
        this.lastMatchedIndex = segments.indexOf(candidate)
        return candidate
      }
    }
    return null
  }

  async preload(text: string, options: TTSSpeakOptions): Promise<TTSPreparedUtterance> {
    const segment = this.findSegment(text)
    if (!segment) {
      throw new Error('No audiobook segment matches this text')
    }
    return {
      text,
      options,
      play: () => this.playSegment(segment, options),
      discard: () => {},
    }
  }

  async speak(text: string, options: TTSSpeakOptions): Promise<TTSUtterance> {
    this.cancel()
    const segment = this.findSegment(text)
    if (!segment) {
      const err = new Error('No audiobook segment matches this text')
      this.onError(err)
      return { text, options, promise: Promise.resolve(), cancel: () => {} }
    }
    return this.playSegment(segment, options)
  }

  private playSegment(segment: AudiobookSegment, options: TTSSpeakOptions): Promise<TTSUtterance> {
    this.cancel()
    this._state = 'speaking'

    if (!this.audio) {
      this.audio = new Audio()
    }
    const audio = this.audio
    if (audio.src !== new URL(this.fileUrl, window.location.origin).href) {
      audio.src = this.fileUrl
    }
    // playbackRate is the single owner of speed, as with the server provider:
    // the file was rendered at its natural rate.
    audio.playbackRate = options.rate

    let resolvePromise: () => void
    const promise = new Promise<void>((resolve) => {
      resolvePromise = resolve
    })

    const cleanup = () => {
      if (this.watchIntervalId !== null) {
        clearInterval(this.watchIntervalId)
        this.watchIntervalId = null
      }
      this.cancelCurrent = null
    }

    const finish = () => {
      cleanup()
      audio.pause()
      this._state = 'idle'
      this.onEnd()
      resolvePromise()
    }

    this.cancelCurrent = () => {
      cleanup()
      audio.pause()
      this._state = 'idle'
      resolvePromise()
    }

    // Stop at the segment's exact end. currentTime is media time, so this
    // stays correct at any playbackRate.
    this.watchIntervalId = window.setInterval(() => {
      if (!audio.paused && audio.currentTime >= segment.end - 0.02) {
        finish()
      }
    }, 30)
    audio.onended = () => {
      if (this.cancelCurrent) finish()
    }

    audio.currentTime = segment.start + 0.001
    return audio
      .play()
      .then(() => ({
        text: segment.text,
        options,
        promise,
        cancel: this.cancelCurrent as () => void,
      }))
      .catch((error) => {
        cleanup()
        this._state = 'idle'
        if (error?.name !== 'AbortError') {
          this.onError(error)
        }
        return {
          text: segment.text,
          options,
          promise,
          cancel: () => {},
        }
      })
  }

  pause(): void {
    if (this._state === 'speaking' && this.audio) {
      this.audio.pause()
      this._state = 'paused'
    }
  }

  resume(): void {
    if (this._state === 'paused' && this.audio) {
      this.audio.play()
      this._state = 'speaking'
    }
  }

  cancel(): void {
    if (this.cancelCurrent) {
      this.cancelCurrent()
    }
  }
}
