import { Client, type CallToolResult } from '@modelcontextprotocol/client'
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio'
import { InMemoryTransport } from '@modelcontextprotocol/server'
import assert from 'node:assert/strict'
import { tmpdir } from 'node:os'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { 作者 as 作者枚举 } from '../src/engine/data/authors.js'
import { 加载数据集 } from '../src/engine/data/dataset.js'
import { 作者目录 } from '../src/engine/data/paths.js'
import { 创建参考服务 } from '../src/engine/mcp.js'
import { 参考实现, 可用实现, type 参考输入 } from '../src/implementations/index.js'

let 仓库目录 = fileURLToPath(new URL('../', import.meta.url))

function 读取文本(结果: CallToolResult): string {
  assert.equal(结果.content.length, 1)
  let 内容 = 结果.content[0]
  assert.ok(内容 !== undefined && 内容.type === 'text')
  return 内容.text
}

await test('真实 stdio 仅提供两个只读工具，按作者原名或标识返回全文参考，拒绝无效请求', async () => {
  let 客户端 = new Client({ name: 'reference-test', version: '' })
  let 传输 = new StdioClientTransport({
    command: process.execPath,
    args: ['--import', import.meta.resolve('tsx'), fileURLToPath(new URL('../src/mcp.ts', import.meta.url))],
    cwd: tmpdir(),
  })
  try {
    await 客户端.connect(传输)
    let { tools: 工具们 } = await 客户端.listTools()
    assert.deepEqual(工具们.map((工具) => 工具.name).sort(), ['get_reference', 'list_implementations'])
    assert.ok(工具们.every((工具) => 工具.annotations?.readOnlyHint === true))
    let 列表 = await 客户端.callTool({ name: 'list_implementations', arguments: {} })
    assert.deepEqual(
      JSON.parse(读取文本(列表)),
      可用实现.map((实现) => ({ name: 实现.名称, description: 实现.说明 })),
    )
    let 数据 = await 加载数据集(仓库目录)
    let 作者 = 数据.authors.find((候选) => 候选.姓名 === '朱光潜')
    let 实现 = 可用实现.find((候选) => 候选.名称 === 'full-context')
    assert.ok(作者 !== undefined && 实现 !== undefined)
    let task = '写一篇有关读书的短文。'
    let 预期 = await 实现.获取参考文本({ 作者, 写作任务: task })
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
  await assert.rejects(创建参考服务([实现, 实现], 仓库目录), /重复参考实现/)
  let 服务 = await 创建参考服务([实现], 仓库目录)
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
      assert.equal(读取文本(结果), '  自定义参考文本\n{"原样":true}\n')
    }
    assert.deepEqual(
      实现.调用们.map((输入) => 输入.写作任务),
      ['第一项任务', '第二项任务'],
    )
    assert.ok(实现.调用们.every((输入) => 输入.作者.姓名 === '朱光潜' && 输入.作者.文章.length > 0))
  } finally {
    await 客户端.close()
    await 服务.close()
  }
})
