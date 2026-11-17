import { parse } from 'csv-parse/sync'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { z } from 'zod'
import { 作者, type 作者姓名 } from './authors.js'

export type 题目数据 = {
  id: string
  title: string
  kind: 'article' | 'rewrite' | 'dialogue'
  input: string
  min: number
  max: number
}
export type 作者资料 = { 姓名: 作者姓名; 文章: { 标题: string; 正文: string }[] }
export type 数据集 = { authors: 作者资料[] }

let 资料清单格式 = z.array(z.object({ 作者: z.enum(作者), 篇名: z.string().min(1), 文件: z.string().min(1) }))

export async function 加载数据集(项目根目录: string): Promise<数据集> {
  let 记录们: unknown = parse(await readFile(path.join(项目根目录, 'data/manifest.csv'), 'utf8'), {
    columns: true,
    bom: true,
    skip_empty_lines: true,
  })
  let 清单 = 资料清单格式.parse(记录们)
  let 分组原文 = new Map<作者姓名, 作者资料['文章']>()
  let 已见编号 = new Set<string>()
  let 资料根目录 = path.resolve(项目根目录, 'data')
  for (let 记录 of 清单) {
    let 文件名 = path.resolve(资料根目录, 记录.文件)
    let 相对路径 = path.relative(资料根目录, 文件名)
    if (相对路径.startsWith('..') || path.isAbsolute(相对路径) || 已见编号.has(文件名))
      throw new Error(`非法或重复资料路径：${记录.文件}`)
    已见编号.add(文件名)
    let 文本 = await readFile(文件名, 'utf8')
    if (文本.trim().length === 0) throw new Error(`资料为空：${记录.文件}`)
    let 参考原文 = 分组原文.get(记录.作者) ?? []
    参考原文.push({ 标题: 记录.篇名, 正文: 文本 })
    分组原文.set(记录.作者, 参考原文)
  }
  let 作者们 = [...分组原文].map(([姓名, 文章]): 作者资料 => ({ 姓名, 文章 }))
  if (作者们.length === 0) throw new Error('没有作者资料')
  return { authors: 作者们 }
}
