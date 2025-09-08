# Poker Trainer

Un entrenador de póker con barajado criptográficamente seguro usando Rust en el backend y React/TypeScript en el frontend.

## 🚀 Inicio Rápido

**Solo necesitas ejecutar un comando:**

```bash
bun run dev
```

Este comando automáticamente:
- ✅ Verifica si el backend Rust está corriendo
- 🚀 Si no está corriendo, lo inicia automáticamente
- 🎨 Inicia el frontend en Vite
- 🔗 Configura la conexión entre frontend y backend

## 🏗️ Arquitectura

### Backend (Rust + Axum)
- **Puerto:** 3000
- **RNG:** ChaCha20Rng criptográficamente seguro
- **Endpoints:**
  - `GET /api/health` - Verificar estado del servidor
  - `GET /api/deck` - Obtener mazo barajado (52 cartas)

### Frontend (React + TypeScript + Vite)
- **Puerto:** 5173
- **Framework:** React con TypeScript
- **Styling:** Tailwind CSS
- **Routing:** React Router

## 🎯 Características

- **Barajado Seguro:** El backend usa `ChaCha20Rng` con entropía del sistema operativo
- **Sin Trampas:** El frontend solo recibe cartas ya barajadas
- **Fallback Local:** Si el backend falla, usa barajado local como respaldo
- **CORS Configurado:** Comunicación fluida entre frontend y backend

## 🛠️ Comandos Disponibles

```bash
# Desarrollo (recomendado - inicia todo automáticamente)
bun run dev

# Solo frontend
bun run dev:frontend

# Solo backend
bun run dev:backend

# Build para producción
bun run build

# Linting
bun run lint
```

## 🔧 Configuración

El archivo `.env.local` contiene:
```
VITE_BACKEND_URL=http://127.0.0.1:3000
```

## 🎮 Uso

1. Ejecuta `bun run dev`
2. Abre `http://localhost:5173`
3. Navega a "Card Shuffler"
4. Haz clic en "Obtener nuevo deck" para barajar con RNG seguro

## 🏃‍♂️ Desarrollo

### Estructura del Proyecto
```
├── backend/           # Servidor Rust (Axum)
│   ├── src/main.rs   # Endpoints y lógica de barajado
│   └── Cargo.toml    # Dependencias Rust
├── src/              # Frontend React
│   ├── components/   # Componentes reutilizables
│   ├── pages/        # Páginas de la aplicación
│   ├── lib/          # Utilidades (API client, etc.)
│   └── types/        # Tipos TypeScript
└── scripts/          # Scripts de desarrollo
    └── dev-with-backend.js  # Script que inicia todo
```

### Tecnologías
- **Backend:** Rust, Axum, ChaCha20Rng, Serde
- **Frontend:** React, TypeScript, Vite, Tailwind CSS
- **Herramientas:** Bun, ESLint

## 🔒 Seguridad

- **RNG Criptográfico:** ChaCha20Rng con semilla de 32 bytes del OS
- **Sin Manipulación:** El cliente no puede influir en el barajado
- **Entropía Real:** Usa `getrandom` para obtener entropía del sistema

## 🐛 Troubleshooting

### Backend no inicia
```bash
# Verificar si el puerto 3000 está ocupado
lsof -i :3000

# Matar proceso si es necesario
pkill -f poker-backend
```

### Frontend no conecta al backend
```bash
# Verificar que el backend esté corriendo
curl http://127.0.0.1:3000/api/health

# Debe responder: ok
```

### CORS errors
- El backend tiene CORS configurado para permitir todos los orígenes en desarrollo
- En producción, configurar dominios específicos en `CorsLayer`