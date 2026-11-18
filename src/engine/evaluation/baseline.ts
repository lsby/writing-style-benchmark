import { writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { 检查结果 } from '../../questions/question.js'
import type { 作者姓名 } from '../data/authors.js'
import type { 题目数据 } from '../data/dataset.js'
import type { API配置, 调用结果 } from '../execution/model.js'
import type { 复现信息 } from './provenance.js'
import type { 单题评分 } from './scoring.js'

export type 基线记录 = {
  目录: string
  编号: string
  时间戳: number
  作者: 作者姓名
  题目: 题目数据
  实现: string
  答题API: API配置
  评分API: API配置
  状态: 'running' | 'complete' | 'failed'
  复现?: 复现信息
  答题消息指纹?: string
  评分消息指纹?: string
  评分格式指纹?: string
  参考文本?: string
  作答?: 调用结果
  评分调用?: 调用结果
  评分?: 单题评分
  检查?: 检查结果
  错误?: string
}

function API元信息(配置: API配置, 调用?: 调用结果): object {
  return {
    address: 配置.地址,
    requestedModel: 配置.模型,
    parameters: 配置.参数,
    timeoutMs: 配置.超时毫秒,
    model: 调用?.model ?? null,
    finishReason: 调用?.finishReason ?? null,
    elapsedSeconds: 调用?.elapsedSeconds ?? null,
    inputTextChars: 调用?.inputTextChars ?? null,
    outputTextChars: 调用?.outputTextChars ?? null,
    usage: 调用?.usage ?? null,
  }
}

/** 新记录保存题目、参考文本、正文、评分和元信息；未完成的评分留空，错误写入元信息。 */
export async function 保存结果(记录: 基线记录): Promise<void> {
  let 写JSON = async (文件: string, 内容: unknown): Promise<void> => {
    await writeFile(path.join(记录.目录, 文件), JSON.stringify(内容, null, 2) + '\n', 'utf8')
  }
  await 写JSON('question.json', 记录.题目)
  await writeFile(path.join(记录.目录, 'reference.txt'), 记录.参考文本 ?? '', 'utf8')
  await writeFile(path.join(记录.目录, 'output.txt'), 记录.作答?.text ?? '', 'utf8')
  await 写JSON('evaluation.json', 记录.评分 ?? null)
  await 写JSON('metadata.json', {
    id: 记录.编号,
    author: 记录.作者,
    implementation: 记录.实现,
    provenance: 记录.复现 ?? null,
    writerMessagesSha256: 记录.答题消息指纹 ?? null,
    judgeMessagesSha256: 记录.评分消息指纹 ?? null,
    judgeSchemaSha256: 记录.评分格式指纹 ?? null,
    questionId: 记录.题目.id,
    unixTimestamp: 记录.时间戳,
    timestampUnit: 'milliseconds',
    startedAt: new Date(记录.时间戳).toISOString(),
    updatedAt: new Date().toISOString(),
    status: 记录.状态,
    writer: API元信息(记录.答题API, 记录.作答),
    judge: API元信息(记录.评分API, 记录.评分调用),
    checks:
      记录.检查 === undefined
        ? null
        : { passed: 记录.检查.通过, characterCount: 记录.检查.字数, issues: 记录.检查.问题 },
    error: 记录.错误 ?? null,
  })
}
