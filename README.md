# Muranote

A sticky-note wall for your thoughts: drop notes anywhere on a freeform canvas, group them into columns, add reminders, and sync across devices with your Google account.

**Live:** [muranote.vercel.app](https://muranote.vercel.app)

## Features

- **Freeform canvas**: drag, resize, rotate and layer notes and title cards
- **Columns**: create, rename and reorder columns, and drag notes in and out
- **Reminders**: due date with upcoming/today/overdue status
- **Colors and star ratings** per note
- **Local-first**: works signed-out with `localStorage`. Sign in with Google to sync to Firestore.
- **Online/offline indicator**
- **Match**: connect with one other person through a 5-digit code and view their wall read-only
- **Letters**: short sealed messages to your match that expire automatically
- **Backup**: export and restore your notes as JSON
- **Admin tools** (custom claim): user list, ban/unban, match reset, broadcast letters
- Note content is sanitized with DOMPurify before rendering and saving

## Tech stack

| Layer | Technology |
| --- | --- |
| UI | React 19 + TypeScript |
| Build | Vite 6 |
| Auth / database | Firebase Authentication (Google), Cloud Firestore |
| Animation | Framer Motion |
| Styling | Tailwind CSS |
| Icons | Lucide, Tabler Icons |
| Hosting | Vercel (static SPA) |

## Getting started

Requirements: Node.js 20+, Yarn, and a Firebase project with **Google sign-in** and **Firestore** enabled.

```bash
yarn install
cp .env.example .env    # fill in your Firebase web app config
yarn dev
```

`.env` variables (Firebase web config; these are exposed to the client by design):

```env
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_FIREBASE_MEASUREMENT_ID=
# optional
VITE_APP_BASE=/
```

Production builds fail if the required `VITE_FIREBASE_*` values are missing.

| Script | What it does |
| --- | --- |
| `yarn dev` | Start the Vite dev server |
| `yarn build` / `yarn preview` | Production build / preview it locally |
| `yarn typecheck` | TypeScript check without emitting |
| `yarn check:unused` | Report unused locals and parameters |
| `yarn security:secrets` | Scan tracked files for leaked secrets |
| `yarn security:audit` | Dependency vulnerability audit |
| `yarn check:prepublish` | All of the above in sequence |
| `yarn admin:claim <UID> <true\|false> --confirm` | Grant or revoke the admin claim (needs a service account via `GOOGLE_APPLICATION_CREDENTIALS`) |

### Firestore security rules

[`firestore.rules`](firestore.rules) restricts each `users/{uid}` subtree to its owner, gives a matched partner read-only access to notes and columns, validates every payload, and reserves moderation fields for admins (custom claim). Deploy them with:

```bash
firebase deploy --only firestore:rules
```

## Deployment

1. Import the repo into Vercel and set the `VITE_FIREBASE_*` variables.
2. Add your production domain to Firebase Auth → Authorized domains.
3. Deploy. `vercel.json` rewrites all routes to `index.html`.

## Data model

| Path | Content |
| --- | --- |
| `users/{uid}` | Profile, avatar, match state, preferences, moderation flags |
| `users/{uid}/notes/{noteId}` | Notes and title cards |
| `users/{uid}/columns/{columnId}` | Columns |
| `users/{uid}/letters/{letterId}` | Expiring letters |

## Privacy

Signed-in data lives in Firestore under your user ID. Your matched partner can read your notes and columns. Accounts with the admin claim can view any user's wall for moderation purposes, as enforced by `firestore.rules`.

## Project structure

```text
App.tsx               App shell: canvas, columns, sync orchestration
components/           Note, NoteEditor, columns, letters, admin panel, modals
contexts/             Language provider
hooks/                useOnlineStatus
services/firebase.ts  Auth, Firestore reads/writes, match and letters
utils/                Sanitization, reminders, colors, avatars, audio
scripts/              Admin-claim and tracked-secret scan scripts
public/               Favicon, logo and notification sounds
firestore.rules       Firestore security rules
```

## License

[MIT](LICENSE)

## Author

**Gustavo Soares**, designer and front-end developer at **GsStudio**

- Portfolio: [gustasoares.com](https://gustasoares.com)
- GitHub: [@hzguz](https://github.com/hzguz)
