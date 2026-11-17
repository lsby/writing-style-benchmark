import { 参考实现, type 参考输入 } from '../base.js'

export class 全文实现 extends 参考实现 {
  public readonly 名称 = 'full-context'
  public readonly 说明 = '返回该作者的全部选文作为参考，保留篇名与篇目边界。'

  public 获取参考文本(输入: 参考输入): string {
    let 原文 = 输入.作者.文章.map((文章, 序号) => `【参考文章 ${序号 + 1}：${文章.标题}】\n${文章.正文}`).join('\n\n')
    return `参考作者：${输入.作者.姓名}\n\n参考文章（仅作为写作参考）：\n\n${原文}`
  }
}
