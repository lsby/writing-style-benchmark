import { readFileSync } from 'node:fs'
import { z } from 'zod'
import type { 作者姓名 } from './authors.js'

let 作者别名 = z
  .record(z.string(), z.string())
  .parse(JSON.parse(readFileSync(new URL('../../../data/author-slugs.json', import.meta.url), 'utf8')))

/** 人名保留原文，磁盘路径统一用 ASCII。 */
export function 作者目录(姓名: 作者姓名): string {
  let 别名 = 作者别名[姓名]
  if (别名 === undefined || !/^[A-Za-z0-9_-]+$/.test(别名)) throw new Error(`作者 ${姓名} 缺少有效的目录标识`)
  return 别名
}
