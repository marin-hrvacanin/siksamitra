/**
 * WHICH FILE THE LOCAL SERVER WILL HAND OUT.
 *
 * This server exists so the Word add-in can be used with no internet, which
 * means it runs on the machine that has everything else on it too — the
 * checkout, the keys, the documents. A static file server that resolves
 * `GET /../../../.ssh/id_rsa` is not a bug in a toy, it is a hole in a
 * developer's laptop, and `office-addin-dev-certs` has already made the
 * browser trust it.
 *
 * SO EVERY ARM HERE IS AN ATTEMPT TO LEAVE THE FOLDER, and the control at the
 * bottom proves the server serves anything at all — a `fileFor` that returned
 * `null` for everything would pass all of them.
 *
 * The paths are real: a temporary directory with a file inside it and a file
 * beside it, so "did it escape" is answered by what came back rather than by
 * re-running the same string arithmetic the function did.
 */
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { TYPES, certDays, fileFor } from '../word-serve.mjs';

/* `<tmp>/root` is what is served. `<tmp>/secret.txt` is beside it, which is
   what an escape would reach. */
const tmp = mkdtempSync(join(tmpdir(), 'sm-serve-'));
const root = resolve(tmp, 'root');
mkdirSync(join(root, 'assets'), { recursive: true });
writeFileSync(join(root, 'taskpane.html'), '<p>pane</p>');
writeFileSync(join(root, 'index.html'), '<p>index</p>');
writeFileSync(join(root, 'assets', 'app.js'), 'export {}');
writeFileSync(resolve(tmp, 'secret.txt'), 'a private key would be here');
/* `<tmp>/rootevil` — the neighbour whose name STARTS with the root's. A
   `startsWith` test without the separator lets this one through. */
mkdirSync(resolve(tmp, 'rootevil'), { recursive: true });
writeFileSync(resolve(tmp, 'rootevil', 'x.txt'), 'also not ours');

afterAll(() => { rmSync(tmp, { recursive: true, force: true }); });

describe('it serves what is in the folder', () => {
  it('a file', () => {
    expect(fileFor(root, '/taskpane.html')).toBe(join(root, 'taskpane.html'));
  });

  it('a file in a subfolder', () => {
    expect(fileFor(root, '/assets/app.js')).toBe(join(root, 'assets', 'app.js'));
  });

  it('the folder itself, as its index', () => {
    expect(fileFor(root, '/')).toBe(join(root, 'index.html'));
  });

  it('and ignores a query string and a fragment', () => {
    expect(fileFor(root, '/taskpane.html?v=2')).toBe(join(root, 'taskpane.html'));
    expect(fileFor(root, '/taskpane.html#top')).toBe(join(root, 'taskpane.html'));
  });

  it('and a percent-escaped name', () => {
    expect(fileFor(root, '/assets%2Fapp.js')).toBe(join(root, 'assets', 'app.js'));
  });
});

describe('it refuses to leave the folder', () => {
  const outside = [
    ['a plain traversal', '/../secret.txt'],
    ['a deeper one', '/assets/../../secret.txt'],
    ['an escaped traversal', '/%2e%2e/secret.txt'],
    ['a doubly escaped one', '/..%2fsecret.txt'],
    ['a backslash traversal', '/..\\secret.txt'],
    ['a leading double slash', '//../secret.txt'],
    ['an absolute Windows path', '/C:/Windows/win.ini'],
    ['a neighbour whose name starts with the root’s', '/../rootevil/x.txt'],
  ];

  for (const [what, url] of outside) {
    it(what, () => {
      /* Either nothing, or something still inside the folder. Stated this way
         rather than as `toBeNull` because a traversal that normalises to a
         file which happens to exist INSIDE the root is also a correct answer —
         what must never happen is a path outside it. */
      const got = fileFor(root, url) ?? '';
      expect(got.startsWith(root) || got === '').toBe(true);
      expect(got).not.toContain('secret.txt');
      expect(got).not.toContain('rootevil');
    });
  }

  it('a malformed escape is a 404, not a crash', () => {
    /* `decodeURIComponent('%zz')` throws. Unhandled in a request handler, that
       is the whole server gone — from one malformed request. */
    expect(() => fileFor(root, '/%zz')).not.toThrow();
    expect(fileFor(root, '/%zz')).toBeNull();
    expect(fileFor(root, '/%')).toBeNull();
  });

  it('a NUL byte is refused', () => {
    expect(fileFor(root, '/taskpane.html%00.png')).toBeNull();
  });

  it('a missing file is nothing, and a folder with no index is nothing', () => {
    expect(fileFor(root, '/nope.html')).toBeNull();
    expect(fileFor(root, '/assets/')).toBeNull();
  });

  it('and no URL at all is the index rather than an exception', () => {
    expect(fileFor(root, undefined)).toBe(join(root, 'index.html'));
  });
});

describe('the content types', () => {
  it('cover every extension the published folder contains', () => {
    /* A `.js` served as `application/octet-stream` is a module the browser
       refuses to execute, which in a task pane is a blank pane. */
    for (const ext of ['.html', '.js', '.css', '.xml', '.png']) {
      expect(TYPES[ext], ext).toBeTruthy();
    }
    expect(TYPES['.js']).toContain('text/javascript');
  });
});

/*
 * A REAL CERTIFICATE, so `certDays` is measured rather than described.
 *
 * Self-signed for `localhost`, valid to 2036-09-07T14:17:38Z, generated once
 * with `openssl req -x509`. It is a fixture and not a secret: the private key
 * that goes with it was thrown away, and a certificate is the public half.
 * A date computed here instead would be `Date.parse` checking itself.
 */
const FIXTURE_CERT = `-----BEGIN CERTIFICATE-----
MIIDCTCCAfGgAwIBAgIUbZxEdAZoXR9qOF+gvQF7yP3y0IwwDQYJKoZIhvcNAQEL
BQAwFDESMBAGA1UEAwwJbG9jYWxob3N0MB4XDTI2MDkxMDE0MTczOFoXDTM2MDkw
NzE0MTczOFowFDESMBAGA1UEAwwJbG9jYWxob3N0MIIBIjANBgkqhkiG9w0BAQEF
AAOCAQ8AMIIBCgKCAQEA5baqsY7EVsUUxlqIeice2aL2551j7VhzfaDuznwprV0L
4TMiQl1K1Zyk4OZxAXYUzTktKuQPkR5pNDEXgG7WM/sompW5H58PPzDS7TU9TZsM
b9e1BwEwnDX4e+IQPLUoAjiolRouWiIGQBr2RDIZjko5Gtgu4Tqp1L1Kf1ceiFQp
DNXJaaV02Tlzfkf2cyc9wUih51WphsPL2ZFAf8oD+G2Bbj7b/zRPj8f//NCY/oP7
lRJAC1PNfJXFermR8Rw1xskgJNvZ3ZSbKndAlAw66IpiK0E66a6iM9euEl423jVH
3qNFLnftOYpi0pGpZboLEjDEWjnXEf7hmq9qqjaYQQIDAQABo1MwUTAdBgNVHQ4E
FgQU4boCfoV9EoBmuxKwINL2jQXzZWUwHwYDVR0jBBgwFoAU4boCfoV9EoBmuxKw
INL2jQXzZWUwDwYDVR0TAQH/BAUwAwEB/zANBgkqhkiG9w0BAQsFAAOCAQEAVRqg
HYWDe+YIhM9/PUVZtll4uXJdTVD9Ij5OneaFNOKyXbOzTkqzzshzOpBR7BPQlvB+
T+pCIoRliVXFf/NlfLu9Tj5VeBitiO24kjX2+uFeF6i4Nr+PS39w8qA6fiU8sIDE
L0gPEIzHfR5Ve3r+EtAIQ3fWsC/geGH9vbxckHJzVdAIrtRBLHlPeSKU2QZtrIV/
vcIMuYO9YbHngGlJ2EtLUFY5Pfz7JILDBzgRcHK3aBjNsgiTkajDmt27MgL/4cUt
NerlWFZWYnk09DpvhVEG4h4RSdcaY8IMLfHEnTeYcEhmmbNA0KusiOfGrYzgjpgW
kV7Ci0EXVZrgGb3Wng==
-----END CERTIFICATE-----
`;

describe('the certificate’s life', () => {
  /*
   * The developer certificate lasts 30 days. A pane that loaded yesterday and
   * is blank today, with no error visible anywhere in Word, is that expiry —
   * so the number is printed at startup and the arithmetic is worth measuring.
   * Both clocks are fixed, so nothing here goes stale with the calendar.
   */
  it('counts whole days left', () => {
    expect(certDays(FIXTURE_CERT, Date.parse('2036-09-01T14:17:38Z'))).toBe(6);
    expect(certDays(FIXTURE_CERT, Date.parse('2036-09-07T02:17:38Z'))).toBe(0);
  });

  it('and goes negative once it has expired', () => {
    expect(certDays(FIXTURE_CERT, Date.parse('2036-09-08T14:17:38Z'))).toBe(-1);
    expect(certDays(FIXTURE_CERT, Date.parse('2037-09-07T14:17:38Z'))).toBe(-365);
  });
});
