import { TTSState, TTSVoice, TTSBoundaryEvent, TTSSpeakOptions, TTSPreparedUtterance } from './tts-provider'
import { TTSProviderRegistry } from './tts-provider-registry'
import { TextExtractor, TextSegment } from './text-extractor'
import { TTSHighlighter } from './tts-highlighter'

// How many upcoming sentences to synthesize ahead of the one currently playing, to mask
// network/generation latency for remote providers. Has no effect on providers that don't
// implement preload() (e.g. browser speech synthesis, which is effectively instant).
const PREFETCH_AHEAD = 2

// A flaky/overloaded remote provider can fail on an individual sentence (bad audio,
// transient timeout) without the provider itself being down. Skip a few failures in a row
// before giving up entirely, so one bad sentence doesn't kill the whole reading session.
const MAX_CONSECUTIVE_FAILURES = 3

export interface TTSControllerOptions {
  locale?: string
  rate?: number
  voice?: TTSVoice
  // explicit speech language sent to the active provider (e.g. "English"); distinct from
  // `locale`, which is only used for client-side sentence segmentation (e.g. "en")
  speechLanguage?: string
  highlightMode?: 'sentence' | 'word' | 'off'
  onStateChange?: (state: TTSState) => void
  onChapterEnd?: () => void
  // Called when the sentence about to be read is off-screen (e.g. a later page in a
  // paginated/columned layout) so the reader can turn the page to keep up with playback.
  onAdvancePage?: () => void
  onProgress?: (progressPercent: number) => void
}

export class TTSController {
  private registry = TTSProviderRegistry.getInstance()
  private highlighter = new TTSHighlighter()
  
  private sentences: TextSegment[] = []
  private currentSentenceIndex = -1
  private doc: Document | null = null
  private activeUtteranceCancel: (() => void) | null = null
  private prefetchCache: Map<number, Promise<TTSPreparedUtterance>> = new Map()
  private prefetchAnchor = -1
  private prefetchInFlight = false
  private consecutiveFailures = 0

  // Config
  private locale = 'en'
  private rate = 1.0
  private voice: TTSVoice | undefined = undefined
  private speechLanguage: string | undefined = undefined
  private highlightMode: 'sentence' | 'word' | 'off' = 'sentence'

  // Callbacks
  private onStateChange?: (state: TTSState) => void
  private onChapterEnd?: () => void
  private onAdvancePage?: () => void
  private onProgress?: (progressPercent: number) => void

  constructor(options: TTSControllerOptions = {}) {
    this.updateOptions(options)
  }

  updateOptions(options: TTSControllerOptions) {
    if (options.locale !== undefined) this.locale = options.locale
    if (options.rate !== undefined) this.rate = options.rate
    if (options.voice !== undefined) this.voice = options.voice
    if (options.speechLanguage !== undefined) this.speechLanguage = options.speechLanguage
    if (options.highlightMode !== undefined) this.highlightMode = options.highlightMode
    if (options.onStateChange) this.onStateChange = options.onStateChange
    if (options.onChapterEnd) this.onChapterEnd = options.onChapterEnd
    if (options.onAdvancePage) this.onAdvancePage = options.onAdvancePage
    if (options.onProgress) this.onProgress = options.onProgress
  }

  get state(): TTSState {
    return this.registry.getActiveProvider().state
  }

  setDocument(doc: Document) {
    // Paginated layouts turn pages by scrolling/transforming within the SAME document
    // (no new resource loaded), and the reader re-reports its location on every such page
    // turn - including ones we ourselves triggered via onAdvancePage. Re-extracting and
    // resetting position on every one of those would constantly yank an active reading
    // session back to the start of the chapter, so a same-document call is a no-op.
    if (doc === this.doc) return

    const wasSpeaking = this.state === 'speaking'
    this.stop()
    this.doc = doc
    this.highlighter.setDocument(doc)

    // Extract new text segments
    const extraction = TextExtractor.extract(doc, this.locale)
    this.sentences = extraction.sentences
    this.currentSentenceIndex = 0

    if (wasSpeaking) {
      this.play()
    }
  }

  // Starts reading from whatever sentence is currently visible on screen instead of the
  // beginning of the chapter - call this when the user explicitly engages TTS mid-chapter.
  // No-op while already speaking, so it can't yank an active session back mid-read.
  syncToVisiblePosition() {
    if (this.state === 'speaking') return
    this.currentSentenceIndex = this.findFirstVisibleSentenceIndex()
  }

  private isRangeVisible(range: Range): boolean {
    const win = this.doc?.defaultView
    if (!win) return false
    const rect = range.getBoundingClientRect()
    return rect.bottom > 0 && rect.top < win.innerHeight && rect.right > 0 && rect.left < win.innerWidth
  }

  private scrollRangeIntoView(range: Range) {
    const container = range.startContainer
    const element = container.nodeType === Node.TEXT_NODE ? container.parentElement : (container as Element)
    element?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }

  private findFirstVisibleSentenceIndex(): number {
    if (!this.doc) return 0
    for (let i = 0; i < this.sentences.length; i++) {
      const range = TextExtractor.createRangeFromPositions(this.doc, this.sentences[i].domPositions)
      if (range && this.isRangeVisible(range)) return i
    }
    return 0
  }

  private clearPrefetchCache() {
    for (const pending of this.prefetchCache.values()) {
      pending.then((prepared) => prepared.discard()).catch(() => {})
    }
    this.prefetchCache.clear()
  }

  // Prefetches at most PREFETCH_AHEAD sentences past `fromIndex`, one request at a time.
  // Many self-hosted TTS servers run a single GPU-bound model behind a lock and can only
  // usefully process one generation at a time anyway - firing a burst of parallel preload
  // requests just queues them up server-side and risks timeouts. A depth-limited pipeline
  // (fetch the next missing one, and once it settles, fetch the one after it) still hides
  // most of the latency, since each fetch overlaps with the playback of the prior sentence.
  private schedulePrefetch(fromIndex: number) {
    this.prefetchAnchor = fromIndex
    this.pumpPrefetch()
  }

  private pumpPrefetch() {
    const provider = this.registry.getActiveProvider()
    if (!provider.preload || this.prefetchInFlight) return

    let target = -1
    for (let i = this.prefetchAnchor + 1; i <= this.prefetchAnchor + PREFETCH_AHEAD; i++) {
      if (i >= this.sentences.length) break
      if (!this.prefetchCache.has(i)) {
        target = i
        break
      }
    }
    if (target === -1) return

    const sentence = this.sentences[target]
    const options: TTSSpeakOptions = {
      voice: this.voice,
      rate: this.rate,
      language: this.speechLanguage,
    }
    this.prefetchInFlight = true
    const pending = provider.preload(sentence.text, options)
    this.prefetchCache.set(target, pending)
    pending
      .catch(() => {
        this.prefetchCache.delete(target)
      })
      .finally(() => {
        this.prefetchInFlight = false
        this.pumpPrefetch()
      })
  }

  play() {
    const provider = this.registry.getActiveProvider()
    if (provider.state === 'paused') {
      provider.resume()
      this.notifyStateChange()
      return
    }

    if (this.sentences.length === 0) {
      if (this.onChapterEnd) this.onChapterEnd()
      return
    }

    if (this.currentSentenceIndex < 0 || this.currentSentenceIndex >= this.sentences.length) {
      this.currentSentenceIndex = 0
    }

    this.consecutiveFailures = 0
    this.readSentence()
  }

  pause() {
    const provider = this.registry.getActiveProvider()
    provider.pause()
    this.notifyStateChange()
  }

  stop() {
    this.cancelActiveSpeech()
    this.clearPrefetchCache()
    this.highlighter.clearAll()
    this.notifyStateChange()
  }

  skipForward() {
    if (this.sentences.length === 0) return
    this.cancelActiveSpeech()
    
    if (this.currentSentenceIndex < this.sentences.length - 1) {
      this.currentSentenceIndex++
      this.readSentence()
    } else {
      // Reached the end of the chapter
      this.stop()
      if (this.onChapterEnd) this.onChapterEnd()
    }
  }

  skipBackward() {
    if (this.sentences.length === 0) return
    this.cancelActiveSpeech()

    if (this.currentSentenceIndex > 0) {
      this.currentSentenceIndex--
      this.readSentence()
    } else {
      this.currentSentenceIndex = 0
      this.readSentence()
    }
  }

  setSpeed(rate: number) {
    this.rate = rate
    this.onSpeakOptionsChanged()
  }

  setVoice(voice: TTSVoice | undefined) {
    this.voice = voice
    this.onSpeakOptionsChanged()
  }

  setSpeechLanguage(language: string | undefined) {
    this.speechLanguage = language
    this.onSpeakOptionsChanged()
  }

  // Any already-prefetched sentences were synthesized with the old voice/rate/language,
  // so drop them and re-prefetch ahead with the new settings.
  private onSpeakOptionsChanged() {
    this.clearPrefetchCache()
    const provider = this.registry.getActiveProvider()
    if (provider.state === 'speaking') {
      // Re-read current sentence with the new settings
      this.readSentence()
    } else if (this.currentSentenceIndex >= 0) {
      this.schedulePrefetch(this.currentSentenceIndex)
    }
  }

  setHighlightMode(mode: 'sentence' | 'word' | 'off') {
    this.highlightMode = mode
    if (mode === 'off') {
      this.highlighter.clearAll()
    } else if (this.state === 'speaking' && this.currentSentenceIndex >= 0) {
      // Re-highlight current sentence
      const sentence = this.sentences[this.currentSentenceIndex]
      if (sentence && this.doc) {
        const sentenceRange = TextExtractor.createRangeFromPositions(this.doc, sentence.domPositions)
        if (sentenceRange) {
          this.highlighter.highlightSentence(sentenceRange)
        }
      }
    }
  }

  getCurrentSentenceText(): string {
    if (this.currentSentenceIndex >= 0 && this.currentSentenceIndex < this.sentences.length) {
      return this.sentences[this.currentSentenceIndex].text
    }
    return ''
  }

  private async readSentence() {
    this.cancelActiveSpeech()

    if (this.currentSentenceIndex < 0 || this.currentSentenceIndex >= this.sentences.length) {
      this.stop()
      if (this.onChapterEnd) this.onChapterEnd()
      return
    }

    const sentence = this.sentences[this.currentSentenceIndex]
    if (!this.doc) return

    // Notify Progress
    if (this.onProgress) {
      const progress = this.sentences.length > 0 ? (this.currentSentenceIndex / this.sentences.length) : 0
      this.onProgress(progress)
    }

    const sentenceRange = TextExtractor.createRangeFromPositions(this.doc, sentence.domPositions)
    if (sentenceRange) {
      // Keep the visible page in sync with what's being read: if this sentence is off-screen
      // (a later page in a paginated/columned layout), turn the page forward; otherwise
      // (e.g. continuous scroll) just scroll it into view.
      if (!this.isRangeVisible(sentenceRange)) {
        if (this.onAdvancePage) {
          this.onAdvancePage()
        } else {
          this.scrollRangeIntoView(sentenceRange)
        }
      } else {
        this.scrollRangeIntoView(sentenceRange)
      }

      if (this.highlightMode !== 'off') {
        this.highlighter.highlightSentence(sentenceRange)
      }
    }

    const provider = this.registry.getActiveProvider()
    provider.onBoundary = (event) => this.handleBoundary(event)
    provider.onEnd = () => {
      this.currentSentenceIndex++
      this.readSentence()
    }
    provider.onError = (err) => {
      // eslint-disable-next-line no-console
      console.error('TTS Controller speak error:', err)
      this.consecutiveFailures++
      if (this.consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
        this.stop()
      } else {
        // Skip this sentence rather than killing the whole session over one bad/flaky response
        this.currentSentenceIndex++
        this.readSentence()
      }
    }

    const speakOptions: TTSSpeakOptions = {
      voice: this.voice,
      rate: this.rate,
      language: this.speechLanguage,
    }

    const index = this.currentSentenceIndex
    const prefetched = this.prefetchCache.get(index)
    this.prefetchCache.delete(index)

    try {
      // Providers set their internal state to 'speaking' synchronously as soon as
      // speak()/play() is invoked (before their first await) - notify only after actually
      // invoking it, so listeners (e.g. the reader UI) see the transition on the first call
      // instead of the stale pre-call state.
      const playPromise = prefetched
        ? (await prefetched).play()
        : provider.speak(sentence.text, speakOptions)
      this.notifyStateChange()
      const utterance = await playPromise
      this.activeUtteranceCancel = utterance.cancel
      this.consecutiveFailures = 0
      // Now that this sentence is playing, synthesize the next few ahead of time.
      this.schedulePrefetch(index)
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('Failed to speak sentence:', e)
      this.consecutiveFailures++
      if (this.consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
        this.stop()
      } else {
        this.currentSentenceIndex++
        this.readSentence()
      }
    }
  }

  private handleBoundary(event: TTSBoundaryEvent) {
    if (this.highlightMode !== 'word' || !this.doc || this.currentSentenceIndex < 0) return

    const sentence = this.sentences[this.currentSentenceIndex]
    if (!sentence) return

    // Find the word matching the boundary index
    const relativeIndex = event.charIndex
    const word = sentence.words.find(
      (w) =>
        relativeIndex >= (w.startCharIndex - sentence.startCharIndex) &&
        relativeIndex <= (w.endCharIndex - sentence.startCharIndex),
    )

    if (word) {
      const wordRange = TextExtractor.createRangeFromPositions(this.doc, word.domPositions)
      if (wordRange) {
        this.highlighter.highlightWord(wordRange)
      }
    }
  }

  private cancelActiveSpeech() {
    if (this.activeUtteranceCancel) {
      this.activeUtteranceCancel()
      this.activeUtteranceCancel = null
    }
    this.registry.getActiveProvider().cancel()
  }

  private notifyStateChange() {
    if (this.onStateChange) {
      this.onStateChange(this.state)
    }
  }
}
