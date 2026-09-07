/**
 * THE ACCOUNT — signing in to Veda Union, from a program that is not a browser.
 *
 * WHY THERE IS NO PASSWORD BOX ANYWHERE IN THIS PACKAGE, and this is the whole
 * design rather than an omission:
 *
 * The obvious editor sign-in is an email field and a password field. It is
 * wrong for a reason that is easy to state — this program would then be
 * handling Veda Union passwords, keeping them or not keeping them by its own
 * lights, and one compromised build of it would be a password breach rather
 * than a token breach. Every future desktop client would have to be trusted
 * the same way, and a person would have learned that it is normal to type
 * their Veda Union password into a program that is not vedaunion.org, which is
 * the exact habit every credential-phishing attack depends on.
 *
 * So: the editor asks the server for a code, shows it, and opens the browser.
 * The person signs in where they always sign in, sees what is asking, compares
 * a short code visible on both screens, and allows it. The editor polls and is
 * handed a session token. This is the device-authorisation grant, and it is
 * what televisions and terminals have used for a decade for exactly this
 * reason.
 *
 * WHAT THIS PACKAGE IS NOT. It is not a network layer and not a UI. It holds
 * the protocol and the rules — what to send, what a reply means, when to stop
 * asking, and what a role is allowed to do — so that the same account works in
 * the desktop shell, in a browser and in a script, and so that all of it can be
 * tested without a server.
 */
export {
  DEFAULT_ORIGIN,
  beginSignIn,
  collect,
  poll,
  signOut,
  whoAmI,
  type Account,
  type Pending,
  type PollOutcome,
  type Transport,
} from './sign-in.js';

export {
  MAY,
  can,
  describeRole,
  type Ability,
} from './abilities.js';

export {
  emptySignedIn,
  load,
  save,
  weakVault,
  type Stored,
  type Vault,
} from './vault.js';
