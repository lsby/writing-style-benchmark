import { 写作题目 } from '../question.js'

export default new 写作题目({
  编号: 'W11',
  标题: '技术文档：队列积压排查手册',
  类型: 'article',
  要求: `请参考所给原文，以给定作者的写作风格，为下面这个虚构的后台任务系统写一份故障排查手册，读者是第一次值班的维护人员。

已知规格：
- 系统有接收任务的 API 和执行任务的 worker，二者独立运行；API 返回 accepted 只表示任务已入队。
- jobctl status 输出 queued（等待任务数）、running（执行中任务数）、workers（在线 worker 数）、oldest_wait_seconds（最早等待任务已等的秒数）、paused（是否暂停接收新任务）。
- jobctl logs --last 20 显示最近 20 条 worker 日志；日志可能包含 STORAGE_TIMEOUT（写入存储超时）或 AUTH_FAILED（worker 的存储凭据被拒绝）。日志不包含凭据原文。
- jobctl pause 只暂停接收新任务，已有任务继续处理；jobctl resume 恢复接收。
- jobctl restart-worker 只重启 worker，不清空队列。被中断的执行中任务会回到队列，因此某项外部写入可能再次发生，不能承诺重启没有重复执行风险。
- 没有清空队列、修改凭据或修复存储的 jobctl 命令。存储故障交给存储负责人处理，凭据问题交给凭据管理员处理；不得在工单中粘贴密钥。
- 恢复判据是连续两次、间隔 60 秒观察到 workers 大于 0、queued 下降且 oldest_wait_seconds 小于 120；仅有 API 返回成功或 worker 在线都不够。

本次告警材料：09:10，queued=860、running=0、workers=0、oldest_wait_seconds=900、paused=false。09:08 起的日志反复出现 AUTH_FAILED。目前没有存储负责人或凭据管理员的处理结果。

文档要给出值班人员可照着走的检查和处置顺序，解释这次告警优先找谁、为什么；说明暂停接收的适用条件与影响，重启的前提与风险，以及怎样验证恢复、何时恢复接收。也要说明如果后续看到 STORAGE_TIMEOUT 应找谁处理。现有材料缺少的结论应明确留待核实，不编造已修复的结果，不把反复重启当作修复凭据的方法，不建议删除任务。作者风格可以进入解释，不能妨碍操作信息的查找。

题目自拟，正文 800～1200 字。只输出标题和文档正文，标题独占第一行。正文可用小标题、列表和代码块；命令及代码也计入字数。`,
  最少字数: 800,
  最多字数: 1200,
})
