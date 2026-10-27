# opencode-models-usage-plugin

**Languages:** English | [简体中文](./README.zh-CN.md) | [日本語](./README.ja.md) | [한국어](./README.ko.md)

**Finally, you can see exactly what your AI model team is doing — right in the OpenCode sidebar.**

When you're coding with multiple models and multi-layer agents, including OMO sub-sessions, do you ever worry about things like:

- Which model is actively generating right now? Is it fast or slow?
- How many tokens have already been consumed? Are sub-agents quietly calling other models?
- How effective is cache reuse? How long can this coding plan keep going?
- Is the bill about to spike?

**Those anxieties can now be a thing of the past.**

`opencode-models-usage-plugin` gives you clear visibility into model usage across the entire session tree. You can see what is happening, stay in control, and drive your AI team with much more confidence.

![Models Usage sidebar screenshot](./src/assets/img.png)

## What It Displays

In the OpenCode sidebar, the plugin aggregates real-time usage for every model used in the current session tree, including all recursive sub-sessions, grouped by **provider/model**:

- **Live TPS**: shows current tokens per second while a response is streaming, and automatically returns to `—` when idle
- **Context Tokens**: the token total for that model's most recent reply, used as the current context footprint
- **Session Tokens**: the cumulative token total consumed by that model in the current session
- **Session Cached**: the cumulative cache-hit tokens for that model in the current session, so you can see how much cache reuse is helping
- **Total Cost**: the amount spent so far, shown as `spent $x.xxxx`

When a model is actively streaming, its name is **highlighted** so you can instantly see who is doing the work.

## Real Sidebar Example

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

● MiniMax/MiniMax-Text-01 (sub-session)
  ■ TPS 41.7
  ■ Context Tokens ...
  ■ Session Tokens ...
  ■ Session Cached ...
  ■ spent ...
```

## Why It Matters

- **Total Transparency**: usage from OMO sub-agents and recursive calls is automatically aggregated, so there are no more hidden costs
- **Real-Time Control**: see live TPS, cache hits, and cumulative costs at a glance
- **Smarter Decisions**: quickly spot slow models or strong cache performers and adjust your strategy on the fly
- **Lower-Stress Coding**: stop worrying about surprise bills or token drain, and focus on building

Whether you are heavily using model routing, complex agent orchestration, or simply want better visibility into token usage, this plugin can make the experience far more transparent and reassuring.

## Requirements

- OpenCode `>= 2.0.0`

This package targets the OpenCode V2 TUI plugin API (`@opencode/plugin`). It does not load under the V1 `tui.json` `plugin` / `plugin_enabled` config.

## Installation

This is a TUI-only package. Add it to the global CLI config so it stays active even when the terminal is connected to a remote server.

Open or create:

```text
~/.config/opencode/cli.json
```

When `$XDG_CONFIG_HOME` is set, use `$XDG_CONFIG_HOME/opencode/cli.json` instead.

```json
{
  "$schema": "https://opencode.ai/v2/cli.json",
  "plugins": [
    "opencode-models-usage-plugin"
  ]
}
```

Save the file. OpenCode installs the npm package and loads its `./tui` entry (`Plugin.define`, id `session-model-usage`). Restart the terminal client if the sidebar panel does not show up on its own.

To disable the panel without removing the package, prefix the plugin id in the same array:

```json
{
  "plugins": [
    "opencode-models-usage-plugin",
    "-session-model-usage"
  ]
}
```

## Technical Notes

- Data is grouped strictly by provider/model label
- Fully supports OMO sub-agents and all recursive sub-sessions, including Gemini, MiniMax, and others
- TPS is strictly live-only: it updates only during streaming and returns to `—` when idle
- Context Tokens reflect the token total of the most recent reply
- Session Tokens and Session Cached reflect cumulative values across the current session tree

## Package Info

- npm: `opencode-models-usage-plugin`
- current version: `2.0.0`

## License

`Apache-2.0`

Try it right after installing — the first time you see all your model activity laid out clearly in the sidebar, you may realize that AI coding can finally feel much calmer and far more under control.

Issues, PRs, and feedback are always welcome.

Let’s make the OpenCode model ecosystem more transparent and more usable together. 🚀
