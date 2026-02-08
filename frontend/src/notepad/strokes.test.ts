import { describe, expect, it } from 'vitest'
import { clearHistory, commitStroke, createStroke, redo, undo } from './strokes'

describe('strokes history', () => {
  it('undo/redo moves strokes between stacks', () => {
    const h0 = clearHistory()

    const s1 = createStroke({ id: 's1', color: '#000', width: 2, start: { x: 0.1, y: 0.1 } })
    const s2 = createStroke({ id: 's2', color: '#000', width: 2, start: { x: 0.2, y: 0.2 } })

    const h1 = commitStroke(h0, s1)
    const h2 = commitStroke(h1, s2)

    expect(h2.strokes.map((s) => s.id)).toEqual(['s1', 's2'])

    const h3 = undo(h2)
    expect(h3.strokes.map((s) => s.id)).toEqual(['s1'])
    expect(h3.undoneStrokes.map((s) => s.id)).toEqual(['s2'])

    const h4 = redo(h3)
    expect(h4.strokes.map((s) => s.id)).toEqual(['s1', 's2'])
    expect(h4.undoneStrokes).toEqual([])
  })

  it('commit clears redo stack', () => {
    const h0 = clearHistory()
    const s1 = createStroke({ id: 's1', color: '#000', width: 2, start: { x: 0.1, y: 0.1 } })
    const s2 = createStroke({ id: 's2', color: '#000', width: 2, start: { x: 0.2, y: 0.2 } })

    const h1 = commitStroke(h0, s1)
    const h2 = undo(h1)
    expect(h2.undoneStrokes).toHaveLength(1)

    const h3 = commitStroke(h2, s2)
    expect(h3.undoneStrokes).toEqual([])
  })
})
