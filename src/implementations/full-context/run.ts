import { 作者 } from '../../engine/data/authors.js'
import 题目_等待 from '../../questions/article/W01.js'
import 题目_命令行说明 from '../../questions/article/W09.js'
import 题目_接口接入 from '../../questions/article/W10.js'
import 题目_故障排查 from '../../questions/article/W11.js'
import { 基准运行入口 } from '../base.js'
import { 全文实现 } from './index.js'

/** 全文运行入口包含该方案的基准配置，并支持执行完整基准。 */
export class 全文运行入口 extends 基准运行入口 {
  public constructor() {
    let 实现 = new 全文实现()

    super({
      作者: [作者.朱光潜, 作者.张爱玲],
      题目: [题目_等待, 题目_命令行说明, 题目_接口接入, 题目_故障排查],
      实现,
      答题API: {
        地址: 'http://127.0.0.1:11434',
        密钥: '',
        模型: 'gpt-oss-20b',
        参数: { temperature: 0.7, max_tokens: 8192, seed: 42, reasoning_effort: 'low' },
        超时毫秒: 1_800_000,
      },
      评分API: {
        地址: 'http://127.0.0.1:11434',
        密钥: '',
        模型: 'gpt-oss-20b',
        参数: { temperature: 0, max_tokens: 4096, seed: 42, reasoning_effort: 'low' },
        超时毫秒: 1_800_000,
      },
    })
  }
}
