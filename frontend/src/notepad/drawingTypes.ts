export type Unit = number // expected in [0, 1]

export type UnitPoint = {
  x: Unit
  y: Unit
}

export type StrokePoint = UnitPoint & {
  // timestamp in ms (optional; can be used later for velocity smoothing)
  t?: number
}

export type Stroke = {
  id: string
  color: string
  width: number
  points: StrokePoint[]
}

export type LineCommand = {
  kind: 'line'
  from: UnitPoint
  to: UnitPoint
  color?: string
  width?: number
}

export type PolylineCommand = {
  kind: 'polyline'
  points: UnitPoint[]
  color?: string
  width?: number
}

export type RectCommand = {
  kind: 'rect'
  x: Unit
  y: Unit
  w: Unit
  h: Unit
  strokeColor?: string
  strokeWidth?: number
  fillColor?: string
}

export type CircleCommand = {
  kind: 'circle'
  cx: Unit
  cy: Unit
  r: Unit
  strokeColor?: string
  strokeWidth?: number
  fillColor?: string
}

export type TextCommand = {
  kind: 'text'
  x: Unit
  y: Unit
  text: string
  fontSize?: number
  color?: string
}

export type ClearCommand = {
  kind: 'clear'
}

export type DrawingCommand =
  | LineCommand
  | PolylineCommand
  | RectCommand
  | CircleCommand
  | TextCommand
  | ClearCommand

export type ChatMessage = {
  id: string
  role: 'user' | 'mot'
  text: string
}

export type NotepadState = {
  strokes: Stroke[]
  undoneStrokes: Stroke[]
  motCommands: DrawingCommand[]
}
