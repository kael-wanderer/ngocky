# Contributing

Thanks for helping improve NgocKy.

## Setup

```bash
npm install
cp .env.example .env
docker compose up -d postgres
cd apps/api
npm run db:migrate:dev
npm run db:generate
```

Start the API and web app in separate terminals:

```bash
cd apps/api && npm run dev
cd apps/web && npm run dev
```

## Checks

Run the focused checks for the area you touched. Before opening a pull request, run:

```bash
cd apps/api && npm test
cd apps/web && npm test && npx tsc --noEmit && npm run build
```

The API currently has some legacy strict TypeScript errors outside newer feature work, so call out any unrelated typecheck failures in your PR.

## Pull Requests

- Keep changes focused and explain the user-visible behavior.
- Add or update tests for new API routes, validation rules, and user flows.
- Include migration files for Prisma schema changes.
- Do not commit local `.env` files, database files, or build artifacts.
