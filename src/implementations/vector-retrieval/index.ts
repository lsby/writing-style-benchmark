import { z } from 'zod'
import { 检查API配置 } from '../../engine/execution/model.js'
import { 参考实现, type 参考输入 } from '../base.js'
import { 切分句子, type 句子片段 } from '../sentence.js'

export type 向量检索配置 = {
  地址: string
  模型: string
  密钥: string
  检索数量: number
  批量大小: number
  超时毫秒: number
  文档前缀: string
  查询前缀: string
}

type 已编码片段 = 句子片段 & { 向量: number[] }

let 向量响应格式 = z.object({
  data: z.array(z.object({ index: z.number().int().nonnegative(), embedding: z.array(z.number().finite()).min(1) })),
})

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
 * 2. 批量向量编码与缓存：按 `批量大小` 分批调用 OpenAI 兼容的 `/v1/embeddings` 接口编码（拼接 `文档前缀`），
 *    对返回向量做结构校验与 L2 归一化，并在当前实例内按作者姓名与文章内容缓存（编码失败时自动清除缓存）。
 * 3. 相似度检索与排序：将 `查询前缀 + 写作任务` 编码并归一化为查询向量，与所有片段向量计算点积（等价于余弦相似度），
 *    按分数从高到低排序（同分保持原文顺序）。
 * 4. 返回原句：截取排名前 `检索数量` 的片段，仅保留原句正文并以空行拼接返回。
 *
 * 配置说明（默认配置见 `src/implementations/index.ts`）：
 * - `地址` / `模型` / `密钥` / `超时毫秒`：向量嵌入服务的连接与请求参数。
 * - `检索数量`：每次返回的最相关原句数量。
 * - `批量大小`：单次请求编码的句子数量。
 * - `文档前缀` / `查询前缀`：分别拼接在待编码原文和写作任务前的提示前缀。
 */
export class 向量检索实现 extends 参考实现 {
  public readonly 名称 = 'vector-retrieval'
  public readonly 说明 = '原文按句号切分，按写作任务检索相关句子，只返回原句。'
  private readonly 配置: 向量检索配置
  private readonly 作者缓存 = new Map<string, Promise<已编码片段[]>>()

  public constructor(配置: 向量检索配置) {
    super()
    检查API配置(配置, '向量检索')
    for (let [名称, 值] of [
      ['检索数量', 配置.检索数量],
      ['批量大小', 配置.批量大小],
    ] as const) {
      if (!Number.isSafeInteger(值) || 值 <= 0) throw new Error(`向量检索.${名称}必须是正安全整数`)
    }
    if (!Number.isSafeInteger(配置.超时毫秒) || 配置.超时毫秒 <= 0 || 配置.超时毫秒 > 2_147_483_647)
      throw new Error('向量检索.超时毫秒必须是 1 到 2147483647 之间的整数')
    this.配置 = { ...配置 }
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
    let [文档, 查询向量们] = await Promise.all([已编码, this.编码文本([this.配置.查询前缀 + 输入.写作任务])])
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
      let 向量们 = await this.编码文本(批次.map((片段值) => this.配置.文档前缀 + 片段值.正文))
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
}
