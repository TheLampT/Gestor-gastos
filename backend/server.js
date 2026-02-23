const express = require("express");
const cors = require("cors");
const initSqlJs = require("sql.js");
const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const app = express();
const PORT = 3001;
const DB_PATH = path.join(__dirname, "gastos.db");
const JWT_SECRET = process.env.JWT_SECRET || "clave_secreta_cambiar_en_produccion";

app.use(cors());
app.use(express.json());

let db;

async function initDB() {
  const SQL = await initSqlJs();

  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS transacciones (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id INTEGER NOT NULL,
      descripcion TEXT NOT NULL,
      monto REAL NOT NULL,
      tipo TEXT NOT NULL,
      categoria TEXT NOT NULL,
      fecha TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
    )
  `);

  saveDB();
  console.log("✅ Base de datos lista");
}

function saveDB() {
  const data = db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

function queryAll(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

function queryOne(sql, params = []) {
  return queryAll(sql, params)[0] || null;
}

function run(sql, params = []) {
  db.run(sql, params);
  saveDB();
}

// Middleware de autenticación
function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Token requerido" });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.id;
    next();
  } catch {
    res.status(401).json({ error: "Token inválido" });
  }
}

// POST - Registro
app.post("/api/auth/registro", async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: "Usuario y contraseña requeridos" });
    }

    if (username.length < 3) {
      return res.status(400).json({ error: "El usuario debe tener al menos 3 caracteres" });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: "La contraseña debe tener al menos 6 caracteres" });
    }

    const existe = queryOne("SELECT id FROM usuarios WHERE username = ?", [username]);
    if (existe) return res.status(400).json({ error: "El usuario ya existe" });

    const hashedPassword = await bcrypt.hash(password, 10);
    run("INSERT INTO usuarios (username, password) VALUES (?, ?)", [username, hashedPassword]);

    const usuario = queryOne("SELECT * FROM usuarios WHERE username = ?", [username]);
    const token = jwt.sign({ id: usuario.id, username: usuario.username }, JWT_SECRET, { expiresIn: "7d" });

    res.status(201).json({ token, username: usuario.username });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST - Login
app.post("/api/auth/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    const usuario = queryOne("SELECT * FROM usuarios WHERE username = ?", [username]);
    if (!usuario) return res.status(400).json({ error: "Usuario o contraseña incorrectos" });

    const valid = await bcrypt.compare(password, usuario.password);
    if (!valid) return res.status(400).json({ error: "Usuario o contraseña incorrectos" });

    const token = jwt.sign({ id: usuario.id, username: usuario.username }, JWT_SECRET, { expiresIn: "7d" });
    res.json({ token, username: usuario.username });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET - Transacciones del usuario
app.get("/api/transacciones", authMiddleware, (req, res) => {
  try {
    const { mes, categoria } = req.query;
    let query = "SELECT * FROM transacciones WHERE usuario_id = ?";
    const params = [req.userId];

    if (mes) {
      query += " AND strftime('%Y-%m', fecha) = ?";
      params.push(mes);
    }

    if (categoria && categoria !== "todas") {
      query += " AND categoria = ?";
      params.push(categoria);
    }

    query += " ORDER BY fecha DESC, created_at DESC";
    res.json(queryAll(query, params));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET - Resumen del usuario
app.get("/api/resumen", authMiddleware, (req, res) => {
  try {
    const { mes } = req.query;
    const params = [req.userId];
    let whereClause = "WHERE usuario_id = ?";

    if (mes) {
      whereClause += " AND strftime('%Y-%m', fecha) = ?";
      params.push(mes);
    }

    const resumen = queryOne(
      `SELECT 
        COALESCE(SUM(CASE WHEN tipo = 'ingreso' THEN monto ELSE 0 END), 0) as total_ingresos,
        COALESCE(SUM(CASE WHEN tipo = 'gasto' THEN monto ELSE 0 END), 0) as total_gastos,
        COALESCE(SUM(CASE WHEN tipo = 'ingreso' THEN monto ELSE -monto END), 0) as balance
      FROM transacciones ${whereClause}`,
      params
    );

    const porCategoria = queryAll(
      `SELECT categoria, tipo, SUM(monto) as total
       FROM transacciones ${whereClause}
       GROUP BY categoria, tipo
       ORDER BY total DESC`,
      params
    );

    res.json({ ...resumen, porCategoria });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST - Nueva transacción
app.post("/api/transacciones", authMiddleware, (req, res) => {
  try {
    const { descripcion, monto, tipo, categoria, fecha } = req.body;

    if (!descripcion || !monto || !tipo || !categoria || !fecha) {
      return res.status(400).json({ error: "Todos los campos son requeridos" });
    }

    if (monto <= 0) {
      return res.status(400).json({ error: "El monto debe ser mayor a 0" });
    }

    run(
      `INSERT INTO transacciones (usuario_id, descripcion, monto, tipo, categoria, fecha) VALUES (?, ?, ?, ?, ?, ?)`,
      [req.userId, descripcion, parseFloat(monto), tipo, categoria, fecha]
    );

    const nueva = queryOne("SELECT * FROM transacciones WHERE id = last_insert_rowid()");
    res.status(201).json(nueva);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE - Eliminar transacción (solo del usuario)
app.delete("/api/transacciones/:id", authMiddleware, (req, res) => {
  try {
    const tx = queryOne("SELECT id FROM transacciones WHERE id = ? AND usuario_id = ?", [parseInt(req.params.id), req.userId]);
    if (!tx) return res.status(404).json({ error: "Transacción no encontrada" });

    run("DELETE FROM transacciones WHERE id = ?", [parseInt(req.params.id)]);
    res.json({ message: "Eliminada correctamente" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

initDB().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
  });
});