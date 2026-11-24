import { 参考实现 } from '../base.js'

/** 无参考基线：保留统一消息格式，仅在参考文本中声明无参考。 */
export class 纯题目实现 extends 参考实现 {
  public readonly 名称 = 'question-only'
  public readonly 说明 = '参考文本仅声明无参考，沿用统一的作者提示、题目与消息格式。'

  public 获取参考文本(): string {
    return '无参考。'
  }

  public override 导出配置(): Record<string, unknown> {
    return {}
  }
}
