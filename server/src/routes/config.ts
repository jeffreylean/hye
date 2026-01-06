import type { BunRequest } from 'bun'
import { ConfigService } from '../services/config.js'
import type { LLMProviderConfig } from '../lib/types.js'
import { jsonResponse, parseJsonBody } from '../lib/http.js'

async function saveConfig(req: BunRequest): Promise<Response> {
  const body = await parseJsonBody<Record<string, unknown>>(req)
  ConfigService.saveConfig(body)
  return jsonResponse({ success: true })
}

async function setCurrentProvider(req: BunRequest): Promise<Response> {
  const provider = await parseJsonBody<LLMProviderConfig | null>(req)
  ConfigService.setCurrentProvider(provider)
  return jsonResponse({ success: true })
}

async function saveProvider(req: BunRequest<'/api/config/provider/:name'>): Promise<Response> {
  const { name } = req.params
  const config = await parseJsonBody<LLMProviderConfig>(req)
  ConfigService.saveProvider(name, config)
  return jsonResponse({ success: true })
}

function removeProvider(req: BunRequest<'/api/config/provider/:name'>): Response {
  const { name } = req.params
  ConfigService.removeProvider(name)
  return jsonResponse({ success: true })
}

export const configRoutes = {
  '/api/config': {
    GET: () => jsonResponse(ConfigService.getConfig()),
    PUT: saveConfig,
  },
  '/api/config/provider/current': {
    PUT: setCurrentProvider,
  },
  '/api/config/provider/:name': {
    PUT: saveProvider,
    DELETE: removeProvider,
  },
  '/api/config/path': {
    GET: () => jsonResponse({ path: ConfigService.getStorePath() }),
  },
}
