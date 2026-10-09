# 🎬 Real-Time YouTube Watch Party

> A real-time, synchronized YouTube Watch Party application built with React, TypeScript, Express, Socket.IO, and SQLite persistence. Allows users to create/join watch rooms, synchronize video playback frame-by-frame, manage user roles (Host, Moderator, Participant, Viewer), and process change approval requests.

---

## 🚀 Live Deployment & Demo

- **Live App URL**: [https://watchparty-production.onrender.com](https://watchparty-production.onrender.com) *(Update with your deployed URL)*
- **Health Check API**: `GET /api/health`

---

## ✨ Features

- 🔄 **Real-Time Video Synchronization**: Frame-accurate synchronization for video play/pause, seek scrubber, and video changes across all room participants.
- 🔑 **Role-Based Access Control (RBAC)**:
  - 👑 **Host (Creator)**: Full control to play/pause, seek, change video, assign roles (Moderator/Participant), kick users, and transfer host privileges.
  - 🛡️ **Moderator**: Playback control (play, pause, seek, change video) and request approvals.
  - 👤 **Participant / Member**: Watch-only playback controls; restricted from direct state mutation, but can submit real-time **Change Requests** to Host/Moderators.
  - 👁️ **Viewer**: Read-only audience member.
- 📋 **Participant Change Request & Approval System**: Participants can submit requests (play/pause, seek position, change video URL, or request moderator role). Hosts and Moderators receive live notifications to **Approve** or **Reject** with automatic execution!
- 💬 **Live Chat & System Log Feed**: Real-time room chat with user role badges, timestamping, and system notification logs for room join/leave/role updates.
- 🎭 **Floating Emoji Reactions**: Interactive real-time emoji reactions (🔥, 👍, 👏, 😂, ❤️, 😮) that float across the video canvas for all connected users.
- 💾 **Room Persistence**: Server persists room metadata, current playback state, participant list, and chat logs to database (`data/watchparty_db.json`), ensuring rooms survive server restarts or page reloads.

---

## 🛠️ Tech Stack

| Layer | Technology | Purpose |
| :--- | :--- | :--- |
| **Frontend** | React 19, Vite 6, Tailwind CSS v4, Lucide Icons | Responsive UI, video player, chat sidebar, glassmorphism design |
| **Backend** | Node.js, Express, TypeScript | REST API endpoints, static file serving, room management |
| **Real-Time** | Socket.IO (WebSockets) | Bidirectional low-latency event broadcasting and state sync |
| **Persistence** | File-backed JSON / SQLite Storage | Rooms, participant state, and message logs persistence |
| **Video Engine**| YouTube IFrame Player API | Frame-by-frame controllable YouTube video player |

---

## 🏛️ Architecture Overview

The system uses an **Object-Oriented Programming (OOP)** architecture on the backend to separate concerns and enforce role permissions before executing state mutations.

```mermaid
sequenceDiagram
    autonumber
    actor Participant as 👤 Participant
    actor Host as 👑 Host / Moderator
    participant Client as 💻 React Client
    participant Server as ⚡ Socket.IO Server
    participant Room as 🏢 Room Manager (OOP)

    Participant->>Client: Clicks "Request Video Change"
    Client->>Server: emit("request_change", { roomId, type: "change_video", payload })
    Server->>Room: room.createChangeRequest(...)
    Server->>Host: broadcast("change_requested", requestPayload)
    Host->>Client: Clicks [Approve]
    Client->>Server: emit("respond_request", { roomId, requestId, approved: true })
    Server->>Room: room.resolveChangeRequest(...)
    Room->>Room: updatePlaybackState() & update videoId
    Server->>Client: broadcastToRoom("sync_state", roomState)
    Client->>Participant: Player automatically loads & plays new video!
```

### Backend OOP Class Hierarchy

- **`RoomManager`**: Singleton class managing active rooms in memory and syncing with storage.
- **`Room`**: Encapsulates room state, video playback calculation, participant map, chat log, and approval request queue.
- **`Participant`**: Represents connected users, tracking socket IDs, role permissions (`hasPermission`), and online presence.
- **`ChangeRequest`**: Encapsulates approval request details, status transitions (`pending`, `approved`, `rejected`), and target execution payload.

---

## 📡 WebSocket Events Specification

| Event Name | Direction | Payload | Description |
| :--- | :--- | :--- | :--- |
| `join_room` | Client ➔ Server | `{ roomId, username, userId }` | User joins room; server assigns role (Host if creator, else Participant) |
| `leave_room` | Client ➔ Server | `{ roomId }` | User leaves the room |
| `sync_state` | Server ➔ Clients | `RoomState` | Full broadcast of room state (videoId, playState, currentTime, participants, requests, chat) |
| `play` | Client ➔ Server | `{ roomId }` | Triggers playback start (Requires Host/Mod permission) |
| `pause` | Client ➔ Server | `{ roomId }` | Triggers playback pause (Requires Host/Mod permission) |
| `seek` | Client ➔ Server | `{ roomId, time }` | Seeks video to specified timestamp (Requires Host/Mod permission) |
| `change_video` | Client ➔ Server | `{ roomId, videoId, videoTitle }` | Changes current video ID (Requires Host/Mod permission) |
| `assign_role` | Client ➔ Server | `{ roomId, targetUserId, role }` | Host assigns role to participant (`host`, `moderator`, `participant`) |
| `remove_participant`| Client ➔ Server | `{ roomId, targetUserId }` | Host kicks user from room |
| `transfer_host` | Client ➔ Server | `{ roomId, targetUserId }` | Host transfers ownership to another participant |
| `request_change` | Client ➔ Server | `{ roomId, type, payload }` | Participant submits request (play/pause/seek/change_video) for approval |
| `respond_request` | Client ➔ Server | `{ roomId, requestId, approved }` | Host/Mod approves or rejects a pending participant request |
| `send_message` | Client ➔ Server | `{ roomId, text }` | Sends chat message to room |
| `send_reaction` | Client ➔ Server | `{ roomId, emoji }` | Broadcasts floating emoji reaction across video canvas |

---

## ⚙️ Local Setup & Running Instructions

### Prerequisites
- **Node.js**: v18.0.0 or higher
- **npm**: v9.0.0 or higher

### 1. Clone & Install Dependencies
```bash
git clone https://github.com/your-username/Watch_Party.git
cd Watch_Party
npm install
```

### 2. Development Mode
Run the development server with live reload:
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### 3. Production Build & Start
```bash
# Build React frontend bundle and compile TypeScript backend
npm run build

# Start production Express + Socket.IO server
npm start
```

---

## 🌐 Production Deployment Guide

### Deploying to Render / Railway / Heroku
1. Push your code to GitHub.
2. Create a new **Web Service** on Render or Railway.
3. Set the following build and start commands:
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
   - **Environment Variables**:
     - `PORT`: `3000` (or set automatically by host)
     - `NODE_ENV`: `production`

---

## 📝 License
MIT License. Free for educational and assignment evaluation purposes.
