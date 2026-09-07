/**
 * THE ACCOUNT, in the File view — where a file's own facts live.
 *
 * Not a dialog and not a menu in the corner. Word's backstage is where you go
 * to ask about the document and about yourself, and signing in belongs there
 * for the same reason: it is never something you do WHILE writing.
 *
 * WHAT THIS PANEL HAS TO SAY, and it says all of it:
 *
 *   Signed out — what an account is FOR, so the offer is not a mystery, and
 *   plainly that the program works without one.
 *   Linking — the code, large, beside the address to open. The person compares
 *   this code with the one on the web page; that comparison is the whole
 *   defence of the flow, so it is the biggest thing on the panel.
 *   Signed in — who, what their role lets them do here, where the credential
 *   is kept, and the way out.
 */
import type { ReactNode } from 'react';
import { MAY, can, describeRole, type Ability } from '@siksamitra/account';
import { Icon } from '../ui/Icon.js';
import type { AccountApi } from '../account/useAccount.js';

/** The abilities worth listing, in the order somebody would ask about them. */
const SHOWN: readonly Ability[] = ['publish', 'edit-any', 'upload-audio'];

export function AccountPanel({ account }: { account: AccountApi }): ReactNode {
  const { state } = account;

  if (state.kind === 'busy') {
    return <p className="bs__note">Checking your account…</p>;
  }

  if (state.kind === 'linking') {
    return (
      <div className="acct">
        <p className="bs__note">
          Open this address in your browser, sign in as usual, and check that
          the code there is the one below.
        </p>
        <a
          className="acct__url"
          href={state.pending.verificationUrlComplete}
          target="_blank"
          rel="noreferrer noopener"
        >
          {state.pending.verificationUrl}
          <Icon name="export" size="sm" />
        </a>
        {/*
          THE BIGGEST THING ON THE PANEL, on purpose. Comparing this code with
          the one on the web page is what stops somebody being talked into
          approving a sign-in that is not theirs — the one attack this flow
          actually has. A code in small grey text does not get compared.
        */}
        <p className="acct__code" aria-label="The code to check">{state.pending.userCode}</p>
        <p className="bs__note">
          Waiting for you to allow it. Veda Union will never ask you for this
          code by email or by telephone.
        </p>
        <button type="button" className="bs__about" onClick={account.cancel}>Cancel</button>
      </div>
    );
  }

  if (state.kind === 'signed-in') {
    const { account: me, verified } = state;
    return (
      <div className="acct">
        <p className="acct__who">
          <Icon name="mode-read" size="md" />
          <span>
            <strong>{me.name}</strong>
            <span className="acct__role">{describeRole(me.role)}</span>
          </span>
        </p>

        {!verified && (
          /* Not an error. The session is kept and works the moment the
             network comes back; saying so is better than a silent doubt. */
          <p className="bs__note">
            Signed in, but Veda Union could not be reached to check. What your
            account may do will be confirmed when it can.
          </p>
        )}

        {verified && (
          <ul className="acct__may">
            {SHOWN.map((ability) => {
              const allowed = can(me, ability);
              return (
                <li key={ability} className={allowed ? 'is-on' : ''}>
                  <Icon name={allowed ? 'check' : 'locked'} size="sm" />
                  <span>{MAY[ability].label}</span>
                </li>
              );
            })}
          </ul>
        )}

        <p className="bs__note">
          Your sign-in is kept in {account.where}.
        </p>
        <button
          type="button"
          className="bs__about"
          onClick={() => { void account.signOut(); }}
        >
          Sign out
        </button>
      </div>
    );
  }

  return (
    <div className="acct">
      <p className="bs__note">
        Sign in to open documents from the Veda Union library and, if your
        account may, to publish back to it.
      </p>
      {/*
        SAID BEFORE IT IS ASKED. Somebody who does not want an account should
        be told they do not need one, rather than wondering what they are
        missing. Everything this program does to a text happens here.
      */}
      <p className="bs__note">
        Everything else — marking, exporting, mapping a recording — works
        without one.
      </p>
      {account.problem !== null && <p className="acct__problem">{account.problem}</p>}
      <button type="button" className="bs__about" onClick={() => { void account.signIn(); }}>
        Sign in to Veda Union
      </button>
      <p className="bs__note acct__fine">
        You will sign in in your own browser. śikṣāmitra never sees your
        password.
      </p>
    </div>
  );
}
