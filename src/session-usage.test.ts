import assert from "node:assert/strict"
import test from "node:test"

import {
  fromSessionMessage,
  getSessionUsage,
  getTokenTotal,
  type SessionMessageLike,
} from "./session-usage"

test("empty session returns no models", () => {
  assert.deepEqual(getSessionUsage([]), {
    models: [],
  })
})

test("assistant message contributes all token counters and cost", () => {
  const usage = getSessionUsage([
    {
      role: "assistant",
      providerID: "openai",
      modelID: "gpt-4.1",
      cost: 0.05,
      tokens: {
        input: 11,
        output: 7,
        reasoning: 5,
        cache: {
          read: 3,
          write: 2,
        },
      },
    },
  ])

  assert.deepEqual(usage, {
    models: [
      {
        label: "openai/gpt-4.1",
        contextTokens: 28,
        sessionTokens: 28,
        sessionCachedTokens: 3,
        cost: 0.05,
        tps: 0,
        isLiveTps: false,
      },
    ],
  })
})

test("repeated model uses the latest output-bearing message for tokens", () => {
  const messages: SessionMessageLike[] = [
    {
      role: "assistant",
      providerID: "openai",
      modelID: "gpt-4.1",
      cost: 0.01,
      tokens: {
        input: 10,
        output: 5,
      },
      time: { created: 1000, completed: 3000 },
    },
    {
      role: "assistant",
      providerID: "openai",
      modelID: "gpt-4.1",
      cost: 0.02,
      tokens: {
        input: 4,
        output: 6,
        cache: {
          read: 7,
          write: 1,
        },
      },
      time: { created: 4000, completed: 5000 },
    },
  ]

  assert.deepEqual(getSessionUsage(messages), {
    models: [
      {
        label: "openai/gpt-4.1",
        contextTokens: 18,
        sessionTokens: 33,
        sessionCachedTokens: 7,
        cost: 0.03,
        tps: 0,
        isLiveTps: false,
      },
    ],
  })
})

test("multiple models preserve first-seen order", () => {
  const usage = getSessionUsage([
    {
      role: "assistant",
      providerID: "anthropic",
      modelID: "claude-sonnet-4",
      tokens: {
        input: 1,
        output: 2,
      },
    },
    {
      role: "assistant",
      providerID: "openai",
      modelID: "gpt-4.1",
      tokens: {
        input: 3,
        output: 4,
      },
    },
  ])

  assert.deepEqual(usage.models.map((m) => m.label), [
    "anthropic/claude-sonnet-4",
    "openai/gpt-4.1",
  ])
  assert.equal(usage.models[0].contextTokens, 3)
  assert.equal(usage.models[0].sessionTokens, 3)
  assert.equal(usage.models[0].sessionCachedTokens, 0)
  assert.equal(usage.models[1].contextTokens, 7)
  assert.equal(usage.models[1].sessionTokens, 7)
  assert.equal(usage.models[1].sessionCachedTokens, 0)
})

test("non-assistant messages are ignored", () => {
  const usage = getSessionUsage([
    {
      role: "user",
      providerID: "openai",
      modelID: "gpt-4.1",
      cost: 10,
      tokens: {
        input: 999,
        output: 999,
      },
    },
    {
      role: "assistant",
      providerID: "openai",
      modelID: "gpt-4.1",
      cost: 0.1,
      tokens: {
        input: 3,
        output: 2,
      },
    },
  ])

  assert.deepEqual(usage, {
    models: [
      {
        label: "openai/gpt-4.1",
        contextTokens: 5,
        sessionTokens: 5,
        sessionCachedTokens: 0,
        cost: 0.1,
        tps: 0,
        isLiveTps: false,
      },
    ],
  })
})

test("provider catalog names are used when available", () => {
  const providers = {
    openai: {
      id: "openai",
      name: "OpenAI",
      models: {
        "gpt-4.1": {
          id: "gpt-4.1",
          name: "GPT-4.1",
        },
      },
    },
  }

  const usage = getSessionUsage(
    [
      {
        role: "assistant",
        providerID: "openai",
        modelID: "gpt-4.1",
        tokens: {
          input: 2,
          output: 3,
        },
      },
    ],
    providers,
  )

  assert.deepEqual(usage, {
    models: [
      {
        label: "OpenAI/GPT-4.1",
        contextTokens: 5,
        sessionTokens: 5,
        sessionCachedTokens: 0,
        cost: 0,
        tps: 0,
        isLiveTps: false,
      },
    ],
  })
})

test("provider catalog also works when providers are stored as an array", () => {
  const providers = [
    {
      id: "anthropic",
      name: "Anthropic",
      models: {
        "claude-sonnet-4": {
          id: "claude-sonnet-4",
          name: "Claude Sonnet 4",
        },
      },
    },
  ]

  const usage = getSessionUsage(
    [
      {
        role: "assistant",
        providerID: "anthropic",
        modelID: "claude-sonnet-4",
        tokens: {
          input: 4,
          output: 6,
        },
      },
    ],
    providers,
  )

  assert.deepEqual(usage, {
    models: [
      {
        label: "Anthropic/Claude Sonnet 4",
        contextTokens: 10,
        sessionTokens: 10,
        sessionCachedTokens: 0,
        cost: 0,
        tps: 0,
        isLiveTps: false,
      },
    ],
  })
})

test("v2 assistant and compaction messages keep the same totals", () => {
  const usage = getSessionUsage([
    fromSessionMessage({
      id: "msg_1",
      type: "assistant",
      model: { id: "gpt-4.1", providerID: "openai" },
      cost: 0.25,
      tokens: {
        input: 11,
        output: 7,
        reasoning: 5,
        cache: { read: 3, write: 2 },
      },
      time: { created: 1000, completed: 2000 },
      finish: "stop",
    }),
    fromSessionMessage({
      id: "user_1",
      type: "user",
      text: "hi",
      time: { created: 500 },
    }),
    fromSessionMessage({
      id: "cmp_1",
      type: "compaction",
      status: "completed",
      model: { id: "gpt-4.1", providerID: "openai" },
      cost: 0.125,
      tokens: {
        input: 4,
        output: 1,
        reasoning: 0,
        cache: { read: 2, write: 0 },
      },
      time: { created: 3000, completed: 4000 },
    }),
  ])

  assert.deepEqual(usage, {
    models: [
      {
        label: "openai/gpt-4.1",
        contextTokens: 7,
        sessionTokens: 35,
        sessionCachedTokens: 5,
        cost: 0.375,
        tps: 0,
        isLiveTps: false,
      },
    ],
  })
})

test("v1 message fields still map through", () => {
  assert.deepEqual(
    fromSessionMessage({
      id: "a",
      role: "assistant",
      providerID: "openai",
      modelID: "gpt-4.1",
      cost: 1,
      tokens: {
        input: 1,
        output: 2,
        cache: { read: 3, write: 4 },
      },
      time: { created: 5, completed: 6 },
      finish: "stop",
    }),
    {
      id: "a",
      role: "assistant",
      modelID: "gpt-4.1",
      providerID: "openai",
      tokens: {
        input: 1,
        output: 2,
        reasoning: undefined,
        cache: { read: 3, write: 4 },
      },
      cost: 1,
      summary: undefined,
      time: { created: 5, completed: 6 },
      finish: "stop",
    },
  )
})

test("token helper tolerates missing counters", () => {
  assert.equal(
    getTokenTotal({
      input: 1,
      cache: {
        read: 2,
      },
    }),
    3,
  )
})

test("latest output-bearing assistant message determines displayed tokens and cache", () => {
  const usage = getSessionUsage([
    {
      role: "assistant",
      providerID: "openai",
      modelID: "gpt-4",
      tokens: {
        input: 5,
        output: 10,
        cache: {
          read: 20,
          write: 2,
        },
      },
      time: { created: 1000, completed: 2000 },
    },
    {
      role: "assistant",
      providerID: "openai",
      modelID: "gpt-4",
      tokens: {
        input: 100,
        output: 0,
        cache: {
          read: 999,
          write: 999,
        },
      },
      time: { created: 3000, completed: 4000 },
    },
    {
      role: "assistant",
      providerID: "openai",
      modelID: "gpt-4",
      tokens: {
        input: 11,
        output: 7,
        reasoning: 3,
        cache: {
          read: 30,
          write: 4,
        },
      },
      time: { created: 5000, completed: 6000 },
    },
  ])

  assert.deepEqual(usage, {
    models: [
      {
        label: "openai/gpt-4",
        contextTokens: 55,
        sessionTokens: 2190,
        sessionCachedTokens: 1049,
        cost: 0,
        tps: 0,
        isLiveTps: false,
      },
    ],
  })
})
