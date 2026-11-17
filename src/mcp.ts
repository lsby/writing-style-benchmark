import { serveStdio } from '@modelcontextprotocol/server/stdio'
import { 创建参考服务 } from './engine/mcp.js'

let 服务 = await 创建参考服务()
serveStdio(() => 服务)
