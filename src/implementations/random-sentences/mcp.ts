import { MCP运行入口 } from '../base.js'
import { 随机抽句实现 } from './index.js'

/** 随机抽句MCP入口包含该方案的服务配置，并支持启动参考服务。 */
export class 随机抽句MCP入口 extends MCP运行入口 {
  public constructor() {
    super(new 随机抽句实现({ 抽取数量: 30, 随机种子: 42 }))
  }
}
