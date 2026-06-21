import {
  TTSProvider,
  TTSVoice,
  TTSProviderCapabilities,
  TTSBoundaryEvent,
  TTSSpeakOptions,
  TTSUtterance,
  TTSState,
} from './tts-provider'

export class BrowserTTSProvider implements TTSProvider {
  readonly id = 'browser'
  readonly name = 'Browser Built-in'
  private _state: TTSState = 'idle'
  private currentUtterance: SpeechSynthesisUtterance | null = null
  private cancelCurrent: (() => void) | null = null

  onBoundary: (event: TTSBoundaryEvent) => void = () => {}
  onEnd: () => void = () => {}
  onError: (error: Error) => void = () => {}

  get state(): TTSState {
    return this._state
  }

  async initialize(config: Record<string, any>): Promise<void> {
    // No config needed for browser synthesis, but make sure it is available
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      throw new Error('Web Speech API is not supported in this browser.')
    }
  }

  getCapabilities(): TTSProviderCapabilities {
    return {
      supportsWordBoundary: true,
      supportsSentenceBoundary: false, // Browser API normally only emits word boundaries
      supportsSSML: false,
      supportsStreaming: false,
      maxChunkLength: 32768,
    }
  }

  async getVoices(): Promise<TTSVoice[]> {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      return []
    }

    return new Promise((resolve) => {
      const fetchVoices = () => {
        const synthVoices = window.speechSynthesis.getVoices()
        const mapped = synthVoices.map((v) => ({
          id: v.voiceURI,
          name: v.name,
          language: v.lang,
          gender: undefined, // Browser API doesn't specify gender directly
          provider: 'browser',
          isDefault: v.default,
        }))
        resolve(mapped)
      }

      if (window.speechSynthesis.getVoices().length > 0) {
        fetchVoices()
      } else {
        window.speechSynthesis.onvoiceschanged = () => {
          fetchVoices()
          window.speechSynthesis.onvoiceschanged = null
        }
      }
    })
  }

  speak(text: string, options: TTSSpeakOptions): Promise<TTSUtterance> {
    this.cancel()

    this._state = 'speaking'
    const synth = window.speechSynthesis
    const utterance = new SpeechSynthesisUtterance(text)
    this.currentUtterance = utterance

    if (options.voice) {
      const systemVoice = synth.getVoices().find((v) => v.voiceURI === options.voice?.id)
      if (systemVoice) {
        utterance.voice = systemVoice
      }
    }

    // Rate in Web Speech API is 0.1 to 10
    utterance.rate = options.rate
    if (options.pitch !== undefined) utterance.pitch = options.pitch
    if (options.volume !== undefined) utterance.volume = options.volume

    let resolvePromise: () => void
    let rejectPromise: (err: any) => void

    const promise = new Promise<void>((resolve, reject) => {
      resolvePromise = resolve
      rejectPromise = reject
    })

    const handleCleanUp = () => {
      this._state = 'idle'
      this.currentUtterance = null
      this.cancelCurrent = null
    }

    utterance.onend = () => {
      handleCleanUp()
      this.onEnd()
      resolvePromise()
    }

    utterance.onerror = (event: SpeechSynthesisErrorEvent) => {
      if (event.error === 'interrupted' || event.error === 'canceled') {
        handleCleanUp()
        resolvePromise() // Canceled/interrupted is a controlled flow termination
      } else {
        handleCleanUp()
        const err = new Error(`Browser synthesis error: ${event.error}`)
        this.onError(err)
        rejectPromise(err)
      }
    }

    utterance.onboundary = (event: SpeechSynthesisEvent) => {
      if (event.name === 'word') {
        // charLength might not be supported on all browsers, fallback to 0 or calculate
        const length = event.charLength !== undefined ? event.charLength : 0
        this.onBoundary({
          type: 'word',
          charIndex: event.charIndex,
          charLength: length,
          elapsedTime: event.elapsedTime,
        })
      }
    }

    this.cancelCurrent = () => {
      synth.cancel()
      handleCleanUp()
      resolvePromise()
    }

    synth.speak(utterance)

    return Promise.resolve({
      text,
      options,
      promise,
      cancel: this.cancelCurrent,
    })
  }

  pause(): void {
    if (this._state === 'speaking') {
      window.speechSynthesis.pause()
      this._state = 'paused'
    }
  }

  resume(): void {
    if (this._state === 'paused') {
      window.speechSynthesis.resume()
      this._state = 'speaking'
    }
  }

  cancel(): void {
    if (this.cancelCurrent) {
      this.cancelCurrent()
    }
  }
}
