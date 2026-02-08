import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import ChatPanel from './ChatPanel'

describe('ChatPanel', () => {
  it('renders messages in order and shows pending bubble', () => {
    render(
      <ChatPanel
        modeLabel="realtime"
        statusLabel="Connected"
        messages={[
          { id: '1', role: 'user', text: 'hi' },
          { id: '2', role: 'mot', text: '', pending: true, requestId: 'r1' },
          { id: '3', role: 'mot', text: 'hello' },
        ]}
        onSend={() => {}}
      />,
    )

    expect(screen.getByText('hi')).toBeInTheDocument()
    expect(screen.getByText('…')).toBeInTheDocument()
    expect(screen.getByText('hello')).toBeInTheDocument()
  })
})
