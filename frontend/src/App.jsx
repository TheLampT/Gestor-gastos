import { useState, useEffect, useCallback } from "react";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from "recharts";
import { styles } from "./styles";

//const API = "https://gestor-gastos-eqbt.onrender.com/api";
const API = "http://localhost:3001/api";

const CATEGORIAS_GASTO = ["Comida", "Transporte", "Entretenimiento", "Salud", "Indumentaria", "Educación", "Alquiler", "Servicios", "Inversion", "Otros"];
const CATEGORIAS_INGRESO = ["Sueldo", "Freelance", "Inversión", "Regalo", "Otros"];
const COLORS = ["#c1121f","#f77f00","#fcbf49","#7209b7","#3a0ca3","#4361ee","#4cc9f0","#b5179e",];
const CATEGORY_COLORS = {Comida: "#ff7b00",Transporte: "#3a86ff",Entretenimiento: "#f15bb5", Salud: "#e63946",Indumentaria: "#9b5de5",Educación: "#4361ee",Alquiler: "#f4a261",Servicios: "#7209b7",Inversion: "#4cc9f0",Otros: "#adb5bd"};

const formatMonto = (n) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(n);

const getMesActual = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

// ─── AUTH SCREEN ────────────────────────────────────────────────────────────
function AuthScreen({ onLogin }) {
  const [modo, setModo] = useState("login"); 
  const [form, setForm] = useState({ username: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`${API}/auth/${modo}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      localStorage.setItem("token", data.token);
      localStorage.setItem("username", data.username);
      onLogin(data.username);
    } catch {
      setError("Error de conexión con el servidor");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.authBg}>
      <div style={styles.authCard}>
        <div style={styles.authLogo}>
          <span style={{ color: "var(--accent)" }}>$</span> GASTOS
        </div>
        <div style={styles.authSubtitle}>Gestor personal de finanzas</div>

        <div style={styles.authToggle}>
          {["login", "registro"].map((m) => (
            <button
              key={m}
              style={modo === m ? styles.authTabActive : styles.authTab}
              onClick={() => { setModo(m); setError(""); }}
            >
              {m === "login" ? "Ingresar" : "Registrarse"}
            </button>
          ))}
        </div>

        {error && <div style={styles.errorBox}>{error}</div>}

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.fieldGroup}>
            <label style={styles.label}>Usuario</label>
            <input
              style={styles.input}
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              placeholder="Tu nombre de usuario"
              required
            />
          </div>
          <div style={styles.fieldGroup}>
            <label style={styles.label}>Contraseña</label>
            <input
              style={styles.input}
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder={modo === "registro" ? "Mínimo 6 caracteres" : "Tu contraseña"}
              required
            />
          </div>
          <button style={styles.btnSubmit} type="submit" disabled={loading}>
            {loading ? "Cargando..." : modo === "login" ? "Ingresar →" : "Crear cuenta →"}
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── MAIN APP ────────────────────────────────────────────────────────────────
export default function App() {
  const [username, setUsername] = useState(() => localStorage.getItem("username"));
  const [transacciones, setTransacciones] = useState([]);
  const [resumen, setResumen] = useState({ total_ingresos: 0, total_gastos: 0, balance: 0, porCategoria: [] });
  const [mes, setMes] = useState(getMesActual());
  const [filtroCategoria, setFiltroCategoria] = useState("todas");
  const [vista, setVista] = useState("dashboard");
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    descripcion: "", monto: "", tipo: "gasto", categoria: "Comida",
    fecha: new Date().toISOString().split("T")[0],
  });
  const [error, setError] = useState("");

  const token = localStorage.getItem("token");

  const authFetch = useCallback((url, options = {}) => {
    return fetch(url, {
      ...options,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...options.headers },
    });
  }, [token]);

  const fetchData = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ mes });
      if (filtroCategoria !== "todas") params.append("categoria", filtroCategoria);

      const [txRes, resRes] = await Promise.all([
        authFetch(`${API}/transacciones?${params}`),
        authFetch(`${API}/resumen?mes=${mes}`),
      ]);
      const [tx, res] = await Promise.all([txRes.json(), resRes.json()]);
      setTransacciones(tx);
      setResumen(res);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [mes, filtroCategoria, token, authFetch]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("username");
    setUsername(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    try {
      const res = await authFetch(`${API}/transacciones`, {
        method: "POST",
        body: JSON.stringify({ ...form, monto: parseFloat(form.monto) }),
      });
      if (!res.ok) { const err = await res.json(); setError(err.error); return; }
      setForm({ descripcion: "", monto: "", tipo: "gasto", categoria: "Comida", fecha: new Date().toISOString().split("T")[0] });
      setVista("dashboard");
      fetchData();
    } catch { setError("Error de conexión con el servidor"); }
  };

  const handleEliminar = async (id) => {
    if (!confirm("¿Eliminar esta transacción?")) return;
    await authFetch(`${API}/transacciones/${id}`, { method: "DELETE" });
    fetchData();
  };

  if (!username) return <AuthScreen onLogin={(u) => setUsername(u)} />;

  const categorias = form.tipo === "gasto" ? CATEGORIAS_GASTO : CATEGORIAS_INGRESO;
  const gastosPorCategoria = resumen.porCategoria.filter((c) => c.tipo === "gasto").map((c) => ({ name: c.categoria, value: c.total }));
  const barData = resumen.porCategoria.map((c) => ({ name: c.categoria, monto: c.total, tipo: c.tipo })).sort((a, b) => b.monto - a.monto).slice(0, 6);

  return (
    <div style={styles.app}>
      <header style={styles.header}>
        <div style={styles.headerInner}>
          <div>
            <div style={{...styles.logo, cursor: "pointer"}} onClick={() => setVista("dashboard")}><span style={styles.logoAccent}>$</span> GASTOS</div>
            <div style={styles.subtitle}>Hola, {username}</div>
          </div>
          <div style={styles.headerActions}>
            <input type="month" value={mes} onChange={(e) => setMes(e.target.value)} style={styles.monthInput} />
            <button style={vista === "nueva" ? styles.btnAccentActive : styles.btnAccent} onClick={() => setVista(vista === "nueva" ? "dashboard" : "nueva")}>
              {vista === "nueva" ? "← Volver" : "+ Nueva"}
            </button>
            <button style={styles.btnLogout} onClick={handleLogout}>Salir</button>
          </div>
        </div>
      </header>

      <main style={styles.main}>
        {vista === "nueva" ? (
          <div style={styles.formContainer}>
            <h2 style={styles.sectionTitle}>Nueva transacción</h2>
            {error && <div style={styles.errorBox}>{error}</div>}
            <form onSubmit={handleSubmit} style={styles.form}>
              <div style={styles.fieldGroup}>
                <label style={styles.label}>Tipo</label>
                <div style={styles.toggleGroup}>
                  {["gasto", "ingreso"].map((t) => (
                    <button key={t} type="button"
                      style={form.tipo === t ? (t === "gasto" ? styles.toggleActiveRed : styles.toggleActiveGreen) : styles.toggleInactive}
                      onClick={() => setForm({ ...form, tipo: t, categoria: t === "gasto" ? "Comida" : "Sueldo" })}>
                      {t === "gasto" ? "↓ Gasto" : "↑ Ingreso"}
                    </button>
                  ))}
                </div>
              </div>
              <div style={styles.fieldGroup}>
                <label style={styles.label}>Descripción</label>
                <input style={styles.input} value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} placeholder="ej: supermercado, sueldo..." required />
              </div>
              <div style={styles.row}>
                <div style={{ ...styles.fieldGroup, flex: 1 }}>
                  <label style={styles.label}>Monto (ARS)</label>
                  <input style={styles.input} type="number" min="1" step="0.01" value={form.monto} onChange={(e) => setForm({ ...form, monto: e.target.value })} placeholder="0.00" required />
                </div>
                <div style={{ ...styles.fieldGroup, flex: 1 }}>
                  <label style={styles.label}>Fecha</label>
                  <input style={styles.input} type="date" value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} required />
                </div>
              </div>
              <div style={styles.fieldGroup}>
                <label style={styles.label}>Categoría</label>
                <select style={styles.input} value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })}>
                  {categorias.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <button style={styles.btnSubmit} type="submit">Guardar transacción →</button>
            </form>
          </div>
        ) : (
          <>
            <div style={styles.cards}>
              <div style={{ ...styles.card, borderColor: resumen.balance >= 0 ? "#00e5a0" : "#ff4d6d" }}>
                <div style={styles.cardLabel}>Balance</div>
                <div style={{ ...styles.cardValue, color: resumen.balance >= 0 ? "#00e5a0" : "#ff4d6d" }}>{formatMonto(resumen.balance)}</div>
              </div>
              <div style={{ ...styles.card, borderColor: "#00e5a0" }}>
                <div style={styles.cardLabel}>Ingresos</div>
                <div style={{ ...styles.cardValue, color: "#00e5a0" }}>{formatMonto(resumen.total_ingresos)}</div>
              </div>
              <div style={{ ...styles.card, borderColor: "#ff4d6d" }}>
                <div style={styles.cardLabel}>Gastos</div>
                <div style={{ ...styles.cardValue, color: "#ff4d6d" }}>{formatMonto(resumen.total_gastos)}</div>
              </div>
            </div>

            {gastosPorCategoria.length > 0 && (
              <div style={styles.charts}>
                <div style={styles.chartBox}>
                  <h3 style={styles.chartTitle}>Gastos por categoría</h3>
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie data={gastosPorCategoria} cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={3} dataKey="value">
                        {gastosPorCategoria.map((item, i) => <Cell key={i} fill={CATEGORY_COLORS[item.name] || "#8884d8"} />)}
                      </Pie>
                      <Tooltip formatter={(v) => formatMonto(v)} contentStyle={{ background: "#12121a", border: "1px solid #2a2a3d", fontFamily: "Space Mono", fontSize: 12 }} itemStyle={{ color: "white" }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div style={styles.legend}>
                    {gastosPorCategoria.map((item, i) => (
                      <div key={i} style={styles.legendItem}>
                        <div style={{ ...styles.legendDot, background: CATEGORY_COLORS[item.name] }} />
                        <span style={{ fontSize: 11 }}>{item.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div style={styles.chartBox}>
                  <h3 style={styles.chartTitle}>Top categorías</h3>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={barData} layout="vertical" margin={{ left: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3d" horizontal={false} />
                      <XAxis type="number" tick={{ fill: "#8888aa", fontSize: 10, fontFamily: "Space Mono" }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                      <YAxis type="category" dataKey="name" tick={{ fill: "#8888aa", fontSize: 10, fontFamily: "Space Mono" }} width={80} />
                      <Tooltip formatter={(v, name) => [formatMonto(v), name.charAt(0).toUpperCase() + name.slice(1)]} contentStyle={{ background: "#12121a", border: "1px solid #2a2a3d", fontFamily: "Space Mono", fontSize: 12 }} itemStyle={{ color: "white" }} />
                      <Bar dataKey="monto" radius={[0, 2, 2, 0]}>
                        {barData.map((entry, i) => <Cell key={i} fill={entry.tipo === "gasto" ? "#ff4d6d" : "#00e5a0"} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            <div style={styles.listSection}>
              <div style={styles.listHeader}>
                <h3 style={styles.chartTitle}>Transacciones</h3>
                <select style={styles.filterSelect} value={filtroCategoria} onChange={(e) => setFiltroCategoria(e.target.value)}>
                  <option value="todas">Todas las categorías</option>
                  {[...CATEGORIAS_GASTO, ...CATEGORIAS_INGRESO].filter((v, i, a) => a.indexOf(v) === i).map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              {loading ? (
                <div style={styles.empty}>Cargando...</div>
              ) : transacciones.length === 0 ? (
                <div style={styles.empty}>Sin transacciones este mes.<br /><span style={{ color: "#00e5a0", cursor: "pointer" }} onClick={() => setVista("nueva")}>Agregá la primera →</span></div>
              ) : (
                <div style={styles.list}>
                  {transacciones.map((t) => (
                    <div key={t.id} style={styles.txItem}>
                      <div style={{ ...styles.txType, background: t.tipo === "gasto" ? "#ff4d6d22" : "#00e5a022", color: t.tipo === "gasto" ? "#ff4d6d" : "#00e5a0" }}>
                        {t.tipo === "gasto" ? "↓" : "↑"}
                      </div>
                      <div style={styles.txInfo}>
                        <div style={styles.txDesc}>{t.descripcion}</div>
                        <div style={styles.txMeta}>{t.categoria} · {t.fecha}</div>
                      </div>
                      <div style={{ ...styles.txMonto, color: t.tipo === "gasto" ? "#ff4d6d" : "#00e5a0" }}>
                        {t.tipo === "gasto" ? "-" : "+"}{formatMonto(t.monto)}
                      </div>
                      <button style={styles.btnDelete} onClick={() => handleEliminar(t.id)}>×</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
