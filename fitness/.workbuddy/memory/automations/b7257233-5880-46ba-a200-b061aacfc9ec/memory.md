# 自动化执行记录 · 每日 AI 健康简报（方盛的数据实验室）

## 2026-09-13（首次记录）
- 状态：成功。commit `ec4a81a` 推到 taizhengfs.github.io master。
- 流程：daily_update.sh → build_insight.py → 数据摘要 → /tmp/ai_brief.json → apply_ai.py → smoke.js → publish.sh --push。全链路退出码 0，smoke 错误项为「无」。
- 注意点：
  1. 早上 8 点同步时今日步数只有几十步，规则引擎会误报「活动量偏低」。本次傍晚重跑后步数为 7,012，告警消失。**建议把本自动化安排在傍晚/晚上执行，或执行前先重跑一次 daily_update.sh。**
  2. narrative 字数上限 450（含标点），一次写满容易超，需边写边量。
  3. push 耗时约 1-2 分钟，属正常，不要中断。
- 数据源坑：core.json activities 的 `durMin` 为 None（用 `durSec`）；health.json 的 `weight` 近 30 天全空。
