// Uses the CSS Custom Highlight API (https://developer.mozilla.org/en-US/docs/Web/API/CSS_custom_highlight_API)
// to highlight ranges without touching the DOM. The previous implementation wrapped ranges
// in <span> elements by splitting text nodes, which permanently mutated the document — every
// sentence/word after the first one in a given text node then had stale pre-computed
// positions pointing at truncated/relocated nodes, silently failing to highlight.
const SENTENCE_HIGHLIGHT = 'komga-tts-sentence'
const WORD_HIGHLIGHT = 'komga-tts-word'

export class TTSHighlighter {
  private win: (Window & { CSS: any }) | null = null
  private supported = false

  setDocument(doc: Document) {
    this.win = doc.defaultView as any
    this.supported = !!(this.win?.CSS?.highlights && (this.win as any).Highlight)
    if (this.supported) {
      this.injectStyles(doc)
    }
  }

  private injectStyles(doc: Document) {
    const id = 'komga-tts-styles'
    if (doc.getElementById(id)) return

    const style = doc.createElement('style')
    style.id = id
    style.textContent = `
      ::highlight(${SENTENCE_HIGHLIGHT}) {
        background-color: rgba(66, 133, 244, 0.18);
      }
      ::highlight(${WORD_HIGHLIGHT}) {
        background-color: rgba(66, 133, 244, 0.38);
      }
      .readium-night-on ::highlight(${SENTENCE_HIGHLIGHT}) {
        background-color: rgba(138, 180, 248, 0.22);
      }
      .readium-night-on ::highlight(${WORD_HIGHLIGHT}) {
        background-color: rgba(138, 180, 248, 0.45);
      }
      .readium-sepia-on ::highlight(${SENTENCE_HIGHLIGHT}) {
        background-color: rgba(183, 128, 64, 0.18);
      }
      .readium-sepia-on ::highlight(${WORD_HIGHLIGHT}) {
        background-color: rgba(183, 128, 64, 0.38);
      }
    `
    doc.head.appendChild(style)
  }

  clearAll() {
    this.clearWordHighlight()
    this.clearSentenceHighlight()
  }

  clearSentenceHighlight() {
    if (this.supported) this.win!.CSS.highlights.delete(SENTENCE_HIGHLIGHT)
  }

  clearWordHighlight() {
    if (this.supported) this.win!.CSS.highlights.delete(WORD_HIGHLIGHT)
  }

  highlightSentence(range: Range) {
    if (!this.supported) return
    const Highlight = (this.win as any).Highlight
    this.win!.CSS.highlights.set(SENTENCE_HIGHLIGHT, new Highlight(range))
  }

  highlightWord(range: Range) {
    if (!this.supported) return
    const Highlight = (this.win as any).Highlight
    this.win!.CSS.highlights.set(WORD_HIGHLIGHT, new Highlight(range))

    const container = range.startContainer
    const element = container.nodeType === Node.TEXT_NODE ? container.parentElement : (container as Element)
    element?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }
}
