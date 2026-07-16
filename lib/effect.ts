/**
 * Single entry point for the Effect v4 beta (pinned 4.0.0-beta.92).
 *
 * RULE: no other file imports "effect" directly. All Effect usage goes
 * through this module so a breaking beta bump is a one-file fix.
 *
 * Mirrors the parent local-ai-web project's lib/effect.ts.
 */
import { Data, Effect, Schema } from "effect";

export { Data, Effect, Schema };

/** Typed error for JSON/schema decode failures at data boundaries. */
export class DecodeError extends Data.TaggedError("DecodeError")<{
  readonly source: string;
  readonly cause: unknown;
}> {}

/** Typed error for network/fetch failures. */
export class FetchError extends Data.TaggedError("FetchError")<{
  readonly source: string;
  readonly cause: unknown;
}> {}

/** Typed error for missing local files/artifacts. */
export class NotFoundError extends Data.TaggedError("NotFoundError")<{
  readonly source: string;
}> {}

export type DataError = DecodeError | FetchError | NotFoundError;

/**
 * Decode unknown input with a Schema, mapping failures to DecodeError.
 */
export const decode =
  <A, I>(schema: Schema.Codec<A, I>, source: string) =>
  (input: unknown): Effect.Effect<A, DecodeError> =>
    Schema.decodeUnknownEffect(schema)(input).pipe(
      Effect.mapError((cause) => new DecodeError({ source, cause })),
    );

/**
 * Run an Effect at a Promise boundary (CLI commands, scripts).
 * Failures reject with the typed error as `cause`.
 */
export const runPromise = <A, E>(effect: Effect.Effect<A, E>): Promise<A> =>
  Effect.runPromise(effect);

/** Run an Effect synchronously (pure decode paths only). */
export const runSync = <A, E>(effect: Effect.Effect<A, E>): A =>
  Effect.runSync(effect);
