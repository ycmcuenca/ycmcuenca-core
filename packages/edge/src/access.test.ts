import type { RequestEvent } from "@sveltejs/kit";
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from "jose";
import type { JWTVerifyGetKey } from "jose";
import { afterEach, describe, expect, it, vi } from "vitest";
import { accessGuard } from "./access";
import type { AccessGuardOptions, AccessRefusalReason } from "./access";
import { createLogger } from "./logging";
import { captureLogLines, eventFor, parsedLines } from "./test-helpers";

const teamDomain = "https://team.cloudflareaccess.com";
const audience = "test-audience";
const keyId = "team-key";

// The team's key pair, generated for this test run; the guard sees only the
// public set, injected as it would be in production (design D6, task 2.4).
const team = await generateKeyPair("RS256", { extractable: true });
const teamKeySet = createLocalJWKSet({
  keys: [
    {
      ...(await exportJWK(team.publicKey)),
      kid: keyId,
      alg: "RS256",
      use: "sig",
    },
  ],
});

interface TokenOptions {
  issuer?: string;
  tokenAudience?: string;
  expires?: number;
  key?: CryptoKey;
  keyId?: string;
}

async function signToken(options: TokenOptions = {}): Promise<string> {
  return await new SignJWT({ email: "owner@example.com" })
    .setProtectedHeader({ alg: "RS256", kid: options.keyId ?? keyId })
    .setIssuer(options.issuer ?? teamDomain)
    .setAudience(options.tokenAudience ?? audience)
    .setExpirationTime(options.expires ?? Math.floor(Date.now() / 1000) + 300)
    .sign(options.key ?? team.privateKey);
}

interface Refusal {
  response: Response;
  locals: RequestEvent["locals"];
  lines: string[];
}

async function runGuard(
  headers: Record<string, string>,
  overrides: Partial<AccessGuardOptions> = {},
): Promise<Refusal> {
  const lines = captureLogLines();
  const guard = accessGuard({
    teamDomain,
    audience,
    log: (request) => createLogger("admin", request),
    keySet: teamKeySet,
    ...overrides,
  });
  const event = eventFor("https://admin.example.com/", headers);
  const response = await guard({
    event,
    resolve: async () => new Response("page"),
  });
  return { response, locals: event.locals, lines };
}

async function expectRefusal(
  token: string | undefined,
  reason: AccessRefusalReason,
  overrides: Partial<AccessGuardOptions> = {},
): Promise<void> {
  const { response, lines } = await runGuard(
    token === undefined ? {} : { "cf-access-jwt-assertion": token },
    overrides,
  );

  expect(response.status).toBe(403);
  const logged = parsedLines(lines);
  expect(logged).toHaveLength(1);
  expect(logged[0]).toMatchObject({
    level: "warn",
    msg: "access refused",
    app: "admin",
    reason,
  });
  if (token !== undefined) {
    expect(lines.join("\n")).not.toContain(token);
  }
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("accessGuard", () => {
  it("refuses with `config` when the team domain or audience is empty", async () => {
    await expectRefusal(undefined, "config", { teamDomain: "" });
    await expectRefusal(undefined, "config", { audience: "" });
  });

  it("refuses with `missing` when the request carries no token", async () => {
    await expectRefusal(undefined, "missing");
  });

  it("refuses with `signature` when the token was signed by another key", async () => {
    const other = await generateKeyPair("RS256", { extractable: true });

    await expectRefusal(
      await signToken({ key: other.privateKey }),
      "signature",
    );
  });

  it("refuses with `issuer` when the token is from another team", async () => {
    await expectRefusal(
      await signToken({ issuer: "https://other.cloudflareaccess.com" }),
      "issuer",
    );
  });

  it("refuses with `audience` when the token belongs to another application", async () => {
    await expectRefusal(
      await signToken({ tokenAudience: "other-audience" }),
      "audience",
    );
  });

  it("refuses with `expired` when the token has expired", async () => {
    await expectRefusal(
      await signToken({ expires: Math.floor(Date.now() / 1000) - 60 }),
      "expired",
    );
  });

  it("refuses with `keys` when the key set cannot be fetched", async () => {
    const unreachableKeySet: JWTVerifyGetKey = async () => {
      throw new TypeError("fetch failed");
    };

    await expectRefusal(await signToken(), "keys", {
      keySet: unreachableKeySet,
    });
  });

  it("lets a valid token through and records the email", async () => {
    const { response, locals, lines } = await runGuard({
      "cf-access-jwt-assertion": await signToken(),
    });

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("page");
    expect(locals.accessEmail).toBe("owner@example.com");
    expect(lines).toEqual([]);
  });
});
