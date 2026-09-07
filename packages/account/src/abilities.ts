/**
 * WHAT AN ACCOUNT MAY DO, in this program's own words.
 *
 * The permissions come from the platform and are named for the platform:
 * `documents.publish`, `documents.edit_any`, `media.upload`. Those are correct
 * and they are not what an editor's interface should say. So there is one
 * table, here, that maps what THIS program does — publish a chant, upload a
 * recording — onto the permission the server will actually check.
 *
 * TWO RULES THIS FILE EXISTS TO KEEP.
 *
 *   THE ANSWER HERE IS NEVER THE SECURITY. The server decides; every one of
 *   these checks is about what the window OFFERS, so that a person is not
 *   invited to press a button that will be refused. A client-side permission
 *   check that is the only check is not a permission check.
 *
 *   AN UNKNOWN PERMISSION MEANS NO. A build of this editor older than a
 *   permission the platform has since renamed must offer less, not more.
 *
 * Anything not listed is allowed to everyone, including somebody who is not
 * signed in at all: marking a text, exporting a Word file, mapping a recording
 * — all of it happens on this machine, to files this person already has, and
 * an editor that demanded an account to open a document would be a worse
 * program for no gain.
 */

/** The things this program asks the platform's permission for. */
export type Ability =
  /** Put a document into the Veda Union library. */
  | 'publish'
  /** Change a document somebody else authored. */
  | 'edit-any'
  /** Send a recording to the platform's media store. */
  | 'upload-audio'
  /** See documents that are not published yet. */
  | 'see-drafts';

interface Rule {
  /** The platform permission the server will actually check. */
  readonly needs: string;
  /** Said in the window, when the answer is no. */
  readonly whyNot: string;
  readonly label: string;
}

export const MAY: Readonly<Record<Ability, Rule>> = Object.freeze({
  publish: {
    needs: 'documents.publish',
    label: 'Publish to the library',
    whyNot: 'Your account can write documents but not publish them. Someone with '
      + 'an editor’s account can put this in the library.',
  },
  'edit-any': {
    needs: 'documents.edit_any',
    label: 'Edit anyone’s document',
    whyNot: 'Your account can change documents you authored. This one is '
      + 'someone else’s.',
  },
  'upload-audio': {
    needs: 'media.upload',
    label: 'Upload a recording',
    whyNot: 'Your account cannot add media to Veda Union. The mapping is saved '
      + 'in the document either way.',
  },
  'see-drafts': {
    needs: 'documents.view',
    label: 'Open unpublished documents',
    whyNot: 'Sign in to Veda Union to open documents that are not published yet.',
  },
});

/**
 * May this account do it?
 *
 * `null` — nobody signed in — is a plain no for everything on the list. It is
 * not an error and not a prompt: the window simply does not offer it, and the
 * File view says how to sign in.
 */
export function can(
  account: { readonly permissions: readonly string[] } | null,
  ability: Ability,
): boolean {
  if (account === null) return false;
  const rule = MAY[ability];
  /* Not `?.` — an ability that is not in the table is a programming mistake,
     and answering `false` for it is the safe reading. */
  if (rule === undefined) return false;
  return account.permissions.includes(rule.needs);
}

/**
 * The role, said the way a person would say it.
 *
 * The keys are the platform's (`youth`, `mentor`) and only some of them are
 * words anybody outside the platform would use. An unknown key comes back as
 * itself rather than as "unknown", because a role this build has not heard of
 * is still that person's real role and printing it is more honest than hiding
 * it.
 */
const ROLES: Readonly<Record<string, string>> = Object.freeze({
  student: 'Student',
  youth: 'Youth',
  mentor: 'Mentor',
  editor: 'Editor',
  admin: 'Administrator',
});

export const describeRole = (role: string): string => ROLES[role] ?? role;
