/** @jsxImportSource @opentui/solid */

import { Plugin, usePlugin } from "@opencode/plugin/tui"
import type { JSX } from "@opentui/solid"
import type { Accessor } from "solid-js"
import { For, Show, createEffect, createMemo, createSignal, onCleanup, onMount } from "solid-js"

import { fromSessionMessage, getSessionUsage, type LiveTpsState, type SessionMessageLike } from "./session-usage"

const pluginID = "session-model-usage"
const messagePageSize = 200
const childPageSize = 200

type PluginContext = ReturnType<typeof usePlugin>

type LiveInfo = {
  sessionID: string
  messageID: string
  modelID: string
  providerID?: string
  startTime: number
  chars: number
}

type KnownModel = {
  modelID: string
  providerID?: string
}

const toProviderCatalog = (
  providers: readonly { id: string; name: string }[],
  models: readonly { id: string; modelID: string; providerID: string; name: string }[],
) => {
  return providers.map((provider) => {
    const providerModels: Record<string, { id: string; name: string }> = {}
    for (const model of models) {
      if (model.providerID !== provider.id) continue
      const entry = { id: model.modelID, name: model.name }
      providerModels[model.modelID] = entry
      if (model.id !== model.modelID) providerModels[model.id] = entry
    }

    return {
      id: provider.id,
      name: provider.name,
      models: providerModels,
    }
  })
}

const listAllMessages = async (
  context: PluginContext,
  sessionID: string,
): Promise<SessionMessageLike[]> => {
  const collected: SessionMessageLike[] = []
  let cursor: string | undefined
  const seenCursors = new Set<string>()

  for (;;) {
    const page = await context.client.message.list({
      sessionID,
      limit: messagePageSize,
      ...(cursor ? { cursor } : { order: "asc" as const }),
    })
    collected.push(...page.data.map((message) => fromSessionMessage(message)))
    const next = page.cursor.next ?? undefined
    if (!next || seenCursors.has(next)) break
    seenCursors.add(next)
    cursor = next
  }

  return collected
}

const collectSessionIDs = async (context: PluginContext, rootSessionID: string): Promise<string[]> => {
  const ordered: string[] = []
  const seen = new Set<string>()
  const queue = [rootSessionID]

  while (queue.length > 0) {
    const sessionID = queue.shift()
    if (!sessionID || seen.has(sessionID)) continue
    seen.add(sessionID)
    ordered.push(sessionID)

    try {
      await context.data.session.sync(sessionID)
    } catch {
      // The host store may already know this session.
    }

    let cursor: string | undefined
    const seenCursors = new Set<string>()
    try {
      for (;;) {
        const page = await context.client.session.list({
          parentID: sessionID,
          limit: childPageSize,
          ...(cursor ? { cursor } : {}),
        })
        for (const child of page.data) {
          if (seen.has(child.id)) continue
          queue.push(child.id)
        }
        const next = page.cursor.next ?? undefined
        if (!next || seenCursors.has(next)) break
        seenCursors.add(next)
        cursor = next
      }
    } catch {
      // family() below still includes sessions the host has already registered.
    }
  }

  for (const sessionID of context.data.session.family(rootSessionID)) {
    if (seen.has(sessionID)) continue
    seen.add(sessionID)
    ordered.push(sessionID)
  }

  return ordered
}

const useSessionMessages = (context: PluginContext, rootSessionID: Accessor<string>) => {
  const [messages, setMessages] = createSignal<SessionMessageLike[]>([])
  const [trackedSessionIDs, setTrackedSessionIDs] = createSignal<ReadonlySet<string>>(
    new Set([rootSessionID()]),
  )
  const [liveInfo, setLiveInfo] = createSignal<LiveInfo | null>(null)
  const modelsByMessage = new Map<string, KnownModel>()

  let reloadVersion = 0

  const reload = async (sessionID: string) => {
    const version = ++reloadVersion
    let sessionIDs: string[] = []
    let nextMessages: SessionMessageLike[] = []

    try {
      sessionIDs = await collectSessionIDs(context, sessionID)
      const groups = await Promise.all(
        sessionIDs.map(async (id) => {
          try {
            // Full pages, not data.session.message.sync. That call replaces the
            // host transcript cache with a single short page.
            return await listAllMessages(context, id)
          } catch {
            return context.data.session.message.list(id).map((message) => fromSessionMessage(message))
          }
        }),
      )
      nextMessages = groups.flat()
    } catch {
      return
    }

    if (version !== reloadVersion) return

    setMessages(nextMessages)
    setTrackedSessionIDs(new Set(sessionIDs.length > 0 ? sessionIDs : [sessionID]))
  }

  const isTracked = (sessionID: string) => {
    if (sessionID === rootSessionID()) return true
    if (trackedSessionIDs().has(sessionID)) return true
    return context.data.session.family(rootSessionID()).includes(sessionID)
  }

  const rememberModel = (messageID: string, model: { id: string; providerID: string }) => {
    modelsByMessage.set(messageID, {
      modelID: model.id,
      providerID: model.providerID,
    })
  }

  const findModel = (sessionID: string, messageID: string): KnownModel | undefined => {
    const known = modelsByMessage.get(messageID)
    if (known) return known

    const live = fromSessionMessage(context.data.session.message.get(sessionID, messageID))
    if (live.role === "assistant" && live.modelID) {
      return { modelID: live.modelID, providerID: live.providerID ?? undefined }
    }

    const historical = messages().find((message) => message.id === messageID)
    if (historical?.role === "assistant" && historical.modelID) {
      return { modelID: historical.modelID, providerID: historical.providerID ?? undefined }
    }

    return undefined
  }

  const noteDelta = (sessionID: string, messageID: string, delta: string) => {
    if (!isTracked(sessionID) || delta.length === 0) return

    setLiveInfo((prev) => {
      if (prev?.messageID === messageID) {
        return { ...prev, chars: prev.chars + delta.length }
      }

      const model = findModel(sessionID, messageID)
      if (!model) return prev

      return {
        sessionID,
        messageID,
        modelID: model.modelID,
        providerID: model.providerID,
        startTime: Date.now(),
        chars: delta.length,
      }
    })
  }

  const clearLive = (sessionID: string) => {
    if (!isTracked(sessionID)) return
    setLiveInfo((prev) => (prev?.sessionID === sessionID ? null : prev))
  }

  createEffect(() => {
    const sessionID = rootSessionID()
    modelsByMessage.clear()
    setMessages([])
    setTrackedSessionIDs(new Set([sessionID]))
    setLiveInfo(null)
    void reload(sessionID)
  })

  onMount(() => {
    const unsubs = [
      context.data.on("session.text.delta", (event) => {
        noteDelta(event.data.sessionID, event.data.assistantMessageID, event.data.delta)
      }),
      context.data.on("session.reasoning.delta", (event) => {
        noteDelta(event.data.sessionID, event.data.assistantMessageID, event.data.delta)
      }),
      context.data.on("session.step.started", (event) => {
        rememberModel(event.data.assistantMessageID, event.data.model)
        void reload(rootSessionID())
      }),
      context.data.on("session.step.ended", () => {
        void reload(rootSessionID())
      }),
      context.data.on("session.step.failed", () => {
        void reload(rootSessionID())
      }),
      context.data.on("session.usage.updated", () => {
        void reload(rootSessionID())
      }),
      context.data.on("session.status", () => {
        void reload(rootSessionID())
      }),
      context.data.on("session.created", () => {
        void reload(rootSessionID())
      }),
      context.data.on("session.idle", (event) => {
        clearLive(event.data.sessionID)
      }),
      context.data.on("session.execution.succeeded", (event) => {
        clearLive(event.data.sessionID)
        void reload(rootSessionID())
      }),
      context.data.on("session.execution.failed", (event) => {
        clearLive(event.data.sessionID)
        void reload(rootSessionID())
      }),
      context.data.on("session.execution.interrupted", (event) => {
        clearLive(event.data.sessionID)
        void reload(rootSessionID())
      }),
    ]

    onCleanup(() => {
      reloadVersion += 1
      unsubs.forEach((unsubscribe) => {
        unsubscribe()
      })
    })
  })

  const [now, setNow] = createSignal(Date.now())

  onMount(() => {
    const timer = setInterval(() => setNow(Date.now()), 500)
    onCleanup(() => clearInterval(timer))
  })

  const liveTps = createMemo<LiveTpsState | null>(() => {
    const info = liveInfo()
    if (!info) return null

    const durationMs = now() - info.startTime
    // Estimate 1 token = 4 chars while the reply is still streaming.
    const tpsTokens = Math.ceil(info.chars / 4)

    return {
      modelID: info.modelID,
      providerID: info.providerID,
      tpsTokens,
      tpsDurationMs: Math.max(durationMs, 1),
    }
  })

  return { usageMessages: messages, liveTps }
}

const SessionUsagePanel = (props: { sessionID: string }) => {
  const context = usePlugin()
  const activeSessionID = () => props.sessionID
  const { usageMessages, liveTps } = useSessionMessages(context, activeSessionID)
  const [catalog, setCatalog] = createSignal<ReturnType<typeof toProviderCatalog>>([])

  const refreshCatalog = async () => {
    const location = context.location ?? context.data.location.default()
    try {
      await Promise.all([
        context.data.location.provider.sync(location),
        context.data.location.model.sync(location),
      ])
    } catch {
      // Keep going with whatever the host has already cached.
    }

    setCatalog(
      toProviderCatalog(
        context.data.location.provider.list(location) ?? [],
        context.data.location.model.list(location) ?? [],
      ),
    )
  }

  onMount(() => {
    void refreshCatalog()
    const stopProvider = context.data.on("provider.updated", () => {
      void refreshCatalog()
    })
    const stopModel = context.data.on("model.updated", () => {
      void refreshCatalog()
    })
    onCleanup(() => {
      stopProvider()
      stopModel()
    })
  })

  const usage = createMemo(() => getSessionUsage(usageMessages(), catalog(), liveTps()))
  const theme = () => context.theme

  return (
    <box flexDirection="column">
      <text>📊 Models Usage</text>
      {usage().models.length === 0 ? (
        <text>None yet</text>
      ) : (
        <For each={usage().models}>
          {(model) => (
            <box flexDirection="column">
              <text fg={model.isLiveTps ? theme().text.feedback.warning.base : theme().text.base}>
                ● {model.label}
              </text>
              <box flexDirection="column" paddingLeft={2}>
                <box flexDirection="row">
                  <text fg={theme().text.base} width={18} flexShrink={0}>
                    ■ TPS
                  </text>
                  <text fg={theme().text.muted}>
                    {model.isLiveTps && model.tps > 0 ? model.tps.toFixed(1) : "—"}
                  </text>
                </box>
                <box flexDirection="row">
                  <text fg={theme().text.base} width={18} flexShrink={0}>
                    ■ Context Tokens
                  </text>
                  <text fg={theme().text.muted}>{model.contextTokens.toLocaleString("en-US")}</text>
                </box>
                <box flexDirection="row">
                  <text fg={theme().text.base} width={18} flexShrink={0}>
                    ■ Session Tokens
                  </text>
                  <text fg={theme().text.muted}>{model.sessionTokens.toLocaleString("en-US")}</text>
                </box>
                <box flexDirection="row">
                  <text fg={theme().text.base} width={18} flexShrink={0}>
                    ■ Session Cached
                  </text>
                  <text fg={theme().text.muted}>{model.sessionCachedTokens.toLocaleString("en-US")}</text>
                </box>
                <box flexDirection="row">
                  <text fg={theme().text.base} width={18} flexShrink={0}>
                    ■ spent
                  </text>
                  <text fg={theme().text.muted}>${model.cost.toFixed(4)}</text>
                </box>
              </box>
            </box>
          )}
        </For>
      )}
    </box>
  )
}

const globalKey = Symbol.for(`opencode-plugin-${pluginID}`)

export default Plugin.define({
  id: pluginID,
  setup(context) {
    const globalStore = globalThis as { [key: symbol]: boolean | undefined }
    if (globalStore[globalKey]) return
    globalStore[globalKey] = true

    const unregister: () => void = context.ui.slot({
      append: "sidebar.content",
      render: ({ sessionID }): JSX.Element => (
        <Show when={sessionID} keyed>
          {(id: string) => <SessionUsagePanel sessionID={id} />}
        </Show>
      ),
    })

    return () => {
      globalStore[globalKey] = false
      unregister()
    }
  },
})
