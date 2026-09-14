# 自动化执行记录 · 每日 AI 健康简报（方盛的数据实验室）

## 2026-09-13（首次记录）
- 状态：成功。commit `ec4a81a` 推到 taizhengfs.github.io master。
- 流程：daily_update.sh → build_insight.py → 数据摘要 → /tmp/ai_brief.json → apply_ai.py → smoke.js → publish.sh --push。全链路退出码 0，smoke 错误项为「无」。
- 注意点：
  1. 早上 8 点同步时今日步数只有几十步，规则引擎会误报「活动量偏低」。本次傍晚重跑后步数为 7,012，告警消失。**建议把本自动化安排在傍晚/晚上执行，或执行前先重跑一次 daily_update.sh。**
  2. narrative 字数上限 450（含标点），一次写满容易超，需边写边量。
  3. push 耗时约 1-2 分钟，属正常，不要中断。
- 数据源坑：core.json activities 的 `durMin` 为 None（用 `durSec`）；health.json 的 `weight` 近 30 天全空。

## 2026-09-14
- 状态：成功。commit `4f3b374..b9474aa` 推到 master。
- 全链路退出码 0，smoke 错误项「无」，活动明细 561 份。
- 注意点：
  1. 08:00 执行时今日步数仅 6 步，findings 会误报「活动量偏低」（0%）。写 narrative 时应忽略该条，改用周均步数（本周 4280 vs 上周 6317，‑2037）作为真实活动量依据。
  2. narrative 初稿 560 字严重超限，砍到 450 字用了两轮。**建议先写满再按段落删，重点保留「数据之间的关系」句，先砍修饰语。**
  3. 今天的核心判断框架可复用：恢复指标（HRV/RHR/准备度）全绿 + ACWR 极低 ⇒ 判定为「可加量窗口」而非「需要休息」，据此给加量建议而非休息建议。

