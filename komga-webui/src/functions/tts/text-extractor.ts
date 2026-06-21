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

const IGNORE_TAGS = new Set([
  'SCRIPT', 'STYLE', 'SVG', 'IMG', 'VIDEO', 'AUDIO', 'NOSCRIPT',
  'IFRAME', 'OBJECT', 'EMBED', 'HEAD', 'MAP', 'AREA',
])

export class TextExtractor {
  static extract(doc: Document, locale = 'en'): { flatText: string; sentences: TextSegment[] } {
    let flatText = ''
    const mappings: DOMTextRange[] = []

    function traverse(node: Node) {
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
    }

    if (doc.body) {
      traverse(doc.body)
    }

    const sentences = this.segmentSentences(flatText, mappings, locale)
    return { flatText, sentences }
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

  private static fallbackSentences(flatText: string, list: { segment: string; index: number }[]) {
    const regex = /[^.!?\n\r]+[.!?\n\r]*/g
    let match
    while ((match = regex.exec(flatText)) !== null) {
      if (match[0].trim()) {
        list.push({
          segment: match[0],
          index: match.index,
        })
      }
    }
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
