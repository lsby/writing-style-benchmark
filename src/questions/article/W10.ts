import { 写作题目 } from '../question.js'

export default new 写作题目({
  编号: 'W10',
  标题: '技术文档：异步任务接口接入',
  类型: 'article',
  要求: `请参考所给原文，以给定作者的写作风格，为下面这个虚构的异步导出接口写一份接入文档，读者是要编写客户端的开发者。

已知规格：
- 示例服务地址为 https://api.example.test；所有请求必须通过 Authorization: Bearer <token> 认证，token 由服务管理员提供。
- POST /v1/exports 接收 JSON，请求头须带 Content-Type: application/json；请求体只有一个字段 report_id，值为非空字符串。
- 创建成功返回 HTTP 202，JSON 为 {"task_id":"exp_123","status":"queued"}。202 表示接受任务，此时文件还未生成。
- 创建请求必须带 Idempotency-Key 请求头。键由客户端生成；在同一 token 下，首次接受后的 24 小时内，同键同请求体会返回相同 task_id，同键不同请求体返回 HTTP 409。24 小时后该键可被当作新请求。相同 report_id 配不同键也会创建不同任务。
- GET /v1/exports/{task_id} 返回 HTTP 200，JSON 中有 task_id 和 status。status 只会是 queued、running、succeeded、failed；前两者未结束，后两者为终态。succeeded 时另有 download_url；failed 时另有 error 字符串。终态不会改变。
- download_url 从任务成功时起 10 分钟内有效；再次查询任务不会延长有效期。过期后需要新建导出任务。
- 任一接口都可能返回 HTTP 401（认证失败）、429（请求过多，Retry-After 为需等待的整数秒数）或 500（服务内部错误）。查询不存在的任务返回 404；创建参数不合法返回 400。

文档须包含创建与查询的请求示例、从提交到取得下载地址的流程，以及错误处理建议。重点说明：创建响应丢失时怎样避免重复任务；怎样区分 HTTP 请求成功与导出成功；怎样处理限流和过期链接。建议与既定规格要区分清楚，不虚构 SDK、回调、取消或其他接口能力。可以使用作者式的措辞和联想，但必须让开发者据此完成接入。

题目自拟，正文 1000～1500 字。只输出标题和文档正文，标题独占第一行。正文可用小标题、列表和代码块；命令及代码也计入字数。`,
  最少字数: 1000,
  最多字数: 1500,
})
