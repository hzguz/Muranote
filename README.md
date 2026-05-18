# Muranote

Muranote is a sticky-note wall built with React, Vite, and Firebase. It combines a freeform canvas with column-based organization, local-first persistence, Google sign-in, and shared features such as match-based collaboration and ephemeral letters.

## Highlights

- Freeform note wall with drag, resize, layering, and rotation support
- Column mode for structured organization alongside the open canvas
- Local-first behavior with `localStorage` fallback
- Firebase Authentication with Google sign-in
- Firestore sync for notes, columns, user profiles, and letters
- Match system that connects two users through a 5-digit code
- Ephemeral letters with automatic expiration
- Admin tools for moderation, user lookup, admin letters, and claim management
- Local backup export and restore
- Built-in tracked-secret audit script

## Tech Stack

- React 19
- TypeScript
- Vite
- Firebase Auth
- Firestore
- Framer Motion
- Tailwind CSS

## Core Features

### Notes and Canvas

- Create note cards and title cards
- Move notes freely on the canvas
- Bring notes and columns to the front with z-index management
- Edit note content in a dedicated editor
- Apply color themes and star ratings
- Sanitize note content before persistence

### Columns

- Create, rename, move, and delete columns
- Drag notes into columns
- Keep unassigned notes on the free canvas
- Preserve column state locally and in Firestore

### Accounts and Sync

- Sign in with Google through Firebase Auth
- Create a profile automatically on first login
- Sync notes and columns per user
- Fall back to local storage when cloud data is unavailable
- Show online/offline state in the UI

### Match and Social Features

- Generate a unique 5-digit match code per user
- Send, accept, decline, and undo match requests
- View a matched partner's notes in read-only mode
- Send short sealed letters to a matched partner
- Auto-clean expired letters

### Admin Tools

- Paginated user listing
- Ban and unban users
- Reset user match state
- Send letters as admin
- Promote or demote admins using a local script and a Firebase service account

## Project Structure

```text
.
|-- components/          UI building blocks
|-- contexts/            React context providers
|-- docs/                deployment and operational notes
|-- hooks/               reusable React hooks
|-- public/              static assets and sounds
|-- scripts/             maintenance and security scripts
|-- services/            Firebase and persistence layer
|-- utils/               sanitization, audio, avatar, and helper logic
|-- App.tsx              main application shell and orchestration
|-- index.tsx            React entrypoint
|-- index.html           HTML shell
|-- vite.config.ts       Vite configuration
|-- vercel.json          SPA rewrite configuration for Vercel
```

## Requirements

- Node.js 20+ recommended
- npm
- A Firebase project with:
  - Google Authentication enabled
  - Firestore enabled

## Environment Variables

Copy `.env.example` to `.env` and fill in your Firebase web app configuration:

```env
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_FIREBASE_MEASUREMENT_ID=
```

Optional:

```env
VITE_APP_BASE=/
```

Notes:

- Production builds fail if the required `VITE_FIREBASE_*` variables are missing.
- Values prefixed with `VITE_` are exposed to the client bundle by design.
- Do not place service account JSON files, private keys, or server-side secrets in `.env` files intended for the frontend.

## Getting Started

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

Create a production build:

```bash
npm run build
```

Preview the production build locally:

```bash
npm run preview
```

## Available Scripts

- `npm run dev` starts Vite in development mode
- `npm run build` creates a production build
- `npm run preview` previews the built app
- `npm run typecheck` runs TypeScript without emitting files
- `npm run check:unused` checks for unused locals and parameters
- `npm run security:secrets` scans tracked files for obvious secret leaks
- `npm run security:audit` runs `npm audit --omit=dev`
- `npm run security:audit:all` runs a full `npm audit`
- `npm run check:prepublish` runs the main quality and security checks
- `npm run admin:claim -- <UID> <true|false> --confirm` updates Firebase custom admin claims

## Admin Claim Script

The admin claim utility reads a Firebase service account from one of these environment variables:

- `GOOGLE_APPLICATION_CREDENTIALS`
- `FIREBASE_SERVICE_ACCOUNT_PATH`

Example:

```bash
npm run admin:claim -- some-user-uid true --confirm
```

Important:

- The service account file must stay out of Git.
- The script writes an audit log to `scripts/admin-claim-audit.log` when possible.
- Users must sign out and back in after a claim change so Firebase refreshes their token.

## Data Model Summary

Main persisted entities:

- `users/{uid}` for profile, match state, avatar, preferences, and moderation flags
- `users/{uid}/notes/{noteId}` for notes and title cards
- `users/{uid}/columns/{columnId}` for board columns
- `users/{uid}/letters/{letterId}` for expiring letters

## Security Notes

- Frontend note content is sanitized before rendering and persistence.
- The repository includes a tracked-file secret scan in `scripts/checkTrackedSecrets.mjs`.
- `.gitignore` excludes `.env`, service account files, Vercel local state, and other sensitive artifacts.
- If a secret was ever committed or deployed, rotate it first. Removing it from the current working tree is not enough.

## Deployment

This app is configured for Vercel as a static SPA with Firebase as the backend.

Basic production flow:

1. Import the repository into Vercel.
2. Set the required `VITE_FIREBASE_*` environment variables.
3. Ensure Google Auth authorized domains include your production domain.
4. Deploy the app.

The SPA rewrite is configured in `vercel.json` so nested routes resolve to `index.html`.

For the existing deployment notes, see [docs/deploy-vercel-firebase.md](./docs/deploy-vercel-firebase.md).

## Known Operational Caveat

`scripts/checkTrackedSecrets.mjs` currently self-matches one of its own detection patterns, which can create a false positive when running `npm run security:secrets`. Treat that script result carefully until the scanner exclusion logic is adjusted.

## Maintenance Reset

If you need to wipe repository history and old deployments after an accidental secret exposure, use the playbook in [docs/reset-history-and-deployments.md](./docs/reset-history-and-deployments.md).
