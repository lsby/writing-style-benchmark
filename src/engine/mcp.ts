import { McpServer, type CallToolResult } from '@modelcontextprotocol/server'
import { randomUUID } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { z } from 'zod'
import { 构造参考文本, type 参考实现 } from '../implementations/base.js'
import { 写作题目 } from '../questions/question.js'
import { 加载数据集 } from './data/dataset.js'
import { 作者目录 } from './data/paths.js'
import { 收集复现信息, type 复现信息 } from './evaluation/provenance.js'

export async function 创建参考服务(
  实现们: readonly 参考实现[],
  仓库目录: string = fileURLToPath(new URL('../../', import.meta.url)),
): Promise<McpServer> {
  if (实现们.length === 0) throw new Error('至少需要一个参考实现')
  let 注册实现 = [...实现们]
  let 已见名称 = new Set<string>()
  for (let 实现 of 注册实现) {
    if (已见名称.has(实现.名称)) throw new Error(`重复参考实现：${实现.名称}`)
    已见名称.add(实现.名称)
  }
  let 数据 = await 加载数据集(仓库目录)
  let 待提交 = new Map<
    string,
    { 题目: 写作题目; 作者: string; 实现: string; 参考: string; 复现: 复现信息; 提交中: boolean }
  >()
  // version 是 MCP 协议必填字段，不维护项目版本号。
  let 服务 = new McpServer({ name: 'writing-style-benchmark', version: '' })
  服务.registerTool(
    'list_implementations',
    {
      description: '列出可用参考实现的名称和说明。',
      inputSchema: z.strictObject({}),
      annotations: { readOnlyHint: true },
    },
    (): CallToolResult => ({
      content: [
        { type: 'text', text: JSON.stringify(注册实现.map((实现) => ({ name: 实现.名称, description: 实现.说明 }))) },
      ],
    }),
  )
  服务.registerTool(
    'get_reference',
    {
      description: '按实现、作者和当前写作任务获取参考文本。作者可使用原名或 author-slugs.json 中的标识。',
      inputSchema: z.strictObject({
        implementation: z.string().trim().min(1),
        author: z.enum(数据.authors.flatMap((作者) => [作者.姓名, 作者目录(作者.姓名)])),
        task: z.string().trim().min(1),
      }),
      annotations: { readOnlyHint: true },
    },
    async ({ implementation, author, task }): Promise<CallToolResult> => {
      let 实现 = 注册实现.find((候选) => 候选.名称 === implementation)
      if (实现 === undefined)
        return { isError: true, content: [{ type: 'text', text: `未知参考实现：${implementation}` }] }
      let 作者 = 数据.authors.find((候选) => 候选.姓名 === author || 作者目录(候选.姓名) === author)
      if (作者 === undefined) return { isError: true, content: [{ type: 'text', text: `未知作者：${author}` }] }
      let 参考文本 = 构造参考文本(await 实现.获取参考文本({ 作者: structuredClone(作者), 写作任务: task }))
      return { content: [{ type: 'text', text: 参考文本 }] }
    },
  )
  服务.registerTool(
    'start_writing',
    {
      description: '开始写作并取得本次参考文本，返回 run_id，作答后用 save_result 保存。',
      inputSchema: z.strictObject({
        implementation: z.string().trim().min(1),
        author: z.enum(数据.authors.flatMap((作者) => [作者.姓名, 作者目录(作者.姓名)])),
        question: z.strictObject({
          id: z.string().min(1),
          title: z.string().min(1),
          kind: z.enum(['article', 'rewrite', 'dialogue']),
          input: z.string().min(1),
          min: z.number().int().positive(),
          max: z.number().int().positive(),
        }),
      }),
      annotations: { readOnlyHint: false },
    },
    async ({ implementation, author, question }): Promise<CallToolResult> => {
      let 实现 = 注册实现.find((候选) => 候选.名称 === implementation)
      if (实现 === undefined)
        return { isError: true, content: [{ type: 'text', text: `未知参考实现：${implementation}` }] }
      let 作者 = 数据.authors.find((候选) => 候选.姓名 === author || 作者目录(候选.姓名) === author)
      if (作者 === undefined) return { isError: true, content: [{ type: 'text', text: `未知作者：${author}` }] }
      let 题目 = new 写作题目({
        编号: question.id,
        标题: question.title,
        类型: question.kind,
        要求: question.input,
        最少字数: question.min,
        最多字数: question.max,
      })
      let 复现 = await 收集复现信息(数据, 实现)
      let 参考 = 构造参考文本(await 实现.获取参考文本(题目.出题(作者)))
      let run_id = randomUUID()
      待提交.set(run_id, { 题目, 作者: 作者.姓名, 实现: 实现.名称, 参考, 复现, 提交中: false })
      return { content: [{ type: 'text', text: JSON.stringify({ run_id, reference: 参考 }) }] }
    },
  )
  服务.registerTool(
    'save_result',
    {
      description: '将本次作答原文保存到服务端 baselines 目录，记录字数检查，不评分。',
      inputSchema: z.strictObject({
        run_id: z.string().uuid(),
        output: z.string().refine((值) => 值.trim().length > 0, '正文不能为空'),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false },
    },
    async ({ run_id, output }): Promise<CallToolResult> => {
      let 任务 = 待提交.get(run_id)
      if (任务 === undefined || 任务.提交中)
        return { isError: true, content: [{ type: 'text', text: '未知、已提交或正在提交的 run_id' }] }
      任务.提交中 = true
      try {
        let 时间戳 = Date.now()
        let 基线目录 = path.join(仓库目录, 'baselines')
        await mkdir(基线目录, { recursive: true })
        let 目录 = path.join(基线目录, String(时间戳))
        await mkdir(目录)
        let 题目 = 任务.题目.导出()
        let 检查 = 任务.题目.检查(output)
        let 写JSON = async (文件: string, 内容: unknown): Promise<void> => {
          await writeFile(path.join(目录, 文件), JSON.stringify(内容, null, 2) + '\n', 'utf8')
        }
        await 写JSON('question.json', 题目)
        await writeFile(path.join(目录, 'reference.txt'), 任务.参考, 'utf8')
        await writeFile(path.join(目录, 'output.txt'), output, 'utf8')
        await 写JSON('evaluation.json', null)
        await 写JSON('metadata.json', {
          id: String(时间戳),
          author: 任务.作者,
          implementation: 任务.实现,
          provenance: 任务.复现,
          writerMessagesSha256: null,
          judgeMessagesSha256: null,
          judgeSchemaSha256: null,
          questionId: 题目.id,
          unixTimestamp: 时间戳,
          timestampUnit: 'milliseconds',
          startedAt: new Date(时间戳).toISOString(),
          updatedAt: new Date().toISOString(),
          status: 'complete',
          source: 'mcp',
          writer: null,
          judge: null,
          checks: { passed: 检查.通过, characterCount: 检查.字数, issues: 检查.问题 },
          error: null,
        })
        待提交.delete(run_id)
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                directory: `baselines/${时间戳}`,
                checks: { passed: 检查.通过, characterCount: 检查.字数, issues: 检查.问题 },
              }),
            },
          ],
        }
      } catch (错误) {
        任务.提交中 = false
        throw 错误
      }
    },
  )
  return 服务
}
