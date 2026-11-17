import assert from 'node:assert/strict'
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { z } from 'zod'
import { 作者, 全文实现, 写作题目, 参考实现, 测试引擎, type 参考输入 } from '../src/engine/index.js'

class 异步参考实现 extends 参考实现 {
  public readonly 名称 = 'async-reference'
  public readonly 说明 = '验证调用方可以使用异步返回的参考文本。'

  public async 获取参考文本(输入: 参考输入): Promise<string> {
    assert.equal(输入.作者.姓名, '朱光潜')
    assert.equal(输入.写作任务, '写读书短文，标题独占一行。')
    return Promise.resolve(' \n独有参考片段：纸页边缘的一点光。 \n')
  }
}

await test('API 顺序作答评分并直接生成独立基线，两份 API 配置及用量各自保存', async () => {
  let 目录 = await mkdtemp(path.join(tmpdir(), 'style-baseline-'))
  let 请求们: { path: string; body: Record<string, unknown>; authorization: string | undefined }[] = []
  let 评分 = {
    style: { score: 4, reason: '用词贴近' },
    quality: { score: 3, reason: '完成要求' },
    naturalness: { score: 4, reason: '表达流畅' },
    observations: [],
  }
  let 评分有效 = true
  let 服务 = createServer((请求, 响应) => {
    let 数据 = ''
    请求.setEncoding('utf8')
    请求.on('data', (片段: string) => {
      数据 += 片段
    })
    请求.on('end', () => {
      let body = z.record(z.string(), z.unknown()).parse(JSON.parse(数据))
      请求们.push({ path: 请求.url ?? '', body, authorization: 请求.headers.authorization })
      let 是答题 = 请求.url?.startsWith('/writer/') === true
      响应.setHeader('Content-Type', 'application/json')
      响应.end(
        JSON.stringify({
          model: 是答题 ? 'writer-actual' : 'judge-actual',
          choices: [
            {
              message: { content: 是答题 ? '题目\n书页里的光慢慢落下来。' : JSON.stringify(评分有效 ? 评分 : {}) },
              finish_reason: 'stop',
            },
          ],
          ...(是答题 ? { usage: { prompt_tokens: 20, completion_tokens: 10, total_tokens: 30 } } : {}),
        }),
      )
    })
  })
  await new Promise<void>((完成) => 服务.listen(0, '127.0.0.1', 完成))
  try {
    let 地址 = 服务.address()
    assert.ok(地址 !== null && typeof 地址 !== 'string')
    let 端点 = `http://127.0.0.1:${地址.port}`
    let 题 = new 写作题目({
      编号: 'short',

      标题: '短文',
      类型: 'article',
      要求: '写读书短文，标题独占一行。',
      最少字数: 1,
      最多字数: 30,
    })
    let 通用配置 = { 题目: [题], 作者: [作者.朱光潜], 实现: new 全文实现(), 基线目录: 目录 }
    let 有效API = { 地址: `${端点}/writer`, 模型: 'writer', 密钥: '' }
    assert.throws(
      () => new 测试引擎({ ...通用配置, 答题API: { ...有效API, 地址: '' }, 评分API: 有效API }),
      /答题API.地址不能为空/,
    )
    assert.throws(
      () => new 测试引擎({ ...通用配置, 答题API: 有效API, 评分API: { ...有效API, 模型: '' } }),
      /评分API.模型不能为空/,
    )
    assert.throws(
      () => new 测试引擎({ ...通用配置, 答题API: 有效API, 评分API: { ...有效API, 地址: 'file:///tmp/model' } }),
      /评分API.地址必须使用 HTTP/,
    )
    assert.equal(请求们.length, 0)
    assert.deepEqual(await readdir(目录), [])
    let 引擎 = new 测试引擎({
      题目: [题],
      作者: [作者.朱光潜],
      实现: new 异步参考实现(),
      基线目录: 目录,
      答题API: { 地址: `${端点}/writer`, 模型: 'writer-requested', 密钥: 'writer-secret', 参数: { temperature: 0.8 } },
      评分API: { 地址: `${端点}/judge/v1`, 模型: 'judge-requested', 密钥: 'judge-secret', 参数: { temperature: 0.1 } },
    })
    let 结果 = await 引擎.运行()
    let 项 = 结果[0]
    assert.ok(项 !== undefined)
    assert.equal(结果.length, 1)
    assert.match(path.basename(项.目录), /^\d{13}$/)
    assert.equal(请求们.length, 2)
    let 答题请求 = 请求们.at(0)
    let 评分请求 = 请求们.at(1)
    assert.ok(答题请求 !== undefined && 评分请求 !== undefined)
    assert.equal(答题请求.path, '/writer/v1/chat/completions')
    assert.equal(评分请求.path, '/judge/v1/chat/completions')
    assert.equal(答题请求.authorization, 'Bearer writer-secret')
    assert.equal(评分请求.authorization, 'Bearer judge-secret')
    assert.equal(答题请求.body.model, 'writer-requested')
    assert.equal(评分请求.body.model, 'judge-requested')
    assert.equal(答题请求.body.temperature, 0.8)
    assert.equal(评分请求.body.temperature, 0.1)
    assert.equal(答题请求.body.max_tokens, undefined)
    assert.equal(评分请求.body.max_tokens, undefined)
    let 答题消息 = z
      .array(z.object({ role: z.enum(['system', 'user']), content: z.string() }))
      .parse(答题请求.body.messages)
    assert.deepEqual(
      答题消息.map((消息) => 消息.role),
      ['system', 'user'],
    )
    let 用户消息 = 答题消息.at(1)
    assert.ok(用户消息 !== undefined)
    assert.equal(用户消息.content.includes('独有参考片段：纸页边缘的一点光。'), true)
    assert.equal(用户消息.content.includes(题.导出().input), true)
    assert.equal(JSON.stringify(评分请求.body.messages).includes('独有参考片段'), false)
    assert.ok(JSON.stringify(评分请求.body.messages).includes('书页里的光'))
    assert.equal(await readFile(path.join(项.目录, 'output.txt'), 'utf8'), '题目\n书页里的光慢慢落下来。')
    assert.deepEqual(JSON.parse(await readFile(path.join(项.目录, 'evaluation.json'), 'utf8')), 评分)
    let 文件们 = ['evaluation.json', 'metadata.json', 'output.txt', 'question.json', 'reference.txt']
    assert.deepEqual((await readdir(项.目录)).sort(), 文件们)
    assert.equal(await readFile(path.join(项.目录, 'reference.txt'), 'utf8'), ' \n独有参考片段：纸页边缘的一点光。 \n')
    assert.deepEqual(JSON.parse(await readFile(path.join(项.目录, 'question.json'), 'utf8')), 题.导出())
    let 调用格式 = z.object({
      address: z.string(),
      requestedModel: z.string(),
      model: z.string().nullable(),
      parameters: z.object({ temperature: z.number() }),
      inputTextChars: z.number().positive(),
      outputTextChars: z.number().positive(),
      elapsedSeconds: z.number().nonnegative(),
      usage: z.object({ total_tokens: z.number() }).nullable(),
    })
    let 元信息 = z
      .object({
        status: z.literal('complete'),
        author: z.literal('朱光潜'),
        implementation: z.literal('async-reference'),
        questionId: z.literal('short'),

        unixTimestamp: z.number(),
        timestampUnit: z.literal('milliseconds'),
        writer: 调用格式,
        judge: 调用格式,
        error: z.null(),
        checks: z.object({ passed: z.boolean(), characterCount: z.number(), issues: z.array(z.string()) }).strict(),
      })
      .parse(JSON.parse(await readFile(path.join(项.目录, 'metadata.json'), 'utf8')))
    assert.equal(String(元信息.unixTimestamp), path.basename(项.目录))
    assert.equal(元信息.writer.address, `${端点}/writer`)
    assert.equal(元信息.judge.address, `${端点}/judge/v1`)
    assert.equal(元信息.writer.requestedModel, 'writer-requested')
    assert.equal(元信息.judge.requestedModel, 'judge-requested')
    assert.equal(元信息.writer.model, 'writer-actual')
    assert.equal(元信息.judge.model, 'judge-actual')
    assert.equal(元信息.writer.parameters.temperature, 0.8)
    assert.equal(元信息.judge.parameters.temperature, 0.1)
    assert.equal(元信息.writer.usage?.total_tokens, 30)
    assert.equal(元信息.judge.usage, null)
    for (let 文件 of 文件们) {
      let 文本: string = await readFile(path.join(项.目录, 文件), 'utf8')
      assert.equal(文本.includes('writer-secret') || 文本.includes('judge-secret'), false)
      if (文件 !== 'reference.txt') assert.equal(文本.includes('独有参考片段'), false)
    }
    // 裁判输出无效时保留已生成作品，停止后续调用。
    评分有效 = false
    let 失败目录 = path.join(目录, 'failure')
    let 失败引擎 = new 测试引擎({
      题目: [题],
      作者: [作者.朱光潜],
      实现: new 全文实现(),
      基线目录: 失败目录,
      答题API: { 地址: `${端点}/writer`, 模型: 'writer', 密钥: '' },
      评分API: { 地址: `${端点}/judge`, 模型: 'judge', 密钥: '' },
    })
    await assert.rejects(失败引擎.运行())
    assert.equal(请求们.length, 4)
    let 失败项 = (await readdir(失败目录))[0]
    assert.ok(失败项 !== undefined)
    assert.equal(await readFile(path.join(失败目录, 失败项, 'output.txt'), 'utf8'), '题目\n书页里的光慢慢落下来。')
    assert.deepEqual((await readdir(path.join(失败目录, 失败项))).sort(), 文件们)
    assert.ok((await readFile(path.join(失败目录, 失败项, 'reference.txt'), 'utf8')).includes('参考作者：朱光潜'))
    assert.equal(JSON.parse(await readFile(path.join(失败目录, 失败项, 'evaluation.json'), 'utf8')), null)
    let 失败信息 = z
      .object({
        status: z.literal('failed'),
        error: z.string().min(1),
        writer: z.object({ usage: z.object({ total_tokens: z.number() }) }),
        judge: z.object({ model: z.literal('judge-actual') }),
      })
      .parse(JSON.parse(await readFile(path.join(失败目录, 失败项, 'metadata.json'), 'utf8')))
    assert.equal(失败信息.writer.usage.total_tokens, 30)
  } finally {
    await new Promise<void>((完成, 失败) => 服务.close((错误) => (错误 === undefined ? 完成() : 失败(错误))))
    await rm(目录, { recursive: true, force: true })
  }
})
