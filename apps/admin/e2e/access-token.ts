// Signs the short-lived Access token the e2e specs send to the built worker
// (design D7). The key-set fixture writes a throwaway private key, and
// `wrangler dev` is told to trust the matching key set through `--var`, so
// every spec signs its own request with the same test trust anchor.
import { SignJWT, importJWK } from "jose";
import type { JWK } from "jose";
import { readFileSync } from "node:fs";

/** The origin `wrangler dev` trusts for e2e (design D7). */
export const fixtureOrigin = "http://127.0.0.1:8799";

/** The audience `wrangler dev` expects for e2e (design D7). */
export const accessAudience = "e2e-audience";

const privateKeyFile = new URL(
  "../.access-fixture/private-key.json",
  import.meta.url,
);

/** Signs a five-minute Access token the fixture's key verifies (design D7). */
export async function signedAccessToken(): Promise<string> {
  const privateJwk = JSON.parse(readFileSync(privateKeyFile, "utf8")) as JWK;
  const key = await importJWK(privateJwk, "RS256");
  return new SignJWT({})
    .setProtectedHeader({ alg: "RS256", kid: "e2e" })
    .setIssuer(fixtureOrigin)
    .setAudience([accessAudience])
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(key);
}
