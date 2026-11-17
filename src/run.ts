import { 作者, 全文实现, 测试引擎 } from './engine/index.js'
import 题目_等待 from './questions/article/W01.js'

// 在这里明确填写两份 API 配置。无需认证的服务将密钥显式设为空字符串。
let 引擎 = new 测试引擎({
  作者: [作者.朱光潜, 作者.张爱玲],
  题目: [题目_等待],
  实现: new 全文实现(),
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
console.log(await 引擎.运行())
