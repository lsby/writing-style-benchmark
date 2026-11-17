import { z } from 'zod'

export type 模型消息 = { role: 'system' | 'user'; content: string }
export type API配置 = {
  地址: string
  模型: string
  密钥: string
  参数?: { temperature?: number; max_tokens?: number; seed?: number; reasoning_effort?: 'low' | 'medium' | 'high' }
  超时毫秒?: number
}
export let 用量格式 = z
  .object({
    prompt_tokens: z.number().nonnegative().optional(),
    completion_tokens: z.number().nonnegative().optional(),
    total_tokens: z.number().nonnegative().optional(),
    completion_tokens_details: z
      .object({ reasoning_tokens: z.number().nonnegative().optional() })
      .passthrough()
      .optional(),
  })
  .passthrough()
let 模型响应格式 = z
  .object({
    model: z.string(),
    choices: z
      .array(z.object({ message: z.object({ content: z.string().nullable() }), finish_reason: z.string().nullable() }))
      .min(1),
    usage: 用量格式.optional(),
  })
  .passthrough()
export type 调用结果 = {
  text: string
  finishReason: string | null
  elapsedSeconds: number
  model: string
  inputTextChars: number
  outputTextChars: number
  usage?: z.infer<typeof 用量格式>
}

export function 统计文本字符(消息们: 模型消息[], 输出: string): { inputTextChars: number; outputTextChars: number } {
  return {
    inputTextChars: 消息们.reduce((累加值, 消息) => 累加值 + [...消息.content].length, 0),
    outputTextChars: [...输出].length,
  }
}

/** 配置错误在请求前暴露；不推断服务地址或模型。 */
export function 检查API配置(配置: API配置, 名称: string): void {
  if (配置.地址.trim().length === 0) throw new Error(`${名称}.地址不能为空`)
  if (配置.模型.trim().length === 0) throw new Error(`${名称}.模型不能为空`)
  let 地址: URL
  try {
    地址 = new URL(配置.地址)
  } catch {
    throw new Error(`${名称}.地址必须是完整的 HTTP 或 HTTPS 地址`)
  }
  if (地址.protocol !== 'http:' && 地址.protocol !== 'https:') throw new Error(`${名称}.地址必须使用 HTTP 或 HTTPS`)
}

export async function 调用模型(配置: API配置, 消息们: 模型消息[], 格式?: Record<string, unknown>): Promise<调用结果> {
  检查API配置(配置, 'API')
  let 请求: Record<string, unknown> = {
    model: 配置.模型,
    messages: 消息们,
    ...配置.参数,
    stream: false,
    ...(格式 === undefined
      ? {}
      : { response_format: { type: 'json_schema', json_schema: { name: 'evaluation', strict: true, schema: 格式 } } }),
  }
  let 地址 = 配置.地址.replace(/\/+$/, '')
  let 端点 = `${地址}${地址.endsWith('/v1') ? '' : '/v1'}/chat/completions`
  let 请求头: Record<string, string> = { 'Content-Type': 'application/json' }
  if (配置.密钥.trim().length > 0) 请求头.Authorization = `Bearer ${配置.密钥}`
  let 开始时间 = performance.now()
  let 响应 = await fetch(端点, {
    method: 'POST',
    headers: 请求头,
    body: JSON.stringify(请求),
    signal: AbortSignal.timeout(配置.超时毫秒 ?? 30 * 60_000),
  })
  if (!响应.ok) throw new Error(`模型请求失败：HTTP ${响应.status}`)
  let 原始数据: unknown = await 响应.json()
  let 已校验数据 = 模型响应格式.parse(原始数据)
  let 候选响应 = 已校验数据.choices[0]
  if (候选响应 === undefined || 候选响应.message.content === null || 候选响应.message.content.trim().length === 0)
    throw new Error('模型没有给出正文')
  let 结果: 调用结果 = {
    text: 候选响应.message.content,
    finishReason: 候选响应.finish_reason,
    elapsedSeconds: (performance.now() - 开始时间) / 1000,
    model: 已校验数据.model,
    ...统计文本字符(消息们, 候选响应.message.content),
  }
  if (已校验数据.usage !== undefined) 结果.usage = 已校验数据.usage
  return 结果
}
