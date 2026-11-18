# MCP 参考文本服务

MCP 和 API 使用同一个 `参考实现.获取参考文本({ 作者, 写作任务 })`。MCP 不调用模型或评分；智能体可以取得参考文本后自行作答，并交由服务保存。

| 工具                   | 参数                                        | 返回                                   |
| ---------------------- | ------------------------------------------- | -------------------------------------- |
| `list_implementations` | `{}`                                        | 实现名称和说明的 JSON 数组             |
| `get_reference`        | `implementation`、`author`、`task`          | 参考文本原文，保留旧接口               |
| `start_writing`        | `implementation`、`author`、完整 `question` | JSON，包含 `run_id` 和本次 `reference` |
| `save_result`          | `run_id`、`output`                          | 保存目录和字数检查结果                 |

先调用 `list_implementations` 选方案，再调用 `start_writing`，例如：

```json
{
  "implementation": "full-context",
  "author": "zhu-guangqian",
  "question": { "id": "W01", "title": "题目", "kind": "article", "input": "写作要求", "min": 200, "max": 400 }
}
```

智能体依据返回的 `reference` 作答，然后调用 `save_result`，参数如 `{"run_id":"返回的 run_id","output":"标题\n正文"}`。正文按原样保存；空白正文、未知或重复提交的 `run_id` 会被拒绝。字数和标题格式检查未通过也会保存，并在返回值和元信息中记录问题。`kind` 支持 `article`、`rewrite`、`dialogue`，题号及字数范围遵循写作题目的校验规则。

服务端固定分配 `baselines/<UNIX毫秒时间戳>/`，调用方不能指定路径；保存题目、本次实际参考、正文、空评分和元信息五个文件。元信息的 `source` 为 `mcp`，`writer` 和 `judge` 为 `null`。未提交的写作任务只保存在服务进程内，服务重启后丢失，需重新开始。目录同名时保存失败，不覆盖已有文件。

`implementation` 必须显式选择列表中的名称。`author` 可用作者原名或 `data/author-slugs.json` 中的标识。旧 `get_reference` 仍按实现、作者和 `task` 返回文本，不创建写作任务。内置 `full-context` 实现返回该作者的全部参考文章。

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
