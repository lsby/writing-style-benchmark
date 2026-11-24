import type { FeatureExtractionPipeline } from '@huggingface/transformers'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { z } from 'zod'
import { 检查API配置 } from '../../engine/execution/model.js'
import { 参考实现, type 参考输入 } from '../base.js'
import { 切分句子, type 句子片段 } from '../sentence.js'

let 非空字符串 = z.string().trim().min(1)
let 公共配置格式 = z.object({
  模型: 非空字符串,
  检索数量: z.number().int().positive().safe(),
  批量大小: z.number().int().positive().safe(),
})
let 向量配置格式 = z.discriminatedUnion('类型', [
  公共配置格式.extend({ 类型: z.literal('本地'), 精度: z.literal('fp32'), 缓存目录: 非空字符串 }).strict(),
  公共配置格式
    .extend({
      类型: z.literal('在线'),
      地址: 非空字符串,
      密钥: z.string(),
      超时毫秒: z.number().int().min(1).max(2_147_483_647),
      文档前缀: z.string(),
      查询前缀: z.string(),
    })
    .strict(),
])

export type 向量检索配置 = z.infer<typeof 向量配置格式>

type 已编码片段 = 句子片段 & { 向量: number[] }

let 向量响应格式 = z.object({
  data: z.array(z.object({ index: z.number().int().nonnegative(), embedding: z.array(z.number().finite()).min(1) })),
})
let 本地向量格式 = z.array(z.array(z.number().finite()).min(1)).min(1)
let 分词结果格式 = z.object({ input_ids: z.array(z.array(z.number().int().nonnegative()).min(1)).min(1) })

export let 默认向量缓存目录 = fileURLToPath(new URL('../../../.cache/embeddings/', import.meta.url))

function 统计分词长度(提取器: FeatureExtractionPipeline, 文本: string, 添加特殊记号: boolean): number {
  let 结果: unknown = 提取器.tokenizer([文本], {
    padding: false,
    truncation: false,
    return_tensor: false,
    add_special_tokens: 添加特殊记号,
  })
  let 编号们 = 分词结果格式.parse(结果).input_ids
  let 编号 = 编号们[0]
  if (编号们.length !== 1 || 编号 === undefined) throw new Error('本地分词结果数量与输入不一致')
  return 编号.length
}

function 切分本地文本(
  提取器: FeatureExtractionPipeline,
  文本: string,
  长度上限: number,
): { 文本: string; 权重: number }[] {
  if (统计分词长度(提取器, 文本, true) <= 长度上限) return [{ 文本, 权重: 统计分词长度(提取器, 文本, false) }]
  let 字符们 = [...文本]
  let 片段们: { 文本: string; 权重: number }[] = []
  let 起点 = 0
  while (起点 < 字符们.length) {
    let 下界 = 1
    let 上界 = 字符们.length - 起点
    let 可用长度 = 0
    while (下界 <= 上界) {
      let 长度 = Math.floor((下界 + 上界) / 2)
      let 候选 = 字符们.slice(起点, 起点 + 长度).join('')
      if (统计分词长度(提取器, 候选, true) <= 长度上限) {
        可用长度 = 长度
        下界 = 长度 + 1
      } else 上界 = 长度 - 1
    }
    if (可用长度 === 0) throw new Error('本地模型的长度上限无法容纳单个输入字符')
    let 片段 = 字符们.slice(起点, 起点 + 可用长度).join('')
    if (统计分词长度(提取器, 片段, true) > 长度上限) throw new Error('本地文本分块超过模型长度上限')
    片段们.push({ 文本: 片段, 权重: 统计分词长度(提取器, 片段, false) })
    起点 += 可用长度
  }
  if (片段们.map((片段) => 片段.文本).join('') !== 文本) throw new Error('本地文本分块未完整覆盖输入')
  return 片段们
}

function 归一化向量(向量: number[]): number[] {
  let 最大值 = 向量.reduce((最大, 值) => Math.max(最大, Math.abs(值)), 0)
  if (最大值 === 0) throw new Error('向量不能全为零')
  let 缩放后 = 向量.map((值) => 值 / 最大值)
  let 长度 = Math.sqrt(缩放后.reduce((累加, 值) => 累加 + 值 * 值, 0))
  return 缩放后.map((值) => 值 / 长度)
}

/**
 * Vector Retrieval（向量检索方案）
 *
 * 方案思路：
 * 采用检索增强（RAG）的思路，不把数万字的作者全集直接塞进提示词，
 * 而是根据当前写作任务，从原文中检索语义最相关的若干原句作为风格参考样本，
 * 在大幅压缩上下文长度与 Token 消耗的同时，让模型聚焦于与当前主题最贴近的表达方式。
 *
 * 具体做法：
 * 1. 按句切分：将作者全部文章的正文按中文句号及其后紧随的闭合引号、括号等标点切分为独立句子片段，去除首尾空白并过滤空片段。
 * 2. 批量向量编码与缓存：按 `批量大小` 分批使用本地 CPU 模型或在线 `/v1/embeddings` 接口编码，
 *    对返回向量做结构校验与 L2 归一化，并在当前实例内按作者姓名与文章内容缓存（编码失败时自动清除缓存）。
 * 3. 相似度检索与排序：将完整写作任务编码并归一化为查询向量，与所有片段向量计算点积（等价于余弦相似度），
 *    按分数从高到低排序（同分保持原文顺序）。
 * 4. 返回原句：截取排名前 `检索数量` 的片段，仅保留原句正文并以空行拼接返回。
 *
 * 配置说明（默认配置见本目录的 `run.ts` 和 `mcp.ts`）：
 * - 本地配置指定模型、精度与缓存目录，仅在首次编码时加载模型，不依赖外部服务。
 * - 在线配置指定 `地址` / `模型` / `密钥` / `超时毫秒`，保留 OpenAI 兼容接口。
 * - `检索数量`：每次返回的最相关原句数量。
 * - `批量大小`：单次请求编码的句子数量。
 * - 在线配置的 `文档前缀` / `查询前缀` 分别拼接在原文和写作任务前。
 */
export class 向量检索实现 extends 参考实现 {
  public readonly 名称 = 'vector-retrieval'
  public readonly 说明 = '原文按句号切分，按写作任务检索相关句子，只返回原句。'
  public readonly 配置: 向量检索配置
  private readonly 作者缓存 = new Map<string, Promise<已编码片段[]>>()
  private 本地提取器: Promise<FeatureExtractionPipeline> | undefined

  public constructor(配置: 向量检索配置) {
    super()
    let 已校验配置 = 向量配置格式.parse(配置)
    if (已校验配置.类型 === '在线') 检查API配置(已校验配置, '向量检索')
    else 已校验配置.缓存目录 = path.resolve(已校验配置.缓存目录)
    this.配置 = 已校验配置
  }

  public async 获取参考文本(输入: 参考输入): Promise<string> {
    if (输入.写作任务.trim().length === 0) throw new Error('写作任务不能为空')
    let 片段们 = 输入.作者.文章.flatMap((文章) => 切分句子(文章.正文))
    if (片段们.length === 0) throw new Error(`作者 ${输入.作者.姓名} 没有可检索的原文片段`)
    let 缓存键 = JSON.stringify([输入.作者.姓名, 输入.作者.文章.map(({ 标题, 正文 }) => [标题, 正文])])
    let 已编码 = this.作者缓存.get(缓存键)
    if (已编码 === undefined) {
      已编码 = this.编码片段(片段们)
      this.作者缓存.set(缓存键, 已编码)
      已编码.catch(() => {
        if (this.作者缓存.get(缓存键) === 已编码) this.作者缓存.delete(缓存键)
      })
    }
    let 查询前缀 = this.配置.类型 === '在线' ? this.配置.查询前缀 : ''
    let [文档, 查询向量们] = await Promise.all([已编码, this.编码文本([查询前缀 + 输入.写作任务])])
    let 查询向量 = 查询向量们[0]
    if (查询向量 === undefined) throw new Error('查询向量缺失')
    let 排序结果 = 文档
      .map((片段值, 顺序) => {
        if (片段值.向量.length !== 查询向量.length) throw new Error('文档与查询向量维度不一致')
        let 分数 = 片段值.向量.reduce((累加, 值, 索引) => 累加 + 值 * (查询向量[索引] ?? 0), 0)
        return { 片段值, 顺序, 分数 }
      })
      .sort((甲, 乙) => (乙.分数 === 甲.分数 ? 甲.顺序 - 乙.顺序 : 乙.分数 - 甲.分数))
    return 排序结果
      .slice(0, this.配置.检索数量)
      .map(({ 片段值 }) => 片段值.正文)
      .join('\n\n')
  }

  private async 编码片段(片段们: 句子片段[]): Promise<已编码片段[]> {
    let 结果: 已编码片段[] = []
    let 维度: number | undefined
    for (let 起点 = 0; 起点 < 片段们.length; 起点 += this.配置.批量大小) {
      let 批次 = 片段们.slice(起点, 起点 + this.配置.批量大小)
      let 文档前缀 = this.配置.类型 === '在线' ? this.配置.文档前缀 : ''
      let 向量们 = await this.编码文本(批次.map((片段值) => 文档前缀 + 片段值.正文))
      for (let [索引, 片段值] of 批次.entries()) {
        let 向量 = 向量们[索引]
        if (向量 === undefined) throw new Error('文档向量缺失')
        维度 ??= 向量.length
        if (向量.length !== 维度) throw new Error('文档向量维度不一致')
        结果.push({ ...片段值, 向量 })
      }
    }
    return 结果
  }

  private async 编码文本(文本们: string[]): Promise<number[][]> {
    if (this.配置.类型 === '本地') return await this.本地编码文本(文本们)
    let 地址 = this.配置.地址.replace(/\/+$/, '')
    let 端点 = `${地址}${地址.endsWith('/v1') ? '' : '/v1'}/embeddings`
    let 请求头: Record<string, string> = { 'Content-Type': 'application/json' }
    if (this.配置.密钥.trim().length > 0) 请求头.Authorization = `Bearer ${this.配置.密钥}`
    let 响应 = await fetch(端点, {
      method: 'POST',
      headers: 请求头,
      body: JSON.stringify({ model: this.配置.模型, input: 文本们 }),
      signal: AbortSignal.timeout(this.配置.超时毫秒),
    })
    if (!响应.ok) throw new Error(`向量请求失败：HTTP ${响应.status}`)
    let 数据: unknown = await 响应.json()
    let 条目们 = 向量响应格式.parse(数据).data
    if (条目们.length !== 文本们.length) throw new Error('向量响应数量与输入不一致')
    let 向量们 = new Map<number, number[]>()
    for (let 条目 of 条目们) {
      if (条目.index >= 文本们.length || 向量们.has(条目.index)) throw new Error('向量响应索引重复或越界')
      向量们.set(条目.index, 归一化向量(条目.embedding))
    }
    return 文本们.map((_, 索引) => {
      let 向量 = 向量们.get(索引)
      if (向量 === undefined) throw new Error('向量响应索引缺失')
      return 向量
    })
  }

  private async 获取本地提取器(): Promise<FeatureExtractionPipeline> {
    if (this.配置.类型 !== '本地') throw new Error('在线配置不能加载本地模型')
    if (this.本地提取器 !== undefined) return await this.本地提取器
    let 配置 = this.配置
    let 初始化 = (async (): Promise<FeatureExtractionPipeline> => {
      let { pipeline } = await import('@huggingface/transformers')
      return await pipeline('feature-extraction', 配置.模型, {
        dtype: 配置.精度,
        device: 'cpu',
        cache_dir: 配置.缓存目录,
      })
    })()
    this.本地提取器 = 初始化
    try {
      return await 初始化
    } catch (错误: unknown) {
      if (this.本地提取器 === 初始化) this.本地提取器 = undefined
      throw 错误
    }
  }

  private async 本地编码文本(文本们: string[]): Promise<number[][]> {
    let 提取器 = await this.获取本地提取器()
    // 管线内部固定开启截断；逐块确认实际 token 数，并核对拼接等于原文。
    let 长度上限 = z.number().int().positive().parse(提取器.tokenizer.model_max_length)
    let 分组片段 = 文本们.map((文本) => 切分本地文本(提取器, 文本, 长度上限))
    let 片段们 = 分组片段.flat()
    let 向量们: number[][] = []
    let 维度: number | undefined
    for (let 起点 = 0; 起点 < 片段们.length; 起点 += this.配置.批量大小) {
      let 批次 = 片段们.slice(起点, 起点 + this.配置.批量大小)
      let 输出 = await 提取器(
        批次.map((片段) => 片段.文本),
        { pooling: 'mean', normalize: true },
      )
      let 批次向量 = 本地向量格式.parse(输出.tolist())
      if (批次向量.length !== 批次.length) throw new Error('本地向量响应数量与输入不一致')
      for (let 向量 of 批次向量) {
        维度 ??= 向量.length
        if (向量.length !== 维度) throw new Error('本地向量维度不一致')
        向量们.push(归一化向量(向量))
      }
    }
    if (维度 === undefined) throw new Error('本地向量输出为空')
    let 输出维度 = 维度
    let 向量起点 = 0
    return 分组片段.map((组) => {
      let 总权重 = 组.reduce((总数, 片段) => 总数 + 片段.权重, 0)
      if (总权重 <= 0) throw new Error('本地文本没有有效 token')
      let 合并向量 = new Array<number>(输出维度).fill(0)
      for (let 片段 of 组) {
        let 向量 = 向量们[向量起点++]
        if (向量 === undefined) throw new Error('本地片段向量缺失')
        合并向量 = 合并向量.map((值, 索引) => 值 + (向量[索引] ?? 0) * (片段.权重 / 总权重))
      }
      return 归一化向量(合并向量)
    })
  }
}
