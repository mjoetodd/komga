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

    // --epub-highlight is set on this document's root by EpubReader's theme watcher
    // (komga-webui/src/functions/epub-themes.ts) and tracks the active reading theme, so the
    // segment highlight stays legible across all 20 themes x light/dark.
    //
    // The word highlight intentionally does NOT reuse --epub-highlight: it renders on top of
    // (a strict subset of) the segment highlight, so using the same color there makes it
    // completely invisible - the word range would just repaint with an identical color over
    // itself. `::highlight()` only supports a small set of properties (no `filter`, notably),
    // so a fixed, theme-independent, high-contrast color is the simplest way to guarantee the
    // word highlight is visibly distinct from the segment highlight underneath it across all
    // themes, light or dark.
    const style = doc.createElement('style')
    style.id = id
    style.textContent = `
      ::highlight(${SENTENCE_HIGHLIGHT}) {
        background-color: var(--epub-highlight, rgba(66, 133, 244, 0.4));
      }
      ::highlight(${WORD_HIGHLIGHT}) {
        background-color: rgba(255, 196, 0, 0.65);
        color: #1A1A1A;
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
    // Safari/WebKit has a known repaint bug where CSS.highlights.set() on a name that
    // already has a registered Highlight doesn't reliably invalidate the old range's paint -
    // the previous highlight visually lingers alongside the new one. An explicit delete()
    // first forces it to actually repaint instead of relying on set() to replace in place.
    this.win!.CSS.highlights.delete(SENTENCE_HIGHLIGHT)
    this.win!.CSS.highlights.set(SENTENCE_HIGHLIGHT, new Highlight(range))
  }

  highlightWord(range: Range) {
    if (!this.supported) return
    const Highlight = (this.win as any).Highlight
    const highlight = new Highlight(range)
    // Word range is a strict subset of the segment range and must paint on top of it where
    // they overlap - the Highlight API resolves overlaps by priority, default 0 for both.
    highlight.priority = 1
    // See highlightSentence() above re: the explicit delete() for Safari/WebKit.
    this.win!.CSS.highlights.delete(WORD_HIGHLIGHT)
    this.win!.CSS.highlights.set(WORD_HIGHLIGHT, highlight)
    // No scrollIntoView here deliberately: TTSController already keeps the active
    // sentence/paragraph on screen at the segment level (readingMode-aware: page-turn in
    // paginate mode, centered scroll in scroll mode). A second, independent scrollIntoView
    // firing on every single word boundary - many times per segment - fought with D2Reader's
    // own column-scroll positioning in multi-column paginated mode.
  }
}
