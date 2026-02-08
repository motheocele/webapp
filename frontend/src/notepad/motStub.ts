import type { DrawingCommand, NotepadState } from './drawingTypes'

export type MotResponse = {
  replyText: string
  commands: DrawingCommand[]
}

function includesAny(haystack: string, needles: string[]) {
  return needles.some((n) => haystack.includes(n))
}

function px(state: NotepadState, fx: number, fy: number) {
  return {
    x: Math.round(state.canvas.width * fx),
    y: Math.round(state.canvas.height * fy),
  }
}

export function motRespond(message: string, state: NotepadState): MotResponse {
  const raw = message.trim()
  const m = raw.toLowerCase()

  if (m.length === 0) {
    return {
      replyText: 'Give me something to draw (e.g. “draw a house”, “draw a circle”, “write hello”).',
      commands: [],
    }
  }

  if (includesAny(m, ['clear canvas', 'clear', 'erase everything', 'reset'])) {
    return {
      replyText: 'Clearing the canvas.',
      commands: [{ kind: 'clear' }],
    }
  }

  // write/label text
  const writeMatch = raw.match(/\b(write|text)\s+(.+)/i)
  if (writeMatch) {
    const text = writeMatch[2].trim().replace(/^"|"$/g, '')
    const p = px(state, 0.08, 0.08)
    return {
      replyText: `Writing “${text}”.`,
      commands: [
        {
          kind: 'text',
          x: p.x,
          y: p.y,
          text,
          fontSize: 28,
          color: '#1e3a8a',
        },
      ],
    }
  }

  if (includesAny(m, ['circle', 'draw a circle', 'draw circle'])) {
    return {
      replyText: 'Drawing a circle in the center.',
      commands: [
        {
          kind: 'circle',
          cx: Math.round(state.canvas.width * 0.5),
          cy: Math.round(state.canvas.height * 0.5),
          r: Math.round(Math.min(state.canvas.width, state.canvas.height) * 0.22),
          strokeColor: '#1e3a8a',
          strokeWidth: 4,
          fillColor: 'rgba(30, 58, 138, 0.08)',
        },
      ],
    }
  }

  if (includesAny(m, ['rectangle', 'rect', 'box'])) {
    return {
      replyText: 'Drawing a rectangle.',
      commands: [
        {
          kind: 'rect',
          x: Math.round(state.canvas.width * 0.2),
          y: Math.round(state.canvas.height * 0.25),
          w: Math.round(state.canvas.width * 0.6),
          h: Math.round(state.canvas.height * 0.45),
          strokeColor: '#1e3a8a',
          strokeWidth: 4,
          fillColor: 'rgba(30, 58, 138, 0.06)',
        },
      ],
    }
  }

  if (includesAny(m, ['house', 'draw a house', 'draw house'])) {
    return {
      replyText: 'Drawing a simple house (base + roof + door).',
      commands: [
        {
          kind: 'rect',
          x: Math.round(state.canvas.width * 0.25),
          y: Math.round(state.canvas.height * 0.45),
          w: Math.round(state.canvas.width * 0.5),
          h: Math.round(state.canvas.height * 0.35),
          strokeColor: '#1e3a8a',
          strokeWidth: 4,
          fillColor: 'rgba(30, 58, 138, 0.04)',
        },
        {
          kind: 'polyline',
          points: [px(state, 0.25, 0.45), px(state, 0.5, 0.2), px(state, 0.75, 0.45)],
          color: '#1e3a8a',
          width: 4,
        },
        {
          kind: 'rect',
          x: Math.round(state.canvas.width * 0.47),
          y: Math.round(state.canvas.height * 0.62),
          w: Math.round(state.canvas.width * 0.06),
          h: Math.round(state.canvas.height * 0.18),
          strokeColor: '#1e3a8a',
          strokeWidth: 3,
          fillColor: 'rgba(30, 58, 138, 0.08)',
        },
      ],
    }
  }

  if (includesAny(m, ['smiley', 'smile', 'face'])) {
    return {
      replyText: 'Smiley coming up.',
      commands: [
        {
          kind: 'circle',
          cx: Math.round(state.canvas.width * 0.5),
          cy: Math.round(state.canvas.height * 0.5),
          r: Math.round(Math.min(state.canvas.width, state.canvas.height) * 0.25),
          strokeColor: '#1e3a8a',
          strokeWidth: 4,
        },
        {
          kind: 'circle',
          cx: Math.round(state.canvas.width * 0.42),
          cy: Math.round(state.canvas.height * 0.45),
          r: Math.round(Math.min(state.canvas.width, state.canvas.height) * 0.03),
          fillColor: '#1e3a8a',
        },
        {
          kind: 'circle',
          cx: Math.round(state.canvas.width * 0.58),
          cy: Math.round(state.canvas.height * 0.45),
          r: Math.round(Math.min(state.canvas.width, state.canvas.height) * 0.03),
          fillColor: '#1e3a8a',
        },
        {
          kind: 'polyline',
          points: [px(state, 0.4, 0.6), px(state, 0.5, 0.67), px(state, 0.6, 0.6)],
          color: '#1e3a8a',
          width: 4,
        },
      ],
    }
  }

  const context = `Currently: ${state.strokes.length} user stroke(s), ${state.motCommands.length} Mot command(s).`

  return {
    replyText: `I can do a few MVP intents right now: “draw a circle”, “draw a house”, “draw a rectangle”, or “write hello”. ${context}`,
    commands: [
      {
        kind: 'text',
        x: Math.round(state.canvas.width * 0.08),
        y: Math.round(state.canvas.height * 0.14),
        text: `Unknown intent: ${raw}`,
        fontSize: 16,
        color: 'rgba(30, 58, 138, 0.9)',
      },
      {
        kind: 'polyline',
        points: [px(state, 0.08, 0.2), px(state, 0.4, 0.2)],
        color: 'rgba(30, 58, 138, 0.35)',
        width: 3,
      },
    ],
  }
}
