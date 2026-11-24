import { 参考实现 } from '../base.js'

/** 场景适配实验：仅提示模型自行识别场景并调整表达，不枚举场景或用词规则。 */
export class 场景适配实现 extends 参考实现 {
  public readonly 名称 = 'context-fit'
  public readonly 说明 =
    '参考文本声明无参考，并提示模型识别当前交流场景，让表达符合场景；沿用不含作者身份的统一消息格式。'

  public 获取参考文本(): string {
    return '无参考。\n\n表达与当前场景不协调，会让文字显得生硬、违和。请根据当前任务识别其交流场景，让回答的表达方式符合这个场景。直接输出最终内容，无需说明判断过程。'
  }

  public override 导出配置(): Record<string, unknown> {
    return { 场景提示: this.获取参考文本() }
  }
}
