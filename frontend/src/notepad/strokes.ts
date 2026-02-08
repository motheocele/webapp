import type { Stroke, StrokePoint } from './drawingTypes'

export type StrokeHistory = {
  strokes: Stroke[]
  undoneStrokes: Stroke[]
}

export function createStroke(params: {
  id: string
  color: string
  width: number
  start: StrokePoint
}): Stroke {
  return {
    id: params.id,
    color: params.color,
    width: params.width,
    points: [params.start],
  }
}

export function addPoint(stroke: Stroke, point: StrokePoint): Stroke {
  // avoid duplicating identical points
  const last = stroke.points[stroke.points.length - 1]
  if (last && last.x === point.x && last.y === point.y) return stroke
  return { ...stroke, points: [...stroke.points, point] }
}

export function commitStroke(history: StrokeHistory, stroke: Stroke): StrokeHistory {
  return {
    strokes: [...history.strokes, stroke],
    undoneStrokes: [],
  }
}

export function undo(history: StrokeHistory): StrokeHistory {
  if (history.strokes.length === 0) return history
  const nextStrokes = history.strokes.slice(0, -1)
  const last = history.strokes[history.strokes.length - 1]
  return {
    strokes: nextStrokes,
    undoneStrokes: [last, ...history.undoneStrokes],
  }
}

export function redo(history: StrokeHistory): StrokeHistory {
  if (history.undoneStrokes.length === 0) return history
  const [first, ...rest] = history.undoneStrokes
  return {
    strokes: [...history.strokes, first],
    undoneStrokes: rest,
  }
}

export function clearHistory(): StrokeHistory {
  return { strokes: [], undoneStrokes: [] }
}
