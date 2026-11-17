import type { 参考实现 } from './base.js'
import { 全文实现 } from './full-context/index.js'

export * from './base.js'
export { 全文实现 } from './full-context/index.js'

// 显式加入方案；MCP 的列举与调用共用这份列表。
export let 可用实现: readonly 参考实现[] = [new 全文实现()]
