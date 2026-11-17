# MCP 参考文本服务

MCP 和 API 使用同一个 `参考实现.获取参考文本({ 作者, 写作任务 })`。服务读取本地作者资料，返回实现生成的参考文本；不调用模型，也不保存作答或评分。

服务只有两个只读工具：

| 工具                   | 参数                                               | 返回                                                        |
| ---------------------- | -------------------------------------------------- | ----------------------------------------------------------- |
| `list_implementations` | `{}`                                               | JSON 文本数组，每项为 `{ "name": "…", "description": "…" }` |
| `get_reference`        | `implementation`、`author`、`task`，均为非空字符串 | 参考文本原文                                                |

`implementation` 必须显式选择列表中的名称。`author` 可用作者原名（如 `朱光潜`）或 `data/author-slugs.json` 中的标识（如 `zhu-guangqian`）；`task` 是这次写作的具体要求。未知实现、未知作者和无效参数均返回工具错误。内置 `full-context` 实现返回该作者的全部参考文章。

新增实现时，继承 `src/implementations/base.ts` 的 `参考实现`，提供唯一的 `名称`、`说明` 和 `获取参考文本`，再把实例加入 `src/implementations/index.ts` 的 `可用实现` 数组。两个入口共用这份实现；MCP 列举和调用均使用这份数组。

## 连接

先在仓库运行 `pnpm install`，可用 `pnpm mcp` 启动。入口是 `src/mcp.ts`，通过标准输入输出提供 MCP。客户端配置示例（把路径替换成实际绝对路径，`--import` 使用 `file:///` URL）：

```json
{
  "mcpServers": {
    "writing-style-benchmark": {
      "command": "C:/Program Files/nodejs/node.exe",
      "args": [
        "--import",
        "file:///C:/Users/you/projects/writing-style-benchmark/node_modules/tsx/dist/loader.mjs",
        "C:/Users/you/projects/writing-style-benchmark/src/mcp.ts"
      ]
    }
  }
}
```

入口按自身文件位置读取仓库资料，可从任意工作目录启动。标准输出只用于 MCP 协议。
