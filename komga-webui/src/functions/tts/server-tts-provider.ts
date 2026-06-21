import {
  TTSProvider,
  TTSVoice,
  TTSProviderCapabilities,
  TTSBoundaryEvent,
  TTSSpeakOptions,
  TTSUtterance,
  TTSPreparedUtterance,
  TTSState,
} from './tts-provider'
import urls from '@/functions/urls'

const SPEAK_URL = () => `${urls.originNoSlash}/api/v1/tts/speak`
const VOICES_URL = () => `${urls.originNoSlash}/api/v1/tts/voices`

interface APIBoundary {
  word: string
  start: number // in seconds
  end: number   // in seconds
  charIndex: number
  charLength: number
}

interface ApiResponsePayload {
  audio: string // base64 encoded audio
  boundaries?: APIBoundary[]
}

// Shape returned by the OpenAI-compatible GET /v1/voices convention
interface VoicesResponsePayload {
  voices?: string[]
  languages?: string[]
}

function mediaErrorName(code: number): string {
  switch (code) {
    case MediaError.MEDIA_ERR_ABORTED: return 'MEDIA_ERR_ABORTED'
    case MediaError.MEDIA_ERR_NETWORK: return 'MEDIA_ERR_NETWORK'
    case MediaError.MEDIA_ERR_DECODE: return 'MEDIA_ERR_DECODE'
    case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED: return 'MEDIA_ERR_SRC_NOT_SUPPORTED'
    default: return `MEDIA_ERR_UNKNOWN(${code})`
  }
}

// Calls Komga's own backend, which proxies the request to the admin-configured TTS provider.
// The provider's URL and API key live server-side only (Settings > Text-to-Speech) and are
// never sent to the browser.
export class ServerTTSProvider implements TTSProvider {
  readonly id = 'server'
  readonly name = 'Server (admin-configured)'
  private _state: TTSState = 'idle'

  private defaultVoiceId = ''
  private cachedVoices: string[] = []
  private languages: string[] = []
  private metadataLoaded = false

  private audio: HTMLAudioElement | null = null
  private cancelCurrent: (() => void) | null = null
  private boundaries: APIBoundary[] = []
  private activeBoundaryIndex = -1
  private syncIntervalId: number | null = null

  onBoundary: (event: TTSBoundaryEvent) => void = () => {}
  onEnd: () => void = () => {}
  onError: (error: Error) => void = () => {}

  get state(): TTSState {
    return this._state
  }

  async initialize(config: Record<string, any>): Promise<void> {
    this.defaultVoiceId = config.voiceId || ''
    this.metadataLoaded = false
    this.cachedVoices = []
    this.languages = []
  }

  getCapabilities(): TTSProviderCapabilities {
    return {
      supportsWordBoundary: true,
      supportsSentenceBoundary: true,
      supportsSSML: false,
      supportsStreaming: false,
      maxChunkLength: 4096,
    }
  }

  async getVoices(): Promise<TTSVoice[]> {
    await this.loadMetadata()

    if (this.cachedVoices.length) {
      return this.cachedVoices.map((id) => ({
        id,
        name: id,
        language: 'multi',
        provider: 'server',
        isDefault: id === this.defaultVoiceId,
      }))
    }

    // Fall back to a generic guess if the provider has no /v1/voices endpoint
    const voices: TTSVoice[] = []
    if (this.defaultVoiceId) {
      voices.push({ id: this.defaultVoiceId, name: this.defaultVoiceId, language: 'en', provider: 'server', isDefault: true })
    }
    voices.push(
      { id: 'default', name: 'Default Voice', language: 'en', provider: 'server', isDefault: voices.length === 0 },
      { id: 'male', name: 'Male Voice', language: 'en', provider: 'server' },
      { id: 'female', name: 'Female Voice', language: 'en', provider: 'server' },
    )
    return voices
  }

  async getLanguages(): Promise<string[]> {
    await this.loadMetadata()
    return this.languages
  }

  private async loadMetadata(): Promise<void> {
    if (this.metadataLoaded) return
    this.metadataLoaded = true
    try {
      const response = await fetch(VOICES_URL(), { credentials: 'include' })
      if (!response.ok) return
      const payload: VoicesResponsePayload = await response.json()
      this.cachedVoices = payload.voices ?? []
      this.languages = payload.languages ?? []
    } catch (e) {
      // leave caches empty; getVoices() falls back to a generic guess
    }
  }

  // Fetches/synthesizes audio without playing it, so the controller can prepare upcoming
  // sentences while the current one is still playing and mask the request latency.
  async preload(text: string, options: TTSSpeakOptions): Promise<TTSPreparedUtterance> {
    const voiceToUse = options.voice?.id || this.defaultVoiceId || 'default'

    const response = await fetch(SPEAK_URL(), {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        input: text,
        voice: voiceToUse,
        rate: options.rate,
        language: options.language,
      }),
    })

    if (!response.ok) {
      const detail = await response.text().catch(() => '')
      throw new Error(`TTS request failed (${response.status})${detail ? `: ${detail}` : ''}`)
    }

    const contentType = response.headers.get('content-type') || ''
    let audioBlob: Blob
    let boundaries: APIBoundary[]

    if (contentType.includes('application/json')) {
      const payload: ApiResponsePayload = await response.json()

      const binaryString = atob(payload.audio)
      const bytes = new Uint8Array(binaryString.length)
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i)
      }
      audioBlob = new Blob([bytes], { type: 'audio/mpeg' })
      boundaries = payload.boundaries ?? this.estimateBoundaries(text, options.rate)
    } else {
      audioBlob = await response.blob()
      boundaries = this.estimateBoundaries(text, options.rate)
    }

    if (audioBlob.size === 0) {
      throw new Error('TTS provider returned empty audio (0 bytes) - it may have failed to generate audio for this sentence.')
    }

    let discarded = false
    return {
      text,
      options,
      play: () => {
        if (discarded) return Promise.reject(new Error('Cannot play a discarded prepared utterance'))
        return this.playPrepared(text, options, audioBlob, boundaries)
      },
      discard: () => {
        discarded = true
      },
    }
  }

  async speak(text: string, options: TTSSpeakOptions): Promise<TTSUtterance> {
    this.cancel()
    this._state = 'speaking'
    try {
      const prepared = await this.preload(text, options)
      return await prepared.play()
    } catch (error: any) {
      this._state = 'idle'
      if (error?.name !== 'AbortError') {
        this.onError(error)
      }
      return {
        text,
        options,
        promise: Promise.resolve(),
        cancel: () => {},
      }
    }
  }

  private playPrepared(
    text: string,
    options: TTSSpeakOptions,
    audioBlob: Blob,
    boundaries: APIBoundary[],
  ): Promise<TTSUtterance> {
    this.cancel()
    this._state = 'speaking'
    this.boundaries = boundaries

    let resolvePromise: () => void
    let rejectPromise: (err: any) => void

    const promise = new Promise<void>((resolve, reject) => {
      resolvePromise = resolve
      rejectPromise = reject
    })

    const handleCleanUp = () => {
      this.clearSync()
      if (this.audio) {
        // Detach handlers first: setting src = '' below is well known to asynchronously
        // fire its own spurious 'error' event ("Empty src attribute") even after a normal,
        // successful playback - without this, onerror would fire again right after onended
        // for every single sentence and look like a real failure.
        this.audio.onended = null
        this.audio.onerror = null
        this.audio.onplay = null
        this.audio.onpause = null
        this.audio.pause()
        this.audio.src = ''
        this.audio = null
      }
      this._state = 'idle'
      this.cancelCurrent = null
    }

    this.cancelCurrent = () => {
      handleCleanUp()
      resolvePromise()
    }

    const audioUrl = URL.createObjectURL(audioBlob)
    const audio = new Audio(audioUrl)
    this.audio = audio
    audio.playbackRate = options.rate

    audio.onended = () => {
      URL.revokeObjectURL(audioUrl)
      handleCleanUp()
      this.onEnd()
      resolvePromise()
    }

    audio.onerror = () => {
      URL.revokeObjectURL(audioUrl)
      handleCleanUp()
      const mediaError = audio.error
      const detail = mediaError ? ` (${mediaErrorName(mediaError.code)}${mediaError.message ? `: ${mediaError.message}` : ''}, ${audioBlob.size} bytes, ${audioBlob.type || 'unknown type'})` : ''
      const err = new Error(`Audio playback failed${detail}.`)
      this.onError(err)
      rejectPromise(err)
    }

    audio.onplay = () => {
      this.startSync()
    }

    audio.onpause = () => {
      this.clearSync()
    }

    return audio
      .play()
      .then(() => ({
        text,
        options,
        promise,
        cancel: this.cancelCurrent as () => void,
      }))
      .catch((error) => {
        handleCleanUp()
        // AbortError here means OUR OWN cancel()/handleCleanUp() called pause() while this
        // play() request was still pending (e.g. a fast skip or settings change) - that's an
        // expected, intentional cancellation, not a playback failure. Only report real errors.
        if (error?.name !== 'AbortError') {
          this.onError(error)
        }
        return {
          text,
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

  private startSync() {
    this.clearSync()
    this.activeBoundaryIndex = -1

    const tick = () => {
      if (!this.audio) return

      const currentTime = this.audio.currentTime
      const matchIndex = this.boundaries.findIndex(
        (b) => currentTime >= b.start && currentTime <= b.end,
      )

      if (matchIndex !== -1 && matchIndex !== this.activeBoundaryIndex) {
        this.activeBoundaryIndex = matchIndex
        const boundary = this.boundaries[matchIndex]
        this.onBoundary({
          type: 'word',
          charIndex: boundary.charIndex,
          charLength: boundary.charLength,
          elapsedTime: currentTime * 1000,
        })
      }
    }

    this.syncIntervalId = window.setInterval(tick, 50)
  }

  private clearSync() {
    if (this.syncIntervalId !== null) {
      clearInterval(this.syncIntervalId)
      this.syncIntervalId = null
    }
  }

  /**
   * Estimate word boundaries from character lengths when the provider doesn't return
   * its own timing. Standard English reading rate is roughly 150-180 words per minute.
   */
  private estimateBoundaries(text: string, rate: number): APIBoundary[] {
    const words = text.split(/(\s+)/)
    const boundaries: APIBoundary[] = []

    const baseWpm = 160
    const wpm = baseWpm * rate
    const charsPerSecond = (wpm * 5) / 60

    let charIndex = 0
    let currentTime = 0.0

    for (const part of words) {
      const partLength = part.length
      if (part.trim() === '') {
        const duration = partLength / charsPerSecond
        charIndex += partLength
        currentTime += duration
        continue
      }

      const duration = partLength / charsPerSecond
      boundaries.push({
        word: part,
        start: currentTime,
        end: currentTime + duration,
        charIndex: charIndex,
        charLength: partLength,
      })

      charIndex += partLength
      currentTime += duration
    }

    return boundaries
  }
}
