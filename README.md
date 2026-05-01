# Dozor Dashboard

Web dashboard for [Dozor](https://github.com/kolia-zamnius/kharko-dozor-packages) — open-source session recording and replay platform. Watch user sessions, manage projects, track users. Free for everyone, forever.

Built under the **Kharko** brand, inspired by Kharkiv, Ukraine.

- **Public demo** — [kharko-dozor.vercel.app](https://kharko-dozor.vercel.app) (don't paste production data)
- **SDK** — [`@kharko/dozor`](https://www.npmjs.com/package/@kharko/dozor) · [`@kharko/dozor-react`](https://www.npmjs.com/package/@kharko/dozor-react)

## Documentation

Everything lives at [`/documentation`](https://kharko-dozor.vercel.app/documentation) on the demo, and at `/documentation` on any self-hosted instance:

- [**Get started**](https://kharko-dozor.vercel.app/documentation/introduction) — what it is, how it works, demo flow, self-host recipe
- [**SDK**](https://kharko-dozor.vercel.app/documentation/sdk) — every option, lifecycle method, integration pattern
- [**Dashboard**](https://kharko-dozor.vercel.app/documentation/dashboard) — UI walkthrough
- [**Resources**](https://kharko-dozor.vercel.app/documentation/resources/architecture) — architecture, data model, ingest pipeline, replay player internals, security, [self-hosting reference](https://kharko-dozor.vercel.app/documentation/resources/self-hosting-reference) (every env var explained)

## Quick start (local dev)

```bash
git clone https://github.com/kolia-zamnius/kharko-dozor-dashboard.git
cd kharko-dozor-dashboard
npm install
cp .env.example .env       # fill in auth, SMTP, DB URLs
npx prisma migrate dev     # apply committed migrations to your dev DB
npm run dev
```

Dashboard runs at [http://localhost:3000](http://localhost:3000). Sign in with email OTP — any working Gmail SMTP credentials in `.env` (the sender doesn't have to match the recipient).

For full deployment + every env var: [Self-host guide](https://kharko-dozor.vercel.app/documentation/self-host) and [Self-hosting reference](https://kharko-dozor.vercel.app/documentation/resources/self-hosting-reference).

## Tests

Three Vitest projects, split by infrastructure:

```bash
npm run test:unit         # pure functions, no Docker (~2s)
npm run test:contract     # OpenAPI snapshot drift, no Docker
npm run test:integration  # Testcontainers Postgres 17 — needs Docker
```

Architecture details live in the docs at [Resources → Architecture → Test suite](https://kharko-dozor.vercel.app/documentation/resources/architecture#test-suite).

## Contributing

See [`CONTRIBUTING.md`](./CONTRIBUTING.md) for scope-of-contributions + how to file issues. The conventions reviewers will flag are documented in [Resources → Contributing](https://kharko-dozor.vercel.app/documentation/resources/contributing).

## Security

Vulnerability reports — see [`SECURITY.md`](./SECURITY.md). **Do not** open a public issue.

## License

MIT. See [`LICENSE`](./LICENSE) for the full text.
