import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { z } from 'zod'
import type { 参考实现 } from '../../implementations/base.js'
import type { 数据集 } from '../data/dataset.js'

let 执行文件 = promisify(execFile)
let 代码根目录 = fileURLToPath(new URL('../../../', import.meta.url))

export type 复现信息 = {
  code: { commit: string | null; dirty: boolean | null; sha256: string }
  datasetSha256: string
  scoringSourceSha256: string
  implementationConfig: Record<string, unknown> | null
}

export function 计算指纹(内容: unknown): string {
  let 文本 = z.string().parse(JSON.stringify(内容))
  return createHash('sha256').update(文本).digest('hex')
}

async function 读取代码版本(): Promise<复现信息['code']> {
  // 只读取代码与构建配置，排除 .env、运行结果和语料；包括未跟踪的源码。
  let 文件们: string[] = []
  let 收集源码 = async (目录: string): Promise<void> => {
    let 条目们 = await readdir(path.join(代码根目录, 目录), { withFileTypes: true })
    for (let 条目 of 条目们) {
      let 文件 = `${目录}/${条目.name}`
      if (条目.isDirectory()) await 收集源码(文件)
      else if (条目.isFile() && !/^\.env(?:\.|$)/.test(条目.name)) 文件们.push(文件)
    }
  }
  await 收集源码('src')
  await 收集源码('scripts')
  文件们.push('package.json', 'pnpm-lock.yaml', 'tsconfig.json', 'eslint.config.mjs', '.prettierrc')
  文件们.sort()
  let 文件指纹们 = await Promise.all(
    文件们.map(
      async (文件): Promise<[string, string]> => [
        文件,
        createHash('sha256')
          .update(await readFile(path.join(代码根目录, 文件)))
          .digest('hex'),
      ],
    ),
  )
  let 提交: string | null = null
  let 已修改: boolean | null = null
  try {
    let [提交结果, 状态结果] = await Promise.all([
      执行文件('git', ['rev-parse', 'HEAD'], { cwd: 代码根目录 }),
      执行文件('git', ['status', '--porcelain', '--untracked-files=normal'], { cwd: 代码根目录 }),
    ])
    提交 = 提交结果.stdout.trim()
    已修改 = 状态结果.stdout.length > 0
  } catch {
    // 源码分发包或未安装 Git 时仍保存实际文件指纹，不将未知状态记为干净。
  }
  return { commit: 提交, dirty: 已修改, sha256: 计算指纹(文件指纹们) }
}

export async function 收集复现信息(数据: 数据集, 实现: 参考实现): Promise<复现信息> {
  let [代码, 评分源码] = await Promise.all([读取代码版本(), readFile(new URL('./scoring.ts', import.meta.url))])
  return {
    code: 代码,
    datasetSha256: 计算指纹(数据),
    scoringSourceSha256: createHash('sha256').update(评分源码).digest('hex'),
    implementationConfig: structuredClone(实现.导出配置()),
  }
}
