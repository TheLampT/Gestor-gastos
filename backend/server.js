const express = require("express");
const cors = require("cors");
const initSqlJs = require("sql.js");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = 3001;
const DB_PATH = path.join(__dirname, "gastos.db");

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
    CREATE TABLE IF NOT EXISTS transacciones (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      descripcion TEXT NOT NULL,
      monto REAL NOT NULL,
      tipo TEXT NOT NULL,
      categoria TEXT NOT NULL,
      fecha TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
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
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

function queryOne(sql, params = []) {
  const rows = queryAll(sql, params);
  return rows[0] || null;
}

function run(sql, params = []) {
  db.run(sql, params);
  saveDB();
}

app.get("/api/transacciones", (req, res) => {
  try {
    const { mes, categoria } = req.query;
    let query = "SELECT * FROM transacciones WHERE 1=1";
    const params = [];

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

app.get("/api/resumen", (req, res) => {
  try {
    const { mes } = req.query;
    const params = mes ? [mes] : [];
    const whereClause = mes ? "WHERE strftime('%Y-%m', fecha) = ?" : "";

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

app.post("/api/transacciones", (req, res) => {
  try {
    const { descripcion, monto, tipo, categoria, fecha } = req.body;

    if (!descripcion || !monto || !tipo || !categoria || !fecha) {
      return res.status(400).json({ error: "Todos los campos son requeridos" });
    }

    if (monto <= 0) {
      return res.status(400).json({ error: "El monto debe ser mayor a 0" });
    }

    run(
      `INSERT INTO transacciones (descripcion, monto, tipo, categoria, fecha) VALUES (?, ?, ?, ?, ?)`,
      [descripcion, parseFloat(monto), tipo, categoria, fecha]
    );

    const nueva = queryOne("SELECT * FROM transacciones WHERE id = last_insert_rowid()");
    res.status(201).json(nueva);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete("/api/transacciones/:id", (req, res) => {
  try {
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
