import { MCP运行入口 } from '../base.js'
import { 向量检索实现 } from './index.js'

/** 向量MCP入口包含该方案的服务配置，并支持启动参考服务。 */
export class 向量MCP入口 extends MCP运行入口 {
  protected 创建实现(): 向量检索实现 {
    return new 向量检索实现({
      地址: 'http://127.0.0.1:11434', // 本地向量服务，与答题、评分 API 独立。
      模型: 'text-embedding-nomic-embed-text-v1.5@q8_0',
      密钥: '', // 无需认证时明确留空。
      检索数量: 30, // 返回最相似的 N 句原文。
      批量大小: 32, // 每次编码的原句数量。
      超时毫秒: 30 * 60_000,
      文档前缀: 'search_document: ', // 按向量模型的要求填写，模型不需要前缀时留空。
      查询前缀: 'search_query: ',
    })
  }
}
