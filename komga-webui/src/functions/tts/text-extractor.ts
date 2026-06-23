export interface DOMTextPosition {
  node: Text
  startOffset: number
  endOffset: number
}

export interface DOMTextRange {
  node: Text
  startOffset: number
  endOffset: number
  flatStart: number
  flatEnd: number
}

export interface TextSegment {
  text: string
  startCharIndex: number
  endCharIndex: number
  domPositions: DOMTextPosition[]
  words: TextSegment[]
}

const BLOCK_TAGS = new Set([
  'P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI', 'BR',
  'TR', 'TD', 'TH', 'BLOCKQUOTE', 'SECTION', 'ARTICLE', 'HEADER',
  'FOOTER', 'NAV', 'ASIDE', 'TITLE', 'CAPTION', 'PRE', 'UL', 'OL',
])

// Tags that hold a unit of actual prose, as opposed to pure layout containers (DIV,
// SECTION, UL...) that just group several of these together - used to chunk text into
// paragraph-sized segments for TTS instead of one sentence at a time.
const PARAGRAPH_TAGS = new Set([
  'P', 'LI', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'BLOCKQUOTE', 'TD', 'TH', 'CAPTION', 'PRE',
])

const IGNORE_TAGS = new Set([
  'SCRIPT', 'STYLE', 'SVG', 'IMG', 'VIDEO', 'AUDIO', 'NOSCRIPT',
  'IFRAME', 'OBJECT', 'EMBED', 'HEAD', 'MAP', 'AREA',
])

export class TextExtractor {
  // 'sentence' sends one sentence per TTS request (current default); 'paragraph' batches a
  // whole paragraph into one request, trading per-word/per-sentence highlight precision for
  // far fewer round trips to the (often self-hosted, latency-sensitive) TTS provider. Word
  // and segment highlighting both still work in paragraph mode - they operate generically on
  // whatever segment was sent, not specifically on sentences.
  static extract(
    doc: Document,
    locale = 'en',
    chunkMode: 'sentence' | 'paragraph' = 'sentence',
  ): { flatText: string; sentences: TextSegment[] } {
    let flatText = ''
    const mappings: DOMTextRange[] = []
    const paragraphRanges: { start: number; end: number }[] = []
    // Guards against nested paragraph-tags (e.g. a <p> inside a <li>) double-counting the
    // same prose as two overlapping paragraph chunks - only the outermost one is tracked.
    let paragraphDepth = 0

    function traverse(node: Node) {
      let isParagraphRoot = false
      let paragraphStart = -1

      if (node.nodeType === Node.ELEMENT_NODE) {
        const element = node as Element
        const tagName = element.tagName.toUpperCase()

        if (IGNORE_TAGS.has(tagName)) {
          return
        }
        if (element.getAttribute('aria-hidden') === 'true') {
          return
        }

        // Add separator spacing for block elements
        if (BLOCK_TAGS.has(tagName) && flatText.length > 0 && !/\s$/.test(flatText)) {
          flatText += ' '
        }

        if (PARAGRAPH_TAGS.has(tagName) && paragraphDepth === 0) {
          isParagraphRoot = true
          paragraphDepth++
          paragraphStart = flatText.length
        }
      }

      if (node.nodeType === Node.TEXT_NODE) {
        const textNode = node as Text
        const val = textNode.nodeValue || ''
        if (val) {
          const start = flatText.length
          const end = start + val.length
          flatText += val
          mappings.push({
            node: textNode,
            startOffset: 0,
            endOffset: val.length,
            flatStart: start,
            flatEnd: end,
          })
        }
      }

      let child = node.firstChild
      while (child) {
        traverse(child)
        child = child.nextSibling
      }

      if (node.nodeType === Node.ELEMENT_NODE) {
        const tagName = (node as Element).tagName.toUpperCase()
        if (BLOCK_TAGS.has(tagName) && flatText.length > 0 && !/\s$/.test(flatText)) {
          flatText += ' '
        }
      }

      if (isParagraphRoot) {
        paragraphDepth--
        if (flatText.length > paragraphStart) {
          paragraphRanges.push({ start: paragraphStart, end: flatText.length })
        }
      }
    }

    if (doc.body) {
      traverse(doc.body)
    }

    const sentences = chunkMode === 'paragraph'
      ? this.segmentParagraphs(flatText, paragraphRanges, mappings, locale)
      : this.segmentSentences(flatText, mappings, locale)
    return { flatText, sentences }
  }

  private static segmentParagraphs(
    flatText: string,
    paragraphRanges: { start: number; end: number }[],
    mappings: DOMTextRange[],
    locale: string,
  ): TextSegment[] {
    const paragraphs: TextSegment[] = []

    for (const { start, end } of paragraphRanges) {
      const text = flatText.slice(start, end).trim()
      if (!text) continue

      const domPositions = this.getDOMPositions(start, end, mappings)
      if (domPositions.length === 0) continue

      const words = this.segmentWords(flatText.slice(start, end), start, mappings, locale)
      paragraphs.push({ text, startCharIndex: start, endCharIndex: end, domPositions, words })
    }

    return paragraphs
  }

  private static getDOMPositions(
    start: number,
    end: number,
    mappings: DOMTextRange[],
  ): DOMTextPosition[] {
    const result: DOMTextPosition[] = []
    
    for (const map of mappings) {
      const intersectStart = Math.max(start, map.flatStart)
      const intersectEnd = Math.min(end, map.flatEnd)
      
      if (intersectStart < intersectEnd) {
        const nodeStartOffset = intersectStart - map.flatStart + map.startOffset
        const nodeEndOffset = intersectEnd - map.flatStart + map.startOffset
        result.push({
          node: map.node,
          startOffset: nodeStartOffset,
          endOffset: nodeEndOffset,
        })
      }
    }
    
    return result
  }

  private static segmentSentences(
    flatText: string,
    mappings: DOMTextRange[],
    locale: string,
  ): TextSegment[] {
    const sentenceList: { segment: string; index: number }[] = []

    // Attempt to use Intl.Segmenter
    if (typeof Intl !== 'undefined' && (Intl as any).Segmenter) {
      try {
        const segmenter = new (Intl as any).Segmenter(locale, { granularity: 'sentence' })
        const segments = segmenter.segment(flatText)
        for (const s of segments) {
          if (s.segment.trim()) {
            sentenceList.push({
              segment: s.segment,
              index: s.index,
            })
          }
        }
      } catch (e) {
        this.fallbackSentences(flatText, sentenceList)
      }
    } else {
      this.fallbackSentences(flatText, sentenceList)
    }

    const sentences: TextSegment[] = []

    for (const s of sentenceList) {
      const start = s.index
      const end = start + s.segment.length
      const domPositions = this.getDOMPositions(start, end, mappings)
      
      if (domPositions.length > 0) {
        const words = this.segmentWords(s.segment, start, mappings, locale)
        sentences.push({
          text: s.segment,
          startCharIndex: start,
          endCharIndex: end,
          domPositions,
          words,
        })
      }
    }

    return sentences
  }

  // Only used when Intl.Segmenter is unavailable/throws - that path is locale-aware and
  // already handles abbreviations correctly via Unicode sentence-boundary rules.
  private static ABBREVIATIONS = new Set([
    'mr', 'mrs', 'ms', 'dr', 'prof', 'st', 'vs', 'etc', 'jr', 'sr', 'no', 'vol', 'approx',
  ])

  private static fallbackSentences(flatText: string, list: { segment: string; index: number }[]) {
    // Capture each candidate sentence plus the word immediately preceding its terminator,
    // so a trailing abbreviation (e.g. "Dr.") can be detected and treated as a non-boundary.
    const regex = /([^.!?\n\r]*?(\b[A-Za-z]+)?[.!?\n\r]+)(?=\s|$)/g
    let buffer = ''
    let bufferStart = -1
    let match

    const flush = (text: string, index: number) => {
      if (text.trim()) list.push({ segment: text, index })
    }

    while ((match = regex.exec(flatText)) !== null) {
      const segment = match[0]
      const lastWord = match[2]?.toLowerCase()
      const endsAbbreviation = !!lastWord && this.ABBREVIATIONS.has(lastWord) && segment.trimEnd().endsWith('.')

      if (bufferStart === -1) bufferStart = match.index
      buffer += segment

      if (!endsAbbreviation) {
        flush(buffer, bufferStart)
        buffer = ''
        bufferStart = -1
      }
    }

    if (buffer) flush(buffer, bufferStart)
  }

  private static segmentWords(
    sentenceText: string,
    sentenceStartOffset: number,
    mappings: DOMTextRange[],
    locale: string,
  ): TextSegment[] {
    const wordList: { segment: string; index: number }[] = []

    if (typeof Intl !== 'undefined' && (Intl as any).Segmenter) {
      try {
        const segmenter = new (Intl as any).Segmenter(locale, { granularity: 'word' })
        const segments = segmenter.segment(sentenceText)
        for (const s of segments) {
          // Intl.Segmenter includes word-like tokens, we can filter for actual words (non-whitespace/non-punctuation)
          if (s.isWordLike && s.segment.trim()) {
            wordList.push({
              segment: s.segment,
              index: s.index,
            })
          }
        }
      } catch (e) {
        this.fallbackWords(sentenceText, wordList)
      }
    } else {
      this.fallbackWords(sentenceText, wordList)
    }

    const words: TextSegment[] = []

    for (const w of wordList) {
      const start = sentenceStartOffset + w.index
      const end = start + w.segment.length
      const domPositions = this.getDOMPositions(start, end, mappings)
      
      if (domPositions.length > 0) {
        words.push({
          text: w.segment,
          startCharIndex: start,
          endCharIndex: end,
          domPositions,
          words: [],
        })
      }
    }

    return words
  }

  private static fallbackWords(sentenceText: string, list: { segment: string; index: number }[]) {
    // Matches word characters, handles diacritics
    const regex = /[\p{L}\p{N}_]+/gu
    let match
    while ((match = regex.exec(sentenceText)) !== null) {
      list.push({
        segment: match[0],
        index: match.index,
      })
    }
  }

  static createRangeFromPositions(doc: Document, positions: DOMTextPosition[]): Range | null {
    if (positions.length === 0) return null
    try {
      const range = doc.createRange()
      const first = positions[0]
      const last = positions[positions.length - 1]
      
      range.setStart(first.node, first.startOffset)
      range.setEnd(last.node, last.endOffset)
      return range
    } catch (e) {
      return null
    }
  }
}
