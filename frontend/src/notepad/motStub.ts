import type { DrawingCommand, NotepadState } from './drawingTypes'

export type MotResponse = {
  replyText: string
  commands: DrawingCommand[]
}

function includesAny(haystack: string, needles: string[]) {
  return needles.some((n) => haystack.includes(n))
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
    return {
      replyText: `Writing “${text}”.`,
      commands: [
        {
          kind: 'text',
          x: 0.08,
          y: 0.08,
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
          cx: 0.5,
          cy: 0.5,
          r: 0.22,
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
          x: 0.2,
          y: 0.25,
          w: 0.6,
          h: 0.45,
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
          x: 0.25,
          y: 0.45,
          w: 0.5,
          h: 0.35,
          strokeColor: '#1e3a8a',
          strokeWidth: 4,
          fillColor: 'rgba(30, 58, 138, 0.04)',
        },
        {
          kind: 'polyline',
          points: [
            { x: 0.25, y: 0.45 },
            { x: 0.5, y: 0.2 },
            { x: 0.75, y: 0.45 },
          ],
          color: '#1e3a8a',
          width: 4,
        },
        {
          kind: 'rect',
          x: 0.47,
          y: 0.62,
          w: 0.06,
          h: 0.18,
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
          cx: 0.5,
          cy: 0.5,
          r: 0.25,
          strokeColor: '#1e3a8a',
          strokeWidth: 4,
        },
        { kind: 'circle', cx: 0.42, cy: 0.45, r: 0.03, fillColor: '#1e3a8a' },
        { kind: 'circle', cx: 0.58, cy: 0.45, r: 0.03, fillColor: '#1e3a8a' },
        {
          kind: 'polyline',
          points: [
            { x: 0.4, y: 0.6 },
            { x: 0.5, y: 0.67 },
            { x: 0.6, y: 0.6 },
          ],
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
        x: 0.08,
        y: 0.14,
        text: `Unknown intent: ${raw}`,
        fontSize: 16,
        color: 'rgba(30, 58, 138, 0.9)',
      },
      {
        kind: 'polyline',
        points: [
          { x: 0.08, y: 0.2 },
          { x: 0.4, y: 0.2 },
        ],
        color: 'rgba(30, 58, 138, 0.35)',
        width: 3,
      },
    ],
  }
}
