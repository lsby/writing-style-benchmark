import { 参考实现 } from '../base.js'

/**
 * Question Only（无参考基线方案）
 *
 * 方案思路：
 * 不提供参考原文或额外表达建议，观察模型仅凭题目时的默认写法，
 * 作为全文、抽句等参考方案以及场景适配实验的共同对照组。
 * 这样可以比较参考材料或额外提示带来了哪些变化，避免将模型原有能力归因于方案。
 *
 * 具体做法：
 * 参考文本只返回“无参考。”，保留统一的题目与消息格式，不附加作者身份。
 * 重点观察默认表达中的常见句式、安慰话术，以及模型本身对交流场景的适应程度。
 */
export class 纯题目实现 extends 参考实现 {
  public readonly 名称 = 'question-only'
  public readonly 说明 = '参考文本仅声明无参考，沿用统一的资料说明、题目与消息格式。'

  public 获取参考文本(): string {
    return '无参考。'
  }

  public override 导出配置(): Record<string, unknown> {
    return {}
  }
}
