# Totem Backoffice

React and TypeScript backoffice, Next.js server routes and Azure SQL. The API runs on the server in this project; browsers never connect directly to SQL. Deploy manually from the Vercel dashboard when the code is ready on GitHub.

## Local development

Requirements: Node.js 22.12 or newer, npm and access to the development SQL database.

1. Create a development SQL database and run `../database/sql/create-schema.sql` in its Azure Portal Query Editor.
2. Copy `.env.example` to `.env.local` and set its values (see `../docs/CONFIGURAR-AZURE-SQL.md`).
3. Install and run:

```powershell
npm install
npm run dev
```

Commands from the repository root are also available: `npm run dev`, `npm run typecheck`, `npm run test` and `npm run build`.

4. Open `http://localhost:3000/setup` to create the first admin. Stop the app, remove `INITIAL_ADMIN_SETUP_KEY` from `.env.local`, and start it again.

Type check/build:

```powershell
npm run typecheck
npm run test
npm run build
```

## Production

Import the GitHub repository into Vercel with Root Directory `totem-backoffice`. Add the production secrets in Vercel **Project → Settings → Environment Variables**. Follow `../docs/CONFIGURAR-AZURE-SQL.md` for the manual SQL and Vercel setup. Keep a separate database and secrets for Preview; do not point Preview to production.

## Safe configuration

- `DATABASE_URL`, `AUTH_SESSION_SECRET` and `INITIAL_ADMIN_SETUP_KEY` are server-only.
- Never add `NEXT_PUBLIC_` to a secret.
- `.env.local`, `.env.production`, SQL backups and signing keys are excluded from Git.
- The SQL user in Vercel must have only the database data permissions described in the SQL guide. Schema changes run manually in Query Editor.
- Create the initial admin with `/setup`, then remove the one-time setup key and redeploy.
