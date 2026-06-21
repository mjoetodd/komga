export interface TTSVoice {
  id: string
  name: string
  language: string
  gender?: 'male' | 'female' | 'neutral'
  provider: string
  isDefault?: boolean
}

export interface TTSProviderCapabilities {
  supportsWordBoundary: boolean
  supportsSentenceBoundary: boolean
  supportsSSML: boolean
  supportsStreaming: boolean
  maxChunkLength: number
}

export interface TTSBoundaryEvent {
  type: 'word' | 'sentence'
  charIndex: number
  charLength: number
  elapsedTime: number
}

export interface TTSSpeakOptions {
  voice?: TTSVoice
  rate: number
  pitch?: number
  volume?: number
  language?: string
}

export interface TTSUtterance {
  text: string
  options: TTSSpeakOptions
  promise: Promise<void>
  cancel: () => void
}

// A synthesized-but-not-yet-played utterance, returned by preload(). Lets the controller
// fetch/generate audio for upcoming sentences ahead of time, then start playback instantly
// once it's actually their turn.
export interface TTSPreparedUtterance {
  text: string
  options: TTSSpeakOptions
  play(): Promise<TTSUtterance>
  // Releases any resources (e.g. blob URLs) if this was never played.
  discard(): void
}

export type TTSState = 'idle' | 'speaking' | 'paused'

export interface TTSProvider {
  readonly id: string
  readonly name: string
  readonly state: TTSState

  initialize(config: Record<string, any>): Promise<void>
  getCapabilities(): TTSProviderCapabilities
  getVoices(): Promise<TTSVoice[]>
  // Providers whose backend exposes a language list (e.g. the OpenAI-compatible
  // /v1/voices convention) can implement this; others simply omit it.
  getLanguages?(): Promise<string[]>

  speak(text: string, options: TTSSpeakOptions): Promise<TTSUtterance>
  // Providers with meaningful network/generation latency (e.g. a remote model) can
  // implement this so the controller can synthesize upcoming sentences ahead of time.
  // Providers that are effectively instant (e.g. browser speech synthesis) can omit it.
  preload?(text: string, options: TTSSpeakOptions): Promise<TTSPreparedUtterance>
  pause(): void
  resume(): void
  cancel(): void

  onBoundary: (event: TTSBoundaryEvent) => void
  onEnd: () => void
  onError: (error: Error) => void
}
