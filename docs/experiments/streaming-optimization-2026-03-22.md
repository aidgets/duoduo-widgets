# Streaming Optimization Experiment Log

**Date**: 2026-03-22
**Goal**: 减少 widget streaming 延迟，防止 agent context 爆炸

## 问题诊断

Agent 使用 `interactive-widget` skill 时：

1. 倾向于一大坨生成完整 HTML 再推送，用户等 30+ 秒
2. 完整 HTML 在 context 中反复出现，导致 context 爆炸
3. SKILL.md 指导太弱，缺乏具体的分块策略

## 实测基线

CLI update 延迟 ~1s（node 启动 + HTTP 往返），与 payload 大小无关。
SSE 推送到 viewer 是即时的（<100ms）。
**瓶颈完全在 agent 侧**：思考时间 + 工具调用开销。

## 试验记录

### Round 1: 原版 SKILL.md（基线）

- **方式**: 原版 SKILL.md，echo pipe 直推
- **总耗时**: 98s / 4 sections
- **工具调用**: 11 次
- **每 section 间隔**: ~24s
- **问题**: agent 在 context 中构建完整 HTML，然后 echo 推送

### Round 2: Edit + Bash 两步模式

- **方式**: Write 创建骨架 → Edit 追加 section → Bash cat pipe 推送
- **SKILL.md 改动**: 引入临时文件 pattern，Edit + Bash 两步
- **总耗时**: 64s / 3 sections
- **工具调用**: 8 次
- **每 section 间隔**: ~21s
- **改进**: context 不再持有完整 HTML，但每 section 需要 2 次工具调用

### Round 3: Bash 单步模式（突破）

- **方式**: python3 替换 `<!-- NEXT -->` 标记 + cat pipe，合并为一条 Bash 命令
- **总耗时**: 45s / 3 sections
- **工具调用**: 4 次
- **每 section 间隔**: ~15s
- **改进**: 工具调用减半，总耗时降低 30%

### Round 4: 最终 SKILL.md + 4 sections

- **方式**: Round 3 pattern 写入 SKILL.md
- **总耗时**: 71s / 4 sections（含 progress bar）
- **工具调用**: 6 次
- **每 section 间隔**: ~12s（归一化到 3 sections 约 53s）
- **渲染质量**: 一次写对，无问题

### Round 5: 部署服务端优化 + CLI hints

- **方式**: 服务端并行化 + CLI \_hints 反馈
- **总耗时**: 68s / 4 sections
- **工具调用**: 6 次
- **sse_viewers**: 1（hints 正确识别到有 viewer）
- **HTML 最终大小**: 4,206 bytes
- **渲染质量**: 高质量，含交互按钮

## 效果对比

| 指标                      | R1 基线    | R5 最终   | 改善    |
| ------------------------- | ---------- | --------- | ------- |
| 每 section 间隔           | ~24s       | ~12s      | **50%** |
| 工具调用次数              | 11         | 6         | **45%** |
| Context 占用（5 section） | ~450 lines | ~77 lines | **83%** |
| 渲染质量                  | 好         | 好        | 相同    |

## 改动清单

### SKILL.md

- `<!-- NEXT -->` 标记 + python3 替换 + cat pipe 单步 Bash 模式
- 明确的 streaming 节奏规则（每 2-5 秒一个 section）
- Context 管理约束（不在 context 中持有完整 HTML）
- `_hints` 字段说明

### CLI (src/cli/commands/update.ts)

- `_hints` 数组：根据度量数据生成实时引导提示
- 涵盖：first_update, no_viewers, html_growing, html_large, ttl_low, ttl_expiring, many_updates

### 服务端 (service/src/durable-objects/widget-do.ts)

- handleUpdate: storage writes + SSE 广播并行化（Promise.all）
- broadcastSSE: 多连接写入并行化（Promise.allSettled）
- closeAllSSE: 并行化
- Update 响应新增: update_seq, html_bytes, sse_viewers, draft_ttl_remaining

### 类型

- UpdateResponse: 新增度量字段
- WidgetManifest: 新增 update_count

## 剩余瓶颈

每 section ~12s 中：

- Agent 思考时间: ~10s（LLM 固有限制，无法优化）
- CLI 往返: ~1s
- 服务端处理: <50ms

### Round 6: 丰富模板库后的测试

- **方式**: html_patterns.md 新增 section templates（KPI cards, data table, progress bar, status list, key-value, action buttons, banner）
- **要求**: 5 sections（header, warning banner, detail list, status list, action buttons）
- **总耗时**: 72s / 5 sections
- **每 section 间隔**: ~10s
- **归一化到 4 sections**: ~58s（vs R5 68s，改善 15%）
- **渲染质量**: 高，直接套用模板换数据
- **关键发现**: agent 明确报告 "used copy-pasted templates with only data values changed" — 模板策略成功减少了思考时间

## 全轮次对比

| 指标            | R1 基线   | R3 突破  | R5 hints | R6 模板  |
| --------------- | --------- | -------- | -------- | -------- |
| 每 section 间隔 | ~24s      | ~15s     | ~17s     | **~10s** |
| 方法            | echo pipe | Bash单步 | +hints   | +模板    |
| vs 基线改善     | —         | 38%      | 29%      | **58%**  |

### Round 7: SKILL.md 精简 + heredoc pattern + 干净 agent 测试

**核心变更**：

- SKILL.md 从 204 行精简到 118 行（-42%），去掉解释性段落，只保留可操作内容
- Step 3 从 `python3 -c`（需要引号转义）改为 `python3 - << 'PYEOF'` heredoc（写原生 HTML）
- html_patterns.md 扩充到 305 行（section templates + 3 种 Chart.js 图表）

**关键方法论改进**：

- 之前所有测试都在 prompt 里给了 agent 额外提示（"用 heredoc pattern"、"copy templates"），相当于作弊
- R7 使用完全干净的 agent，只告诉它"Build a DevOps dashboard"和"Read SKILL.md"

**R7 干净 agent 测试结果**：

- **任务**: DevOps Overview dashboard（agent 自主决定内容）
- **总耗时**: 150s
- **Sections**: 8（agent 自主做了比要求更多的内容：4 KPI cards, service health, 2 charts, incident table, pipeline stages, alert banner, action buttons）
- **工具调用**: 10 次（2 读文件 + 1 skeleton + 6 sections + 1 finalize）
- **每 section 间隔**: ~19s
- **渲染质量**: 高 — 含 2 个 Chart.js 图表、color-coded badges、progress bars、交互按钮

**对比之前的干净测试（R7-before，204 行 SKILL.md）**：

- R7-before: 101s / 5 sections = ~20s/section
- R7-after: 150s / 8 sections = ~19s/section
- 归一化到 5 sections: R7-after ~95s vs R7-before ~101s — **略快 6%**

**反思**：

1. 之前的"喂答案"测试（~10s/section）和干净测试（~19s/section）差距约 2x — 说明 prompt 中的额外指导有巨大影响
2. SKILL.md 精简 42% 后，干净 agent 的 per-section 速度略有改善但不显著
3. 真正的瓶颈是 LLM 推理时间（~17s/section），我们已经把工具 / 服务端 / 模板都优化到位了
4. heredoc pattern 的价值不在速度，而在**正确性** — 不需要引号转义，减少 agent 出错
5. agent 读 SKILL.md + html_patterns.md 花 ~10s，这是不可避免的一次性开销

## 全轮次对比（最终版）

| 指标            | R1 基线 | R3 突破 | R6 模板 | R7 干净  |
| --------------- | ------- | ------- | ------- | -------- |
| 每 section 间隔 | ~24s    | ~15s    | ~10s\*  | **~19s** |
| 测试方式        | 喂答案  | 喂答案  | 喂答案  | **干净** |
| vs R1 基线改善  | —       | 38%     | 58%\*   | **21%**  |

\*R6 的 10s 有上下文污染，不可比。干净测试的真实改善是 **~21%**（24s→19s）。

### Round 7 FINAL: 全部修复 + 精简模板 + chart 渲染修复

**变更**：

- html_patterns.md 合并回单文件（130 行），精简去重
- KPI cards 固定 `repeat(3,1fr)` 防断行
- Viewer shell: `execScripts` 顺序加载外部脚本（onload 回调链）
- Viewer shell: 静态页面 `window.load` 后 `Chart.resize()` 修复图表初始化
- Viewer shell: SSE `execScripts` 完成后 setTimeout + `Chart.resize()`
- 部署 3 次 Cloudflare Workers

**R7 FINAL 干净 agent 测试结果**：

- **任务**: Quarterly Business Review（6 KPI cards, 2 charts, table, banner, buttons）
- **总耗时**: 114s / 8 sections (含 2 charts)
- **每 section 间隔**: ~14s
- **渲染质量**: 高 — Line chart + Doughnut chart + status badges + 交互按钮
- **Chart 渲染**: 刷新后完美（SSE finalize 路径有残留时序问题但已有 resize 兜底）

**全部干净测试对比**：
| 测试 | 每section | vs R1基线 | Charts | 质量 |
|------|----------|----------|--------|------|
| R7a | 19s | -21% | OK | 好 |
| R7b | 17s | -29% | 失败 | 差 |
| R7c | 18s | -25% | 失败 | 中 |
| **R7 FINAL** | **14s** | **-42%** | **OK** | **好** |

## 最终结论

1. **干净 agent 测试的真实改善为 42%**（24s→14s/section）
2. **上下文污染效应**很大 — "喂答案"测试（~10s）和干净测试（~14s）仍有差距，但已大幅缩小
3. 改善来源：SKILL.md 精简（读文件快）+ 模板复制（减少思考）+ heredoc（无转义）+ 服务端并行化 + Chart.js 渲染修复
4. 最大价值的改动不仅是速度，更是**可靠性**：
   - 临时文件 pattern 防止 context 爆炸
   - heredoc 防止引号转义错误
   - `_hints` 防止忘记发 link 或 TTL 过期
   - section templates 提高一次写对的概率
   - `execScripts` 顺序加载 + `Chart.resize()` 修复图表渲染

## 未来优化方向

1. partial mode update（只推增量，不推全量），减少 payload 和 morphdom 开销
2. 更多预制"页面模板"（dashboard / report / form），进一步减少 agent 组装决策
3. 使用更快的 LLM 模型（如 Sonnet）做 widget 生成，可能牺牲质量换速度
