import assert from 'node:assert/strict'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { 作者 as 作者枚举 } from '../src/engine/data/authors.js'
import { 加载数据集 } from '../src/engine/data/dataset.js'
import { 单题评分格式, 构造评分消息 } from '../src/engine/evaluation/scoring.js'
import { 构造参考文本 } from '../src/implementations/base.js'
import { 全文实现 } from '../src/implementations/full-context/index.js'
import 等待题 from '../src/questions/article/W01.js'
import { 统计正文字数 } from '../src/questions/question.js'

await test('作者资料只含姓名和分篇文章，写作与评分各自组织全部原文', async () => {
  let 资料集 = await 加载数据集(fileURLToPath(new URL('../', import.meta.url)))
  assert.deepEqual(资料集.authors.map((项) => 项.姓名).sort(), Object.values(作者枚举).sort())
  assert.equal(
    资料集.authors.reduce((数量, 作者) => 数量 + 作者.文章.length, 0),
    54,
  )
  for (let 作者资料 of 资料集.authors) {
    assert.deepEqual(Object.keys(作者资料).sort(), ['姓名', '文章'])
    for (let 文章 of 作者资料.文章) {
      assert.deepEqual(Object.keys(文章).sort(), ['标题', '正文'])
      assert.ok(文章.标题.length > 0 && 文章.正文.length > 0)
    }
  }
  let 作者 = 资料集.authors[0]
  assert.ok(作者 !== undefined)
  let 题目 = 等待题.导出()
  let 参考文本 = 构造参考文本(作者.姓名, new 全文实现().获取参考文本(等待题.出题(作者)))
  assert.equal(typeof 参考文本, 'string')
  assert.equal(参考文本.includes(题目.input), false)
  assert.ok(参考文本.includes(作者.姓名))
  for (let 文章 of 作者.文章) {
    assert.ok(参考文本.includes(文章.标题) && 参考文本.includes(文章.正文))
  }
  let 评审消息 = 构造评分消息(作者, 题目, '唯一待评正文', 6, 'stop')
  assert.equal(评审消息.filter((消息) => 消息.role === 'system').length, 1)
  let 评审文本 = 评审消息.map((消息) => 消息.content).join('\n')
  for (let 标准 of [
    '# 评分标准',
    '## 1. 作者风格贴近程度',
    '## 2. 作品完成质量',
    '## 3. 表达自然程度',
    '## 单独记录的现象',
    '不按个人是否赞同其立场评分',
    '作者特有的用词、典故与联想方式、表达质地',
    '华丽用词和典故都不是必选项',
    '刻意点题',
    '不按某个词、句式或“有结尾”本身扣分',
    '不猜测作品由人还是模型写成',
  ])
    assert.ok(评审文本.includes(标准))
  assert.equal(评审消息.at(-1)?.content.includes('唯一待评正文'), true)
  for (let 文章 of 作者.文章) assert.ok(评审消息.some((消息) => 消息.content.includes(文章.正文)))
})

await test('超范围分数或缺失理由不能当成有效评分', () => {
  let 合法评分 = { score: 3, reason: '有具体依据' }
  assert.equal(
    单题评分格式.safeParse({ style: 合法评分, quality: 合法评分, naturalness: 合法评分, observations: [] }).success,
    true,
  )
  assert.equal(
    单题评分格式.safeParse({
      style: { score: 6, reason: '高分' },
      quality: 合法评分,
      naturalness: 合法评分,
      observations: [],
    }).success,
    false,
  )
  assert.equal(
    单题评分格式.safeParse({
      style: { score: 3, reason: '' },
      quality: 合法评分,
      naturalness: 合法评分,
      observations: [],
    }).success,
    false,
  )
})

await test('字数按字符计数，文章排除首行标题，对话保留首行', () => {
  assert.equal(统计正文字数('标题\n\n正文。\n甲 乙', 'article'), 5)
  assert.equal(统计正文字数('你好。\n再见。', 'dialogue'), 6)
})
