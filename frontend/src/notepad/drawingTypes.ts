export type Pixel = number

export type CanvasMeta = {
  width: number // CSS pixels (logical)
  height: number
  dpr: number
}

export type Point = {
  x: Pixel
  y: Pixel
}

export type StrokePoint = Point & {
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
  from: Point
  to: Point
  color?: string
  width?: number
}

export type PolylineCommand = {
  kind: 'polyline'
  points: Point[]
  color?: string
  width?: number
}

export type RectCommand = {
  kind: 'rect'
  x: Pixel
  y: Pixel
  w: Pixel
  h: Pixel
  strokeColor?: string
  strokeWidth?: number
  fillColor?: string
}

export type CircleCommand = {
  kind: 'circle'
  cx: Pixel
  cy: Pixel
  r: Pixel
  strokeColor?: string
  strokeWidth?: number
  fillColor?: string
}

export type TextCommand = {
  kind: 'text'
  x: Pixel
  y: Pixel
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
  requestId?: string
  pending?: boolean
  createdAt?: number
}

export type NotepadState = {
  canvas: CanvasMeta
  strokes: Stroke[]
  undoneStrokes: Stroke[]
  motCommands: DrawingCommand[]
}
