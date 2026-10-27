# opencode-models-usage-plugin

**言語:** [English](./README.md) | [简体中文](./README.zh-CN.md) | 日本語 | [한국어](./README.ko.md)

**ついに、OpenCode のサイドバーで「AI モデルチームが今何をしているか」をリアルタイムで見られるようになりました。**

複数モデルや多段 Agent、さらに OMO のサブセッションまで使って本格的に Coding していると、こんな不安を感じることはありませんか？

- 今どのモデルが出力中なのか？速度は速いのか遅いのか？
- すでにどれだけ tokens を消費したのか？サブ Agent が別のモデルを勝手に呼んでいないか？
- キャッシュのヒット状況はどうか？この coding plan はまだ持ちそうか？
- コストが急に跳ね上がらないか？

**もう、そうした不安に振り回される必要はありません。**

`opencode-models-usage-plugin` は、現在のセッションツリー全体におけるモデル使用状況を見える化します。何が起きているかを把握しながら、より安心して AI チームを動かせるようになります。

![Models Usage sidebar screenshot](./src/assets/img.png)

## 何が表示されるのか

OpenCode のサイドバーで、現在のセッションツリー（再帰的な子セッションを含む）に登場した各モデルの使用状況を **provider/model** 単位で集約表示します。

- **Live TPS**: ストリーミング出力中の tokens per second。アイドル時は `—` に戻ります
- **Context Tokens**: そのモデルの直近の返信に対応する token 総数
- **Session Tokens**: 現在のセッション内でそのモデルが累積消費した token 総数
- **Session Cached**: 現在のセッション内でそのモデルが累積でキャッシュヒットした token 数
- **Total Cost**: 現時点までの累積コスト（`spent $x.xxxx` 形式）

モデルが現在アクティブに出力しているときは、モデル名が**ハイライト表示**されるため、「今どのモデルが動いているか」を一目で把握できます。

## サイドバー表示例

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
```

## これが重要な理由

- **完全な透明性**: OMO サブ Agent や再帰呼び出しによる使用量も自動で集約され、見えないコストがなくなります
- **リアルタイム把握**: Live TPS、キャッシュヒット、累積コストをその場で確認できます
- **判断しやすい**: 遅いモデルやキャッシュ効率の良いモデルを素早く見分け、戦略を調整できます
- **安心して Coding**: 突然の高額請求や token 枯渇を気にしすぎず、開発そのものに集中できます

## 動作要件

- OpenCode `>= 2.0.0`

このパッケージは OpenCode V2 の TUI プラグイン API（`@opencode/plugin`）向けです。V1 の `tui.json` にある `plugin` / `plugin_enabled` では読み込まれません。

## インストール

TUI 専用パッケージです。グローバルな CLI 設定に追加すると、ターミナルがリモートサーバーへ接続していてもサイドバーは有効なままです。

次のファイルを開くか、新規作成します。

```text
~/.config/opencode/cli.json
```

`$XDG_CONFIG_HOME` が設定されている場合は `$XDG_CONFIG_HOME/opencode/cli.json` を使います。

```json
{
  "$schema": "https://opencode.ai/v2/cli.json",
  "plugins": [
    "opencode-models-usage-plugin"
  ]
}
```

保存すると、OpenCode が npm からパッケージを入れ、`./tui` エントリ（`Plugin.define`、id は `session-model-usage`）を読み込みます。サイドバーがすぐ出ないときはターミナルクライアントを再起動してください。

パッケージは残したままパネルだけ止めたい場合は、同じ配列にプラグイン id を `-` 付きで追加します。

```json
{
  "plugins": [
    "opencode-models-usage-plugin",
    "-session-model-usage"
  ]
}
```

## 技術メモ

- データは provider/model label 単位で厳密に集約されます
- OMO サブ Agent や再帰的な子セッションも完全にサポートします
- TPS は live-only で、ストリーミング中のみ更新され、アイドル時には `—` に戻ります
- Context Tokens は直近の返信に対応します
- Session Tokens と Session Cached は現在のセッションツリー全体での累積値です

## パッケージ情報

- npm: `opencode-models-usage-plugin`
- 現在のバージョン: `2.0.0`

## License

`Apache-2.0`

インストール後、ぜひすぐに試してみてください。サイドバーにモデルの状態が整然と並ぶのを見た瞬間、AI Coding がもっと落ち着いて、もっと扱いやすく感じられるはずです。
