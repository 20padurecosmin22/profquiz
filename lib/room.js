'use client';

import { createClient } from '@supabase/supabase-js';

export const topics = {
  down: (pin) => `pq-${pin}`,
  up: (pin) => `pq-${pin}-up`,
  me: (pin, id) => `pq-${pin}-me-${id}`,
};

let client = null;
let clientKey = '';

export function realtime(config) {
  const k = `${config.url}|${config.key}`;
  if (!client || clientKey !== k) {
    client = createClient(config.url, config.key, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      realtime: { params: { eventsPerSecond: 40 } },
    });
    clientKey = k;
  }
  return client;
}

export function joinTopic(sb, topic, handlers, onStatus) {
  const channel = sb.channel(topic, { config: { broadcast: { self: false, ack: true } } });
  for (const [event, fn] of Object.entries(handlers)) {
    channel.on('broadcast', { event }, ({ payload }) => fn(payload));
  }
  channel.subscribe((status) => onStatus && onStatus(status));
  return {
    async send(event, payload) {
      try {
        return await channel.send({ type: 'broadcast', event, payload });
      } catch {
        return 'error';
      }
    },
    close() {
      sb.removeChannel(channel);
    },
  };
}

const postChannels = new Map();

export async function postTo(sb, topic, event, payload) {
  let ch = postChannels.get(topic);
  if (!ch) {
    ch = sb.channel(topic, { config: { broadcast: { self: false } } });
    postChannels.set(topic, ch);
  }
  try {
    const r = await ch.httpSend(event, payload);
    return !!(r && r.success);
  } catch {
    try {
      return (await ch.send({ type: 'broadcast', event, payload })) === 'ok';
    } catch {
      return false;
    }
  }
}

export async function postReliable(sb, topic, event, payload, tries = 3) {
  for (let i = 0; i < tries; i++) {
    if (await postTo(sb, topic, event, payload)) return true;
    await new Promise((res) => setTimeout(res, 400 * (i + 1)));
  }
  return false;
}

export function randomId() {
  const a = new Uint32Array(2);
  crypto.getRandomValues(a);
  return (a[0].toString(36) + a[1].toString(36)).slice(0, 14).padEnd(8, '0');
}
