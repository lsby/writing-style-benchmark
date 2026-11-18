import { randomInt } from 'node:crypto'
import { z } from 'zod'
import { 参考实现, type 参考输入 } from '../base.js'
import { 切分句子 } from '../sentence.js'

export type 随机抽句配置 = { 抽取数量: number; 随机种子?: number | undefined }

let 配置格式 = z.object({ 抽取数量: z.number().int().positive(), 随机种子: z.number().int().optional() })

function 创建随机数生成器(种子?: number): () => number {
  if (种子 === undefined) return () => Math.random()
  let 状态 = 种子 >>> 0
  return (): number => {
    // 使用 Mulberry32 生成可复现的 [0, 1) 伪随机数。
    状态 = (状态 + 0x6d2b79f5) >>> 0
    let 混合 = Math.imul(状态 ^ (状态 >>> 15), 1 | 状态)
    混合 = (混合 + Math.imul(混合 ^ (混合 >>> 7), 61 | 混合)) ^ 混合
    return ((混合 ^ (混合 >>> 14)) >>> 0) / 4_294_967_296
  }
}

/**
 * Random Sentences（随机抽句基线方案）
 *
 * 方案思路：
 * 作为检索方案的零成本对照组，不计算任何向量相似度，
 * 而是将作者全部文章按句切分后随机抽取若干原句作为风格参考样本，
 * 用于检验主题相关性检索相比单纯“展示作者随机原句”究竟带来多少增益。
 */
export class 随机抽句实现 extends 参考实现 {
  public readonly 名称 = 'random-sentences'
  public readonly 说明 = '原文按句号切分，随机抽取若干原句作为风格参考，只返回原句。'
  private readonly 配置: 随机抽句配置

  public constructor(配置: 随机抽句配置) {
    super()
    this.配置 = 配置格式.parse(配置)
    this.配置.随机种子 ??= randomInt(0, 4_294_967_296)
  }

  public override 导出配置(): Record<string, unknown> {
    return { sampleCount: this.配置.抽取数量, seed: this.配置.随机种子 }
  }

  public 获取参考文本(输入: 参考输入): string {
    let 句子们 = 输入.作者.文章.flatMap((文章) => 切分句子(文章.正文))
    if (句子们.length === 0) throw new Error('作者文章切分后没有任何可用句子')

    let 候选们 = [...句子们]
    let 随机数 = 创建随机数生成器(this.配置.随机种子)
    let 目标数量 = Math.min(this.配置.抽取数量, 候选们.length)

    for (let 位置 = 0; 位置 < 目标数量; 位置++) {
      let 交换位置 = 位置 + Math.floor(随机数() * (候选们.length - 位置))
      let 当前句 = 候选们[位置]
      let 选中句 = 候选们[交换位置]
      if (当前句 === undefined || 选中句 === undefined) throw new Error('抽句索引越界')
      候选们[位置] = 选中句
      候选们[交换位置] = 当前句
    }

    return 候选们
      .slice(0, 目标数量)
      .map((句子) => 句子.正文)
      .join('\n\n')
  }
}
