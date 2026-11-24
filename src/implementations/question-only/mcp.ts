import { MCP运行入口 } from '../base.js'
import { 纯题目实现 } from './index.js'

/** 纯题目MCP入口包含该方案的服务配置，并支持启动参考服务。 */
export class 纯题目MCP入口 extends MCP运行入口 {
  public constructor() {
    super(new 纯题目实现())
  }
}
