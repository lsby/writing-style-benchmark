import type { 作者资料, 题目数据 } from '../engine/data/dataset.js'
import type { 参考输入 } from '../implementations/base.js'

export type 题目参数 = {
  编号: string
  标题: string
  类型: 题目数据['kind']
  要求: string
  最少字数: number
  最多字数: number
}
export type 检查结果 = { 通过: boolean; 字数: number; 问题: string[] }

/** 写作题目包含稳定题号、任务内容和字数范围，并检查作品的客观约束。 */
export class 写作题目 {
  private readonly 参数: 题目参数

  public constructor(参数: 题目参数) {
    for (let 值 of [参数.编号, 参数.标题, 参数.要求]) {
      if (值.trim().length === 0) throw new Error('题号、标题及要求不能为空')
    }
    if (!/^[A-Za-z0-9_-]+$/.test(参数.编号)) throw new Error('题号只能包含英文字母、数字、下划线及连字符')
    if (/^(?:CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i.test(参数.编号))
      throw new Error(`题号 ${参数.编号} 是 Windows 保留文件名，请使用其他编号`)
    if (!['article', 'rewrite', 'dialogue'].includes(参数.类型)) throw new Error('未知题目类型')
    if (
      !Number.isSafeInteger(参数.最少字数) ||
      !Number.isSafeInteger(参数.最多字数) ||
      参数.最少字数 < 1 ||
      参数.最多字数 < 参数.最少字数
    )
      throw new Error('题目字数范围无效')
    this.参数 = { ...参数 }
  }

  public 导出(): 题目数据 {
    let 题 = this.参数
    return { id: 题.编号, title: 题.标题, kind: 题.类型, input: 题.要求, min: 题.最少字数, max: 题.最多字数 }
  }

  public 出题(作者: 作者资料): 参考输入 {
    return { 作者: structuredClone(作者), 写作任务: this.参数.要求 }
  }

  public 检查(正文: string): 检查结果 {
    let 行 = 正文.trim().split(/\r?\n/)
    if (this.参数.类型 !== 'dialogue') 行.shift()
    let 字数 = 统计正文字数(正文, this.参数.类型)
    let 问题: string[] = []
    if (正文.trim().length === 0) 问题.push('正文不能为空')
    if (this.参数.类型 !== 'dialogue' && 行.join('\n').trim().length === 0)
      问题.push('标题须独占第一行，并在后续行提供正文')
    if (字数 < this.参数.最少字数 || 字数 > this.参数.最多字数)
      问题.push(`正文 ${字数} 字，要求 ${this.参数.最少字数}～${this.参数.最多字数} 字`)
    return { 通过: 问题.length === 0, 字数, 问题 }
  }
}

export function 统计正文字数(文本: string, 类型: 题目数据['kind']): number {
  let 文本行们 = 文本.trim().split(/\r?\n/)
  // The task requests a separate title for articles and rewrites. Keep this rule
  // visible in the report: a missing or ambiguous title needs human inspection.
  if (类型 !== 'dialogue') 文本行们.shift()
  return [...文本行们.join('\n')].filter((字符) => !/\s/u.test(字符)).length
}
