import { describe, expect, it } from 'vitest'
import type { DrawingCommand, NotepadState } from './drawingTypes'
import { applyCommands, validateCommands } from './commands'

describe('validateCommands', () => {
  it('clamps unit coordinates to [0,1] and fills defaults', () => {
    const cmds: DrawingCommand[] = [
      {
        kind: 'line',
        from: { x: -10, y: 2 },
        to: { x: 0.5, y: 0.5 },
        width: 1000,
      },
    ]

    const out = validateCommands(cmds)
    expect(out).toHaveLength(1)
    const line = out[0]
    expect(line.kind).toBe('line')
    if (line.kind === 'line') {
      expect(line.from.x).toBe(0)
      expect(line.from.y).toBe(1)
      expect(line.width).toBeLessThanOrEqual(40)
      expect(line.width).toBeGreaterThanOrEqual(1)
      expect(line.color).toBeTruthy()
    }
  })

  it('drops invalid commands safely', () => {
    const cmds = [{ kind: 'polyline', points: [] }] as unknown as DrawingCommand[]
    const out = validateCommands(cmds)
    expect(out).toEqual([])
  })
})

describe('applyCommands', () => {
  it('applies clear deterministically', () => {
    const start: NotepadState = {
      strokes: [{ id: 's1', color: '#000', width: 2, points: [{ x: 0.1, y: 0.1 }] }],
      undoneStrokes: [],
      motCommands: [{ kind: 'text', x: 0.1, y: 0.1, text: 'hi' }],
    }

    const next = applyCommands(start, [
      { kind: 'clear' },
      { kind: 'text', x: 0.2, y: 0.2, text: 'after' },
    ])
    expect(next.strokes).toHaveLength(0)
    expect(next.undoneStrokes).toHaveLength(0)
    expect(next.motCommands).toHaveLength(1)
    expect(next.motCommands[0]).toMatchObject({ kind: 'text', text: 'after' })
  })
})
