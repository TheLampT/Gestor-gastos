# 💸 Gestor de Gastos Personales

App fullstack para gestionar ingresos y gastos personales. Construida con React, Node.js/Express y SQLite.

## 🚀 Tecnologías

- **Frontend**: React + Recharts + Vite
- **Backend**: Node.js + Express + better-sqlite3
- **Base de datos**: SQLite (archivo local, sin configuración extra)

## 📦 Instalación

### 1. Clonar el repo

```bash
git clone <tu-repo>
cd gestor-gastos
```

### 2. Instalar y correr el backend

```bash
cd backend
npm install
npm run dev
```

El servidor corre en `http://localhost:3001`

### 3. Instalar y correr el frontend (nueva terminal)

```bash
cd frontend
npm install
npm run dev
```

La app corre en `http://localhost:5173`

## ✨ Funcionalidades

- Registrar ingresos y gastos con categoría, descripción y fecha
- Ver balance, total de ingresos y total de gastos del mes
- Filtrar transacciones por mes y categoría
- Gráfico de torta con distribución de gastos por categoría
- Gráfico de barras con top categorías
- Eliminar transacciones

## 📁 Estructura del proyecto

```
gestor-gastos/
├── backend/
│   ├── server.js       # API REST con Express
│   ├── gastos.db       # Base de datos SQLite (se crea automáticamente)
│   └── package.json
└── frontend/
    ├── src/
    │   ├── App.jsx     # Componente principal
    │   ├── main.jsx    # Entry point
    │   └── index.css   # Estilos globales
    ├── index.html
    ├── vite.config.js
    └── package.json
```

## 🌐 Deploy

- **Frontend**: [Vercel](https://vercel.com) — conectá tu repo de GitHub y listo
- **Backend**: [Render](https://render.com) — servicio gratuito para Node.js

## API Endpoints

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/transacciones` | Obtener transacciones (soporta filtros `?mes=&categoria=`) |
| GET | `/api/resumen` | Obtener balance y estadísticas del mes |
| POST | `/api/transacciones` | Crear nueva transacción |
| DELETE | `/api/transacciones/:id` | Eliminar transacción |
