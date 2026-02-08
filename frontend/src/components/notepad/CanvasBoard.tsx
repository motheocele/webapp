import { useEffect, useMemo, useRef, useState } from 'react'
import type { NotepadState, Stroke, StrokePoint } from '../../notepad/drawingTypes'
import { renderNotepad, resizeCanvasToDisplaySize } from '../../notepad/render'
import { addPoint, commitStroke, createStroke, redo, undo } from '../../notepad/strokes'

type Props = {
  state: NotepadState
  onChange: (next: NotepadState) => void
  onCanvasMetaChange?: (meta: NotepadState['canvas']) => void
  onStrokeCommitted?: (stroke: Stroke) => void
}

function newId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v))
}

function pointFromEvent(canvas: HTMLCanvasElement, state: NotepadState, e: PointerEvent): StrokePoint {
  const rect = canvas.getBoundingClientRect()
  const x = clamp(e.clientX - rect.left, 0, state.canvas.width)
  const y = clamp(e.clientY - rect.top, 0, state.canvas.height)
  return { x, y, t: Date.now() }
}

export default function CanvasBoard({ state, onChange, onCanvasMetaChange, onStrokeCommitted }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [penColor, setPenColor] = useState('#000000')
  const [penWidth, setPenWidth] = useState(4)

  const canUndo = state.strokes.length > 0
  const canRedo = state.undoneStrokes.length > 0

  const drawingRef = useRef<{
    active: boolean
    stroke: Stroke | null
    pointerId: number | null
  }>({
    active: false,
    stroke: null,
    pointerId: null,
  })

  const dpr = useMemo(() => (typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1), [])

  // Resize observer: keep canvas crisp and update canvas meta in state.
  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    const ro = new ResizeObserver(() => {
      const { width, height } = resizeCanvasToDisplaySize(canvas, container, dpr)
      const meta = { width, height, dpr }
      onCanvasMetaChange?.(meta)
      renderNotepad(canvas, { ...state, canvas: meta })
    })
    ro.observe(container)

    // initial
    const { width, height } = resizeCanvasToDisplaySize(canvas, container, dpr)
    const meta = { width, height, dpr }
    if (state.canvas.width !== width || state.canvas.height !== height || state.canvas.dpr !== dpr) {
      onCanvasMetaChange?.(meta)
    }
    renderNotepad(canvas, { ...state, canvas: meta })

    return () => ro.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dpr])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    renderNotepad(canvas, state)
  }, [state])

  useEffect(() => {
    const canvasEl = canvasRef.current
    if (!canvasEl) return
    const canvas = canvasEl

    function onPointerDown(e: PointerEvent) {
      if (e.button !== 0 && e.pointerType === 'mouse') return
      canvas.setPointerCapture(e.pointerId)
      const start = pointFromEvent(canvas, state, e)
      const stroke = createStroke({ id: newId(), color: penColor, width: penWidth, start })
      drawingRef.current = { active: true, stroke, pointerId: e.pointerId }

      // Render live stroke on top by temporarily appending it.
      onChange({ ...state, strokes: [...state.strokes, stroke] })
      e.preventDefault()
    }

    function onPointerMove(e: PointerEvent) {
      const d = drawingRef.current
      if (!d.active || !d.stroke || d.pointerId !== e.pointerId) return
      const p = pointFromEvent(canvas, state, e)
      d.stroke = addPoint(d.stroke, p)
      drawingRef.current = d

      // Replace the last stroke (live) for smooth feedback.
      const strokes = state.strokes.slice(0, -1)
      onChange({ ...state, strokes: [...strokes, d.stroke] })
      e.preventDefault()
    }

    function endPointer(e: PointerEvent) {
      const d = drawingRef.current
      if (!d.active || !d.stroke || d.pointerId !== e.pointerId) return

      // Commit final stroke and clear redo stack.
      const baseHistory = {
        strokes: state.strokes.slice(0, -1),
        undoneStrokes: state.undoneStrokes,
      }
      const history = commitStroke(baseHistory, d.stroke)
      const committed = d.stroke
      onChange({ ...state, strokes: history.strokes, undoneStrokes: history.undoneStrokes })

      drawingRef.current = { active: false, stroke: null, pointerId: null }
      onStrokeCommitted?.(committed)
      e.preventDefault()
    }

    canvas.addEventListener('pointerdown', onPointerDown)
    canvas.addEventListener('pointermove', onPointerMove)
    canvas.addEventListener('pointerup', endPointer)
    canvas.addEventListener('pointercancel', endPointer)

    return () => {
      canvas.removeEventListener('pointerdown', onPointerDown)
      canvas.removeEventListener('pointermove', onPointerMove)
      canvas.removeEventListener('pointerup', endPointer)
      canvas.removeEventListener('pointercancel', endPointer)
    }
  }, [penColor, penWidth, state, onChange, onStrokeCommitted])

  function onClear() {
    onChange({ ...state, strokes: [], undoneStrokes: [], motCommands: [] })
  }

  function onUndo() {
    const h = undo(state)
    onChange({ ...state, ...h })
  }

  function onRedo() {
    const h = redo(state)
    onChange({ ...state, ...h })
  }

  function onExportPng() {
    const canvas = canvasRef.current
    if (!canvas) return

    const url = canvas.toDataURL('image/png')
    const a = document.createElement('a')
    a.href = url
    a.download = `canvas-notepad-${Date.now()}.png`
    a.click()
  }

  return (
    <section className="notepad-canvas" aria-label="Canvas notepad">
      <div className="notepad-canvas__toolbar" aria-label="Canvas controls">
        <label className="np-field">
          <span className="np-field__label">Color</span>
          <input
            aria-label="Pen color"
            type="color"
            value={penColor}
            onChange={(e) => setPenColor(e.target.value)}
          />
        </label>

        <label className="np-field np-field--wide">
          <span className="np-field__label">Width</span>
          <input
            aria-label="Pen width"
            type="range"
            min={1}
            max={20}
            value={penWidth}
            onChange={(e) => setPenWidth(Number(e.target.value))}
          />
          <span className="np-field__value" aria-label="Pen width value">
            {penWidth}
          </span>
        </label>

        <div className="np-actions" role="group" aria-label="Actions">
          <button type="button" className="np-btn" onClick={onClear} title="Clear canvas">
            Clear
          </button>
          <button
            type="button"
            className="np-btn"
            onClick={onUndo}
            disabled={!canUndo}
            title="Undo last stroke"
          >
            Undo
          </button>
          <button
            type="button"
            className="np-btn"
            onClick={onRedo}
            disabled={!canRedo}
            title="Redo"
          >
            Redo
          </button>
          <button
            type="button"
            className="np-btn np-btn--primary"
            onClick={onExportPng}
            title="Export as PNG"
          >
            Export PNG
          </button>
        </div>
      </div>

      <div className="notepad-canvas__surface" ref={containerRef}>
        <canvas
          ref={canvasRef}
          className="notepad-canvas__canvas"
          aria-label="Drawing canvas"
          style={{ touchAction: 'none' }}
        />
      </div>
    </section>
  )
}
