import { describe, expect, it } from 'vitest'
import type { DrawingCommand, NotepadState } from './drawingTypes'
import { applyCommands, validateCommands } from './commands'

const canvas = { width: 200, height: 100, dpr: 1 }

describe('validateCommands', () => {
  it('clamps pixel coordinates to canvas bounds and fills defaults', () => {
    const cmds: DrawingCommand[] = [
      {
        kind: 'line',
        from: { x: -10, y: 200 },
        to: { x: 50, y: 50 },
        width: 1000,
      },
    ]

    const out = validateCommands(cmds, canvas)
    expect(out).toHaveLength(1)
    const line = out[0]
    expect(line.kind).toBe('line')
    if (line.kind === 'line') {
      expect(line.from.x).toBe(0)
      expect(line.from.y).toBe(100)
      expect(line.width).toBeLessThanOrEqual(40)
      expect(line.width).toBeGreaterThanOrEqual(1)
      expect(line.color).toBeTruthy()
    }
  })

  it('drops invalid commands safely', () => {
    const cmds = [{ kind: 'polyline', points: [] }] as unknown as DrawingCommand[]
    const out = validateCommands(cmds, canvas)
    expect(out).toEqual([])
  })
})

describe('applyCommands', () => {
  it('applies clear deterministically (preserves canvas meta)', () => {
    const start: NotepadState = {
      canvas,
      strokes: [{ id: 's1', color: '#000', width: 2, points: [{ x: 10, y: 10 }] }],
      undoneStrokes: [],
      motCommands: [{ kind: 'text', x: 10, y: 10, text: 'hi' }],
    }

    const next = applyCommands(start, [
      { kind: 'clear' },
      { kind: 'text', x: 20, y: 20, text: 'after' },
    ])
    expect(next.canvas).toEqual(canvas)
    expect(next.strokes).toHaveLength(0)
    expect(next.undoneStrokes).toHaveLength(0)
    expect(next.motCommands).toHaveLength(1)
    expect(next.motCommands[0]).toMatchObject({ kind: 'text', text: 'after' })
  })
})
