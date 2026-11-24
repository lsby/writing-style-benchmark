import { MCP运行入口 } from '../base.js'
import { 场景适配实现 } from './index.js'

/** 场景适配MCP入口包含该方案的服务配置，并支持启动参考服务。 */
export class 场景适配MCP入口 extends MCP运行入口 {
  protected 创建实现(): 场景适配实现 {
    return new 场景适配实现()
  }
}
