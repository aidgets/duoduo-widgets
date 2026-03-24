# Widget Design Document (v5)

> Status: Draft
> Scope: external widget package, widget service, viewer lifecycle
> Last Updated: 2026-03-19
> References:
>
> - `refs/generative-ui/SKILL.md`
> - `refs/generative-ui/references/core_design_system.md`
> - `refs/generative-ui/references/ui_components.md`

## 1. 结论先行

`widget` 的 V1 不应该嵌入或修改 duoduo core。

它解决的是一个严格限定的问题：

1. agent 作为一个会用 CLI 的执行者，渐进式生成可交互 widget。
2. widget 由外部 web service 托管，最终物料 durable、可重开、可分享。
3. 用户在 viewer 上的交互，由 agent 主动通过 `duoduo-widget wait|get` 获取。

因此 V1 的主设计应当是：

- 一个与 `channel-feishu` / `channel-acp` 同层级的外部 package
- 一个独立二进制 `duoduo-widget`
- 一个独立的 widget web service
- 一个给 agent 用的 skill / prompt adapter，封装常见调用模式
- 一组 CLI 生命周期命令：`open / update / finalize / wait / get / inspect`
- 一组明确分离的 URL/capability：
  - `viewer_url`: 给用户看的只读 URL，无 token
  - `control_url`: 给 agent/CLI 用的写 capability URL，带 token

V1 先用 Cloudflare Workers / Durable Objects / R2 验证模型，但 API contract 不应绑定 Cloudflare 专有概念。未来可替换为 self-hosted 实现，只要满足同一组 CLI / API / viewer 边界。

---

## 2. 核心边界

### 2.1 和 duoduo 的关系

- widget service 是独立系统，不属于 duoduo runtime 内部子系统
- widget service 的 session/state 与 duoduo session 无关
- duoduo 只需要：
  - 能执行 `duoduo-widget ...`
  - 能把 `viewer_url` 发给用户
  - 能在需要时读取 `wait/get` 的 JSON 结果

### 2.2 和用户的关系

- 用户从飞书、stdio、ACP 或其他 channel 看到的，只能是 `viewer_url`
- `viewer_url` 默认是无 token 的只读地址
- 用户不会拿到 `control_url`

### 2.3 和 agent 的关系

- agent 把 widget 当成纯 CLI 工具使用
- agent 通过 `control_url` 或本地 cache 的 `widget_id` alias 执行 `update/finalize/wait/get/inspect`
- `wait/get` 是 agent 主动阻塞等待外部 web service 结果的模型
- `wait/get` 不是 duoduo ingress，不伪装成 channel message，不参与 duoduo session wake 语义
- 为了降低 agent 使用门槛，最终应提供一层 skill，把常见 widget 流程提示成稳定套路

### 2.4 和 skill 的关系

- CLI 是 runtime contract，也是唯一硬边界
- skill 只是 agent ergonomics adapter，不是系统边界
- skill 的职责是帮助 agent 更轻松地：
  - 选择何时 `open`
  - 何时 `update`
  - 何时 `finalize`
  - 何时在有交互元素时调用 `wait/get`
- 即使没有 duoduo、没有 channel、没有 runner，agent 也应能单独使用 `duoduo-widget`

---

## 3. 设计目标

### 3.1 必须做到

- 不嵌入、不修改 duoduo core 代码
- 支持 agent 渐进式生成 widget，并在同一 `widget_id` 下持续更新
- `open` 后立即得到可分享的 `viewer_url`
- `viewer_url` 与 `control_url` 严格分离
- `widget_id` 是 durable ref，不是本地 cache key
- 最终 `finalized/submitted` 物料永久保留
- 用户交互必须能被 agent 以结构化 JSON 结果读取
- 对不支持 rich viewer 的 channel 必须有明确降级路径
- 保持 strong boundary、可回放、可降级、易手工调试

### 3.2 明确不做

- 不把 widget 做成通用前端平台
- 不把 V1 建立在 MCP/tool 集成上
- 不把 V1 建立在 duoduo ingress / outbox 协议修改上
- 不让 agent 直接拥有浏览器 privileged state
- 不把 widget service 的状态机和 duoduo session 生命周期耦合
- 不引入独立 auth 平台作为前置条件

---

## 4. 从 `refs/generative-ui` 提炼出的可迁移原则

`refs/generative-ui` 的价值不在于样式细节，而在于运行时边界。

### 4.1 要保留的原则

- **Host-owned shell**: widget 不直接拥有宿主页面，宿主负责注入 bridge 和安全边界
- **Visual only**: prose 仍由正常文本回复承担，widget 只承载结构化 UI
- **Self-contained payload**: 单个 revision 必须自描述
- **Graceful activation**: viewer shell 与最终交互内容分离，宿主控制激活时机

### 4.2 不能照搬的部分

- `generative-ui` 的 `show_widget` / `end_widget` 更接近工具协议；这里需要 human/agent 都能直接用的 CLI
- `generative-ui` 的 streaming 可依赖 tool delta；这里由 widget service 自己负责 draft 更新
- `generative-ui` 的单窗口模型不能直接替代多 channel 链接分发模型

### 4.3 对本设计的直接启发

- widget 需要 host-owned shell、明确 finalize 边界、durable revision
- 渐进式更新可以完全由外部 service 负责
- 如果把 duoduo 想成”一个会用命令行的人”，`wait/get` 是最自然的交互读取模型

### 4.4 增量更新（v0.4+）— 受 A2UI 启发

Google A2UI 协议的核心洞察是将 UI 变更分为两个正交维度：**结构变更**（低频）和**数据变更**（高频）。
A2UI 用声明式组件 + data binding 实现这一点，但这对 duoduo-widget 来说太重——需要 renderer、catalog、binding 引擎。

duoduo-widget 的方案是用 HTML 原生能力实现同样的分离：

- **结构变更**：全量 `update --html`（推完整 HTML，morphdom diff）
- **数据变更**：`update --patch`（CSS selector + DOM 操作，跳过 morphdom）

```text
全量模式:  Agent 推 HTML(N bytes) → SSE → morphdom diff → 全页重渲染
Patch 模式: Agent 推 patch(delta bytes) → SSE → querySelector → 精准 DOM 操作
```

设计约束：

- Patch 只修改 viewer 端 DOM，不更新 DO 存储的 draft_html
- Finalize 前 agent 需要做一次全量 update 以确保持久化
- 这是有意为之：patch 是 streaming 加速手段，不是持久化机制

---

## 5. 第一性原理下的系统分层

```text
Agent
  -> shell / command runner
      -> duoduo-widget open / update / finalize / wait|get / inspect
      -> widget service API
      -> assistant text reply (viewer_url + fallback)

widget service
  -> Durable Objects        (draft coordination + wait/get + submit idempotency)
  -> R2                     (immutable revisions)
  -> Workers                (open/update/finalize/view/submit/wait/get/inspect)

User
  -> opens viewer_url
  -> sees progressive updates in same viewer
  -> interacts locally in browser
  -> submit bridge posts event
  -> widget service stores event
  -> duoduo-widget wait|get returns JSON
```

这里的关键不是“把 widget 接进 duoduo 协议”，而是“让 duoduo 能把一个外部 durable UI service 当成工具使用”。

---

## 6. Package 形态与主接口

### 6.1 为什么是外部 package

当前 duoduo root CLI 没有通用外部子命令发现机制。若坚持零侵入 core，V1 最合理的形态是：

- package: `packages/widget`
- bin: `duoduo-widget`

而不是先为 `duoduo widget` 去改 root CLI。

### 6.2 为什么不是仅 `publish`

如果目标只是“一次性生成一个最终页面”，原子 `publish` 足够。

但这里明确要的是渐进式：

- 页面先打开
- agent 持续生成内容
- 用户在同一 viewer 中看到增长
- 如果定义了交互元素，agent 还可能主动等待用户结果

因此 V1 主模型应直接是：

- `open`
- `update`
- `finalize`
- `wait`
- `get`
- `inspect`

### 6.3 主接口

```text
duoduo-widget open
  输入: title/ttl/interaction schema
  输出: widget_id/viewer_url/control_url/expires_at

duoduo-widget update
  输入: control_url|widget_id/html/text_fallback
  输出: widget_id/status

duoduo-widget finalize
  输入: control_url|widget_id
  输出: widget_id/revision_id/viewer_url

duoduo-widget wait
  输入: control_url|widget_id/timeout
  输出: pending | submitted + payload

duoduo-widget get
  输入: control_url|widget_id
  输出: pending | submitted + payload

duoduo-widget inspect
  输入: control_url|widget_id
  输出: debug/status/manifest
```

---

## 7. Agent Skill Adapter

除了 CLI contract，最终还应提供一个面向 agent 的 skill。

这个 skill 的定位不是新增协议，而是把 `duoduo-widget` 这组 CLI 调用封装成易用模式。

### 7.1 Skill 的职责

- 告诉 agent 什么时候适合创建 widget，什么时候只该返回纯文本
- 在需要渐进式生成时，引导 agent 使用 `open -> update -> finalize`
- 在定义了交互元素并且 agent 明确要等待用户反馈时，引导 agent 使用 `wait` 或 `get`
- 提醒 agent 只向用户发送 `viewer_url`，绝不发送 `control_url`
- 在 `--wid` 可用时优先使用本地 cache shortcut，减少上下文中的 URL/token 长度

### 7.2 Skill 的边界

- skill 不是 widget service API 的一部分
- skill 不参与 widget durable state
- skill 不要求 duoduo runtime 存在
- skill 只是帮助任意 agent 更稳定地调用 `duoduo-widget`

### 7.3 直接价值

- 后续开发 widget 时，不需要先跑 duoduo 才能验证完整链路
- agent 可以在纯本地或其他宿主环境里直接用 `duoduo-widget`
- duoduo 只是这个 CLI 的一个使用方，不再是唯一入口

---

## 8. URL 与 Capability 模型

### 8.1 `viewer_url`

- 无 token
- 默认只读
- 用于飞书消息、文本回复、分享链接
- 可以重复打开
- 用于展示 draft/live viewer 或 immutable revision

### 8.2 `control_url`

- 带 token
- 仅用于 `update/finalize/wait/get/inspect`
- 只给 agent/CLI 持有
- 不应出现在 assistant 正文、飞书卡片或用户可见链接里

### 8.3 `widget_id`

- `widget_id` 是 widget service 的 canonical durable ref
- 不是 cache key
- 本地 cache 只是 `widget_id -> control_url` 的快捷映射
- cache 丢失后，仍可通过显式 `--url <control_url>` 操作同一 widget

---

## 9. CLI Contract

### 9.1 Args

```ts
type WidgetOpenArgs = {
  title?: string;
  widget_id?: string;
  fork_widget_id?: string;
  ttl_seconds?: number;
  interaction?: {
    mode: "none" | "submit";
    schema?: Record<string, unknown>;
    submit_label?: string;
  };
};

type PatchOp = {
  op: "append" | "prepend" | "replace" | "innerHTML" | "text" | "remove";
  selector: string;
  html?: string;
  text?: string;
};

type WidgetUpdateArgs = {
  url?: string;
  wid?: string;
  html?: string; // full HTML mode (existing)
  patches?: PatchOp[]; // incremental DOM patch mode (new in v0.4)
  text_fallback?: string;
  mode?: "replace" | "append";
};

type WidgetFinalizeArgs = {
  url?: string;
  wid?: string;
};

type WidgetWaitArgs = {
  url?: string;
  wid?: string;
  timeout_seconds?: number;
};

type WidgetGetArgs = {
  url?: string;
  wid?: string;
};
```

### 9.2 Semantics

- `open`: 创建新的 draft，立即返回 `widget_id`、`viewer_url`、`control_url`
- `open --widget-id <widget_id>`: 为既有 widget 的最新 immutable 状态生成新的只读 `viewer_url`
- `open --fork <widget_id>`: 从既有 widget 的最新 immutable 状态派生新的 draft，并返回新的 `widget_id`
- `update`: 持续写入当前 draft；支持全量 HTML 或增量 `--patch` 模式（v0.4+）
- `finalize`: 冻结当前 draft，生成 immutable revision
- `wait`: 阻塞等待用户提交；如果已 `submitted`，返回同一份最终结果
- `get`: 非阻塞查询当前是否已有提交结果
- `inspect`: operator/debug 查看状态
- `--url` 总是指向 `control_url`
- `--wid` 只是 CLI 本地 cache shortcut
- 若 `--wid` 缓存未命中，CLI 应报错并要求显式传 `--url`

### 9.3 Local Cache

CLI 为了避免在 agent 上下文里反复携带长 `control_url`，应在本地 cache 一条记录：

```json
{
  "widget_id": "wid_01J...",
  "viewer_url": "https://widget.example.com/w/wid_01J...",
  "control_url": "https://widget.example.com/c/wid_01J...?token=tok_xxx",
  "token_expires_at": "2026-03-19T12:05:00.000Z"
}
```

语义：

- cache key: `widget_id`
- cache value: `{ control_url, viewer_url, token_expires_at }`
- `update/finalize/wait/get/inspect` 默认接受 `--url`
- 同时允许 `--wid`，CLI 自动从 cache 解析到 `control_url`
- 若 token 过期，CLI 应提示显式传新的 `--url` 或重新 `open`

### 9.4 Example Flow

```bash
duoduo-widget open \
  --title "Usage analysis" \
  --ttl-seconds 600
```

stdout:

```json
{
  "widget_id": "wid_01J...",
  "viewer_url": "https://widget.example.com/w/wid_01J...",
  "control_url": "https://widget.example.com/c/wid_01J...?token=tok_xxx",
  "expires_at": "2026-03-19T12:05:00.000Z"
}
```

```bash
duoduo-widget update \
  --wid "wid_01J..." \
  --text-fallback "Usage analysis is loading..." \
  < widget.html
```

```bash
duoduo-widget finalize --wid "wid_01J..."
```

```bash
duoduo-widget wait \
  --wid "wid_01J..." \
  --timeout-seconds 600
```

或显式使用 capability URL：

```bash
duoduo-widget get \
  --url "https://widget.example.com/c/wid_01J...?token=tok_xxx"
```

---

## 10. Widget Service 组件设计

### 10.1 Viewer

V1 需要 live viewer，但不需要 duoduo 内部 preview consumer。

理由：

- 渐进式是 widget service 自己的责任
- agent 只需要通过 CLI 调 `update`
- viewer 只需要连接 widget service 自己的 draft channel

传输层可以是：

- SSE
- WebSocket
- 长轮询

具体实现由 widget service 决定，不要求 duoduo runtime 提供额外流式事件。

### 10.2 Storage

建议职责分层：

- Durable Objects: draft 顺序控制、wait/get、submit 幂等
- R2: immutable revision HTML / assets / export blobs
- Workers: open/update/finalize/view/submit/wait/get/inspect API

规则：

- revision 不可变
- 同一 widget 可以有多个 revision
- 交互事件有独立 durable log
- progressive update 写入 draft，finalize 时冻结为 revision
- `submitted` 后的只读最终态由 `revision + latest_event_id` 合成，不回写 revision HTML

### 10.3 Viewer Shell

宿主 shell 负责：

- 安全沙箱
- 样式基础变量
- 注入 `window.duoduo.submit(action, payload)`
- 注入 `window.duoduo.openLink(url)`
- 控制脚本执行边界
- 对 draft 与 finalized revision 使用同一 rendering contract

### 10.4 Interaction Bridge

用户交互在 V1 中不回注 duoduo core，而是由 widget service 记录并通过 `wait/get` 返回给 agent。

桥接流程：

1. widget 调 `window.duoduo.submit(...)`
2. viewer shell POST 到 widget service
3. widget service 校验、去重、关联 `widget_id`
4. widget service 记录 event log
5. `duoduo-widget wait|get` 读取该结果
6. agent 把 JSON 结果当成下一步输入

这里的 submit capability 属于 widget web service 自己的 viewer session 机制，不等于 `control_url` 的写 token，也不属于 duoduo session。

---

## 11. 数据模型

### 11.1 Manifest

```json
{
  "widget_id": "wid_01J...",
  "title": "Price anomaly review",
  "parent_widget_id": null,
  "parent_revision_id": null,
  "created_at": "2026-03-19T12:00:00.000Z",
  "updated_at": "2026-03-19T12:00:04.000Z",
  "latest_revision_id": "rev_0002",
  "latest_event_id": "evt_0001",
  "state": "awaiting_input",
  "draft_expires_at": "2026-03-19T12:05:00.000Z",
  "interaction_expires_at": "2026-03-19T12:30:00.000Z",
  "metadata": {
    "source": "duoduo",
    "source_session_key": "stdio:default.ab12cd3",
    "source_channel_kind": "stdio"
  }
}
```

说明：

- `metadata.source_*` 只是可选审计信息
- widget service 不以这些字段驱动状态机
- widget 的 durable identity 是 `widget_id`

`state` 建议枚举：

- `draft`
- `finalized`
- `awaiting_input`
- `submitted`
- `draft_expired`

### 11.2 Revision Metadata

```json
{
  "revision_id": "rev_0002",
  "widget_id": "wid_01J...",
  "seq": 2,
  "created_at": "2026-03-19T12:00:04.000Z",
  "title": "Price anomaly review",
  "text_fallback": "Price anomaly review is ready. Open the widget to inspect the chart and confirm parameters.",
  "html_object_key": "widgets/wid_01J.../revisions/rev_0002.html",
  "interaction": {
    "mode": "submit",
    "schema": {
      "type": "object",
      "properties": {
        "symbol": { "type": "string" },
        "confirmed": { "type": "boolean" }
      },
      "required": ["symbol", "confirmed"]
    }
  },
  "sandbox_policy": {
    "allow_scripts": true,
    "allow_forms": true,
    "allow_network": false
  },
  "viewer_url": "https://widget.example.com/w/wid_01J.../rev_0002"
}
```

### 11.3 User Interaction Event

```json
{
  "event_id": "evt_0001",
  "widget_id": "wid_01J...",
  "revision_id": "rev_0002",
  "submitted_at": "2026-03-19T12:01:22.000Z",
  "immutable": true,
  "action": "submit",
  "payload": {
    "symbol": "NVDA",
    "confirmed": true
  }
}
```

### 11.4 Outbox Payload

这不是 V1 必需项。

V1 的最小交付路径是：

- `open` 后 agent 立刻把 `viewer_url` 发给用户
- 最终仍由 assistant 正文输出 `viewer_url` 与 `text_fallback`

Future 若需要 richer channel integration，再考虑 `OutboxRecord.payload.data.type = "widget_revision"`。

---

## 12. 协议与事件流

### 12.1 生成期

当 agent 调用 `duoduo-widget open` / `update`：

1. `open` 创建 widget draft，并返回 `widget_id`、`viewer_url`、`control_url`
2. agent 将 `viewer_url` 发给用户
3. agent 保留 `control_url` 作为后续命令的 capability URL
4. agent 通过 `update --url ...` 或 `update --wid ...` 持续推送 HTML
5. viewer 在同一 `viewer_url` 下看到渐进式更新

### 12.2 完成期

当 agent 调用 `duoduo-widget finalize` 时：

1. widget service 校验当前 draft
2. 生成 `revision_id`
3. 写 R2 revision object
4. 更新 manifest
5. 若有交互 schema，则状态变为 `awaiting_input`
6. 第一条合法 submit 会被冻结为最终用户输入快照
7. agent 可继续用同一个 `control_url` 调 `wait` 或轮询 `get`

### 12.3 用户交互期

用户点击 submit 后：

1. shell 收到前端 action
2. shell 只提交结构化 `action + payload`
3. widget service 进行 schema 校验与去重
4. 第一条合法 submit 被记录为最终 event，并把 manifest 状态切到 `submitted`
5. widget service 将该 payload 冻结为只读用户输入快照
6. 后续新的 submit 被拒绝，viewer 只能展示这份最终状态
7. `duoduo-widget wait|get` 持续读取同一个最终 event
8. agent 用结构化 JSON 继续下一步推理；若要继续复用，执行 `open --fork <widget_id>`

这里“冻结”指的是冻结 `latest_event_id` 指向的最终输入，而不是回写 revision HTML。

### 12.4 为什么选择 `wait/get`

把 duoduo 想成一个会用命令行的人，`wait/get` 是最自然的模型：

- human 和 agent 共用同一套 CLI
- widget service 完全独立，不要求改 duoduo core
- 交互结果不需要伪装成“又来了一条用户消息”
- 本地调试和手工操作最简单

同时必须明确：

- `wait/get` 是外部 CLI 阻塞模型
- 它不是 duoduo ingress
- 它不尝试把 widget 交互注入为新的 channel event

---

## 13. `wait/get` Contract

### 13.1 `wait`

```bash
duoduo-widget wait \
  --wid "wid_01J..." \
  --timeout-seconds 600
```

成功返回：

```json
{
  "status": "submitted",
  "event_id": "evt_01J...",
  "immutable": true,
  "message": "Widget is immutable after final submit. Use `duoduo-widget open --fork wid_01J...` to continue from the latest immutable state.",
  "action": "submit",
  "payload": {
    "symbol": "NVDA",
    "confirmed": true
  }
}
```

超时返回：

```json
{
  "status": "pending",
  "timeout": true
}
```

约束：

- `wait` 只等待 widget service 的交互结果
- `wait` 不会向 duoduo 发送 ingress
- `wait` 被中断或超时后，可重复调用

### 13.2 `get`

```bash
duoduo-widget get --wid "wid_01J..."
```

未提交：

```json
{
  "status": "pending"
}
```

已提交：

```json
{
  "status": "submitted",
  "event_id": "evt_01J...",
  "immutable": true,
  "message": "Widget is immutable after final submit. Use `duoduo-widget open --fork wid_01J...` to continue from the latest immutable state.",
  "action": "submit",
  "payload": {
    "symbol": "NVDA",
    "confirmed": true
  }
}
```

---

## 14. 生命周期与状态机

### 14.1 Preview 状态机

这是 viewer 本地的 ephemeral 状态：

```text
idle
  -> preview_open(widget_id)
  -> preview_streaming
  -> preview_complete
  -> preview_dispose
```

它不进入 durable store。

### 14.2 Widget Artifact 状态机

```text
draft
  -> finalized             (显式 finalize)
  -> draft_expired         (draft ttl 到期)

finalized
  -> awaiting_input        (finalized revision 带交互 schema)

awaiting_input
  -> submitted             (收到合法 widget_event)

submitted
  -> submitted             (稳定只读态)
```

约束：

- 一个 revision 不回写、不变更 HTML
- `finalized/submitted` 物料永久保留
- 可过期的是 draft 写窗口、交互等待窗口、write token
- 第一条合法 submit 会冻结最终用户输入快照，后续 submit 全部拒绝
- `wait/get` 在 `submitted` 后重复返回同一份最终 payload
- 若要继续复用当前结果，必须 `open --fork <widget_id>` 创建新的 draft
- 页面关闭不等于 widget 消失

### 14.3 Viewer Session 状态机

```text
connected
  -> disconnected
  -> closed

disconnected
  -> connected
  -> closed
```

规则：

- `connected/disconnected/closed` 只描述单个 viewer page session
- `close page` 只结束当前 page session，不改变 artifact 状态
- `open --widget-id` 不是恢复旧 session，而是为同一 artifact 或 revision 生成新的 viewer 访问入口
- viewer session 与 widget 生命周期解耦

### 14.4 `open` / `close` 语义

- `open`: 创建 widget artifact，进入 `draft`
- `open --widget-id`: 为既有 widget 的最新 immutable 状态返回新的只读 `viewer_url`
- `open --fork`: 从既有 widget 的最新 immutable 状态派生新的 draft
- `update`: 持续更新当前 draft
- `finalize`: 冻结当前 draft
- `wait|get`: 读取用户交互结果
- `close page`: 仅关闭 viewer session

因此：

- `open` 后立即有 `viewer_url`
- `finalize` 后页面对应 immutable revision，可重复打开
- 用户提交后的最终状态会以只读方式保留在该 revision 上
- `wait/get` 读取的是最终事件结果，不是页面内容
- 若要基于当前结果继续演化，必须 `open --fork <widget_id>`

---

## 15. Storyboard 场景模拟

### 15.1 场景 A: 渐进式生成

**Actor**

- Agent
- widget service
- viewer

**Context**

- 用户要求 agent 生成一个带图表和确认按钮的分析面板

**Trigger**

- agent 依次调用 `duoduo-widget open` / `update`

**Action**

1. `open` 返回 `widget_id`、`viewer_url`、`control_url`、`expires_at`
2. agent 把 `viewer_url` 发给用户
3. agent 保留 `control_url` 作为后续命令 capability
4. agent 持续调用 `update --wid ...`
5. viewer 在同一页面看到渐进式更新
6. agent 调用 `finalize --wid ...`
7. widget service 把最终 revision 冻结到 R2

**Memory Read/Write**

- 写: Durable Object draft state + R2 revision + manifest

**Feedback**

- 用户先看到草稿，再看到最终可交互版本

### 15.2 场景 B: 读取结果

**Actor**

- Agent
- widget service

**Context**

- widget 已 `awaiting_input`

**Trigger**

- agent 调用 `duoduo-widget wait --wid ...`

**Action**

1. widget service 阻塞等待用户提交
2. 用户在 viewer 中点击 submit
3. widget service 冻结这次 submit 为最终用户输入快照
4. wait 返回带 `immutable: true` 的结构化 JSON
5. agent 继续下一步推理；若还要扩展同一个分析，执行 `open --fork wid_...`

**Feedback**

- 不需要修改 duoduo core，也不需要 ingress 回注

### 15.3 场景 C: 重新打开

**Actor**

- viewer
- widget service

**Context**

- 用户之前已经 finalize 了 widget，随后关闭页面

**Trigger**

- 用户再次点击 `viewer_url`

**Action**

1. viewer 请求 `viewer_url`
2. Workers 从 R2 读取 immutable revision
3. 若 widget 已 `submitted`，viewer 额外读取 `latest_event_id` 对应 payload，并以只读方式 hydrate 最终状态
4. viewer 展示最后一次用户输入，但不再允许新的 submit

**Feedback**

- 用户看到的是最终 immutable revision，而不是过期草稿

### 15.4 场景 D: token 过期

**Actor**

- Agent
- widget service

**Context**

- widget 的 write token 已过期，但 immutable revision 仍存在

**Trigger**

- agent 调用 `duoduo-widget update --wid ...`

**Action**

1. CLI 查本地 cache，发现对应 `control_url` token 已过期
2. CLI 拒绝继续写入，并提示显式传新的 `--url` 或重新 `open`
3. 现有 `viewer_url` 继续可读
4. 已经 finalize 的 revision 不受影响

**Feedback**

- 过期的是写 capability，不是最终物料

---

## 16. 安全模型

### 16.1 必须保证

- agent HTML 不能直接与宿主 privileged DOM 同树运行
- widget 不能直接读 cookies、session storage、local storage
- widget 不能自行导航宿主窗口
- 所有外链必须通过宿主 `openLink`
- 用户可见 `viewer_url` 不能拥有写权限

### 16.2 V1 建议策略

- 使用隔离 iframe 或等价沙箱容器
- 注入单一 bridge:
  - `window.duoduo.submit(action, payload)`
  - `window.duoduo.openLink(url)`
- 默认禁止任意远程源，仅允许硬编码 CDN allowlist
- V1 以兼容 `refs/generative-ui` 现有 HTML 为目标，优先让图表、ERD、交互 demo 先跑起来
- 允许来自 allowlist 的 `<script src="...">`、`<script type="module">` 和对应静态 `import ... from "https://..."`
- 禁止 `fetch` / `XMLHttpRequest` / `WebSocket`
- 禁止 `eval()`、`new Function()`、`setTimeout(string)`、`setInterval(string)`
- 允许 inline script，但运行在受限壳中

### 16.3 CDN Allowlist

V1 直接对齐 `refs/generative-ui` 的现有代码约定，并由 viewer shell 的 CSP 固定下来：

- `cdnjs.cloudflare.com`
- `esm.sh`
- `cdn.jsdelivr.net`
- `unpkg.com`

---

## 17. 部署建议

按第一性原理和奥卡姆剃刀，V1 建议使用：

- Workers
- Durable Objects
- R2

暂不引入：

- KV
- D1
- Queues

原因：

- `Workers`: 提供 API 与 viewer 路由
- `Durable Objects`: 提供 draft 顺序控制、wait/get、submit 幂等
- `R2`: 存 immutable revision blob

幂等 submit：

- `POST /api/submit` 必须接收 `event_id`
- 同一个 `event_id` 重复提交返回相同结果
- artifact 进入 `submitted` 后，不同 `event_id` 的新 submit 应返回 immutable 错误

V1 建议约束：

- HTML 大小上限: `512KB`
- 每个 source session 的 widget 配额: `10`
- `viewer_url`: 无 token，只读
- `control_url`: 带 token，可写

---

## 18. Channel 行为与降级

### 18.1 基本原则

- widget 永远不是唯一输出
- 每个 widget revision 必须带 `text_fallback`
- rich channel 优先消费 `viewer_url`
- plain channel 消费纯文本链接或 `text_fallback`

### 18.2 建议的 channel 行为

| Channel   | Live Preview | Final Widget            | Interaction         | Fallback    |
| --------- | ------------ | ----------------------- | ------------------- | ----------- |
| `stdio`   | 否           | 可显示本地 URL/内嵌面板 | 可选                | 纯文本摘要  |
| `feishu`  | 否           | 链接卡片或简化卡片      | 通过打开外部 viewer | 文本 + 链接 |
| `acp/web` | 否           | 原生 viewer             | 是                  | 文本摘要    |

---

## 19. 实施路径

### Phase 1: External Progressive Widget

- 增加外部 widget service
- 增加 `Workers + Durable Objects + R2`
- 定义 `duoduo-widget open / update / finalize / wait|get / inspect`
- 增加 agent-facing skill，封装常见 CLI 调用模式
- `open` 后立即返回 `viewer_url + control_url`
- 用户交互通过 `wait/get` 读取，不改 duoduo core

这是最小渐进式闭环：一组 CLI 子命令、一个 Workers API、一个 DO 协调器、一个 R2 bucket。

### Phase 2: Richer Progressive Update

- 更复杂的 patch/append/replace 策略
- 更好的 viewer diff / morphing
- richer channel embedding

### Phase 3: Optional Channel Integration

- 如允许 core 演进，再扩展 `channel.ingress.data`
- 如允许 richer outbound，再考虑 `payload.data.type = "widget_revision"`

### Phase 4: Better Host Rendering

- 更强的 sandbox
- 更清晰的 design tokens
- richer channel adapters

---

## 20. 拒绝的方案

### 20.1 先改 duoduo root CLI 做 `duoduo widget`

不是不能做，而是不是 V1 最小路径。

### 20.2 只用 `Workers + KV`

KV 适合配置/缓存/token 映射，不适合承载 draft 顺序状态。

### 20.3 在 V1 去掉 Durable Objects

如果明确要渐进式，就需要 draft 协调器；DO 是当前 Cloudflare 语境下最小的顺序状态承载体。

### 20.4 让 `viewer_url` 直接带写 token

不建议。

- 用户可见链接必须是 view only
- 写 capability 应只存在于 `control_url`

### 20.5 把 widget 交互强行伪装成 duoduo channel message

不建议。

- V1 的目标是外部工具闭环
- `wait/get` 已足以表达完整生命周期

### 20.6 把 skill 当成系统边界

不建议。

- 真正稳定的边界应该是 CLI/API contract
- skill 只是一层 agent 使用体验优化
- 没有 skill 时，`duoduo-widget` 仍应可独立使用

### 20.7 只做客户端内存里的瞬时 widget

不建议。

- 断线即丢
- 无 replay
- 无分享 URL

---

## 21. Q&A

### Q1: 为什么 `viewer_url` 和 `control_url` 必须分开？

因为用户看到的 URL 只能承担只读展示职责。只要用户可见 URL 同时具备 `update/finalize/wait/get` 权限，分享、日志、截图、第三方脚本都会变成写权限泄漏面。

### Q2: 为什么 `widget_id` 不是 cache key？

因为 `widget_id` 是 widget service 里的 durable object identity。local cache 只是为了减少 agent 上下文里携带长 URL 的 token 消耗。cache 丢失不应该改变 widget 本体身份。

### Q3: `wait/get` 为什么不走 duoduo ingress？

因为这里要的是“agent 作为 CLI 用户主动等待外部 web service 结果”的模型，不是“把 widget 当成一个 duoduo channel”。这两者都合理，但 V1 选择前者以保持 core 零侵入。

### Q4: `wait/get` 会不会阻塞 duoduo？

会阻塞当前调用它的 agent 进程，因此它必须被视为一种显式的 HIL blocking 行为，而不是 runtime 自动 continuation 机制。它是 V1 的设计选择，不是隐藏语义。

### Q5: 为什么 `finalized/submitted` 物料不过期？

因为它们已经是 immutable artifact。可过期的是 draft 写窗口、交互等待窗口、write token，不应该是最终 revision 本身。否则就失去 durable/shareable/reopenable 的核心价值。

### Q6: widget service 里的 `session` 和 duoduo session 有什么关系？

没有运行时耦合关系。widget service 可以记录 `source_session_key` 之类的 metadata 方便审计，但这些字段不参与 widget lifecycle，也不驱动 service 状态机。

### Q7: 为什么 V1 还不直接做 richer outbox payload？

因为 V1 的最小闭环已经成立：agent 生成 widget，发 `viewer_url`，必要时 `wait/get` 读结果。更深的 channel 集成是未来增强项，不是闭环前提。

### Q8: 为什么除了 CLI 还要有 skill？

因为 CLI 解决的是系统边界和可移植性，skill 解决的是 agent 易用性。两者职责不同，不能互相替代。

### Q9: 为什么说后续开发时不需要 duoduo？

因为一旦能力被抽象成 `duoduo-widget` 这个独立 CLI，任何 agent、脚本或本地调试流程都可以直接调用它。duoduo 只是调用方之一，不再是开发和验证 widget 的必要前置。

---

## 22. 最终建议

1. `Widget` 是外部 package 提供的 durable UI artifact，不嵌入 duoduo core。
2. V1 CLI 采用 `duoduo-widget`，而不是强求 `duoduo widget`。
3. 除 CLI 外，还应提供 agent-facing skill，降低调用门槛，但 skill 不是系统边界。
4. `viewer_url` 与 `control_url` 必须严格分离。
5. `widget_id` 是 durable ref；本地 cache 只是 `wid -> control_url` 的 shortcut。
6. agent 通过 CLI 管理生命周期：`open / update / finalize / wait|get / inspect`。
7. `wait/get` 是外部 CLI 阻塞等待模型，不是 duoduo ingress。
8. `finalized/submitted` 物料永久保留；过期的是 draft、interaction window、write token。
9. 页面关闭只结束 viewer session，不结束 artifact。
10. 若要在当前结果上继续生成新结果，使用 `open --fork <widget_id>` 派生新的 draft。
11. 一旦抽象成独立 CLI，后续开发、调试、验证 widget 都不应依赖 duoduo 存在。
12. 所有 channel 必须能承载 `viewer_url` 或 `text_fallback`，widget 只负责增强体验。
