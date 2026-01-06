export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  })
}

export function textResponse(text: string, status = 200): Response {
  return new Response(text, {
    status,
    headers: { 'Content-Type': 'text/plain', ...corsHeaders },
  })
}

export function errorResponse(message: string, status = 500): Response {
  return jsonResponse({ error: message }, status)
}

export function sseResponse(stream: ReadableStream): Response {
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      ...corsHeaders,
    },
  })
}

export async function parseJsonBody<T>(req: Request): Promise<T> {
  const text = await req.text()
  return JSON.parse(text) as T
}
