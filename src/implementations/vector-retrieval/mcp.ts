import { MCP运行入口 } from '../base.js'
import { 向量检索实现, 默认向量缓存目录 } from './index.js'

/** 向量MCP入口包含该方案的服务配置，并支持启动参考服务。 */
export class 向量MCP入口 extends MCP运行入口 {
  public constructor() {
    super(
      new 向量检索实现({
        类型: '本地',
        模型: 'Xenova/paraphrase-multilingual-MiniLM-L12-v2',
        精度: 'fp32',
        缓存目录: 默认向量缓存目录,
        检索数量: 30, // 返回最相似的 N 句原文。
        批量大小: 32, // 每次编码的原句数量。
      }),
    )
  }
}
