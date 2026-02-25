# Gestor de Gastos Personales

![React](https://img.shields.io/badge/React-18-61DAFB?style=flat&logo=react)
![Node.js](https://img.shields.io/badge/Node.js-Express-339933?style=flat&logo=node.js)
![JWT](https://img.shields.io/badge/Auth-JWT-000000?style=flat&logo=jsonwebtokens)
![Vercel](https://img.shields.io/badge/Deploy-Vercel-000000?style=flat&logo=vercel)
![License](https://img.shields.io/badge/License-MIT-green?style=flat)

App fullstack para registrar y visualizar ingresos y gastos personales. Cada usuario tiene su propia cuenta con datos aislados y seguros.

**Demo en vivo**: [gestor-gastos-iota.vercel.app](https://gestor-gastos-iota.vercel.app)

---

## Vista previa

<img width="836" height="924" alt="image" src="https://github.com/user-attachments/assets/d5fc2ead-57f7-43b0-814d-db58a0534456" />
<img width="966" height="658" alt="image" src="https://github.com/user-attachments/assets/e98b8a5d-84f8-4894-aa05-ecb492da95a2" />
<img width="680" height="626" alt="image" src="https://github.com/user-attachments/assets/85d95cd4-95a9-4d80-94c3-4dbcd57615a5" />



---

## Funcionalidades

- Registro e inicio de sesión con autenticación JWT
- Registrar ingresos y gastos con categoría, descripción y fecha
- Gráfico de torta por categoría y ranking de top gastos
- Filtrar transacciones por mes y categoría
- Balance, ingresos y gastos totales del mes
- Eliminar transacciones
- Diseño responsive (mobile y desktop)

---

##  Tecnologías
Frontend: React 18, Vite, Recharts 
Backend:  Node.js, Express 
Base de datos:  Turso (SQLite en la nube) 
Autenticación:  JWT + bcrypt 
Deploy:  Vercel + Render 

---

## API Endpoints

POST | `/api/auth/registro` Crear cuenta 
POST | `/api/auth/login`  Iniciar sesión 
GET | `/api/transacciones`  Listar transacciones del usuario 
GET | `/api/resumen`  Balance y estadísticas del mes 
POST | `/api/transacciones`  Crear transacción 
DELETE | `/api/transacciones/:id`  Eliminar transacción 

---

## Estructura del proyecto

```
Gestor-gastos/
├── backend/
│   ├── server.js       # API REST + autenticación JWT
│   └── package.json
└── frontend/
    ├── src/
    │   ├── App.jsx     # Componente principal
    │   ├── styles.js   # Estilos responsive
    │   ├── main.jsx    # Entry point
    │   └── index.css   # Variables CSS globales
    ├── index.html
    ├── vite.config.js
    └── package.json
```


## Licencia

Este proyecto está bajo la licencia [MIT](https://choosealicense.com/licenses/mit/).
