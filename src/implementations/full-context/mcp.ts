import { MCP运行入口 } from '../base.js'
import { 全文实现 } from './index.js'

/** 全文MCP入口包含该方案的服务配置，并支持启动参考服务。 */
export class 全文MCP入口 extends MCP运行入口 {
  public constructor() {
    super(new 全文实现())
  }
}
