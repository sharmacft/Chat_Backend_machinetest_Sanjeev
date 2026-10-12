# Chat Backend

Node.js, TypeScript, PostgreSQL and Firebase Admin/Firestore implementation for 1:1 chat. Relational tables store users and chat membership; Firestore stores messages, read receipts, and per-member last-seen state.

## Setup

1. Install dependencies with `npm install`.
2. Create a PostgreSQL database, then run `src/sql/schema.sql` against it.
3. Copy `.env.example` to `.env` and set `DATABASE_URL`. Firebase Admin loads `serviceAccountKey.json` from the project root by default; set `FIREBASE_SERVICE_ACCOUNT_PATH` if the file is elsewhere. Alternatively configure the Firebase credential environment variables or Google Application Default Credentials.
4. Start with `npm run dev`; compile with `npm run build` and run with `npm start`.

Firebase credentials are secrets. Keep `.env` and service account key files out of source control. Firestore layout is `chats/{chatId}/messages/{messageId}` and `chats/{chatId}/members/{userId}`.

## API

- `POST /chat/create` body `{ "userAId": "alice", "userBId": "bob" }` returns the same 1:1 chat for the pair. It creates placeholder relational user rows when needed.
- `POST /chat/:chatId/message/send` body `{ "senderId": "alice", "text": "Hello" }`.
- `GET /chat/:chatId/messages?limit=50` returns oldest-to-newest messages in the selected page. Limit is 1–100. An optional `userId` query parameter enables membership checking.
- `POST /chat/:chatId/message/:messageId/read` body `{ "userId": "bob" }` records the receipt.
- `POST /chat/:chatId/lastseen` body `{ "userId": "alice", "messageId": "..." }` updates last seen and marks that message read.
- `GET /user/:userId/chats` returns relational chat rows and both member IDs.
- `GET /health` reports process health.

Requests that carry a user ID enforce chat membership, but this assignment scaffold does not include authentication. The message listing endpoint accepts an optional `userId` for the same check; in production, require a verified identity token and enforce membership on every endpoint.
