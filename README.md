# Poker Trainer (Rust + React)

Fast poker trainer with a Rust (Axum) backend and a React/TypeScript frontend. All game logic aims to run server-side in Rust for speed and safety.

Repository: https://github.com/rickypcyt/poker-trainer-react-rust

## Quick Start (Local)

Prerequisites
- Rust (stable) + Cargo
- Bun (preferred) or Node.js 18+

Environment
```bash
cp .env.example .env.local
# ensure this value exists:
echo "VITE_BACKEND_URL=http://127.0.0.1:3000" >> .env.local
```

Run everything (backend + frontend)
```bash
bun run dev
# or with npm:
# npm run dev
```

Open the app
- http://localhost:5173

Backend health check
```bash
curl http://127.0.0.1:3000/api/health
# expected: ok
```

## Scripts
```bash
bun run dev           # start backend + frontend
bun run dev:frontend  # start only frontend (Vite)
bun run dev:backend   # start only backend (Axum)
bun run build         # type-check + build frontend
bun run lint          # lint frontend
```

## Troubleshooting
- Port 3000 busy: stop the process using it or change the backend port.
- CORS: development is open; in production, restrict origins in the Axum CORS layer.
