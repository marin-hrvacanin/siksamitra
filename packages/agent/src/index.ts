/**
 * @siksamitra/agent — ONE harness for every place śikṣāmitra runs.
 *
 * The Word panel, the desktop app and the bot on a server each give it a
 * `Host` (what they can do) and keep their own `Session`s; the loop, the tools,
 * the prompts, the budget and the checks are here, once. The tools drive the
 * program's own functions — the importers' builder, `apply`, the rules, the
 * exporters — so the agent is an instance of śikṣāmitra, not a second one.
 *
 * No DOM, no Office, no Node built-ins: a browser and a server run it alike.
 * See `openspec/changes/agent-harness/`.
 */
export { deepseek, chatCompletions, toWire, usageOf, ModelError, SEEING } from './model.js';
export type {
  CompleteRequest, FetchLike, JsonSchema, Message, Model, ChatCompletionsOptions, Reply, Thinking, ToolCall, ToolSpec, Usage,
} from './model.js';
export { PRICES, OverBudget, UnknownPrice, checkBudget, costOf, memoryLedger, priceOf } from './budget.js';
export type { Ledger, LedgerEntry, Limits, Price } from './budget.js';
export { documentOf, paragraphsOf, runsOf } from './build.js';
export type { Outline, OutlineSection, OutlineVerse } from './build.js';
export { Workspace, marksSummary, outlineOf, verseLetters, versesOf } from './workspace.js';
export type { BuiltFrom, Origin, Witness } from './workspace.js';
export { RUNAWAY, runTurn, capped, withoutPaths } from './loop.js';
export type { AgentEvent, TurnOptions, TurnResult } from './loop.js';
export { TOOL_LABELS, systemFor, toolsFor } from './modes.js';
export { OUTCOME_ICON, stepAttention, stepIcon, stepResult, stepStarted } from './steps.js';
export { describeDocument } from './describe.js';
export type { Mode } from './modes.js';
export { Session, compact } from './session.js';
export type { SessionOptions, SessionState } from './session.js';
export { checkDocument } from './tools/check.js';
export type { Finding } from './tools/check.js';
export { RESEARCH, blocksOf } from './tools/sources.js';
export { findIn, fold, indexEntries, publishedLibrary, sectionDoc } from './library.js';
export { panelHtml, plainOf, telegramHtml, telegramPieces } from './markdown.js';
export { lineRange } from './tools/document.js';
export type {
  Delivered, DeliveryFormat, Exporters, Host, Library, LibraryEntry, Research, SearchHit, Shot, Tool, ToolContext,
} from './tools/types.js';
