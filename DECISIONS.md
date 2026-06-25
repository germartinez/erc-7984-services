# Decisions & Trade-offs

This documents the choices that shaped the build, where I pushed back on the
brief, what I cut, and what I'd do next.

## 1. Compose, don't build

Three things are bought rather than built from scratch:

- **Indexing (Envio HyperSync)** (`@envio-dev/hypersync-client`). Instead of
  hand-rolling `eth_getLogs` pagination, rate-limit handling, etc., the indexer
  issues one HyperSync query per range for both the token's
  `ConfidentialTransfer` logs and the ACL's `DelegatedForUserDecryption` logs,
  and gets back a `nextBlock` cursor. The loop itself (finality lag, poll
  interval, resume-from-last-block) stays small and owned by us, because that is
  the part with the project-specific invariant (to never drop a handle) and is
  worth keeping legible.
- **Schema & migrations (Prisma)** Prisma owns the schema and runs
  `prisma migrate deploy` before the indexer starts. The indexer writes through
  a raw `pg` pool (so the idempotent `ON CONFLICT` SQL is explicit and
  reviewable). The API reads through the Prisma client.
- **REST API (Express).** Kept as a strictly read-only process.

The cost of Envio HyperSync over a heavier framework (e.g. Ponder) is that reorg
handling and crash-safe checkpointing are our responsibility, not free. I accept
that here by indexing only up to a lagged head (`height - FINALITY_BLOCKS`) so
shallow reorgs below the cursor are not a concern at demo scale, and by making
every write idempotent. Under a stricter freshness requirement this is the
assumption I'd revisit first.

## 2. Balance: net of what is decrypted

The design choice is deliberate and worth stating:

- The balance is the running net of DECRYPTED transfer deltas: sender (minus),
  recipient (plus), weighted by the cleartext amount. A `PENDING` transfer
  contributes nothing until it is backfilled.
- This means the balance can be understated while transfers are pending, and it
  becomes complete as the backfill fills handles in. It is eventually
  consistent, not instantaneously complete.
- The API returns `null` only when nothing has been decrypted for that address
  yet (no balance row), and a concrete net otherwise. The transfer-history
  endpoint carries each row's `decryptStatus`, so a partner can always see that
  decryption is still in flight rather than mistaking an understated number for
  a final one.

## 3. Never drop a handle, backfill recovers via delegation

Every `ConfidentialTransfer` is persisted before decryption succeeds, with its
ciphertext handle and a `decryptStatus`. Decryption is attempted inline:

- entitled and decryptable → `DECRYPTED`, with the cleartext amount and balance
  deltas applied in the same transaction.
- not entitled, or no ciphertext available yet, or a relayer error → `PENDING`,
  handle intact with balance untouched. The status enum is intentionally just
  `DECRYPTED | PENDING`. A relayer failure and a not-yet-entitled transfer both
  resolve to "try again later," so they collapse to one persisted state and the
  reason string is kept for logs rather than the schema.

Backfill is party-keyed, not handle-keyed. The base granularity of the
entitlement check `isHandleDelegatedForUserDecryption(delegator, delegate,
contractAddress, handle)` is per handle. But the grant event we
watch `DelegatedForUserDecryption(delegator, delegate, contractAddress)`
authorises the delegate to decrypt all of the delegator's handles for one
contract, not a single handle. So when the holder is delegated to, the backfill
re-attempts every `PENDING` transfer the delegator is a party to (`"from" =
delegator OR "to" = delegator`), scoped to `contractAddress == token`. Backfill
should be paginated and queued if needed under load.

## 4. Inline decryption and its limit

Decryption happens inline in the processing loop. This serialises sync behind
relayer latency, and a relayer outage stalls indexing of new cleartext (never
the storage of handles, those are always written first). For Sepolia demo volume
this is fine and keeps the data flow obvious: read range → decrypt-or-pending →
commit.

Under real partner load this is the first thing I'd change: keep only `handle +
PENDING` on the hot path and move all decryption (first attempt and retry alike)
into a dedicated worker, decoupling sync speed from relayer throughput. The
design already writes the handle first and the backfill already owns the
re-decrypt path, so this is a localised change, not a rewrite.

## 5. Tests: real DB, mock only the relayer seam

Two tests, both driving the production path against an in-memory Postgres
(`pg-mem`). The only seam stubbed is `tryDecryptAs`.

- **Happy path:** a decryptable transfer → persisted `DECRYPTED`, recipient
  `+amount`, sender `-amount`.
- **Negative path:** an undecryptable transfer → persisted `PENDING`,
  `amount_clear` null, the ciphertext handle retained, and the balance unmoved.
  This pins the brief's single hardest invariant: a transfer the holder cannot
  yet decrypt is never dropped and never silently affects a balance. It is the
  highest-value negative because every other behaviour (backfill, eventual
  consistency) depends on the handle still being there to retry.

## 6. What I cut and would do next

1. **Decouple decryption from the sync loop.** Today both first-attempt
   decryption and the delegation backfill run inline, so relayer latency
   throttles indexing and a delegation triggers a synchronous re-decrypt of
   every `PENDING` row the delegator is party to — blocking forward progress
   while it runs. Move all decryption (first attempt and backfill) onto a
   separate worker that drains a queue, so the indexer only ever writes `handle +
PENDING` on the hot path. This is the single change that matters most under
   real load.
2. Only `ConfidentialTransfer` is wired, so mints and burns aren't indexed yet.
   A holder's balance ignores tokens entering or leaving circulation. Needs the
   ABI events plus the same decrypt-or-`PENDING` path.
3. **Retries with backoff.** Both the HyperSync fetch and the relayer decrypt
   are single-shot today; a transient RPC/relayer blip surfaces as a crash or a
   stuck `PENDING`. Add bounded retry with backoff, and a `decryptAttempts` cap
   so a genuinely undecryptable handle stops being re-tried forever.
4. **Cursor pagination** for transfers (currently `limit` / `offset`; offset
   degrades on large histories).
5. **Structured logging** — replace the `console.log` breadcrumbs with a
   leveled, structured logger so the per-transfer decrypt/backfill flow is
   queryable in production.

## 7. Reflection: least confident under load

The part I am least sure survives production is the **synchronous, inline
decryption**, both the first-pass decrypt in the indexing loop and the
delegation backfill, which run one relayer call at a time before the loop
advances.

What breaks first: relayer latency becomes the indexer's throughput ceiling.
Each transfer waits on a round-trip before the next is processed, so a burst of
transfers, or a slow/rate-limited relayer, makes the indexer fall behind the
chain head and the gap never closes. Worse, a single
`DelegatedForUserDecryption` event triggers a synchronous re-decrypt of every
`PENDING` row that party is involved in, an unbounded amount of work done
inline, stalling forward progress while it runs. A full relayer outage halts all
cleartext progress (handles are still stored, so nothing is dropped, but
balances stop updating).

How I'd prove it: replay a block range with N transfers against a relayer with
realistic per-call latency and measure indexer lag vs. N; then fire a delegation
over a party with many pending rows and watch the loop block. Move all
decryption onto a separate worker draining a queue. I left it synchronous
because at Sepolia demo volume it's correct and far easier to read, but it's the
first thing that would buckle under real partner load.
