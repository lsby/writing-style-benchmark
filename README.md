# Writing Style Benchmark

用真人文章比较 AI 的文风生成方案。包含六位作者的 54 篇选文、15 道题及评分标准，不预先总结作者人设。

API 引擎顺序执行：实现返回参考文本 → 引擎组织消息 → 答题 API → 评分 API → 直接保存单题基线。答题和评分分别配置服务地址、模型、密钥和参数。

推荐直接编辑[src/run.ts](src/run.ts)：用 `作者.朱光潜` 等枚举选择作者、直接 import 所需题目放进数组，分别填写答题 API 与评分 API 的地址、密钥、模型和生成参数，再执行入口。

```powershell
pnpm install
pnpm start
# 或者直接运行 TS 入口
pnpm exec tsx src/run.ts
```

入口中的 API 地址与模型均需明确配置，未填写时立即报错。两份配置都必须明确提供，评分服务不会沿用答题服务。无需认证时将密钥显式写成空字符串；生成参数只发送你配置的值。已移除命令行参数解析。

自定义实现和完整 TS 用法见 [框架说明](docs/framework.md)。源码分为 `questions/`、`engine/`、`implementations/`，标识符中文、文件路径英文。作者资料只有姓名和文章（标题、正文），实现只返回参考文本，API 引擎负责组织模型消息。

智能体可通过 `pnpm mcp` 启动的 MCP 服务调用同一份实现：`list_implementations` 列出方案，`get_reference` 按实现名、作者和写作任务返回参考文本。通过 `start_writing` 开始作答，并用 `save_result` 保存到固定的 `baselines/`；MCP 不调用模型或评分，详见 [MCP 说明](docs/mcp.md)。

结果直接保存为 `baselines/<UNIX毫秒时间戳>/`，包含 `question.json`、`reference.txt`、`output.txt`、`evaluation.json`、`metadata.json`。`reference.txt` 是实现函数实际返回的参考文本，`output.txt` 是模型最终正文；作者、实现、API 配置和消耗都在元信息中。不额外复制原文目录，旧结果不自动回写。

题目直接定义在 [src/questions/](src/questions/)，评价标准内联在 [裁判提示词](src/engine/evaluation/scoring.ts)中。API 路径目前逐题评分，不自动运行整组多样性评价。

技术文档题 W09～W11 分别要求编写命令行使用说明、异步任务接口接入文档和队列积压排查手册。每题附完整的虚构技术规格，用来观察作者文风在准确性、操作步骤和异常处理约束下的表现；沿用 `article` 类型和评分字段。入口已选入这三题，分别使用朱光潜和张爱玲的原文作参考。

开发使用 Node.js 24、pnpm 9、TypeScript 与 tsx，规范见 [AGENTS.md](AGENTS.md)。

```powershell
pnpm tidy:all
pnpm check:all
pnpm test
```

## Data

`data/` 按作者英文标识存放 UTF-8 TXT，每篇使用 `essay-01.txt` 等英文文件名；`data/manifest.csv` 保留中文作者、篇名及文件路径。`author-slugs.json` 和 `path-aliases.json` 保留姓名标识及旧路径映射。

六位作者共 54 篇，每位约 2.6 万字。选文以独立篇目为单位，排除序跋、题记、他人评论和长篇章节。朱光潜的选文去除了书信称呼、祝颂、署名和告别客套，保留篇名与正文。字数不计空白，包含标题和标点。

| 作者   | 篇数 |   字数 |
| ------ | ---: | -----: |
| 鲁迅   |    8 | 25,471 |
| 朱光潜 |    9 | 25,540 |
| 张爱玲 |   10 | 26,448 |
| 钱锺书 |   10 | 25,602 |
| 汪曾祺 |   12 | 26,436 |
| 老舍   |    5 | 26,018 |

除上述书信首尾整理外，文本保留源文件文字，尚未逐字校勘。原始书籍和整理记录保存在桌面的“文风基准测试”资料目录。

本文本集合未统一授予使用许可；原作权利归各自权利人，公开分发或接入服务前需分别确认使用权限。
