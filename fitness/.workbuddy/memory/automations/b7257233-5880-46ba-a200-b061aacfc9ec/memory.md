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

## 2026-09-15
- 状态：成功。commit `43c776d..0e40120` 推到 master。全链路退出码 0，smoke 错误项「无」，活动明细 561 份。
- 注意点：
  1. **字数控制有了可靠办法**：写完 JSON 后先用 python 量 `len(narrative)` 再调 apply_ai.py。本次首稿目测 421 实际 498（含 \n\n 与标点），**目测会低估 15–20%**。最终 415 字达标。
  2. 08:00 执行今日步数仅 28 步，findings 的「活动量偏低」依旧是误报，narrative 中忽略，改用周均步数（4502 vs 上周 6543，‑2041）。
  3. 今日新增可复用判断：睡眠短（5.62h）但 HRV 反升（71 > 基线上限 69）⇒ 「睡眠债提前支取」，需在 advice 里预警而非表扬。
  4. 训练质量维度值得每次写：骑行 avgHR 102 属热身区、TE 1.98；跑步 TE 4.09 —— 直接给出「别骑车去跑步」的落地建议。

## 2026-09-16
- 状态：成功（push 前需额外处理分叉）。commit `17eabb6..c21751b` 推到 master。smoke 错误项「无」，活动明细 561 份。
- 注意点：
  1. **远端分叉**：Warden 从别处推了 Eerzee 徒步页提交，本地 3 个 fitness 提交被拒（fetch first）。解决：`cp tools.html /tmp/tools.html.local.bak` → `git stash push -- tools.html` → `git pull --rebase origin master` → `git stash pop`。远端与本地改的是 tools.html 不同区域，合并干净。**push 被拒就走这套，别硬推。**
  2. 站点仓库 tools.html 常年有一笔未提交改动（publish.sh 只 add fitness/），rebase 前必须 stash 掉。
  3. 字数：本次首稿 566 → 中间 528/495 → 终稿 448。**可靠做法：分段写，先逐段 `len()` 量，再拼装。目测仍会低估 15–20%。**
  4. 今日判断框架（可复用）：准备度四连跌但 RHR/HRV 分量全绿 ⇒ 判定为「停练掉分（detraining）」而非疲劳，advice 给加量；反之若 HRV 跌破基线下限 + RHR 上行，才是该休息。
  5. 脚本小坑：push 失败时 daily_update.sh 第 67 行会报 `rc: unbound variable`（bash + set -u），会吞掉「发布失败」日志，但不影响本自动化自己跑 publish.sh。

