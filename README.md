# @pckt-sh/sdk

TypeScript SDK for the PCKT API, generated with [Hey API](https://github.com/hey-api/hey-api)
from the official PCKT OpenAPI specification.

**Do not edit `src/client/` or `openapi/` by hand** — both are overwritten on every release.

## Usage

```sh
npm install @pckt-sh/sdk
```

```ts
import { client, stockXServiceSearch } from '@pckt-sh/sdk';

client.setConfig({
  headers: { Authorization: `Bearer ${process.env.PCKT_API_KEY}` },
});

const { data, error } = await stockXServiceSearch({ query: { query: 'dunk low' } });
```

Need several configurations (different keys, base URLs)? Create a dedicated client and pass it per call:

```ts
import { createClient, createConfig, goatServiceSearch } from '@pckt-sh/sdk';

const pckt = createClient(createConfig({ baseUrl: 'https://api.pckt.sh', headers: { /* ... */ } }));
await goatServiceSearch({ client: pckt, query: { query: 'jordan 1' } });
```

## How releases work

```
spec change on the upstream API repository
  └─ repository_dispatch (openapi-updated)  ──▶  this repo
       └─ .github/workflows/release.yml
            1. fetch the latest OpenAPI spec from the upstream repository
            2. npm run generate               (@hey-api/openapi-ts)
            3. scripts/plan-release.mjs       (skip if nothing changed, otherwise pick version)
            4. typecheck + build              (ESM + CJS + .d.ts via tsup)
            5. npm publish                    (with provenance)
            6. commit spec + generated code, tag vX.Y.Z, GitHub release with API changelog
```

Version bumps are computed from the latest version on npm:

| Change | Bump |
| --- | --- |
| Breaking spec change (detected by [oasdiff](https://github.com/oasdiff/oasdiff)) | minor |
| Any other change (new endpoints, fields, generator upgrade) | patch |
| No change | nothing published |

Major versions are never bumped automatically. To cut one (or force any version), set it
in `package.json` and push — if it's higher than the latest on npm it is published as-is
on the next run.

A scheduled run every 6 hours acts as a safety net if a dispatch is ever missed, and the
workflow can be run manually from the Actions tab (optionally against another upstream ref).

## Local development

```sh
npm install
npm run generate   # regenerate src/client from openapi/openapi.json
npm run typecheck
npm run build
```
