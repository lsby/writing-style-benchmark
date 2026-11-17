import type { 作者资料 } from '../engine/data/dataset.js'

export type 参考输入 = { 作者: 作者资料; 写作任务: string }

/** 参测方案提供参考文本，模型消息由调用方组织。 */
export abstract class 参考实现 {
  public abstract readonly 名称: string
  public abstract readonly 说明: string
  public abstract 获取参考文本(输入: 参考输入): string | Promise<string>
}
