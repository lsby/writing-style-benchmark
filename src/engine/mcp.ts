import { McpServer, type CallToolResult } from '@modelcontextprotocol/server'
import { fileURLToPath } from 'node:url'
import { z } from 'zod'
import { 可用实现, type 参考实现 } from '../implementations/index.js'
import { 加载数据集 } from './data/dataset.js'
import { 作者目录 } from './data/paths.js'

export async function 创建参考服务(
  实现们: readonly 参考实现[] = 可用实现,
  仓库目录: string = fileURLToPath(new URL('../../', import.meta.url)),
): Promise<McpServer> {
  let 注册实现 = [...实现们]
  let 已见名称 = new Set<string>()
  for (let 实现 of 注册实现) {
    if (已见名称.has(实现.名称)) throw new Error(`重复参考实现：${实现.名称}`)
    已见名称.add(实现.名称)
  }
  let 数据 = await 加载数据集(仓库目录)
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
      let 参考文本 = await 实现.获取参考文本({ 作者: structuredClone(作者), 写作任务: task })
      return { content: [{ type: 'text', text: 参考文本 }] }
    },
  )
  return 服务
}
