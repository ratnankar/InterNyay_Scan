export type LineInput = { text: string; width: number }
export type BlockInput = { lines: LineInput[] }

const TERMINAL = /[.:;?!।)\]”"']\s*$/
const HYPHEN = /[-‐]\s*$/
const COMMA = /,\s*$/
const LATIN = /[A-Za-z]/
const STARTS_LOWER = /^[a-z(]/

export function blockToText(block: BlockInput): string {
  const lines = block.lines.map(l => ({ text: l.text.trim(), width: l.width })).filter(l => l.text.length > 0)
  if (lines.length === 0) return ''
  const widest = Math.max(...lines.map(l => l.width))
  let out = lines[0].text
  for (let i = 1; i < lines.length; i++) {
    const prev = lines[i - 1]
    const nearFull = prev.width >= widest * 0.9
    const continues = STARTS_LOWER.test(lines[i].text) || COMMA.test(prev.text) || !LATIN.test(prev.text)
    const wrapped = nearFull && !TERMINAL.test(prev.text) && continues
    if (wrapped && HYPHEN.test(prev.text)) {
      out = out.replace(HYPHEN, '') + lines[i].text
    } else {
      out += (wrapped ? ' ' : '\n') + lines[i].text
    }
  }
  return out
}

export function blocksToText(blocks: BlockInput[]): string {
  return blocks
    .map(blockToText)
    .filter(t => t.length > 0)
    .join('\n\n')
}

export function devanagariRatio(text: string): number {
  let letters = 0
  let deva = 0
  for (const ch of text) {
    if (/[\p{L}\p{M}]/u.test(ch)) {
      letters++
      const code = ch.codePointAt(0) ?? 0
      if (code >= 0x0900 && code <= 0x097f) deva++
    }
  }
  return letters === 0 ? 0 : deva / letters
}
