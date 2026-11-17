import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { test } from 'node:test'
import { 统计文本字符, 调用模型 } from '../src/engine/execution/model.js'

await test('上下文包含各条消息及空白，汉字和补充平面字符均按一个字符计', () => {
  assert.deepEqual(
    统计文本字符(
      [
        { role: 'system', content: '甲\n' },
        { role: 'user', content: '𠮷 乙' },
      ],
      '标题\n正文',
    ),
    { inputTextChars: 5, outputTextChars: 5 },
  )
})

await test('独立配置、认证、参数、响应及错误处理', async () => {
  let 请求们: { url: string | undefined; authorization: string | undefined; body: unknown }[] = []
  let 服务 = createServer(async (请求, 响应) => {
    let 内容 = ''
    for await (let 数据 of 请求) 内容 += String(数据)
    请求们.push({ url: 请求.url, authorization: 请求.headers.authorization, body: JSON.parse(内容) as unknown })
    let 序号 = 请求们.length
    if (序号 === 3) {
      响应.writeHead(503)
      响应.end('unavailable')
      return
    }
    响应.setHeader('content-type', 'application/json')
    响应.end(
      JSON.stringify(
        序号 === 4
          ? { model: 'alias', choices: [{ message: { content: '  ' }, finish_reason: 'stop' }] }
          : 序号 === 5
            ? { model: 'alias', choices: [] }
            : {
                model: 'alias',
                choices: [{ message: { content: '答𠮷' }, finish_reason: 'stop' }],
                ...(序号 === 1 ? { usage: { prompt_tokens: 2 } } : {}),
              },
      ),
    )
  })
  await new Promise<void>((resolve) => 服务.listen(0, '127.0.0.1', resolve))
  try {
    let 地址信息 = 服务.address()
    if (地址信息 === null || typeof 地址信息 === 'string') throw new Error('服务地址无效')
    let 地址 = `http://127.0.0.1:${地址信息.port}`
    let 消息们 = [{ role: 'user' as const, content: '你好' }]
    let 格式 = { type: 'object' }
    let 结果 = await 调用模型(
      {
        地址,
        模型: 'requested',
        密钥: 'secret',
        参数: { temperature: 0.5, max_tokens: 10, seed: 1, reasoning_effort: 'high' },
      },
      消息们,
      格式,
    )
    let 首次请求 = 请求们.at(0)
    assert.ok(首次请求 !== undefined)
    assert.equal(首次请求.url, '/v1/chat/completions')
    assert.equal(首次请求.authorization, 'Bearer secret')
    assert.deepEqual(首次请求.body, {
      model: 'requested',
      messages: 消息们,
      temperature: 0.5,
      max_tokens: 10,
      seed: 1,
      reasoning_effort: 'high',
      stream: false,
      response_format: { type: 'json_schema', json_schema: { name: 'evaluation', strict: true, schema: 格式 } },
    })
    assert.equal(结果.model, 'alias')
    assert.equal(结果.inputTextChars, 2)
    assert.equal(结果.outputTextChars, 2)
    assert.deepEqual(结果.usage, { prompt_tokens: 2 })
    assert.ok(结果.elapsedSeconds >= 0)
    assert.ok(!JSON.stringify(结果).includes('secret'))
    let 第二次 = await 调用模型({ 地址: `${地址}/v1/`, 模型: 'other', 密钥: '' }, 消息们)
    let 第二次请求 = 请求们.at(1)
    assert.ok(第二次请求 !== undefined)
    assert.equal(第二次请求.url, '/v1/chat/completions')
    assert.equal(第二次请求.authorization, undefined)
    assert.equal(第二次.usage, undefined)
    await assert.rejects(调用模型({ 地址, 模型: 'other', 密钥: '' }, 消息们), /HTTP 503/)
    await assert.rejects(调用模型({ 地址, 模型: 'other', 密钥: '' }, 消息们), /没有给出正文/)
    await assert.rejects(调用模型({ 地址, 模型: 'other', 密钥: '' }, 消息们))
    assert.equal(请求们.length, 5)
  } finally {
    await new Promise<void>((resolve, reject) => 服务.close((错误) => (错误 === undefined ? resolve() : reject(错误))))
  }
})
