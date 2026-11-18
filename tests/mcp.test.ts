import { Client, type CallToolResult } from '@modelcontextprotocol/client'
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio'
import { InMemoryTransport } from '@modelcontextprotocol/server'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { cp, mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { z } from 'zod'
import { 作者 as 作者枚举 } from '../src/engine/data/authors.js'
import { 加载数据集 } from '../src/engine/data/dataset.js'
import { 作者目录 } from '../src/engine/data/paths.js'
import { 创建参考服务 } from '../src/engine/mcp.js'
import { 构造参考文本 } from '../src/implementations/base.js'
import { 全文实现, 参考实现, type 参考输入 } from '../src/implementations/index.js'

let 仓库目录 = fileURLToPath(new URL('../', import.meta.url))

function 读取文本(结果: CallToolResult): string {
  assert.equal(结果.content.length, 1)
  let 内容 = 结果.content[0]
  assert.ok(内容 !== undefined && 内容.type === 'text')
  return 内容.text
}

await test('真实 stdio 提供参考和保存工具，按作者原名或标识返回全文参考，拒绝无效请求', async () => {
  let 入口地址们 = [
    'full-context/run.ts',
    'full-context/mcp.ts',
    'vector-retrieval/run.ts',
    'vector-retrieval/mcp.ts',
  ].map((文件) => new URL(`../src/implementations/${文件}`, import.meta.url).href)
  let 导入输出 = execFileSync(
    process.execPath,
    [
      '--import',
      import.meta.resolve('tsx'),
      '--input-type=module',
      '--eval',
      `globalThis.fetch = () => { throw new Error('导入时请求模型') }; for (let 地址 of ${JSON.stringify(入口地址们)}) await import(地址); console.log('导入完成')`,
    ],
    { cwd: tmpdir(), encoding: 'utf8', timeout: 10_000 },
  )
  assert.equal(导入输出.trim(), '导入完成')
  let 客户端 = new Client({ name: 'reference-test', version: '' })
  let 传输 = new StdioClientTransport({
    command: process.execPath,
    args: [
      '--import',
      import.meta.resolve('tsx'),
      '--input-type=module',
      '--eval',
      `await new (await import(${JSON.stringify(new URL('../src/implementations/full-context/mcp.ts', import.meta.url).href)})).全文MCP入口().启动()`,
    ],
    cwd: tmpdir(),
  })
  try {
    await 客户端.connect(传输)
    let { tools: 工具们 } = await 客户端.listTools()
    assert.deepEqual(工具们.map((工具) => 工具.name).sort(), [
      'get_reference',
      'list_implementations',
      'save_result',
      'start_writing',
    ])
    assert.ok(
      工具们
        .filter((工具) => ['get_reference', 'list_implementations'].includes(工具.name))
        .every((工具) => 工具.annotations?.readOnlyHint === true),
    )
    assert.ok(
      工具们
        .filter((工具) => ['save_result', 'start_writing'].includes(工具.name))
        .every((工具) => 工具.annotations?.readOnlyHint === false),
    )
    let 列表 = await 客户端.callTool({ name: 'list_implementations', arguments: {} })
    let 列出的实现 = z
      .array(z.object({ name: z.string(), description: z.string().min(1) }))
      .parse(JSON.parse(读取文本(列表)))
    let 实现 = new 全文实现()
    assert.deepEqual(列出的实现, [{ name: 实现.名称, description: 实现.说明 }])
    let 数据 = await 加载数据集(仓库目录)
    let 作者 = 数据.authors.find((候选) => 候选.姓名 === '朱光潜')
    assert.ok(作者 !== undefined)
    let task = '写一篇有关读书的短文。'
    let 预期 = 构造参考文本(作者.姓名, 实现.获取参考文本({ 作者, 写作任务: task }))
    for (let author of [作者.姓名, 作者目录(作者.姓名)]) {
      let 结果 = await 客户端.callTool({
        name: 'get_reference',
        arguments: { implementation: 实现.名称, author, task },
      })
      assert.ok(结果.isError !== true)
      assert.equal(读取文本(结果), 预期)
      for (let 文章 of 作者.文章) assert.ok(读取文本(结果).includes(文章.正文))
    }
    for (let 参数 of [
      { implementation: 'missing', author: 作者.姓名, task },
      { implementation: 实现.名称, author: '不存在的作者', task },
      { implementation: 实现.名称, author: 作者.姓名, task: '  \n' },
      { implementation: '', author: 作者.姓名, task },
      { implementation: 实现.名称, author: '', task },
      { implementation: 实现.名称, author: 作者.姓名, task, extra: true },
    ]) {
      let 失败 = await 客户端.callTool({ name: 'get_reference', arguments: 参数 })
      assert.equal(失败.isError, true)
    }
  } finally {
    await 客户端.close()
    await 传输.close()
  }
  let 向量客户端 = new Client({ name: 'vector-reference-test', version: '' })
  let 向量传输 = new StdioClientTransport({
    command: process.execPath,
    args: [
      '--import',
      import.meta.resolve('tsx'),
      '--input-type=module',
      '--eval',
      `await new (await import(${JSON.stringify(new URL('../src/implementations/vector-retrieval/mcp.ts', import.meta.url).href)})).向量MCP入口().启动()`,
    ],
    cwd: tmpdir(),
  })
  try {
    await 向量客户端.connect(向量传输)
    let 列表 = await 向量客户端.callTool({ name: 'list_implementations', arguments: {} })
    let 列出的实现 = z
      .array(z.object({ name: z.string(), description: z.string().min(1) }))
      .parse(JSON.parse(读取文本(列表)))
    assert.deepEqual(
      列出的实现.map((实现) => 实现.name),
      ['vector-retrieval'],
    )
  } finally {
    await 向量客户端.close()
    await 向量传输.close()
  }
})

class 异步参考实现 extends 参考实现 {
  public readonly 名称 = 'async-reference'
  public readonly 说明 = '验证当前写作任务传递和异步文本返回。'
  public 调用们: 参考输入[] = []

  public async 获取参考文本(输入: 参考输入): Promise<string> {
    this.调用们.push(structuredClone(输入))
    输入.作者.姓名 = 作者枚举.鲁迅
    输入.作者.文章.length = 0
    return await Promise.resolve('  自定义参考文本\n{"原样":true}\n')
  }
}

await test('自定义异步实现收到当前任务、文本原样返回，作者资料按调用隔离，重复实现名直接报错', async () => {
  let 实现 = new 异步参考实现()
  await assert.rejects(创建参考服务([], 仓库目录), /至少需要一个参考实现/)
  await assert.rejects(创建参考服务([实现, 实现], 仓库目录), /重复参考实现/)
  let 临时目录 = await mkdtemp(path.join(tmpdir(), 'writing-mcp-'))
  await cp(path.join(仓库目录, 'data'), path.join(临时目录, 'data'), { recursive: true })
  let 服务 = await 创建参考服务([实现], 临时目录)
  let 客户端 = new Client({ name: 'custom-reference-test', version: '' })
  let [客户端传输, 服务端传输] = InMemoryTransport.createLinkedPair()
  try {
    await 服务.connect(服务端传输)
    await 客户端.connect(客户端传输)
    for (let task of ['第一项任务', '第二项任务']) {
      let 结果 = await 客户端.callTool({
        name: 'get_reference',
        arguments: { implementation: 实现.名称, author: 'zhu-guangqian', task },
      })
      assert.ok(结果.isError !== true)
      assert.equal(读取文本(结果), 构造参考文本('朱光潜', '  自定义参考文本\n{"原样":true}\n'))
    }
    assert.deepEqual(
      实现.调用们.map((输入) => 输入.写作任务),
      ['第一项任务', '第二项任务'],
    )
    assert.ok(实现.调用们.every((输入) => 输入.作者.姓名 === '朱光潜' && 输入.作者.文章.length > 0))
    let question = { id: 'W01', title: '测试', kind: 'article', input: '写作要求', min: 2, max: 3 }
    let 开始 = await 客户端.callTool({
      name: 'start_writing',
      arguments: { implementation: 实现.名称, author: 'zhu-guangqian', question },
    })
    assert.ok(开始.isError !== true)
    let { run_id, reference } = z
      .object({ run_id: z.string(), reference: z.string() })
      .parse(JSON.parse(读取文本(开始)))
    assert.equal(reference, 构造参考文本('朱光潜', '  自定义参考文本\n{"原样":true}\n'))
    let 保存 = await 客户端.callTool({ name: 'save_result', arguments: { run_id, output: '标题\n正文过长了' } })
    assert.ok(保存.isError !== true)
    let { directory, checks } = z
      .object({ directory: z.string(), checks: z.object({ passed: z.boolean() }) })
      .parse(JSON.parse(读取文本(保存)))
    assert.equal(checks.passed, false)
    assert.equal(await readFile(path.join(临时目录, directory, 'reference.txt'), 'utf8'), reference)
    assert.equal(await readFile(path.join(临时目录, directory, 'output.txt'), 'utf8'), '标题\n正文过长了')
    assert.deepEqual(JSON.parse(await readFile(path.join(临时目录, directory, 'question.json'), 'utf8')), question)
    assert.equal(JSON.parse(await readFile(path.join(临时目录, directory, 'evaluation.json'), 'utf8')), null)
    let 元信息 = z
      .object({
        source: z.string(),
        writer: z.null(),
        judge: z.null(),
        provenance: z.object({
          code: z.object({
            commit: z.string().nullable(),
            dirty: z.boolean().nullable(),
            sha256: z.string().length(64),
          }),
          datasetSha256: z.string().length(64),
          scoringSourceSha256: z.string().length(64),
          implementationConfig: z.null(),
        }),
        writerMessagesSha256: z.null(),
        judgeMessagesSha256: z.null(),
        judgeSchemaSha256: z.null(),
      })
      .parse(JSON.parse(await readFile(path.join(临时目录, directory, 'metadata.json'), 'utf8')))
    assert.equal(元信息.source, 'mcp')
    assert.equal(元信息.writer, null)
    assert.equal(元信息.judge, null)
    assert.equal(
      (await 客户端.callTool({ name: 'save_result', arguments: { run_id, output: '重复提交' } })).isError,
      true,
    )
  } finally {
    await 客户端.close()
    await 服务.close()
    await rm(临时目录, { recursive: true, force: true })
  }
})
