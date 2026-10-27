# opencode-models-usage-plugin

**语言：** [English](./README.md) | 简体中文 | [日本語](./README.ja.md) | [한국어](./README.ko.md)

**终于，你可以在 OpenCode 侧边栏里实时看到「你的 AI 模型团队」到底在干什么了。**

当你同时使用多个模型、多层 Agent（包括 OMO 子会话）全力 Coding 时，是否经常产生这些焦虑：

- 这个模型现在到底在不在输出？速度快不快？
- 已经悄悄消耗了多少 tokens？子 Agent 有没有偷偷调用其他模型？
- 缓存命中情况怎么样？这次 coding plan 还能撑多久？
- 账单会不会突然暴涨？

**现在，这些担心可以彻底告别了。**

`opencode-models-usage-plugin` 让你对整个会话树中的所有模型使用情况**一目了然**、**心中有数**。你可以更放心地驱动 AI 团队为你工作，而不必再畏手畏脚、时刻提心吊胆。

![Models Usage sidebar screenshot](./src/assets/img.png)


## 它能显示什么？

在 OpenCode 的侧边栏中，插件会按 **provider/model** 聚合展示当前会话树（含所有递归子会话）中每个模型的实时数据：

- **实时 TPS**：正在流式输出时显示当前 tokens per second，输出结束或空闲时自动变为 `—`
- **Context Tokens**：该模型最近一次回复对应的 token 总数，用来表示这一轮上下文占用
- **Session Tokens**：当前会话中该模型累计消耗的 token 总数
- **Session Cached**：当前会话中该模型累计缓存命中的 token 数，能直观看到缓存节省了多少
- **Total Cost**：当前已产生的费用（显示为 `spent $x.xxxx`）

当某个模型正在活跃输出时，它的名称会**高亮显示**，让你一眼就知道「谁在干活」。

## 侧边栏实际显示示例

```text
📊 Models Usage
● OpenAI/GPT-5.4 Fast
  ■ TPS 23.1
  ■ Context Tokens 12,345
  ■ Session Tokens 84,163
  ■ Session Cached 81,792
  ■ spent $0.0000

● Google/Gemini-2.5-Pro
  ■ TPS —
  ■ Context Tokens 8,942
  ■ Session Tokens 45,672
  ■ Session Cached 32,100
  ■ spent $0.0123

● MiniMax/MiniMax-Text-01（子会话）
  ■ TPS 41.7
  ■ Context Tokens ...
  ■ Session Tokens ...
  ■ Session Cached ...
  ■ spent ...
```

## 核心价值

- **完全透明**：OMO 子 Agent、递归调用产生的消耗都会自动聚合，不再有“黑箱烧钱”
- **实时掌控**：随时看到 TPS、缓存命中和累计成本，对预算和性能心里有数
- **高效决策**：快速判断哪个模型响应慢、哪个缓存效果好，随时优化策略
- **低焦虑 Coding**：告别对账单暴涨、token 耗尽的恐惧，把注意力放回创作本身

无论你是重度使用多模型路由、复杂 Agent 编排，还是只是想对 token 消耗更有掌控感，这个插件都能显著提升你的使用体验和安心感。

## 运行要求

- OpenCode `>= 2.0.0`

本包使用 OpenCode V2 的 TUI 插件 API（`@opencode/plugin`）。V1 的 `tui.json` 里 `plugin` / `plugin_enabled` 不会加载这个版本。

## 安装方式

这是一个仅 TUI 的插件。把它写进全局 CLI 配置后，即使终端连的是远程服务器，侧边栏也会继续生效。

打开或新建：

```text
~/.config/opencode/cli.json
```

如果设置了 `$XDG_CONFIG_HOME`，请改用 `$XDG_CONFIG_HOME/opencode/cli.json`。

```json
{
  "$schema": "https://opencode.ai/v2/cli.json",
  "plugins": [
    "opencode-models-usage-plugin"
  ]
}
```

保存后，OpenCode 会从 npm 安装该包，并加载 `./tui` 入口（`Plugin.define`，id 为 `session-model-usage`）。如果侧边栏没有马上出现，重启一次终端客户端。

不想删包、只想关掉面板时，在同一个数组里加上带 `-` 前缀的插件 id：

```json
{
  "plugins": [
    "opencode-models-usage-plugin",
    "-session-model-usage"
  ]
}
```

## 技术说明

- 数据按 provider/model label 严格聚合
- 完整支持 OMO 子 Agent 及所有递归子会话，Gemini、MiniMax 等子模型调用也会被统计
- TPS 为严格实时：仅在流式输出过程中动态更新，空闲状态自动恢复为 `—`
- Context Tokens 反映最近一次回复对应的 token 总数
- Session Tokens 与 Session Cached 反映当前整个会话树中的累计值

## 包信息

- npm：`opencode-models-usage-plugin`
- 当前版本：`2.0.0`

## License

`Apache-2.0`

安装后立刻试试看——当你第一次在侧边栏看到所有模型数据清晰、安静地排列在那里时，你会真切感受到：用 AI Coding，从此可以更放松、更可控。

欢迎提交 Issue、PR，或分享你的使用感受。

让我们一起让 OpenCode 的模型世界更加透明、更好用。🚀
