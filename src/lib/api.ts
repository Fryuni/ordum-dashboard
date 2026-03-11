import { BitcraftApiClient } from "../bitcraft-api-client";
import { API_BASE_URL } from "./ordum-data";

/** Global API client instance — used server-side by all pages and actions. */
export const api = new BitcraftApiClient({
  baseUrl: API_BASE_URL,
  timeout: 60_000,
});
