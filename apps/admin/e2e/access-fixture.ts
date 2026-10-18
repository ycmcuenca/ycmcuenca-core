// The Access key-set fixture of the admin smoke test (design D7). Every run
// generates a throwaway RS256 key pair, serves the public key at the path
// Cloudflare Access serves it from, and writes the private JWK to a
// git-ignored file the smoke test signs its token with. `wrangler dev` points
// ACCESS_TEAM_DOMAIN here through `--var`, so the production guard code
// verifies a real token against a test trust anchor, never a bypass.
//
// Node's http server, executed by `bun`, keeps the file type-checked with the
// types the workspace already has. A busy port is a loud failure (design D7,
// "Port clash"), which is the wanted behavior: 8799 is fixed on purpose.
import { exportJWK, generateKeyPair } from "jose";
import { createServer } from "node:http";
import { mkdirSync, writeFileSync } from "node:fs";

const PORT = 8799;
const CERTIFICATES_PATH = "/cdn-cgi/access/certs";
const keyDirectory = new URL("../.access-fixture/", import.meta.url);

const { publicKey, privateKey } = await generateKeyPair("RS256", {
  extractable: true,
});
// Cloudflare's key set carries `alg` and `kid` on every key; mirror the shape.
const publicJwk = { ...(await exportJWK(publicKey)), alg: "RS256", kid: "e2e" };
const privateJwk = {
  ...(await exportJWK(privateKey)),
  alg: "RS256",
  kid: "e2e",
};

mkdirSync(keyDirectory, { recursive: true });
writeFileSync(
  new URL("private-key.json", keyDirectory),
  JSON.stringify(privateJwk),
);
const keySet = JSON.stringify({ keys: [publicJwk] });

createServer((request, response) => {
  if (request.url === CERTIFICATES_PATH) {
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(keySet);
    return;
  }
  response.writeHead(404);
  response.end();
}).listen(PORT, "127.0.0.1", () => {
  console.log(`access fixture listening on http://127.0.0.1:${PORT}`);
});
