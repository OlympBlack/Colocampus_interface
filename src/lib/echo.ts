import Echo from 'laravel-echo'
import Pusher from 'pusher-js'
import { API_BASE_URL } from '../services/api'
import { getStoredSession } from '../services/session'

type ChannelAuthorizationData = {
  auth: string
  channel_data?: string
  shared_secret?: string
}

type ChannelAuthorizationCallback = (error: Error | null, data: ChannelAuthorizationData | null) => void

;(window as any).Pusher = Pusher as any

const reverbKey = import.meta.env.VITE_REVERB_APP_KEY as string | undefined

function createNoopEcho(): Echo<'reverb'> {
  const channel = {
    listen: () => channel,
    notification: () => channel,
    stopListening: () => channel,
    here: () => channel,
    joining: () => channel,
    leaving: () => channel,
    unsubscribe: () => {},
  }
  return {
    private: () => channel,
    public: () => channel,
    join: () => channel,
    leave: () => {},
    disconnect: () => {},
  } as unknown as Echo<'reverb'>
}

function createEcho(): Echo<'reverb'> {
  if (!reverbKey) return createNoopEcho()

  return new Echo<'reverb'>({
    broadcaster: 'reverb',
    key: reverbKey,
    wsHost: import.meta.env.VITE_REVERB_HOST || window.location.hostname,
    wsPort: import.meta.env.VITE_REVERB_PORT || 80,
    wssPort: import.meta.env.VITE_REVERB_PORT || 443,
    forceTLS: (import.meta.env.VITE_REVERB_SCHEME || 'http') === 'https',
    enabledTransports: ['ws', 'wss'],
    authorizer: (channel: any) => ({
      authorize: (socketId: string, callback: ChannelAuthorizationCallback) => {
        const token = getStoredSession()?.token
        if (!token) {
          callback(new Error('Session introuvable'), null)
          return
        }

        fetch(`${API_BASE_URL}/broadcasting/auth`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
            Accept: 'application/json',
          },
          body: JSON.stringify({ socket_id: socketId, channel_name: channel.name }),
        })
          .then((response) => response.json())
          .then((data) => callback(null, data))
          .catch((error) => callback(error instanceof Error ? error : new Error(String(error)), null))
      },
    }),
  })
}

export const echo = createEcho()
export const realtimeAvailable = Boolean(reverbKey)
