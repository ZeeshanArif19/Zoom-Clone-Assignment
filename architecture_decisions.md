# Zoom Clone - Architecture & Implementation Decisions

This document explains the key technical decisions made during the development of this Zoom Clone. Use this as a reference to explain and defend your implementation during the evaluation interview.

## 1. Database Design Decisions (SQLite)

We chose SQLite with SQLAlchemy for simplicity and ease of setup, which is ideal for a 1-day assignment.

### Separation of Internal ID and Public Meeting Code
- **Decision**: The `Meeting` table has an auto-incrementing integer `id` (Primary Key) and a separate `meeting_code` (e.g., UUID or short string).
- **Why**: Exposing sequential internal database IDs (like `1`, `2`, `3`) in public invite URLs is a security risk (IDOR - Insecure Direct Object Reference). By generating a random `meeting_code`, we make URLs unguessable. The internal `id` is still used for foreign key relationships because integers are faster for database joins.

### Participant Table Design
- **Decision**: We created a dedicated `Participant` table to track `joined_at` and `left_at` timestamps, linking to the `Meeting` table.
- **Why**: While an in-memory structure tracks *active* connections, the database needs a persistent historical record of who attended a meeting and for how long. The `left_at` column starts as `NULL` and is updated when the WebSocket disconnects, providing an accurate meeting ledger.

### Absence of User Authentication
- **Decision**: No `User` table or authentication tokens were implemented.
- **Why**: The assignment explicitly stated "Assume a default user is logged in. Focus on the functionality rather than authentication." Thus, authentication logic was excluded to prioritize core meeting functionalities.

## 2. Backend Architecture (FastAPI)

### Service Layer Pattern
- **Decision**: We introduced a "Service Layer" (e.g., `services/`) between the API Routers and the Database Layer.
- **Why**: This separates business logic from HTTP request handling. Routers only validate incoming data and return responses, while the service layer handles the "thinking" (e.g., generating codes, checking meeting status, orchestrating DB calls). This makes the code highly modular, easier to test, and closer to production-grade architecture.

### In-Memory Room Manager
- **Decision**: A dictionary-based `RoomManager` is used to track active WebSockets instead of Redis.
- **Why**: For a single-server deployment and a short deadline, an in-memory dictionary is the fastest and simplest way to route WebSocket messages. Introducing Redis or a Pub/Sub system would add unnecessary infrastructure complexity violating the "keep it simple" constraint. However, in a real scalable system with multiple server instances, a tool like Redis Pub/Sub would be required.

## 3. WebRTC Signaling Architecture

### WebRTC Mesh vs SFU/MCU
- **Decision**: We used a **WebRTC Mesh architecture** (Peer-to-Peer).
- **Why**: In a Mesh network, every participant connects directly to every other participant. This requires no dedicated media server (like an SFU - Selective Forwarding Unit). It is the simplest way to build multi-party video conferencing in a pure Python/Node environment. The tradeoff is that it consumes high CPU and bandwidth for clients as the number of participants grows (scales poorly past 4-6 users). For this assignment, it perfectly balances simplicity and core requirements.

### Targeted Offer/Answer/ICE Signaling
- **Decision**: The WebSocket signaling payload includes `sender_id` and `target_id`. The server explicitly routes WebRTC offers, answers, and ICE candidates to the specific `target_id`.
- **Why**: In a multi-party mesh, broadcasting offers to *everyone* causes race conditions and incorrect connections. When Peer A joins, they must negotiate a separate distinct connection with Peer B, Peer C, etc. Targeted signaling ensures that Peer B only receives the offer meant for Peer B.

## 4. Frontend Strategy (Next.js)

- **Single Page Application (SPA)**: Next.js handles routing on the client side, ensuring fast transitions between the Dashboard and Meeting Rooms without page reloads.
- **Dynamic Routing**: We use `/meeting/[meeting_code]` to handle direct invite links. If a user clicks an invite link, the frontend extracts the `meeting_code` and immediately initiates the join flow.
- **Vanilla CSS / Simple UI**: We avoided heavy styling frameworks (like Tailwind) to stick to the guidelines (unless explicitly requested), focusing instead on clean, organized CSS that mimics the Zoom aesthetic.

---
*End of Document*
