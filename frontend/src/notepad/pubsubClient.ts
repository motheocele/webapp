import { WebPubSubClient } from '@azure/web-pubsub-client'

export type PubSubHandlers = {
  onConnected?: () => void
  onDisconnected?: () => void
  onError?: (err: unknown) => void
  onServerMessage?: (data: unknown) => void
}

export type PubSubConnection = {
  client: WebPubSubClient
  stop: () => Promise<void>
}

export async function connectPubSub(params: {
  url: string
  group: string
  handlers?: PubSubHandlers
}): Promise<PubSubConnection> {
  const client = new WebPubSubClient({
    getClientAccessUrl: async () => params.url,
  })

  client.on('connected', () => params.handlers?.onConnected?.())
  client.on('disconnected', () => params.handlers?.onDisconnected?.())
  client.on('stopped', () => params.handlers?.onDisconnected?.())
  client.on('server-message', (e) => {
    // e.message is string | ArrayBuffer | object depending on server send
    params.handlers?.onServerMessage?.((e as any).message)
  })

  await client.start()
  await client.joinGroup(params.group)

  return {
    client,
    stop: async () => {
      try {
        await client.leaveGroup(params.group)
      } catch {
        // ignore
      }
      await client.stop()
    },
  }
}
