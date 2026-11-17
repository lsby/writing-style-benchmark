import assert from 'node:assert/strict'
import { test } from 'node:test'
import { 作者 } from '../src/engine/data/authors.js'
import W01 from '../src/questions/article/W01.js'
import W02 from '../src/questions/article/W02.js'
import W03 from '../src/questions/article/W03.js'
import W04 from '../src/questions/article/W04.js'
import W05 from '../src/questions/article/W05.js'
import W06 from '../src/questions/article/W06.js'
import W07 from '../src/questions/article/W07.js'
import W08 from '../src/questions/article/W08.js'
import D01 from '../src/questions/dialogue/D01.js'
import D02 from '../src/questions/dialogue/D02.js'
import R01 from '../src/questions/rewrite/R01.js'
import R02 from '../src/questions/rewrite/R02.js'

await test('直接引用的十二道题保留完整要求，出题不修改作者原文', () => {
  let 题目们 = [W01, W02, W03, W04, W05, W06, W07, W08, R01, R02, D01, D02]
  assert.equal(new Set(题目们.map((题) => 题.导出().id)).size, 12)
  for (let 题 of 题目们) {
    let 数据 = 题.导出()
    assert.ok(数据.input.length > 0 && 数据.min > 0 && 数据.max >= 数据.min)
  }
  assert.match(R01.导出().input, /按了两次，它亮了/)
  assert.match(R02.导出().input, /把计步软件关掉了/)
  let 资料 = { 姓名: 作者.朱光潜, 文章: [{ 标题: '小文', 正文: '原文' }] }
  let 输入 = W01.出题(资料)
  assert.equal(输入.写作任务, W01.导出().input)
  let 文章 = 输入.作者.文章[0]
  assert.ok(文章 !== undefined)
  文章.正文 = '修改'
  assert.equal(资料.文章[0]?.正文, '原文')
  assert.equal(W01.导出().id, 'W01')
  assert.equal(D01.导出().kind, 'dialogue')
})
