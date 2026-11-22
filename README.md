# Real-Time Campus Collaboration and Communication Platform (Backend)

Node.js + Express + MongoDB (Mongoose) + Socket.IO capstone backend.

## Features
- JWT auth (access + rotating refresh tokens), bcrypt hashing, RBAC (`student`, `faculty`, `admin`) and group-level roles (`member`, `groupAdmin`)
- Groups, memberships, invitations (accept/reject), group-level permissions (`canPost`, `canShareResources`)
- Direct and group messaging, persisted in MongoDB, paginated history in chronological order
- Real-time: Socket.IO with JWT handshake auth, presence, typing indicators, delivered/read status, notifications
- Idempotent sends (`clientMsgId` + unique index) so reconnect retries never create duplicates
- Resource sharing (links / file metadata) with membership checks
- EventEmitter-driven notifications (decoupled from controllers)
- 2 aggregation pipelines, multiple indexes, seed script, Postman collection

## Setup
```bash
npm install
cp .env.example .env        # edit secrets and MONGO_URI
npm run seed                # sample data (all passwords: Password@123)
npm run dev                 # or: npm start
```
Open http://localhost:5000 for the Socket.IO demo client (log in as two users in two tabs).

Seed logins: `admin@campus.edu`, `meera@campus.edu` (faculty), `aarav@campus.edu`, `isha@campus.edu`, `rohan@campus.edu`, `sara@campus.edu` (students).

## Environment variables
`PORT, NODE_ENV, MONGO_URI, JWT_ACCESS_SECRET, JWT_REFRESH_SECRET, ACCESS_TTL, REFRESH_TTL, BCRYPT_ROUNDS, CLIENT_ORIGIN`

## Architecture
`routes -> middleware (auth, rbac, groupRole, validate) -> controllers -> services -> models`.
Sockets (`src/sockets`) reuse the same services as REST (`messageService.createMessage`), so rules are enforced once.
Controllers emit domain events (`src/events/appEvents.js`); `src/events/listeners.js` creates notifications and keeps socket rooms in sync.

## REST API (all JSON; `Authorization: Bearer <accessToken>` except register/login/refresh/logout)
Responses: `{ success, message, data, meta? }`; errors: `{ success:false, message, details? }`.

| Method & Path | Access | Purpose |
|---|---|---|
| POST /api/auth/register | public | Register (student/faculty) |
| POST /api/auth/login | public | Login -> access + refresh token |
| POST /api/auth/refresh | public | Rotate refresh token |
| POST /api/auth/logout | public | Revoke refresh token |
| GET/PATCH /api/users/me | auth | View / update own profile |
| GET /api/users/search?q= | auth | Find users |
| GET /api/users, PATCH /api/users/:id/status | admin | Manage users |
| POST /api/groups | auth | Create group (subject groups: faculty/admin) |
| GET /api/groups?scope=mine\|discover&type=&q=&page=&limit= | auth | List groups |
| GET /api/groups/:groupId | member / public group | Group details |
| PATCH/DELETE /api/groups/:groupId | group admin | Update / delete |
| POST /api/groups/:groupId/join, /leave | auth | Join public group / leave |
| GET /api/groups/:groupId/members | member | List members |
| POST /api/groups/:groupId/members | group admin | Add member |
| PATCH/DELETE /api/groups/:groupId/members/:userId | group admin | Change role/permissions, remove |
| POST /api/groups/:groupId/invitations | group admin | Invite user |
| GET /api/invitations?status= | auth | My invitations |
| PATCH /api/invitations/:id `{action:"accept"\|"reject"}` | invitee | Respond |
| GET /api/conversations | auth | My conversations |
| POST /api/conversations/direct `{userId}` | auth | Get/create DM |
| GET /api/conversations/:id/messages?page=&limit= | participant/member | History |
| POST /api/conversations/:id/messages | participant/member | Send (REST fallback) |
| DELETE /api/messages/:id | sender / admin | Moderation (soft delete) |
| POST /api/groups/:groupId/resources | member w/ permission | Share resource |
| GET /api/groups/:groupId/resources?subject=&topic=&type= | member | List resources |
| DELETE /api/resources/:id | uploader / group admin / admin | Delete |
| GET /api/notifications?unread=true, PATCH /api/notifications/:id/read, /read-all | auth | Notifications |
| GET /api/reports/active-groups?from=&to= | admin | Aggregation 1 |
| GET /api/reports/unread-counts | auth | Aggregation 2 |

## Socket.IO
Connect: `io(url, { auth: { token: accessToken } })`. Invalid token -> `connect_error: Authentication error`.
Rooms: `user:<id>` (personal), `conv:<conversationId>` (auto-joined on connect, kept in sync on membership changes).

| Event | Dir | Payload | Notes |
|---|---|---|---|
| `message:send` | C->S | `{conversationId, content, clientMsgId}` + ack | Ack `{ok, duplicate, message}` only after DB save |
| `message:new` | S->C | message doc | Broadcast to the conversation room |
| `typing:start` / `typing:stop` | C->S | `{conversationId}` | Relayed as `typing` `{conversationId,userId,name,isTyping}` |
| `message:delivered` | C->S | `{messageId}` | Sender receives `message:status` |
| `message:read` | C->S | `{conversationId}` | Room receives `message:read` |
| `presence:update` | S->C | `{userId, online, lastSeen?}` | Sent to users sharing a conversation |
| `presence:get` | C->S | `[userIds]` + ack | Returns online flags |
| `notification:new` | S->C | notification doc | Invitations, added-to-group |
| `group:deleted` | S->C | `{groupId}` | |

## Database design
Collections: User, Group, Membership, Invitation, Conversation, Message, Resource, Notification.
Indexes: `User.email` (unique), `Membership{group,user}` (unique), `Message{conversation,createdAt}`, `Message{sender,clientMsgId}` (unique, partial), `Conversation.directKey` (unique sparse), `Group` text index, `Notification{user,isRead,createdAt}`, and more (see models).
Aggregations: `report.controller.js` (active groups with `$group/$lookup/$unwind/$project/$sort`; unread counts per conversation).

## Testing
Import `postman/Campus-Collab.postman_collection.json` (run the *Login* request first; it stores tokens).
Covers success, validation failure, 404, no token, insufficient role, and duplicate/conflict cases.
