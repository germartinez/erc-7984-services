# ERC-7984 Confidential Indexer

A small TypeScript service that sits between the Zama Protocol and a wallet partner.
It watches one ERC-7984 confidential token on Sepolia, decrypts the transfer
amounts the indexer holder is entitled to (as a transfer party or via ACL
delegation), and exposes a read-only API for cleartext balances and transfer
history.

The core requirement: a transfer the holder cannot yet decrypt is never dropped
Its encrypted amount handle is stored as `PENDING` and backfilled to cleartext
once decryption rights are granted on-chain.

## How it works

The project is split into three independent processes that share a single Postgres
database. Only the indexer writes to it; the API reads.

### Indexer

A polling loop that streams logs for the token from a finalized point of the chain
and keeps the database in sync:

- For each confidential transfer, it records the encrypted amount and attempts to
  decrypt it. If the holder is entitled, the cleartext amount is stored; otherwise
  the transfer is kept as `PENDING` with its encrypted handle intact.
- It also watches for ACL delegation events that grant the holder decryption
  rights. When a partner delegates, every `PENDING` transfer that partner is a party
  to is re-attempted and backfilled to cleartext.
- Each address's balance is maintained as the running net of its decrypted
  transfers. Re-processing the same range (e.g. after a restart) never double-counts.

### Read API

A partner-facing Express service that serves cleartext data over read-only queries.
It exposes liveness, balances, and transfer history. A balance reflects only the
transfers that have been decrypted so far; amounts still `PENDING` are excluded until
the indexer backfills them.

### Database

A single Postgres instance. The schema and its migrations are owned by Prisma and
applied automatically before the indexer starts.

## Getting started

### Prerequisites

- Node.js 22+
- Docker
- A Sepolia RPC endpoint
- An Envio account
- The address of the ERC-7984 token to index

### Installation

```bash
npm install
```

### Configuration

```bash
cp .env.example .env
```

Fill in `.env` (see `.env.example` for the full list).

### Running with Docker

Bring up the whole stack (database, indexer, and API) in containers:

```bash
npm run docker:up      # build + start db, indexer, api
npm run docker:logs    # follow logs
npm run docker:down    # stop
```

### Tests

```bash
npm test
```

## API endpoints

| Endpoint                                                  | Description                                                        |
| --------------------------------------------------------- | ------------------------------------------------------------------ |
| `GET /api/v1/health`                                      | Liveness check.                                                    |
| `GET /api/v1/balances/:chainId/:address/:tokenAddress`    | Cleartext balance (`null` if nothing decrypted yet).               |
| `GET /api/v1/transactions/:chainId/:address?limit&offset` | Transfer history; each item carries its amount and decrypt status. |

See `DECISIONS.md` for design trade-offs and what was intentionally left out.
</content>
