import { useEffect, useRef, useState } from 'react'
import CanvasBoard from '../components/notepad/CanvasBoard'
import ChatPanel from '../components/notepad/ChatPanel'
import type { ChatMessage, NotepadState } from '../notepad/drawingTypes'
import { applyCommands, validateCommands } from '../notepad/commands'
import { motRespond } from '../notepad/motStub'
import './NotepadPage.css'

function newId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

const initialState: NotepadState = {
  strokes: [],
  undoneStrokes: [],
  motCommands: [],
}

export default function NotepadPage() {
  const [state, setState] = useState<NotepadState>(initialState)
  const [messages, setMessages] = useState<ChatMessage[]>([])

  const stateRef = useRef(state)
  useEffect(() => {
    stateRef.current = state
  }, [state])

  function sendToMot(text: string) {
    const userMsg: ChatMessage = { id: newId(), role: 'user', text }
    setMessages((m) => [...m, userMsg])

    const res = motRespond(text, stateRef.current)
    const motMsg: ChatMessage = { id: newId(), role: 'mot', text: res.replyText }
    setMessages((m) => [...m, motMsg])

    const valid = validateCommands(res.commands)
    setState((s) => applyCommands(s, valid))
  }

  return (
    <div className="notepad-page">
      <div className="notepad-page__canvas">
        <CanvasBoard state={state} onChange={setState} />
      </div>
      <div className="notepad-page__chat">
        <ChatPanel messages={messages} onSend={sendToMot} />
      </div>
    </div>
  )
}
