import type { 作者资料 } from '../engine/data/dataset.js'
import type { 引擎配置 } from '../engine/engine.js'

export type 参考输入 = { 作者: 作者资料; 写作任务: string }

/** 参测方案提供参考文本，模型消息由调用方组织。 */
export abstract class 参考实现 {
  public abstract readonly 名称: string
  public abstract readonly 说明: string
  public abstract 获取参考文本(输入: 参考输入): string | Promise<string>
}

/**
 * 基准运行入口代表一种参测方案的独立启动方式。
 * 具体入口提供所需的实现、题目、作者和模型配置，并由它统一执行基准。
 */
export abstract class 基准运行入口 {
  protected abstract 创建配置(): 引擎配置

  public async 运行(): Promise<void> {
    let { 测试引擎 } = await import('../engine/engine.js')
    let 引擎 = new 测试引擎(this.创建配置())
    console.log(await 引擎.运行())
  }
}

/**
 * MCP运行入口代表一种参测方案的 MCP 服务启动方式。
 * 具体入口提供配置好的参考实现，由它创建服务并通过标准输入输出发布。
 */
export abstract class MCP运行入口 {
  protected abstract 创建实现(): 参考实现

  public async 启动(): Promise<void> {
    let [{ 创建参考服务 }, { serveStdio }] = await Promise.all([
      import('../engine/mcp.js'),
      import('@modelcontextprotocol/server/stdio'),
    ])
    let 服务 = await 创建参考服务([this.创建实现()])
    serveStdio(() => 服务)
  }
}
