// The `welcome` app's server hooks: the baseline security headers on every
// response (design D8, decision I10) and structured error handling with a
// request id (design D9, decision I9).
import { handleErrorFor, securityHeaders } from "@ycmcuenca/edge";
import { sequence } from "@sveltejs/kit/hooks";

export const handle = sequence(securityHeaders());

export const handleError = handleErrorFor("welcome");
