import { describe, expect, it } from 'vitest'
import { blocksToText, devanagariRatio } from '../src/ocr/structure'

describe('blocksToText', () => {
  it('joins wrapped lines and keeps short lines apart', () => {
    const text = blocksToText([
      {
        lines: [
          { text: 'The petitioner humbly submits that the order passed by', width: 900 },
          { text: 'the learned court is liable to be set aside.', width: 520 },
        ],
      },
      {
        lines: [
          { text: 'Case No. 1234/2026', width: 400 },
          { text: 'Rouse Avenue Courts', width: 380 },
        ],
      },
    ])
    expect(text).toBe(
      'The petitioner humbly submits that the order passed by the learned court is liable to be set aside.\n\nCase No. 1234/2026\nRouse Avenue Courts',
    )
  })

  it('keeps a line break after terminal punctuation', () => {
    const text = blocksToText([
      {
        lines: [
          { text: 'Date: 22/11/2026.', width: 880 },
          { text: 'Place: New Delhi', width: 600 },
        ],
      },
    ])
    expect(text).toBe('Date: 22/11/2026.\nPlace: New Delhi')
  })

  it('rejoins hyphenated words', () => {
    const text = blocksToText([
      {
        lines: [
          { text: 'The respondent has no jurisdic-', width: 900 },
          { text: 'tion in this matter', width: 500 },
        ],
      },
    ])
    expect(text).toBe('The respondent has no jurisdiction in this matter')
  })

  it('ignores empty blocks', () => {
    expect(blocksToText([{ lines: [{ text: '  ', width: 10 }] }])).toBe('')
  })
})

describe('devanagariRatio', () => {
  it('measures the share of Devanagari letters', () => {
    expect(devanagariRatio('न्यायालय')).toBe(1)
    expect(devanagariRatio('Court')).toBe(0)
    expect(devanagariRatio('Court न्यायालय')).toBeGreaterThan(0.5)
    expect(devanagariRatio('12345')).toBe(0)
  })
})
