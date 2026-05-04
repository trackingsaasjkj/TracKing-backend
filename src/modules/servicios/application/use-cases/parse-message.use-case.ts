import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../../infrastructure/database/prisma.service';
import OpenAI from 'openai';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ParsedServiceFields {
  clientName?: string
  clientPhone?: string
  clientAddress?: string
  originAddress?: string
  originPhone?: string
  destinationName?: string
  destinationPhone?: string
  destinationAddress?: string
  packageDetails?: string
  missingFields?: string[]
  usedAI?: boolean
}

interface DiagnosisEntry {
  field: string
  extracted_value: string | null
  reason_parser_failed: string
  pattern_found: string
  suggestion: string
}

// ── Required fields map ───────────────────────────────────────────────────────

const REQUIRED_FIELDS: Array<{ key: keyof ParsedServiceFields; label: string }> = [
  { key: 'clientName',         label: 'Nombre del cliente' },
  { key: 'originAddress',      label: 'Dirección de recogida' },
  { key: 'originPhone',        label: 'Teléfono remitente' },
  { key: 'destinationName',    label: 'Nombre destinatario' },
  { key: 'destinationPhone',   label: 'Teléfono destinatario' },
  { key: 'destinationAddress', label: 'Dirección de entrega' },
]

// ── Rule-based parser (fast, free) ────────────────────────────────────────────

function stripFormatting(text: string): string {
  return text
    .replace(/\*([^*]*)\*/g, '$1')
    .replace(/_([^_]*)_/g, '$1')
    .replace(/[\u{1F300}-\u{1FAFF}]/gu, '')
    .replace(/[🛵💜📦🏠📍😕🤯✅❌⚠️]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function normStr(s: string) {
  return stripFormatting(s).toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

function extractPhone(text: string): string | undefined {
  const m = text.match(/(?:tel(?:efono)?|cel(?:ular)?|phone|whatsapp|num(?:ero)?)?[:\s]*(\+?57)?[\s\-.]?([0-9]{3})[\s\-.]?([0-9]{3,4})[\s\-.]?([0-9]{3,4})/i)
  if (!m) return undefined
  const digits = ((m[1] ?? '') + m[2] + m[3] + m[4]).replace(/\D/g, '')
  return digits.length >= 7 ? digits : undefined
}

function extractAddress(text: string): string | undefined {
  const stopPattern = /\s+(?:a\s+nombre\s+de|tel(?:efono)?[\s:]|nombre[\s:]|\d{7,})/i
  const formalMatch = text.match(/((?:calle|cra|carrera|av(?:enida)?|cl|kr|diagonal|transversal|cll|tv|dg)[\s.]*\d+[\s#\-]*\d+[^,\n]*)/i)
  if (formalMatch) {
    let addr = formalMatch[1].trim()
    const stopIdx = addr.search(stopPattern)
    if (stopIdx !== -1) addr = addr.slice(0, stopIdx).trim()
    return addr || undefined
  }
  const informalMatch = text.match(/(?:la\s+)?(\d+\s+con\s+\d+[^,\n]*)/i)
  if (informalMatch) {
    let addr = informalMatch[1].trim()
    const stopIdx = addr.search(stopPattern)
    if (stopIdx !== -1) addr = addr.slice(0, stopIdx).trim()
    return addr || undefined
  }
  return undefined
}

const NAME_AFTER_RE = /(?:a\s+nombre\s+de|nombre\s+(?:de\s+)?(?:quien\s+recibe\s+)?|donde\s+|para\s+)\s*([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)*)/i

function extractName(text: string): string | undefined {
  const m = text.match(NAME_AFTER_RE)
  if (!m) return undefined
  let name = m[1].trim()
  name = name.replace(/\s+(?:tel(?:efono)?|cel(?:ular)?).*$/i, '').trim()
  name = name.replace(/\s+\d[\d\s\-]+$/, '').trim()
  return name || undefined
}

const RECOGER_RE = /\b(recoger|recogida|recoge|origen|remitente|envia|envi[aá]|pickup|recogen)\b/i
const ENTREGA_RE = /\b(entrega[rn]?|destino|llevar|delivery|recibe|llevan\s+a|lo\s+llevan)\b/i
const PAQUETE_RE = /\b(transportar|paquete|producto|env[ií]o|que\s+vamos|mercanc[ií]a|va\s+a\s+transportar|es\s+un\s+paquete)\b/i

function runRuleParser(raw: string): ParsedServiceFields {
  const lines = raw.split(/\n|\r/).map(l => stripFormatting(l)).filter(Boolean)
  type Section = 'unknown' | 'recoger' | 'entrega' | 'paquete'
  let currentSection: Section = 'unknown'
  const recoger: { name?: string; phone?: string; address?: string; barrio?: string; municipio?: string } = {}
  const entrega: { name?: string; phone?: string; address?: string; barrio?: string; municipio?: string } = {}
  let packageDetails: string | undefined

  for (const line of lines) {
    const n = normStr(line)

    // Inline single-line: "Recoger en Cra 36 a nombre de Diego tel 310..."
    const inlineSection = RECOGER_RE.test(n) ? 'recoger' : ENTREGA_RE.test(n) ? 'entrega' : null
    if (inlineSection) {
      const t = inlineSection === 'recoger' ? recoger : entrega
      const phone = extractPhone(line)
      const lineNoPhone = phone ? line.replace(/(?:tel(?:efono)?|cel(?:ular)?)?[\s:]*\+?57?[\s\-.]?\d[\d\s\-\.]{6,14}/i, '').trim() : line
      const name = extractName(lineNoPhone)
      const address = extractAddress(lineNoPhone)
      if (name && !t.name) t.name = name
      if (phone && !t.phone) t.phone = phone
      if (address && !t.address) t.address = address
      currentSection = inlineSection
      continue
    }

    if (PAQUETE_RE.test(n)) {
      currentSection = 'paquete'
      const colonIdx = line.indexOf(':')
      if (colonIdx !== -1) { const v = line.slice(colonIdx + 1).trim(); if (v) packageDetails = v }
      continue
    }

    if (currentSection === 'paquete') { packageDetails = packageDetails ? `${packageDetails} ${line}` : line; continue }

    // Compound labels: "nombre entrega:", "tel recoge:"
    const compoundRe = /^(nombre|tel(?:efono)?|cel(?:ular)?|dir(?:eccion)?|barrio|municipio)\s+(recoge|recogida|origen|entrega|destino)\s*:?\s*(.*)/i
    const cm = normStr(line).match(compoundRe)
    if (cm) {
      const field = cm[1]; const sectionWord = cm[2]
      const value = stripFormatting(line).replace(/^[^:]*:\s*/, '').trim() || stripFormatting(line).split(/\s+/).slice(2).join(' ').trim()
      const t = ['recoge', 'recogida', 'origen'].includes(sectionWord) ? recoger : entrega
      if (field.startsWith('nombre') && !t.name) t.name = value
      else if ((field.startsWith('tel') || field.startsWith('cel')) && !t.phone) t.phone = value.replace(/\D/g, '')
      else if (field.startsWith('dir') && !t.address) t.address = value
      else if (field.startsWith('barrio') && !t.barrio) t.barrio = value
      else if (field.startsWith('muni') && !t.municipio) t.municipio = value
      continue
    }

    const target = currentSection === 'entrega' ? entrega : recoger
    if (/^nombre\s*:/i.test(line)) { const v = line.replace(/^nombre\s*:\s*/i, '').trim(); if (v && !target.name) { target.name = v; continue } }
    if (/^(?:tel(?:efono)?|cel(?:ular)?|phone|num(?:ero)?)\s*:/i.test(line)) { const v = line.replace(/^[^:]+:\s*/, '').trim(); if (v && !target.phone) { target.phone = v.replace(/\D/g, ''); continue } }
    if (/^dir(?:eccion)?\s*:/i.test(line)) { const v = line.replace(/^[^:]+:\s*/, '').trim(); if (v && !target.address) { target.address = v; continue } }
    if (/^(?:barrio|conjunto|sector)\s*:/i.test(line)) { const v = line.replace(/^[^:]+:\s*/, '').trim(); if (v && !target.barrio) { target.barrio = v; continue } }
    if (/^(?:municipio|ciudad)\s*:/i.test(line)) { const v = line.replace(/^[^:]+:\s*/, '').trim(); if (v && !target.municipio) { target.municipio = v; continue } }
    if (/^(?:va\s+a\s+transportar|paquete|producto|env[ií]o)\s*:/i.test(line)) { const v = line.replace(/^[^:]+:\s*/, '').trim(); if (v) { packageDetails = v; continue } }

    const phone = extractPhone(line)
    if (!target.phone && phone) { target.phone = phone; continue }
    const addr = extractAddress(line)
    if (!target.address && addr) { target.address = addr; continue }
    if (!target.name && !/\d/.test(line) && line.length > 2 && line.length < 60 && currentSection !== 'unknown') target.name = line
  }

  // Informal fallback
  const hasData = recoger.name || recoger.address || entrega.name || entrega.address
  if (!hasData) {
    const fullText = lines.join(' ')
    const recogerM = fullText.match(/recogen?\s+(?:donde\s+|en\s+casa\s+de\s+)([A-Za-záéíóúñÁÉÍÓÚÑ]+(?:\s+[A-Za-záéíóúñÁÉÍÓÚÑ]+)?)\s+en\s+((?:la\s+)?\d+\s+con\s+\d+[^,\n]*?|(?:calle|cra|carrera|av)[^,\n]*?)(?:,?\s*tel(?:efono)?\s*([\d\s]+))?(?:\s*[,\n]|$)/i)
    if (recogerM) {
      let name = recogerM[1].trim().replace(/\s+(en|la|el|los|las|de|del)$/i, '').trim()
      recoger.name = name; recoger.address = recogerM[2].trim()
      if (recogerM[3]) recoger.phone = recogerM[3].replace(/\D/g, '')
    }
    const entregaM = fullText.match(/(?:y\s+)?(?:lo\s+)?(?:llevan?|entregan?)\s+(?:a\s+)?([A-Za-záéíóúñÁÉÍÓÚÑ]+(?:\s+[A-Za-záéíóúñÁÉÍÓÚÑ]+)?)\s+(?:en\s+)?([A-Za-záéíóúñÁÉÍÓÚÑ\s\d#\-,]+?)(?:\s+tel(?:efono)?\s*([\d\s]+))?(?:\s*[,\n]|$)/i)
    if (entregaM) {
      let name = entregaM[1].trim().replace(/\s+(en|la|el|los|las|de|del)$/i, '').trim()
      entrega.name = name; entrega.address = entregaM[2].trim()
      if (entregaM[3]) entrega.phone = entregaM[3].replace(/\D/g, '')
    }
    const allPhones = fullText.match(/\b\d{10}\b/g) ?? []
    if (!recoger.phone && allPhones[0]) recoger.phone = allPhones[0]
    if (!entrega.phone && allPhones[1]) entrega.phone = allPhones[1]
    const paqueteM = fullText.match(/(?:es\s+un(?:a)?\s+(?:paquete\s+)?|paquete[:\s]+)([^,\n.]+)/i)
    if (paqueteM) packageDetails = paqueteM[1].trim()
  }

  const buildAddr = (p: typeof recoger) => [p.address, p.barrio, p.municipio].filter(Boolean).join(', ')

  return {
    clientName: recoger.name,
    clientPhone: recoger.phone,
    clientAddress: buildAddr(recoger) || recoger.address,
    originAddress: buildAddr(recoger) || recoger.address,
    originPhone: recoger.phone,
    destinationName: entrega.name,
    destinationPhone: entrega.phone,
    destinationAddress: buildAddr(entrega) || entrega.address,
    packageDetails: packageDetails?.trim(),
  }
}

// ── AI fallback prompt ────────────────────────────────────────────────────────

function buildAIPrompt(message: string, parserResult: ParsedServiceFields, missingFields: string[]): string {
  const detected = Object.entries(parserResult)
    .filter(([k, v]) => v && !['missingFields', 'usedAI'].includes(k))
    .reduce((acc, [k, v]) => ({ ...acc, [k]: v }), {})

  return `Eres un asistente especializado en mensajería colombiana.
Tu tarea es completar SOLO los campos faltantes de un pedido de domicilio.

CAMPOS YA DETECTADOS POR EL PARSER:
${JSON.stringify(detected, null, 2)}

CAMPOS QUE FALTAN (debes intentar extraerlos):
${missingFields.join(', ')}

MENSAJE ORIGINAL DEL CLIENTE:
"${message}"

CONTEXTO COLOMBIANO:
- "la 27 con 14", "27 con 14" son direcciones válidas
- "cel", "tel", "whatsapp" indican teléfono
- "recogen", "recoger", "recoge" = punto de origen
- "entregan", "llevan", "entrega" = punto de destino
- Teléfonos colombianos: 10 dígitos
- Los mensajes pueden tener emojis, errores ortográficos, lenguaje informal

CAMPOS DISPONIBLES:
- clientName: nombre del remitente/cliente
- clientPhone: teléfono del remitente
- clientAddress: dirección del remitente
- originAddress: dirección de recogida (con barrio y municipio si los hay)
- originPhone: teléfono en punto de recogida
- destinationName: nombre de quien recibe
- destinationPhone: teléfono del destinatario
- destinationAddress: dirección de entrega (con barrio y municipio si los hay)
- packageDetails: descripción del paquete

RESPONDE SOLO con este JSON (sin markdown):
{
  "fields": {
    "<campo>": "<valor extraído o null si no se puede inferir>"
  },
  "diagnosis": [
    {
      "field": "<nombre del campo>",
      "extracted_value": "<valor encontrado o null>",
      "reason_parser_failed": "<explicación clara de por qué el parser no lo detectó>",
      "pattern_found": "<el patrón exacto que usó el cliente en el mensaje>",
      "suggestion": "<sugerencia concreta de regex o regla para agregar al parser>"
    }
  ]
}`
}

// ── Main use-case ─────────────────────────────────────────────────────────────

@Injectable()
export class ParseMessageUseCase {
  private readonly logger = new Logger(ParseMessageUseCase.name)
  private readonly openai: OpenAI | null

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    const apiKey = this.config.get<string>('OPENAI_API_KEY')
    this.openai = apiKey ? new OpenAI({ apiKey }) : null
    if (!this.openai) this.logger.warn('OPENAI_API_KEY not configured')
  }

  async execute(message: string, companyId?: string): Promise<ParsedServiceFields> {
    this.logger.log(`[ParseMessage] message length=${message.length}`)

    // Step 1: rule-based parser (free, instant)
    const parserResult = runRuleParser(message)

    // Step 2: detect missing required fields
    const missingFields = REQUIRED_FIELDS
      .filter(({ key }) => !parserResult[key])
      .map(({ label }) => label)

    // If parser got everything, return immediately
    if (missingFields.length === 0) {
      this.logger.log('[ParseMessage] Parser got all fields — no AI needed')
      return { ...parserResult, missingFields: [], usedAI: false }
    }

    this.logger.log(`[ParseMessage] Parser missing: ${missingFields.join(', ')} — calling AI`)

    // Step 3: AI fallback for missing fields only
    if (!this.openai) {
      return { ...parserResult, missingFields, usedAI: false }
    }

    let aiFields: Record<string, string | null> = {}
    let diagnosis: DiagnosisEntry[] = []

    try {
      const prompt = buildAIPrompt(message, parserResult, missingFields)
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0,
        max_tokens: 600,
        response_format: { type: 'json_object' },
      })

      const raw = completion.choices[0]?.message?.content ?? '{}'
      this.logger.log(`[ParseMessage] AI response: ${raw.slice(0, 150)}`)
      const parsed = JSON.parse(raw)
      aiFields = parsed.fields ?? {}
      diagnosis = parsed.diagnosis ?? []
    } catch (err) {
      this.logger.error('[ParseMessage] AI error:', err)
    }

    // Step 4: merge parser + AI results
    const merged: ParsedServiceFields = { ...parserResult }
    for (const [key, value] of Object.entries(aiFields)) {
      if (value && !(merged as any)[key]) {
        (merged as any)[key] = value
      }
    }

    // Step 5: recalculate still-missing fields after AI
    const stillMissing = REQUIRED_FIELDS
      .filter(({ key }) => !merged[key])
      .map(({ label }) => label)

    merged.missingFields = stillMissing
    merged.usedAI = true

    // Step 6: save to BD for parser improvement (fire-and-forget)
    if (diagnosis.length > 0) {
      this.prisma.parserFailureLog.create({
        data: {
          company_id: companyId ?? null,
          raw_message: message,
          parser_result: parserResult as any,
          ai_result: aiFields as any,
          missing_fields: missingFields,
          ai_diagnosis: diagnosis as any,
        },
      }).catch(e => this.logger.error('[ParseMessage] Failed to save log:', e))
    }

    return merged
  }
}
