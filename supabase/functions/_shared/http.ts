export class HttpError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'HttpError'
    this.status = status
  }
}

function configuredOrigins() {
  const siteUrl = Deno.env.get('SITE_URL')
  if (!siteUrl) throw new HttpError(503, 'Endereco do PALCO nao configurado')

  const siteOrigin = new URL(siteUrl).origin
  const origins = new Set([
    siteOrigin,
    ...(Deno.env.get('ALLOWED_ORIGINS') || '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean)
      .map((value) => new URL(value).origin),
  ])

  return { origins, siteOrigin }
}

export function assertAllowedOrigin(req: Request) {
  const { origins, siteOrigin } = configuredOrigins()
  const requestOrigin = req.headers.get('origin')

  if (requestOrigin && !origins.has(requestOrigin)) {
    throw new HttpError(403, 'Origem nao autorizada')
  }

  return requestOrigin || siteOrigin
}

export function corsHeaders(req: Request) {
  let origin = Deno.env.get('SITE_URL') || ''
  try {
    origin = assertAllowedOrigin(req)
  } catch {
    try {
      origin = new URL(origin).origin
    } catch {
      origin = ''
    }
  }

  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  }
}

export function jsonResponse(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
  })
}

export function errorResponse(req: Request, error: unknown) {
  const status = error instanceof HttpError ? error.status : 500
  const message = error instanceof HttpError
    ? error.message
    : 'O servico encontrou um erro inesperado. Tente novamente.'

  return jsonResponse(req, { error: message }, status)
}
