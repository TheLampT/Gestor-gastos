import { useState, useEffect, useCallback } from "react";
import { styles } from "./styles";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";

const API = "https://gestor-gastos-eqbt.onrender.com/api";

const CATEGORIAS_GASTO = [
  "Comida",
  "Transporte",
  "Entretenimiento",
  "Salud",
  "Ropa",
  "Educación",
  "Servicios",
  "Otros",
];
const CATEGORIAS_INGRESO = ["Sueldo", "Freelance", "Inversión", "Regalo", "Otros"];

const COLORS = ["#00e5a0", "#ff4d6d", "#ffd166", "#6c63ff", "#00b4d8", "#f77f00", "#a8dadc", "#e63946"];

const formatMonto = (n) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(n);

const getMesActual = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

export default function App() {
  const [transacciones, setTransacciones] = useState([]);
  const [resumen, setResumen] = useState({ total_ingresos: 0, total_gastos: 0, balance: 0, porCategoria: [] });
  const [mes, setMes] = useState(getMesActual());
  const [filtroCategoria, setFiltroCategoria] = useState("todas");
  const [vista, setVista] = useState("dashboard"); 
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    descripcion: "",
    monto: "",
    tipo: "gasto",
    categoria: "Comida",
    fecha: new Date().toISOString().split("T")[0],
  });
  const [error, setError] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ mes });
      if (filtroCategoria !== "todas") params.append("categoria", filtroCategoria);

      const [txRes, resRes] = await Promise.all([
        fetch(`${API}/transacciones?${params}`),
        fetch(`${API}/resumen?mes=${mes}`),
      ]);
      const [tx, res] = await Promise.all([txRes.json(), resRes.json()]);
      setTransacciones(tx);
      setResumen(res);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [mes, filtroCategoria]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    try {
      const res = await fetch(`${API}/transacciones`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, monto: parseFloat(form.monto) }),
      });
      if (!res.ok) {
        const err = await res.json();
        setError(err.error);
        return;
      }
      setForm({ descripcion: "", monto: "", tipo: "gasto", categoria: "Comida", fecha: new Date().toISOString().split("T")[0] });
      setVista("dashboard");
      fetchData();
    } catch (e) {
      setError("Error de conexión con el servidor");
    }
  };

  const handleEliminar = async (id) => {
    if (!confirm("¿Eliminar esta transacción?")) return;
    await fetch(`${API}/transacciones/${id}`, { method: "DELETE" });
    fetchData();
  };

  const categorias = form.tipo === "gasto" ? CATEGORIAS_GASTO : CATEGORIAS_INGRESO;

  // Datos para gráficos
  const gastosPorCategoria = resumen.porCategoria
    .filter((c) => c.tipo === "gasto")
    .map((c) => ({ name: c.categoria, value: c.total }));

  const barData = resumen.porCategoria
    .map((c) => ({ name: c.categoria, monto: c.total, tipo: c.tipo }))
    .sort((a, b) => b.monto - a.monto)
    .slice(0, 6);

  return (
    <div style={styles.app}>

      {/* Header */}
      <header style={styles.header}>
        <div style={styles.headerInner}>
          <div>
            <div style={styles.logo}>
              <span style={styles.logoAccent}>$</span> GASTOS
            </div>
            <div style={styles.subtitle}>Gestor personal de finanzas</div>
          </div>
          <div style={styles.headerActions}>
            <input
              type="month"
              value={mes}
              onChange={(e) => setMes(e.target.value)}
              style={styles.monthInput}
            />
            <button
              style={vista === "nueva" ? styles.btnAccentActive : styles.btnAccent}
              onClick={() => setVista(vista === "nueva" ? "dashboard" : "nueva")}
            >
              {vista === "nueva" ? "Volver" : "Nueva"}
            </button>
          </div>
        </div>
      </header>

      <main style={styles.main}>
        {vista === "nueva" ? (
          /* FORMULARIO */
          <div style={styles.formContainer}>
            <h2 style={styles.sectionTitle}>Nueva transacción</h2>
            {error && <div style={styles.errorBox}>{error}</div>}
            <form onSubmit={handleSubmit} style={styles.form}>

              {/* Tipo toggle */}
              <div style={styles.fieldGroup}>
                <label style={styles.label}>Tipo</label>
                <div style={styles.toggleGroup}>
                  {["gasto", "ingreso"].map((t) => (
                    <button
                      key={t}
                      type="button"
                      style={form.tipo === t ? (t === "gasto" ? styles.toggleActiveRed : styles.toggleActiveGreen) : styles.toggleInactive}
                      onClick={() => setForm({ ...form, tipo: t, categoria: t === "gasto" ? "Comida" : "Sueldo" })}
                    >
                      {t === "gasto" ? "↓ Gasto" : "↑ Ingreso"}
                    </button>
                  ))}
                </div>
              </div>

              <div style={styles.fieldGroup}>
                <label style={styles.label}>Descripción</label>
                <input
                  style={styles.input}
                  value={form.descripcion}
                  onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
                  placeholder="ej: supermercado, sueldo..."
                  required
                />
              </div>

              <div style={styles.row}>
                <div style={{ ...styles.fieldGroup, flex: 1 }}>
                  <label style={styles.label}>Monto (ARS)</label>
                  <input
                    style={styles.input}
                    type="number"
                    min="1"
                    step="0.01"
                    value={form.monto}
                    onChange={(e) => setForm({ ...form, monto: e.target.value })}
                    placeholder="0.00"
                    required
                  />
                </div>
                <div style={{ ...styles.fieldGroup, flex: 1 }}>
                  <label style={styles.label}>Fecha</label>
                  <input
                    style={styles.input}
                    type="date"
                    value={form.fecha}
                    onChange={(e) => setForm({ ...form, fecha: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div style={styles.fieldGroup}>
                <label style={styles.label}>Categoría</label>
                <select
                  style={styles.input}
                  value={form.categoria}
                  onChange={(e) => setForm({ ...form, categoria: e.target.value })}
                >
                  {categorias.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <button style={styles.btnSubmit} type="submit">
                Guardar transacción 
              </button>
            </form>
          </div>
        ) : (
          /* DASHBOARD */
          <>

            {/* Tarjetas resumen */}
            <div style={styles.cards}>
              <div style={{ ...styles.card, borderColor: "#00e5a0" }}>
                <div style={styles.cardLabel}>Balance</div>
                <div style={{ ...styles.cardValue, color: resumen.balance >= 0 ? "#00e5a0" : "#ff4d6d" }}>
                  {formatMonto(resumen.balance)}
                </div>
              </div>
              <div style={{ ...styles.card, borderColor: "#00e5a0" }}>
                <div style={styles.cardLabel}>Ingresos</div>
                <div style={{ ...styles.cardValue, color: "#00e5a0" }}>
                  {formatMonto(resumen.total_ingresos)}
                </div>
              </div>
              <div style={{ ...styles.card, borderColor: "#ff4d6d" }}>
                <div style={styles.cardLabel}>Gastos</div>
                <div style={{ ...styles.cardValue, color: "#ff4d6d" }}>
                  {formatMonto(resumen.total_gastos)}
                </div>
              </div>
            </div>

            {/* Gráficos */}
            {gastosPorCategoria.length > 0 && (
              <div style={styles.charts}>
                <div style={styles.chartBox}>
                  <h3 style={styles.chartTitle}>Gastos por categoría</h3>
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie data={gastosPorCategoria} cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={3} dataKey="value">
                        {gastosPorCategoria.map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v) => formatMonto(v)} contentStyle={{ background: "white", border: "1px solid #2a2a3d", fontFamily: "Arial", fontSize: 12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div style={styles.legend}>
                    {gastosPorCategoria.map((item, i) => (
                      <div key={i} style={styles.legendItem}>
                        <div style={{ ...styles.legendDot, background: COLORS[i % COLORS.length] }} />
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
                      <Tooltip formatter={(v, name) => [formatMonto(v), name.charAt(0).toUpperCase() + name.slice(1)]} contentStyle={{ background: "white", border: "1px solid #2a2a3d", fontFamily: "Arial", fontSize: 12 }} labelStyle={{ color: "#000000ff" }} />
                      <Bar dataKey="monto" radius={[0, 2, 2, 0]}>
                        {barData.map((entry, i) => (
                          <Cell key={i} fill={entry.tipo === "gasto" ? "#ff4d6d" : "#00e5a0"} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Lista transacciones */}
            <div style={styles.listSection}>
              <div style={styles.listHeader}>
                <h3 style={styles.chartTitle}>Transacciones</h3>
                <select
                  style={styles.filterSelect}
                  value={filtroCategoria}
                  onChange={(e) => setFiltroCategoria(e.target.value)}
                >
                  <option value="todas">Todas las categorías</option>
                  {[...CATEGORIAS_GASTO, ...CATEGORIAS_INGRESO].filter((v, i, a) => a.indexOf(v) === i).map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              {loading ? (
                <div style={styles.empty}>Cargando...</div>
              ) : transacciones.length === 0 ? (
                <div style={styles.empty}>
                  Sin transacciones este mes.<br />
                  <span style={{ color: "#00e5a0" }}>Agregá la primera →</span>
                </div>
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

