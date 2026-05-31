import Anthropic from '@anthropic-ai/sdk'

export const runtime = 'nodejs'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const PROMPTS: Record<string, string> = {
  summary: `Genera un RESUMEN EJECUTIVO claro y estructurado del contenido. Incluye:
- Tema principal
- Puntos clave (máximo 7)
- Conclusiones importantes
Formato: usa bullet points y negrita para destacar conceptos clave. Escribe en español.`,

  studyGuide: `Genera una GUÍA DE ESTUDIO completa y detallada. Incluye:
- Objetivo de aprendizaje
- Conceptos clave con definiciones
- Explicaciones desarrolladas por tema
- Ejemplos cuando sea relevante
- Preguntas de repaso al final
Formato: usa encabezados (##), bullet points y secciones bien separadas. Escribe en español.`,

  presentation: `Genera el contenido de una PRESENTACIÓN en formato slide por slide. Para cada slide:
## Slide N: [Título del Slide]
- Punto 1
- Punto 2
- Punto 3
(Nota del presentador: breve indicación)

Crea entre 8 y 12 slides. Empieza con portada y termina con conclusiones. Escribe en español.`,

  flashcards: `Genera FLASHCARDS de estudio en formato pregunta-respuesta. Crea entre 15 y 25 flashcards.

Formato exacto:
**P:** [Pregunta clara y específica]
**R:** [Respuesta concisa y completa]

---

Cubre los conceptos más importantes del contenido. Escribe en español.`,

  actionItems: `Genera una lista de PUNTOS DE ACCIÓN y tareas derivadas del contenido. Incluye:

## Prioridad Alta 🔴
- [ ] Acción específica

## Prioridad Media 🟡
- [ ] Acción específica

## Seguimiento 🔵
- [ ] Acción específica

## Notas importantes
- Información crítica a recordar

Sé específico y accionable. Escribe en español.`,
}

type ImageBlock = {
  type: 'image'
  source: {
    type: 'base64'
    media_type: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'
    data: string
  }
}

type TextBlock = {
  type: 'text'
  text: string
}

export async function POST(req: Request) {
  try {
    const { sessionName, sessionType, transcript, images = [], outputType } = await req.json()

    const prompt = PROMPTS[outputType]
    if (!prompt) return new Response('Invalid output type', { status: 400 })
    if (!transcript && images.length === 0) return new Response('No content provided', { status: 400 })

    const typeLabels: Record<string, string> = {
      class: 'clase', meeting: 'reunión', business: 'negocio', workshop: 'taller'
    }

    const contentBlocks: (ImageBlock | TextBlock)[] = []

    // Add images if any
    for (const imgDataUrl of images.slice(0, 6)) {
      const match = imgDataUrl.match(/^data:([^;]+);base64,(.+)$/)
      if (!match) continue
      const mediaType = match[1] as ImageBlock['source']['media_type']
      const data = match[2]
      contentBlocks.push({ type: 'image', source: { type: 'base64', media_type: mediaType, data } })
    }

    // Add transcript + instruction
    const contextText = [
      `Sesión: "${sessionName}" (${typeLabels[sessionType] || sessionType})`,
      transcript ? `\nTranscripción de la sesión:\n${transcript}` : '',
      images.length > 0 ? `\n[Se han incluido ${images.length} imagen(es) de la sesión]` : '',
      `\n\nInstrucción:\n${prompt}`,
    ].join('')

    contentBlocks.push({ type: 'text', text: contextText })

    const stream = client.messages.stream({
      model: 'claude-opus-4-8',
      max_tokens: 3000,
      system: 'Eres Zynq, un asistente de estudio e inteligencia artificial especializado en analizar contenido de clases, reuniones y sesiones de trabajo para generar materiales educativos de alta calidad. Analiza cuidadosamente el texto y las imágenes proporcionadas.',
      messages: [{ role: 'user', content: contentBlocks }],
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
    console.error('[analyze]', err)
    return new Response('Error interno', { status: 500 })
  }
}
