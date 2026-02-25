const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { createClient } = require("@libsql/client");

const app = express();
const PORT = 3001;
const JWT_SECRET = process.env.JWT_SECRET || "clave_secreta_cambiar_en_produccion";

app.use(cors());
app.use(express.json());

// Conectar a Turso
const db = createClient({
  url: process.env.TURSO_URL,
  authToken: process.env.TURSO_TOKEN,
});

async function initDB() {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  await db.execute(`
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

  console.log("✅ Base de datos Turso lista");
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
    if (!username || !password) return res.status(400).json({ error: "Usuario y contraseña requeridos" });
    if (username.length < 3) return res.status(400).json({ error: "El usuario debe tener al menos 3 caracteres" });
    if (password.length < 6) return res.status(400).json({ error: "La contraseña debe tener al menos 6 caracteres" });

    const existe = await db.execute({ sql: "SELECT id FROM usuarios WHERE username = ?", args: [username] });
    if (existe.rows.length > 0) return res.status(400).json({ error: "El usuario ya existe" });

    const hashedPassword = await bcrypt.hash(password, 10);
    await db.execute({ sql: "INSERT INTO usuarios (username, password) VALUES (?, ?)", args: [username, hashedPassword] });

    const usuario = await db.execute({ sql: "SELECT * FROM usuarios WHERE username = ?", args: [username] });
    const token = jwt.sign({ id: usuario.rows[0].id, username }, JWT_SECRET, { expiresIn: "7d" });

    res.status(201).json({ token, username });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST - Login
app.post("/api/auth/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    const result = await db.execute({ sql: "SELECT * FROM usuarios WHERE username = ?", args: [username] });
    if (result.rows.length === 0) return res.status(400).json({ error: "Usuario o contraseña incorrectos" });

    const usuario = result.rows[0];
    const valid = await bcrypt.compare(password, usuario.password);
    if (!valid) return res.status(400).json({ error: "Usuario o contraseña incorrectos" });

    const token = jwt.sign({ id: usuario.id, username }, JWT_SECRET, { expiresIn: "7d" });
    res.json({ token, username });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET - Transacciones
app.get("/api/transacciones", authMiddleware, async (req, res) => {
  try {
    const { mes, categoria } = req.query;
    let sql = "SELECT * FROM transacciones WHERE usuario_id = ?";
    const args = [req.userId];

    if (mes) { sql += " AND strftime('%Y-%m', fecha) = ?"; args.push(mes); }
    if (categoria && categoria !== "todas") { sql += " AND categoria = ?"; args.push(categoria); }
    sql += " ORDER BY fecha DESC, created_at DESC";

    const result = await db.execute({ sql, args });
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET - Resumen
app.get("/api/resumen", authMiddleware, async (req, res) => {
  try {
    const { mes } = req.query;
    const args = [req.userId];
    let whereClause = "WHERE usuario_id = ?";
    if (mes) { whereClause += " AND strftime('%Y-%m', fecha) = ?"; args.push(mes); }

      const balanceAcumulado = await db.execute({
    sql: `SELECT 
      COALESCE(SUM(CASE WHEN tipo = 'ingreso' THEN monto ELSE -monto END), 0) as balance
    FROM transacciones WHERE usuario_id = ?${mes ? " AND strftime('%Y-%m', fecha) <= ?" : ""}`,
    args: mes ? [req.userId, mes] : [req.userId]
  });

  const resumen = await db.execute({
    sql: `SELECT 
      COALESCE(SUM(CASE WHEN tipo = 'ingreso' THEN monto ELSE 0 END), 0) as total_ingresos,
      COALESCE(SUM(CASE WHEN tipo = 'gasto' THEN monto ELSE 0 END), 0) as total_gastos
    FROM transacciones ${whereClause}`,
    args
  });

    const porCategoria = await db.execute({
      sql: `SELECT categoria, tipo, SUM(monto) as total FROM transacciones ${whereClause} GROUP BY categoria, tipo ORDER BY total DESC`,
      args
    });

    res.json({ ...resumen.rows[0], balance: balanceAcumulado.rows[0].balance,porCategoria: porCategoria.rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST - Nueva transacción
app.post("/api/transacciones", authMiddleware, async (req, res) => {
  try {
    const { descripcion, monto, tipo, categoria, fecha } = req.body;
    if (!descripcion || !monto || !tipo || !categoria || !fecha) return res.status(400).json({ error: "Todos los campos son requeridos" });
    if (monto <= 0) return res.status(400).json({ error: "El monto debe ser mayor a 0" });

    await db.execute({
      sql: "INSERT INTO transacciones (usuario_id, descripcion, monto, tipo, categoria, fecha) VALUES (?, ?, ?, ?, ?, ?)",
      args: [req.userId, descripcion, parseFloat(monto), tipo, categoria, fecha]
    });

    const nueva = await db.execute({ sql: "SELECT * FROM transacciones WHERE id = last_insert_rowid()", args: [] });
    res.status(201).json(nueva.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE - Eliminar transacción
app.delete("/api/transacciones/:id", authMiddleware, async (req, res) => {
  try {
    const tx = await db.execute({ sql: "SELECT id FROM transacciones WHERE id = ? AND usuario_id = ?", args: [parseInt(req.params.id), req.userId] });
    if (tx.rows.length === 0) return res.status(404).json({ error: "Transacción no encontrada" });

    await db.execute({ sql: "DELETE FROM transacciones WHERE id = ?", args: [parseInt(req.params.id)] });
    res.json({ message: "Eliminada correctamente" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

initDB().then(() => {
  app.listen(PORT, () => console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`));
});