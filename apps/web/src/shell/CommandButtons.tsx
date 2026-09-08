/**
 * The commands of one group, as ribbon buttons.
 *
 * Split out of `Toolbar.tsx` because it is no longer only the toolbar that
 * renders a registry group: the File group draws New / Open / Save / Save As
 * from the same four entries, and a second copy of this loop is exactly the
 * drift the registry exists to prevent — the accelerator shown on the button
 * would come from one place and the accelerator that fires from another.
 *
 * `large` names the ones that get the big face — the actions the group is
 * about. Naming them at the call site rather than in the registry keeps the
 * registry about what a command IS, not how big it looks: Save is a large
 * button in the File group and a small one in an overflow popover.
 */
import type { ReactNode } from 'react';
import { commandsIn, type CommandContext, type CommandGroup } from './commands.js';
import { RibbonButton, RibbonStack } from './RibbonButton.js';

export function CommandButtons(
  { group, ctx, large = [] }: {
    group: CommandGroup;
    ctx: CommandContext;
    large?: readonly string[];
  },
): ReactNode {
  const all = commandsIn(group);
  const big = all.filter((c) => large.includes(c.id));
  const small = all.filter((c) => !large.includes(c.id));
  const button = (c: (typeof all)[number], size: 'lg' | 'sm'): ReactNode => (
    <RibbonButton
      key={c.id}
      icon={c.icon}
      label={c.label}
      size={size}
      {...(c.hint === undefined ? {} : { title: c.hint })}
      {...(c.key === undefined ? {} : { accel: c.key })}
      disabled={!(c.enabled?.(ctx) ?? true)}
      {...(c.active === undefined ? {} : { pressed: c.active(ctx) })}
      onClick={() => c.run(ctx)}
    />
  );
  return (
    <div className="rbg">
      {big.map((c) => button(c, 'lg'))}
      {small.length > 0 && <RibbonStack>{small.map((c) => button(c, 'sm'))}</RibbonStack>}
    </div>
  );
}
