# Emerging Talks Podcast Matcher

## Local development

Use Bun 1.3.10.

```sh
bun install --frozen-lockfile
bun run migrate
bun run dev
```

Open http://localhost:5173. Vite serves the browser app and forwards API requests to Hono on port 3000. The app uses `data/local.sqlite`. Account verification and reset messages appear as private JSON files in `data/mail`. Open the URL from the relevant file in the browser.

Register and verify an operator account. Grant it admin access with `bun run admin operator@example.com`. Sign in again to use the dashboard. Approve the host profile, podcast listing, and guest profile before testing discovery.

## Checks

```sh
bun run check
bun test
bun run build
```

The workflow test creates a fresh SQLite database. Set `TEST_DATABASE_URL` to a fresh, disposable PostgreSQL database to run the same test with the PostgreSQL migrations. The test writes test accounts and marketplace records to that database.

## Production

Build the image with `docker build -t podcast-matcher .`. Supply these variables to the migration job and the application container.

| Variable | Value |
|---|---|
| `DATABASE_URL` | PostgreSQL connection URL |
| `BETTER_AUTH_URL` | Public HTTPS origin of the app |
| `BETTER_AUTH_SECRET` | Random secret of at least 32 characters |
| `RESEND_API_KEY` | Production Resend API key |
| `EMAIL_FROM` | Sender address on a verified Resend domain |
| `PORT` | HTTP port inside the container. Defaults to 3000. |

Run `bun run migrate` as a release job with the image before starting the application. Route HTTPS traffic to the container. Use `GET /health/ready` for readiness. Test a browser deep link, sign-in, password reset, backup restoration, and real account email delivery in the target environment before launch.

The admin dashboard records account deletion requests and their resolution. Operators handle deletion according to the approved retention policy before resolving a request.
