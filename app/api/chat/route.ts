import Anthropic from '@anthropic-ai/sdk'

export const runtime = 'nodejs'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const BASE_SYSTEM = `Eres Zynq, un asistente de IA inteligente y amigable para uso diario. Ayudas con escritura, código, análisis, preguntas, traducciones, y cualquier otra tarea. Sé conciso, directo y útil. Usa markdown cuando ayude.`

function buildSystem(context?: { sessionName?: string; sessionType?: string; transcript?: string; hasImages?: boolean }) {
  if (!context?.sessionName) return BASE_SYSTEM

  const typeLabels: Record<string, string> = {
    class: 'clase', meeting: 'reunión', business: 'sesión de negocio', workshop: 'taller'
  }

  return `Eres Zynq, asistente de estudio IA. Estás ayudando con una ${typeLabels[context.sessionType || ''] || 'sesión'} llamada "${context.sessionName}".

${context.transcript ? `Transcripción de la sesión:\n"""\n${context.transcript.slice(0, 8000)}\n"""` : 'Aún no hay transcripción.'}
${context.hasImages ? '\n[El usuario también ha subido imágenes de la sesión]' : ''}

Responde preguntas sobre el contenido de la sesión. Si te preguntan algo fuera del contexto, también puedes ayudar. Sé específico y referencia el contenido cuando sea relevante. Responde en español.`
}

export async function POST(req: Request) {
  try {
    const { messages, context } = await req.json()
    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response('Bad request', { status: 400 })
    }

    const stream = client.messages.stream({
      model: 'claude-opus-4-8',
      max_tokens: 2048,
      system: buildSystem(context),
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
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'X-Content-Type-Options': 'nosniff' },
    })
  } catch (err) {
    console.error('[chat]', err)
    return new Response('Internal error', { status: 500 })
  }
}
