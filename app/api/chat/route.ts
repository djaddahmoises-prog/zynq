import Anthropic from '@anthropic-ai/sdk'

export const runtime = 'nodejs'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const SYSTEM = `You are Zynq, a brilliant and friendly AI assistant built for daily use.
You help with anything: writing, coding, math, research, brainstorming, life advice, translations, and more.
Be concise, clear, and direct. Use markdown when it helps (code blocks, bullet points, bold text).
If you don't know something, say so honestly. Keep responses focused and useful.`

export async function POST(req: Request) {
  try {
    const { messages } = await req.json()
    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response('Bad request', { status: 400 })
    }

    const stream = client.messages.stream({
      model: 'claude-opus-4-8',
      max_tokens: 2048,
      system: SYSTEM,
      messages,
    })

    const encoder = new TextEncoder()
    const readable = new ReadableStream({
      async start(controller) {
        for await (const chunk of stream) {
          if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
            controller.enqueue(encoder.encode(chunk.delta.text))
          }
        }
        controller.close()
      },
      cancel() { stream.abort() },
    })

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch (err) {
    console.error('[chat]', err)
    return new Response('Internal error', { status: 500 })
  }
}
