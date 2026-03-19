/**
 * Represents a "raw JSON" object created by `JSON.rawJSON()`.
 *
 * Raw JSON objects are frozen, null-prototype objects that carry pre-serialized
 * JSON text.  When encountered by `JSON.stringify()`, the `rawJSON` property
 * value is emitted verbatim instead of the usual serialization.
 *
 * @see {@link https://tc39.es/proposal-json-parse-with-source/ TC39 proposal-json-parse-with-source}
 */
// ─── Uint8Array Base64 (TC39 proposal-arraybuffer-base64) ──────────────────────

interface Uint8ArrayToBase64Options {
  alphabet?: "base64" | "base64url";
  omitPadding?: boolean;
}

interface Uint8ArrayFromBase64Options {
  alphabet?: "base64" | "base64url";
  lastChunkHandling?: "loose" | "strict" | "stop-before-partial";
}

interface Uint8Array<TArrayBuffer extends ArrayBufferLike = ArrayBufferLike> {
  /**
   * Encodes this Uint8Array as a Base64 string.
   * @see {@link https://tc39.es/proposal-arraybuffer-base64/ TC39 proposal-arraybuffer-base64}
   */
  toBase64(options?: Uint8ArrayToBase64Options): string;

  /**
   * Encodes this Uint8Array as a hexadecimal string.
   * @see {@link https://tc39.es/proposal-arraybuffer-base64/ TC39 proposal-arraybuffer-base64}
   */
  toHex(): string;
}

interface Uint8ArrayConstructor {
  /**
   * Creates a Uint8Array from a Base64-encoded string.
   * @see {@link https://tc39.es/proposal-arraybuffer-base64/ TC39 proposal-arraybuffer-base64}
   */
  fromBase64(base64: string, options?: Uint8ArrayFromBase64Options): Uint8Array<ArrayBuffer>;

  /**
   * Creates a Uint8Array from a hexadecimal string.
   * @see {@link https://tc39.es/proposal-arraybuffer-base64/ TC39 proposal-arraybuffer-base64}
   */
  fromHex(hex: string): Uint8Array<ArrayBuffer>;
}

// ─── JSON extensions (TC39 proposal-json-parse-with-source) ────────────────────

interface RawJSON {
  readonly rawJSON: string;
}

interface JSON {
  /**
   * Converts a JavaScript Object Notation (JSON) string into an object.
   * @param text A valid JSON string.
   * @param reviver A function that transforms the results. This function is called for each member of the object.
   * If a member contains nested objects, the nested objects are transformed before the parent object is.
   * For primitive values the reviver also receives a `context` object whose `source` property is the original JSON
   * text of that value.
   * @throws {SyntaxError} If `text` is not valid JSON.
   */
  parse(
    text: string,
    reviver: (
      this: any,
      key: string,
      value: any,
      context: { source: string },
    ) => any,
  ): any;

  /**
   * Creates a "raw JSON" object containing a piece of JSON text.
   * When serialized with `JSON.stringify()`, the raw text is emitted verbatim.
   * @param text A valid JSON string representing a primitive value (string, number, boolean, or null).
   * @throws {SyntaxError} If `text` is not valid JSON or represents an object or array.
   */
  rawJSON(text: string): RawJSON;

  /**
   * Returns whether the provided value is a raw JSON object created by `JSON.rawJSON()`.
   * @param value The value to test.
   */
  isRawJSON(value: unknown): value is RawJSON;
}
