/**
 * WHICH TAB OF THE PANEL IS SHOWN — a store, so a command can open one.
 *
 * Ctrl+Shift+I, the typing help, used to open a dialog of its own; it opens
 * the panel on its Type tab instead, and that needs the runtime, which is not
 * React, to be able to say which tab.
 */
import { useSyncExternalStore } from 'react';

export type Tab = 'mark' | 'rules' | 'script' | 'type' | 'document';

export const TABS: readonly { id: Tab; label: string; icon: string }[] = [
  { id: 'mark', label: 'Mark', icon: 'hold-short' },
  { id: 'rules', label: 'Rules', icon: 'auto-keep' },
  { id: 'script', label: 'Script', icon: 'script' },
  { id: 'type', label: 'Type', icon: 'keyboard' },
  { id: 'document', label: 'Document', icon: 'document' },
];

let tab: Tab = 'mark';
const listeners = new Set<() => void>();

export function openTab(next: Tab): void {
  if (next === tab) return;
  tab = next;
  for (const l of listeners) l();
}

export const useTab = (): Tab => useSyncExternalStore(
  (l) => { listeners.add(l); return () => { listeners.delete(l); }; },
  () => tab,
);
