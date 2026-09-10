# janvey-shop

A full-stack e-commerce application built with [Vendure](https://www.vendure.io/) and [Next.js](https://nextjs.org/docs).

## Project Structure

This is a monorepo using npm workspaces:

```
janvey-shop/
├── apps/
│   ├── server/       # Vendure backend (GraphQL API, Admin Dashboard)
│   └── storefront/   # Next.js frontend
└── package.json      # Root workspace configuration
```

## Getting Started

### Development

Start Docker Desktop and wait for its engine to be running. The dev startup check
verifies the configured PostgreSQL login before launching the apps. If the local
database on port 6543 is stopped, it starts only the `postgres_db` Compose service
and waits for its health check. Existing database volumes are preserved.

Run one instance of each app. If the storefront is already running on port 3001,
use `npm run dev:server` to start only the backend. Occupied app ports produce a
clear error before any additional processes are launched. When a child process
exits during the combined dev command, its sibling is stopped as well.

Start both the server and storefront in development mode:

```bash
npm run dev
```

Or run them individually:

```bash
# Start only the server
npm run dev:server

# Start only the storefront
npm run dev:storefront
```

### Access Points

- **Vendure Dashboard**: http://localhost:3000/dashboard
- **Shop GraphQL API**: http://localhost:3000/shop-api
- **Admin GraphQL API**: http://localhost:3000/admin-api
- **Storefront**: http://localhost:3001

### Admin Credentials

Use these credentials to log in to the Vendure Dashboard:

- **Username**: superadmin
- **Password**: superadmin

## Production Build

Build all packages:

```bash
npm run build
```

Start the production server:

```bash
npm run start
```

## Learn More

- [Vendure Documentation](https://docs.vendure.io)
- [Next.js Documentation](https://nextjs.org/docs)
- [Vendure Discord Community](https://vendure.io/community)
