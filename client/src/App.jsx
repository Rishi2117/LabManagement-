import React, { useState, useEffect, useMemo } from "react";
import ReportView from "./ReportView";
import {
  FlaskConical, LayoutDashboard, FilePlus, ListChecks, FileText,
  Beaker, Settings, LogOut, Search, Bell, Sun, Moon, ChevronDown,
  TrendingUp, Wallet, Clock, CheckCircle2, Users, Plus, Minus,
  Check, ArrowRight, ArrowLeft, MapPin, Banknote, Smartphone,
  CreditCard, PartyPopper, History, X, Phone, ChevronRight,
  Edit2, Trash2, Building2, Stethoscope, FlaskRound, FileOutput, ClipboardList, SlidersHorizontal,
  Lock, UserPlus, LogIn, Menu
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from "recharts";

const API = import.meta.env.VITE_API_URL || "http://localhost:5244";
let TOKEN = null;
function setToken(t) { TOKEN = t; }
function api(path, opts = {}) {
  return fetch(`${API}${path}`, {
    ...opts,
    headers: {
      ...(opts.headers || {}),
      ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}),
    },
  });
}

// ---------------------------------------------------------------------------
// SAI PATHOLOGY (Step 3). Dashboard + Registration (phone dedup) + Work Queue.
// Data model: patients keyed by phone; orders link via patientPhone.
// All mock/in-memory for now.
// ---------------------------------------------------------------------------

const NAV = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "register", label: "New Registration", icon: FilePlus },
  { id: "queue", label: "Work Queue", icon: ListChecks },
  { id: "patients", label: "Patients", icon: Users },
  { id: "revenue", label: "Revenue", icon: TrendingUp },
  { id: "reports", label: "Reports", icon: FileText },
  {
    id: "admin", label: "Admin", icon: Settings, children: [
      { id: "catalog", label: "Tests Catalog", icon: Beaker },
      { id: "departments", label: "Departments", icon: Building2 },
      { id: "referrals", label: "Referral Doctors", icon: Stethoscope },
      { id: "settings", label: "Settings", icon: FlaskRound },
    ],
  },
];

const ALL_NAV = NAV.flatMap((n) => n.children ? [n, ...n.children] : [n]);

const PAY_MODES = [
  { id: "cash", label: "Cash", icon: Banknote },
  { id: "upi", label: "UPI", icon: Smartphone },
  { id: "card", label: "Card", icon: CreditCard },
  { id: "credit", label: "Credit / Due", icon: Wallet },
];

const REG_STEPS = ["Patient", "Tests", "Payment", "Collection"];
const STATUS_FLOW = ["Registered", "Sample Collected", "In Lab", "Report Ready"];

// --- MOCK DASHBOARD DATA ----------------------------------------------------

export default function App() {
  const [theme, setTheme] = useState("light");
  const [user, setUser] = useState(null);
  const [page, setPage] = useState("dashboard");
  const [navOpen, setNavOpen] = useState(false);
  const [patients, setPatients] = useState({});
  const [orders, setOrders] = useState([]);
  const [tests, setTests] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [params, setParams] = useState([]);
  const [reportOrder, setReportOrder] = useState(null);
  const [entryOrder, setEntryOrder] = useState(null);
  const [search, setSearch] = useState("");
  const [apiError, setApiError] = useState("");
  const [loading, setLoading] = useState(true);
  const [toasts, setToasts] = useState([]);
  const toast = (msg, kind = "success") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, msg, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3000);
  };
  useEffect(() => { document.documentElement.setAttribute("data-theme", theme); }, [theme]);
  const toggle = () => setTheme((t) => (t === "dark" ? "light" : "dark"));

  // load everything from the API
  const loadAll = async () => {
    try {
      const [oRes, pRes, tRes, dRes, prRes] = await Promise.all([
        api(`/orders`),
        api(`/patients`),
        api(`/tests`),
        api(`/doctors`),
        api(`/parameters`),
      ]);
      const oData = await oRes.json();
      const pData = await pRes.json();
      const tData = await tRes.json();
      const dData = await dRes.json();
      const prData = await prRes.json();
      setParams(prData);
      setTests(tData.map((t) => ({ id: t.id, name: t.name, price: t.price, tat: t.tat, cat: t.category })));
      setDoctors(dData);
      const pMap = {};
      pData.forEach((p) => {
        pMap[p.phone] = { name: p.name, age: p.age, sex: p.sex, phone: p.phone };
      });
      setPatients(pMap);
      setOrders(oData.map((o) => ({
        id: o.id, phone: o.phone, total: o.total, payMode: o.payMode,
        status: o.status, created: (o.created || "").slice(0, 10),
        ref: o.referredBy || "",
        tests: o.testsJson ? JSON.parse(o.testsJson) : [],
        results: o.resultsJson ? JSON.parse(o.resultsJson) : null,
      })));
      setApiError("");
    } catch (e) {
      setApiError("Cannot reach API. Is the server running? (cd server && dotnet run)");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { if (user) loadAll(); }, [user]);

  // gate placed after all hooks (Rules of Hooks)
  if (!user) return <><style>{CSS}</style><AuthGate onLogin={setUser} /></>;

  // create order via API (server handles patient dedup by phone)
  const registerOrder = async ({ patient, tests, total, payMode }) => {
    const phone = patient.phone.trim();
    const id = "PL" + Math.floor(1000 + Math.random() * 9000);
    try {
      await api(`/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id, phone,
          name: patient.name, age: patient.age, sex: patient.sex,
          referredBy: patient.ref,
          testsJson: JSON.stringify(tests),
          total, payMode,
        }),
      });
      await loadAll();
    } catch {
      setApiError("Failed to save order.");
    }
    return { id, phone, total };
  };

  const advance = async (id) => {
    const o = orders.find((x) => x.id === id);
    const i = STATUS_FLOW.indexOf(o.status);
    const next = STATUS_FLOW[Math.min(i + 1, STATUS_FLOW.length - 1)];
    try {
      await api(`/orders/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: next, resultsJson: o.results ? JSON.stringify(o.results) : null,
          phone: "", testsJson: "", total: 0, payMode: "", created: new Date().toISOString() }),
      });
      await loadAll();
      toast("Status updated to " + next);
    } catch {
      setApiError("Failed to update status.");
      toast("Failed to update status", "error");
    }
  };

  const saveResults = async (order, resultRows) => {
    try {
      await api(`/orders/${order.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: order.id, status: "Report Ready",
          resultsJson: JSON.stringify(resultRows),
          phone: "", testsJson: "", total: 0, payMode: "", created: new Date().toISOString() }),
      });
      await loadAll();
    } catch { setApiError("Failed to save results."); }
    setEntryOrder(null);
    openReport(order, resultRows);
  };

  const buildParamRows = (order) => {
    const rows = [];
    order.tests.forEach((t) => {
      params.filter((p) => p.testId === t.id).forEach((p) => {
        rows.push({ paramId: p.id, testId: t.id, testName: t.name,
          name: p.name, method: p.method, unit: p.unit,
          refLow: p.refLow, refHigh: p.refHigh, result: "" });
      });
    });
    return rows;
  };

  const openReport = (order, resultRows) => {
    const p = patients[order.phone] || {};
    // group result rows by test -> one group per test (page-per-test in report)
    const byTest = {};
    const orderTests = {};
    order.tests.forEach((t) => { orderTests[t.id] = t.name; });
    resultRows.forEach((r) => {
      const key = r.testId || "general";
      if (!byTest[key]) byTest[key] = { heading: r.testName || orderTests[key] || "", rows: [] };
      byTest[key].rows.push({
        name: r.name, method: r.method, result: r.result, unit: r.unit,
        refLow: r.refLow, refHigh: r.refHigh,
      });
    });
    const groups = Object.values(byTest);
    setReportOrder({
      patientId: order.phone, sampleId: order.id, name: p.name || "",
      age: p.age || "", sex: p.sex || "", ref: order.ref || "Self",
      regDate: order.created, reportDate: new Date().toISOString().slice(0, 10),
      groups: groups.length ? groups : [{ heading: "", rows: [] }],
    });
  };

  // Smart open: if results already saved, view the report; otherwise open entry form.
  const handleReport = (order) => {
    if (order.results && order.results.length > 0) {
      openReport(order, order.results);
    } else {
      setEntryOrder({ order, rows: buildParamRows(order) });
    }
  };

  const lookupPatient = async (phone) => {
    try {
      const res = await api(`/patients/${phone.trim()}`);
      if (!res.ok) return null;
      const p = await res.json();
      return { name: p.name, age: p.age, sex: p.sex, phone: p.phone };
    } catch {
      return null;
    }
  };

  const go = (p) => { setPage(p); setNavOpen(false); };
  return (
    <div style={S.shell} className="app-shell">
      <style>{CSS}</style>
      {navOpen && <div className="nav-overlay" onClick={() => setNavOpen(false)} />}
      <Sidebar page={page} setPage={go} user={user} navOpen={navOpen} onLogout={() => setUser(null)} onAddStaff={() => go("addstaff")} />
      <div style={S.body} className="app-body">
        <TopBar theme={theme} toggle={toggle} page={page} search={search} setSearch={setSearch} setPage={setPage} user={user} onMenu={() => setNavOpen(true)} />
        {apiError && <div style={S.apiError}>{apiError}</div>}
        <main style={S.main} className="app-main">
          {loading && <div style={S.loadingBar}><div style={S.loadingFill} /></div>}
          {page === "dashboard" && <Dashboard orders={orders} patients={patients} />}
          {page === "register" && <NewRegistration onDone={registerOrder} lookup={lookupPatient} tests={tests} doctors={doctors} goQueue={() => setPage("queue")} />}
          {page === "queue" && <WorkQueue orders={orders} patients={patients} advance={advance} onNew={() => setPage("register")} onReport={handleReport} />}
          {page === "catalog" && <TestsCatalog />}
          {page === "referrals" && <ReferralDoctors />}
          {page === "patients" && <PatientsView orders={orders} patients={patients} onReport={handleReport} />}
          {page === "revenue" && <RevenueView orders={orders} patients={patients} />}
          {page === "search" && <SearchResults query={search} orders={orders} patients={patients} advance={advance} onReport={handleReport} />}
          {page === "addstaff" && <AddStaff />}
          {!["dashboard", "register", "queue", "catalog", "referrals", "patients", "revenue", "search", "addstaff"].includes(page) && <Placeholder page={page} />}
        </main>
      </div>
      <div style={S.toastWrap}>
        {toasts.map((t) => (
          <div key={t.id} style={{ ...S.toast, ...(t.kind === "error" ? S.toastErr : {}) }}>
            {t.kind === "error" ? "⚠" : "✓"} {t.msg}
          </div>
        ))}
      </div>
      {entryOrder && (
        <ResultEntry data={entryOrder} onCancel={() => setEntryOrder(null)} onSave={saveResults} />
      )}
      {reportOrder && (
        <ReportView order={reportOrder} onClose={() => setReportOrder(null)} />
      )}
    </div>
  );
}

function ResultEntry({ data, onCancel, onSave }) {
  const { order, rows: initial } = data;
  const [rows, setRows] = useState(initial);
  const set = (i, val) => setRows((rs) => rs.map((r, idx) => idx === i ? { ...r, result: val } : r));
  const allFilled = rows.length > 0 && rows.every((r) => r.result !== "");
  return (
    <div style={S.overlay} onClick={onCancel}>
      <div style={{ ...S.modal, width: 620 }} onClick={(e) => e.stopPropagation()}>
        <div style={S.modalHead}>
          <h3 style={{ fontFamily: "'Fraunces',serif", fontSize: 20 }}>Enter Results — {order.id}</h3>
          <button style={S.iconBtnSm} onClick={onCancel}><Trash2 size={16} style={{ opacity: 0 }} />✕</button>
        </div>
        {rows.length === 0 ? (
          <p style={{ color: "var(--muted)", marginTop: 14 }}>No parameters defined for these tests. Add them under Admin → Tests Catalog (parameters).</p>
        ) : (
          <div style={{ marginTop: 14, maxHeight: "55vh", overflowY: "auto" }}>
            {Object.entries(rows.reduce((acc, r, idx) => {
              const key = r.testName || "Tests";
              (acc[key] = acc[key] || []).push({ ...r, _idx: idx });
              return acc;
            }, {})).map(([testName, group]) => (
              <div key={testName} style={{ marginBottom: 18 }}>
                <div style={{ fontWeight: 600, fontSize: 15, fontFamily: "'Fraunces',serif", margin: "6px 0 8px", color: "var(--accent)" }}>{testName}</div>
                <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 0.8fr 1.2fr 0.7fr", gap: 8, fontSize: 11, color: "var(--muted)", textTransform: "uppercase", padding: "0 0 8px", borderBottom: "1px solid var(--border)" }}>
                  <div>Parameter</div><div>Result</div><div>Unit</div><div>Range</div><div>Flag</div>
                </div>
                {group.map((r) => {
                  const i = r._idx;
                  const v = parseFloat(r.result);
                  const high = !isNaN(v) && v > r.refHigh, low = !isNaN(v) && v < r.refLow;
                  const flag = r.result === "" ? "" : high ? "HIGH" : low ? "LOW" : "Normal";
                  const fc = high ? "#f87171" : low ? "#f59e0b" : "#2dd4bf";
                  return (
                    <div key={i} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 0.8fr 1.2fr 0.7fr", gap: 8, alignItems: "center", padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 500 }}>{r.name}</div>
                        {r.method && <div style={{ fontSize: 11, color: "var(--muted)", fontStyle: "italic" }}>Method: {r.method}</div>}
                      </div>
                      <input style={S.input} type="number" value={r.result} onChange={(e) => set(i, e.target.value)} placeholder="—" />
                      <div style={{ fontSize: 13, color: "var(--muted)" }}>{r.unit}</div>
                      <div style={{ fontSize: 13, color: "var(--muted)" }}>{r.refLow} - {r.refHigh}</div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: flag ? fc : "var(--muted)" }}>{flag || "—"}</div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
          <button style={S.btnGhost} onClick={onCancel}>Cancel</button>
          <button style={{ ...S.btn, opacity: allFilled ? 1 : 0.4 }} disabled={!allFilled}
            onClick={() => onSave(order, rows)}>
            <FileOutput size={16} /> Save & Generate Report
          </button>
        </div>
      </div>
    </div>
  );
}

// --- SIDEBAR / TOPBAR -------------------------------------------------------
function Sidebar({ page, setPage, user, navOpen, onLogout, onAddStaff }) {
  const childIds = NAV.find((n) => n.id === "admin").children.map((c) => c.id);
  const [adminOpen, setAdminOpen] = useState(childIds.includes(page));
  return (
    <aside style={S.sidebar} className={"app-sidebar" + (navOpen ? " open" : "")}>
      <div style={S.brand}>
        <div style={S.logo}>
          <img src="/logo.png" alt="" style={{ width: 30, height: 30, objectFit: "contain" }}
            onError={(e) => { e.target.style.display = "none"; e.target.nextSibling.style.display = "block"; }} />
          <FlaskConical size={20} style={{ display: "none" }} />
        </div>
        <div>
          <div style={S.brandName}>SAI<span style={{ color: "var(--accent)" }}> PATH</span></div>
          <div style={S.brandSub}>Lab Portal</div>
        </div>
      </div>
      <nav style={S.nav}>
        {NAV.map((n) => {
          const Icon = n.icon;
          if (n.children) {
            const groupActive = childIds.includes(page);
            return (
              <div key={n.id}>
                <button onClick={() => setAdminOpen((o) => !o)}
                  style={{ ...S.navItem, ...(groupActive && !adminOpen ? S.navOn : {}) }}>
                  <Icon size={18} /> {n.label}
                  <ChevronRight size={15} style={{ marginLeft: "auto", transform: adminOpen ? "rotate(90deg)" : "none", transition: "transform .15s" }} />
                </button>
                {adminOpen && (
                  <div style={S.subNav}>
                    {n.children.map((c) => {
                      const CIcon = c.icon; const on = page === c.id;
                      return (
                        <button key={c.id} onClick={() => setPage(c.id)} style={{ ...S.subItem, ...(on ? S.subItemOn : {}) }}>
                          <CIcon size={16} /> {c.label}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          }
          const on = page === n.id;
          return (
            <button key={n.id} onClick={() => setPage(n.id)} style={{ ...S.navItem, ...(on ? S.navOn : {}) }}>
              <Icon size={18} /> {n.label}
            </button>
          );
        })}
      </nav>
      <div style={{ marginTop: "auto" }}>
        <button style={S.navItem} onClick={onAddStaff}>
          <UserPlus size={18} /> Add Staff
        </button>
        <div style={{ padding: "10px 13px", fontSize: 12, color: "var(--muted)" }}>
          Signed in as <b style={{ color: "var(--ink)" }}>{user?.fullName || user?.username}</b>
          {user?.labName && <div style={{ marginTop: 3 }}>{user.labName} <span style={{ color: "var(--accent)" }}>({user.labCode})</span></div>}
        </div>
        <button style={{ ...S.navItem, color: "#f87171" }} onClick={onLogout}>
          <LogOut size={18} /> Log Out
        </button>
      </div>
    </aside>
  );
}

function TopBar({ theme, toggle, page, search, setSearch, setPage, user, onMenu }) {
  const title = ALL_NAV.find((n) => n.id === page)?.label || "Dashboard";
  const onSearch = (v) => {
    setSearch(v);
    if (v && page !== "search") setPage("search");
  };
  return (
    <header style={S.topbar} className="app-topbar">
      <button className="menu-btn" style={S.iconBtn} onClick={onMenu}><Menu size={18} /></button>
      <h1 style={S.pageTitle} className="page-title">{title}</h1>
      <div style={S.searchBox} className="search-box">
        <Search size={16} color="var(--muted)" />
        <input style={S.searchInput} placeholder="Search patient, phone, order ID, or test..."
          value={search} onChange={(e) => onSearch(e.target.value)} />
      </div>
      <div style={S.topRight}>
        <button style={S.iconBtn} onClick={toggle}>{theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}</button>
        <button style={S.iconBtn}><Bell size={18} /><span style={S.badge}>3</span></button>
        <div style={S.profile}>
          <div style={S.avatar}>{(user?.fullName || user?.username || "?").slice(0, 1).toUpperCase()}</div>
          <div>
            <div style={{ fontWeight: 600, fontSize: 13 }}>{user?.fullName || user?.username}</div>
            <div style={{ fontSize: 11, color: "var(--muted)" }}>Staff</div>
          </div>
        </div>
      </div>
    </header>
  );
}

// --- WORK QUEUE -------------------------------------------------------------
function WorkQueue({ orders, patients, advance, onNew, onReport }) {
  const [q, setQ] = useState("");
  const [historyPhone, setHistoryPhone] = useState(null);
  const [sort, setSort] = useState({ key: "id", dir: "desc" });

  const toggleSort = (key) => setSort((s) =>
    s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" });

  let rows = orders
    .map((o) => ({ ...o, patient: patients[o.phone] || { name: "?", ref: "" } }))
    .filter((o) =>
      o.patient.name.toLowerCase().includes(q.toLowerCase()) ||
      o.id.toLowerCase().includes(q.toLowerCase()) ||
      o.phone.includes(q));

  rows = rows.sort((a, b) => {
    let av, bv;
    if (sort.key === "name") { av = a.patient.name; bv = b.patient.name; }
    else if (sort.key === "amount") { av = a.total; bv = b.total; }
    else if (sort.key === "status") { av = a.status; bv = b.status; }
    else { av = a.id; bv = b.id; }
    if (av < bv) return sort.dir === "asc" ? -1 : 1;
    if (av > bv) return sort.dir === "asc" ? 1 : -1;
    return 0;
  });

  const SortTh = ({ label, k }) => (
    <th style={{ ...S.th, cursor: k ? "pointer" : "default", userSelect: "none" }} onClick={() => k && toggleSort(k)}>
      {label}{k && sort.key === k ? (sort.dir === "asc" ? " ↑" : " ↓") : ""}
    </th>
  );

  if (!orders.length) return (
    <div style={S.placeholder}>
      <Beaker size={40} color="var(--muted)" />
      <h2 style={{ margin: "14px 0 4px" }}>No orders yet</h2>
      <button style={S.btn} onClick={onNew}><Plus size={16} /> New Registration</button>
    </div>
  );

  return (
    <div>
      <div style={S.queueBar} className="queue-bar">
        <div style={{ ...S.searchBox, maxWidth: 360, margin: 0 }}>
          <Search size={16} color="var(--muted)" />
          <input style={S.searchInput} placeholder="Search name, order ID, phone" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <button style={S.btn} onClick={onNew}><Plus size={16} /> New Registration</button>
      </div>

      <div style={S.panel}>
        <table style={S.table}>
          <thead>
            <tr>
              <SortTh label="Status" k="status" />
              <SortTh label="Order ID" k="id" />
              <SortTh label="Patient" k="name" />
              <SortTh label="Phone" />
              <SortTh label="Amount" k="amount" />
              <SortTh label="Referral Dr." />
              <SortTh label="" />
            </tr>
          </thead>
          <tbody>
            {rows.map((o) => (
              <tr key={o.id} style={S.tr}>
                <td style={S.td}><span style={badge(o.status)}>{o.status}</span></td>
                <td style={S.td}><b>{o.id}</b></td>
                <td style={S.td}>{o.patient.name}</td>
                <td style={{ ...S.td, color: "var(--muted)" }}>{o.phone}</td>
                <td style={S.td}>₹{o.total}</td>
                <td style={{ ...S.td, color: "var(--muted)" }}>{o.ref || "—"}</td>
                <td style={{ ...S.td, textAlign: "right", whiteSpace: "nowrap" }}>
                  <button style={S.linkBtn} onClick={() => setHistoryPhone(o.phone)} title="Patient history"><History size={15} /></button>
                  <button style={{ ...S.btnSm, marginRight: 8 }} onClick={() => onReport(o)}>
                    <FileOutput size={13} /> Report
                  </button>
                  {o.status !== "Report Ready" && (
                    <button style={S.btnSm} onClick={() => advance(o.id)}>
                      <ArrowRight size={13} /> {STATUS_FLOW[STATUS_FLOW.indexOf(o.status) + 1]}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {historyPhone && (
        <HistoryModal
          patient={patients[historyPhone]}
          orders={orders.filter((o) => o.phone === historyPhone)}
          onClose={() => setHistoryPhone(null)}
        />
      )}
    </div>
  );
}

function HistoryModal({ patient, orders, onClose }) {
  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={S.modal} onClick={(e) => e.stopPropagation()}>
        <div style={S.modalHead}>
          <div>
            <h3 style={{ fontFamily: "'Fraunces',serif", fontSize: 20 }}>{patient.name}</h3>
            <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 2 }}>
              {patient.age}/{patient.sex} · {patient.phone}
            </div>
          </div>
          <button style={S.iconBtnSm} onClick={onClose}><X size={16} /></button>
        </div>
        <div style={{ fontSize: 12, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 0.5, margin: "16px 0 8px" }}>
          {orders.length} visit{orders.length !== 1 ? "s" : ""}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {orders.map((o) => (
            <div key={o.id} style={S.histCard}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <b>{o.id}</b>
                <span style={badge(o.status)}>{o.status}</span>
              </div>
              <div style={{ fontSize: 13, color: "var(--muted)", margin: "6px 0" }}>{o.created} · ₹{o.total} ({o.payMode}) · Ref: {o.ref || "—"}</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {o.tests.map((t) => <span key={t.id} style={S.chip}>{t.name}</span>)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// --- NEW REGISTRATION (with phone dedup) ------------------------------------
function NewRegistration({ onDone, lookup, tests, doctors, goQueue }) {
  const [step, setStep] = useState(0);
  const [done, setDone] = useState(null);
  const [patient, setPatient] = useState({ name: "", age: "", sex: "M", phone: "", ref: "" });
  const [matched, setMatched] = useState(false);
  const [cart, setCart] = useState({});
  const [pay, setPay] = useState({ mode: "" });
  const [coll, setColl] = useState({ mode: "lab", date: "", time: "", addr: "" });

  const items = useMemo(() => Object.keys(cart).map((id) => tests.find((t) => t.id === id)).filter(Boolean), [cart, tests]);
  const total = items.reduce((s, t) => s + t.price, 0);
  const add = (id) => setCart((c) => ({ ...c, [id]: true }));
  const rm = (id) => setCart((c) => { const n = { ...c }; delete n[id]; return n; });

  // phone dedup: when phone reaches 10 digits, look up existing patient
  const onPhone = async (val) => {
    const phone = val.replace(/\D/g, "").slice(0, 10);
    setPatient((p) => ({ ...p, phone }));
    if (phone.length === 10) {
      const existing = await lookup(phone);
      if (existing) {
        setPatient({ ...existing, phone });
        setMatched(true);
        return;
      }
    }
    setMatched(false);
  };

  const finish = async () => {
    const order = await onDone({ patient, tests: items, total, payMode: pay.mode });
    setDone({ order, patient });
  };

  const restart = () => {
    setDone(null); setStep(0); setCart({}); setPay({ mode: "" }); setMatched(false);
    setPatient({ name: "", age: "", sex: "M", phone: "", ref: "" });
    setColl({ mode: "lab", date: "", time: "", addr: "" });
  };

  if (done) return (
    <div style={S.regWrap}>
      <div style={{ ...S.panel, textAlign: "center", padding: "48px 24px" }}>
        <div style={{ display: "inline-grid", placeItems: "center", width: 70, height: 70, borderRadius: "50%", background: "var(--accent)", color: "#04201d", marginBottom: 16 }}>
          <PartyPopper size={32} />
        </div>
        <h2 style={{ fontFamily: "'Fraunces',serif", fontSize: 26 }}>Order Registered</h2>
        <p style={{ color: "var(--muted)", marginTop: 6 }}>
          {done.order.id} · {done.patient.name} · ₹{done.order.total}
        </p>
        <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 24 }}>
          <button style={S.btnGhost} onClick={goQueue}>Go to Work Queue</button>
          <button style={S.btn} onClick={restart}><Plus size={16} /> Register Another</button>
        </div>
      </div>
    </div>
  );

  return (
    <div style={S.regWrap}>
      <RegStepper step={step} />

      {step === 0 && (
        <RegCard title="Patient Details">
          <Field label="Phone (10 digits)" full>
            <div style={{ position: "relative" }}>
              <Phone size={15} style={{ position: "absolute", left: 12, top: 13, color: "var(--muted)" }} />
              <input style={{ ...S.input, paddingLeft: 36 }} value={patient.phone} onChange={(e) => onPhone(e.target.value)} placeholder="Enter to auto-fill returning patients" />
            </div>
            {matched && <div style={S.matchNote}><CheckCircle2 size={14} /> Returning patient found — details loaded. New order will link to existing record.</div>}
          </Field>
          <div style={{ ...S.formGrid, marginTop: 14 }}>
            <Field label="Full name" full>
              <input style={S.input} value={patient.name} onChange={(e) => setPatient({ ...patient, name: e.target.value })} />
            </Field>
            <Field label="Age"><input style={S.input} value={patient.age} onChange={(e) => setPatient({ ...patient, age: e.target.value })} /></Field>
            <Field label="Sex">
              <select style={S.input} value={patient.sex} onChange={(e) => setPatient({ ...patient, sex: e.target.value })}>
                <option>M</option><option>F</option><option>Other</option>
              </select>
            </Field>
            <Field label="Referred by (Dr.)" full>
              <select style={S.input} value={patient.ref} onChange={(e) => setPatient({ ...patient, ref: e.target.value })}>
                <option value="">Select doctor</option>
                {doctors.map((d) => (
                  <option key={d.id} value={d.name}>{d.name}{d.specialty ? ` — ${d.specialty}` : ""}</option>
                ))}
              </select>
            </Field>
          </div>
          <RegNav next={() => setStep(1)} nextOk={!!patient.name && patient.phone.length === 10} />
        </RegCard>
      )}

      {step === 1 && (
        <RegCard title="Select Tests">
          <div style={S.testGrid}>
            {tests.length === 0 && <p style={{ color: "var(--muted)" }}>No tests in catalog. Add some under Admin → Tests Catalog.</p>}
            {tests.map((t) => {
              const on = !!cart[t.id];
              return (
                <div key={t.id} style={{ ...S.testCard, ...(on ? S.testCardOn : {}) }}>
                  <div style={S.catTag}>{t.cat}</div>
                  <div style={S.testName}>{t.name}</div>
                  <div style={S.metaRow}><Clock size={12} /> {t.tat}</div>
                  <div style={S.testFoot}>
                    <span style={S.price}>₹{t.price}</span>
                    {on ? <button style={S.btnGhost} onClick={() => rm(t.id)}><Minus size={14} /></button>
                        : <button style={S.btnSm} onClick={() => add(t.id)}><Plus size={14} /> Add</button>}
                  </div>
                </div>
              );
            })}
          </div>
          <RegNav back={() => setStep(0)} next={() => setStep(2)} nextOk={!!items.length}
            footer={<span><b>₹{total}</b> · {items.length} tests</span>} />
        </RegCard>
      )}

      {step === 2 && (
        <RegCard title="Payment Mode">
          <div style={S.summary}>
            {items.map((t) => <div key={t.id} style={S.sumRow}><span>{t.name}</span><span>₹{t.price}</span></div>)}
            <div style={{ ...S.sumRow, ...S.sumTotal }}><span>Total</span><span>₹{total}</span></div>
          </div>
          <div style={{ ...S.label, marginTop: 18 }}>Select payment mode</div>
          <div style={S.payRow}>
            {PAY_MODES.map((m) => {
              const Icon = m.icon; const on = pay.mode === m.id;
              return (
                <button key={m.id} style={{ ...S.payBtn, ...(on ? S.payBtnOn : {}) }} onClick={() => setPay({ mode: m.id })}>
                  <Icon size={18} /> {m.label}
                </button>
              );
            })}
          </div>
          {pay.mode === "credit" && <div style={S.dueNote}>⚠️ Marked as due. Balance ₹{total} pending.</div>}
          <RegNav back={() => setStep(1)} next={() => setStep(3)} nextOk={!!pay.mode} />
        </RegCard>
      )}

      {step === 3 && (
        <RegCard title="Sample Collection">
          <div style={S.payRow}>
            {[["lab", "At Lab"], ["home", "Home Visit"]].map(([id, lbl]) => (
              <button key={id} style={{ ...S.payBtn, ...(coll.mode === id ? S.payBtnOn : {}) }} onClick={() => setColl({ ...coll, mode: id })}>
                <MapPin size={16} /> {lbl}
              </button>
            ))}
          </div>
          <div style={S.formGrid} className="form-grid">
            <Field label="Date"><input type="date" style={S.input} value={coll.date} onChange={(e) => setColl({ ...coll, date: e.target.value })} /></Field>
            <Field label="Time slot">
              <select style={S.input} value={coll.time} onChange={(e) => setColl({ ...coll, time: e.target.value })}>
                <option value="">Select</option><option>07-09</option><option>09-11</option><option>11-13</option>
              </select>
            </Field>
            {coll.mode === "home" && (
              <Field label="Address" full><input style={S.input} value={coll.addr} onChange={(e) => setColl({ ...coll, addr: e.target.value })} /></Field>
            )}
          </div>
          <RegNav back={() => setStep(2)} next={finish} nextLabel="Register Order" nextOk={!!coll.date && !!coll.time} />
        </RegCard>
      )}
    </div>
  );
}

function RegStepper({ step }) {
  return (
    <div style={S.regStepper}>
      {REG_STEPS.map((s, i) => (
        <div key={s} style={S.regStepItem}>
          <div style={{ ...S.regDot, ...(i <= step ? S.regDotOn : {}) }}>{i < step ? <Check size={13} /> : i + 1}</div>
          <span style={{ fontSize: 13, color: i <= step ? "var(--ink)" : "var(--muted)", whiteSpace: "nowrap" }}>{s}</span>
          {i < REG_STEPS.length - 1 && <div style={{ ...S.regLine, background: i < step ? "var(--accent)" : "var(--border)" }} />}
        </div>
      ))}
    </div>
  );
}
function RegCard({ title, children }) {
  return <div style={S.panel}><h3 style={{ fontFamily: "'Fraunces',serif", fontSize: 20 }}>{title}</h3><div style={{ marginTop: 18 }}>{children}</div></div>;
}
function Field({ label, children, full }) {
  return <div style={{ gridColumn: full ? "1 / -1" : "auto" }}><label style={S.label}>{label}</label>{children}</div>;
}
function RegNav({ back, next, nextOk = true, nextLabel = "Next", footer }) {
  return (
    <div style={S.regNav}>
      <div>{footer}</div>
      <div style={{ display: "flex", gap: 10 }}>
        {back && <button style={S.btnGhost} onClick={back}><ArrowLeft size={14} /> Back</button>}
        <button style={{ ...S.btn, opacity: nextOk ? 1 : 0.4 }} disabled={!nextOk} onClick={next}>{nextLabel} <ArrowRight size={16} /></button>
      </div>
    </div>
  );
}

// --- DASHBOARD --------------------------------------------------------------
function Dashboard({ orders, patients }) {
  // --- compute real stats from data ---
  const totalOrders = orders.length;
  const totalPatients = Object.keys(patients).length;
  const revenue = orders.reduce((s, o) => s + (o.total || 0), 0);
  const pending = orders.filter((o) => o.status !== "Report Ready").length;
  const today = new Date().toISOString().slice(0, 10);
  const todayCount = orders.filter((o) => (o.created || "").slice(0, 10) === today).length;

  const stats = [
    { label: "Total Orders", value: totalOrders.toLocaleString(), icon: ListChecks, tint: "#3b82f6" },
    { label: "Total Patients", value: totalPatients.toLocaleString(), icon: Users, tint: "#a855f7" },
    { label: "Revenue", value: "₹" + revenue.toLocaleString(), icon: Wallet, tint: "#2dd4bf" },
    { label: "Pending Samples", value: pending.toLocaleString(), icon: Clock, tint: "#f59e0b" },
    { label: "Today's Orders", value: todayCount.toLocaleString(), icon: FilePlus, tint: "#ec4899" },
  ];

  // orders + revenue over last 7 days
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const label = d.toLocaleDateString("en-IN", { weekday: "short" });
    const dayOrders = orders.filter((o) => (o.created || "").slice(0, 10) === key);
    days.push({ d: label, orders: dayOrders.length, revenue: dayOrders.reduce((s, o) => s + (o.total || 0), 0) });
  }

  // top tests by frequency
  const testCount = {};
  orders.forEach((o) => o.tests.forEach((t) => {
    const n = t.name.split(" ")[0];
    testCount[n] = (testCount[n] || 0) + 1;
  }));
  const topTests = Object.entries(testCount)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count).slice(0, 6);

  const recent = orders.slice(0, 6).map((o) => ({
    ...o, patient: patients[o.phone] || { name: "?" },
    testStr: o.tests.map((t) => t.name.split(" ")[0]).join(", "),
  }));

  const empty = orders.length === 0;

  return (
    <div style={S.dashGrid} className="dash-grid">
      <div style={{ ...S.statRow, gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))" }}>
        {stats.map((st) => {
          const Icon = st.icon;
          return (
            <div key={st.label} style={S.statCard}>
              <div style={{ ...S.statIcon, background: st.tint + "22", color: st.tint }}><Icon size={20} /></div>
              <div style={S.statVal}>{st.value}</div>
              <div style={S.statLabel}>{st.label}</div>
            </div>
          );
        })}
      </div>

      {empty && (
        <div style={{ ...S.panel, gridColumn: "1 / -1", textAlign: "center", padding: 40, color: "var(--muted)" }}>
          No data yet. Register an order to populate the dashboard.
        </div>
      )}

      {/* Orders over time */}
      <div style={{ ...S.panel, gridColumn: "span 2" }}>
        <PanelHead title="Orders — last 7 days" />
        <ResponsiveContainer width="100%" height={250}>
          <AreaChart data={days} margin={{ left: -20, right: 8, top: 8 }}>
            <defs>
              <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#2dd4bf" stopOpacity={0.4} />
                <stop offset="100%" stopColor="#2dd4bf" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis dataKey="d" stroke="var(--muted)" fontSize={12} tickLine={false} axisLine={false} />
            <YAxis stroke="var(--muted)" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
            <Tooltip contentStyle={tooltipStyle} />
            <Area type="monotone" dataKey="orders" stroke="#2dd4bf" strokeWidth={2.5} fill="url(#g1)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Revenue by day */}
      <div style={{ ...S.panel, gridColumn: "span 2" }}>
        <PanelHead title="Revenue — last 7 days" />
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={days} margin={{ left: -10, right: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis dataKey="d" stroke="var(--muted)" fontSize={12} tickLine={false} axisLine={false} />
            <YAxis stroke="var(--muted)" fontSize={12} tickLine={false} axisLine={false} />
            <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--border)" }} formatter={(v) => "₹" + v} />
            <Bar dataKey="revenue" fill="#a855f7" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Top tests */}
      <div style={S.panel}>
        <PanelHead title="Top Tests" />
        {topTests.length === 0 ? <p style={{ color: "var(--muted)", fontSize: 14 }}>No tests yet.</p> : (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={topTests} layout="vertical" margin={{ left: 8, right: 16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
              <XAxis type="number" stroke="var(--muted)" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
              <YAxis type="category" dataKey="name" stroke="var(--muted)" fontSize={12} tickLine={false} axisLine={false} width={70} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--border)" }} />
              <Bar dataKey="count" fill="#3b82f6" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Recent orders */}
      <div style={S.panel}>
        <PanelHead title="Recent Orders" />
        <table style={S.table}>
          <thead>
            <tr>{["Order", "Patient", "Amount", "Status"].map((h) => <th key={h} style={S.th}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {recent.length === 0 ? (
              <tr><td style={{ ...S.td, color: "var(--muted)" }} colSpan={4}>No orders yet.</td></tr>
            ) : recent.map((r) => (
              <tr key={r.id} style={S.tr}>
                <td style={S.td}><b>{r.id}</b></td>
                <td style={S.td}>{r.patient.name}</td>
                <td style={S.td}>₹{r.total}</td>
                <td style={S.td}><span style={badge(r.status)}>{r.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PanelHead({ title, right }) {
  return <div style={S.panelHead}><h3 style={S.panelTitle}>{title}</h3>{right}</div>;
}
function Placeholder({ page }) {
  const label = ALL_NAV.find((n) => n.id === page)?.label;
  return (
    <div style={S.placeholder}>
      <TrendingUp size={40} color="var(--muted)" />
      <h2 style={{ margin: "14px 0 4px" }}>{label}</h2>
      <p style={{ color: "var(--muted)" }}>Coming in the next step.</p>
    </div>
  );
}

// --- TESTS CATALOG ----------------------------------------------------------
function TestsCatalog() {
  const [tests, setTests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [paramsFor, setParamsFor] = useState(null);
  const [err, setErr] = useState("");

  const load = async () => {
    try {
      const res = await api(`/tests`);
      setTests(await res.json());
      setErr("");
    } catch { setErr("Cannot reach API."); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const save = async (t, isNew) => {
    try {
      await api(`/tests${isNew ? "" : "/" + t.id}`, {
        method: isNew ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(t),
      });
      setEditing(null);
      await load();
    } catch { setErr("Save failed."); }
  };

  const del = async (id) => {
    if (!confirm("Delete this test?")) return;
    try { await api(`/tests/${id}`, { method: "DELETE" }); await load(); }
    catch { setErr("Delete failed."); }
  };

  return (
    <div>
      <div style={S.queueBar} className="queue-bar">
        <div style={{ fontSize: 14, color: "var(--muted)" }}>{tests.length} tests in catalog</div>
        <button style={S.btn} onClick={() => setEditing({ id: "", name: "", price: 0, tat: "", category: "", _new: true })}>
          <Plus size={16} /> Add Test
        </button>
      </div>
      {err && <div style={S.dueNote}>{err}</div>}

      <div style={S.panel}>
        {loading ? <p style={{ color: "var(--muted)" }}>Loading…</p> : (
          <table style={S.table}>
            <thead>
              <tr>{["ID", "Name", "Category", "TAT", "Price", ""].map((h) => <th key={h} style={S.th}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {tests.map((t) => (
                <tr key={t.id} style={S.tr}>
                  <td style={{ ...S.td, color: "var(--muted)" }}>{t.id}</td>
                  <td style={S.td}>{t.name}</td>
                  <td style={S.td}><span style={S.chip}>{t.category}</span></td>
                  <td style={{ ...S.td, color: "var(--muted)" }}>{t.tat}</td>
                  <td style={S.td}>₹{t.price}</td>
                  <td style={{ ...S.td, textAlign: "right", whiteSpace: "nowrap" }}>
                    <button style={S.linkBtn} onClick={() => setParamsFor(t)} title="Parameters"><SlidersHorizontal size={14} /></button>
                    <button style={S.linkBtn} onClick={() => setEditing({ ...t })}><Edit2 size={14} /></button>
                    <button style={{ ...S.linkBtn, marginRight: 0 }} onClick={() => del(t.id)}><Trash2 size={14} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {editing && <TestEditor test={editing} onSave={save} onClose={() => setEditing(null)} />}
      {paramsFor && <ParamManager test={paramsFor} onClose={() => setParamsFor(null)} />}
    </div>
  );
}

function ParamManager({ test, onClose }) {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: "", method: "", unit: "", refLow: "", refHigh: "" });
  const [err, setErr] = useState("");

  const load = async () => {
    try { const res = await api(`/parameters/${test.id}`); setList(await res.json()); setErr(""); }
    catch { setErr("Cannot reach API."); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const add = async () => {
    try {
      await api(`/parameters`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          testId: test.id, name: form.name, method: form.method || null,
          unit: form.unit, refLow: parseFloat(form.refLow) || 0,
          refHigh: parseFloat(form.refHigh) || 0, sortOrder: list.length + 1,
        }),
      });
      setForm({ name: "", method: "", unit: "", refLow: "", refHigh: "" });
      await load();
    } catch { setErr("Save failed."); }
  };

  const del = async (id) => {
    try { await api(`/parameters/${id}`, { method: "DELETE" }); await load(); }
    catch { setErr("Delete failed."); }
  };

  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={{ ...S.modal, width: 680 }} onClick={(e) => e.stopPropagation()}>
        <div style={S.modalHead}>
          <div>
            <h3 style={{ fontFamily: "'Fraunces',serif", fontSize: 20 }}>Parameters — {test.name}</h3>
            <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 2 }}>Define what this test measures. These auto-fill the result entry form.</div>
          </div>
          <button style={S.iconBtnSm} onClick={onClose}>✕</button>
        </div>

        {err && <div style={S.dueNote}>{err}</div>}

        <div style={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 12, padding: 14, marginTop: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1.3fr 0.9fr 0.8fr 0.8fr auto", gap: 8, alignItems: "end" }}>
            <Field label="Parameter name"><input style={S.input} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Fasting Plasma Glucose" /></Field>
            <Field label="Method"><input style={S.input} value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })} placeholder="Hexokinase" /></Field>
            <Field label="Unit"><input style={S.input} value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="mg/dl" /></Field>
            <Field label="Low"><input style={S.input} type="number" value={form.refLow} onChange={(e) => setForm({ ...form, refLow: e.target.value })} placeholder="60" /></Field>
            <Field label="High"><input style={S.input} type="number" value={form.refHigh} onChange={(e) => setForm({ ...form, refHigh: e.target.value })} placeholder="100" /></Field>
            <button style={{ ...S.btn, opacity: form.name && form.unit ? 1 : 0.4 }} disabled={!form.name || !form.unit} onClick={add}><Plus size={16} /></button>
          </div>
        </div>

        <div style={{ marginTop: 16 }}>
          {loading ? <p style={{ color: "var(--muted)" }}>Loading…</p> : list.length === 0 ? (
            <p style={{ color: "var(--muted)", fontSize: 14 }}>No parameters yet. Add the first one above.</p>
          ) : (
            <table style={S.table}>
              <thead><tr>{["Parameter", "Method", "Unit", "Range", ""].map((h) => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
              <tbody>
                {list.map((p) => (
                  <tr key={p.id} style={S.tr}>
                    <td style={S.td}>{p.name}</td>
                    <td style={{ ...S.td, color: "var(--muted)", fontStyle: "italic" }}>{p.method || "—"}</td>
                    <td style={{ ...S.td, color: "var(--muted)" }}>{p.unit}</td>
                    <td style={{ ...S.td, color: "var(--muted)" }}>{p.refLow} - {p.refHigh}</td>
                    <td style={{ ...S.td, textAlign: "right" }}>
                      <button style={{ ...S.linkBtn, marginRight: 0 }} onClick={() => del(p.id)}><Trash2 size={14} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

function TestEditor({ test, onSave, onClose }) {
  const [t, setT] = useState(test);
  const isNew = !!test._new;
  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={S.modal} onClick={(e) => e.stopPropagation()}>
        <div style={S.modalHead}>
          <h3 style={{ fontFamily: "'Fraunces',serif", fontSize: 20 }}>{isNew ? "Add Test" : "Edit Test"}</h3>
          <button style={S.iconBtnSm} onClick={onClose}><X size={16} /></button>
        </div>
        <div style={{ ...S.formGrid, marginTop: 16 }}>
          <Field label="ID (short code)"><input style={{ ...S.input, opacity: isNew ? 1 : 0.5 }} disabled={!isNew} value={t.id} onChange={(e) => setT({ ...t, id: e.target.value.toLowerCase().replace(/\s/g, "") })} placeholder="cbc" /></Field>
          <Field label="Price (₹)"><input type="number" style={S.input} value={t.price} onChange={(e) => setT({ ...t, price: parseInt(e.target.value) || 0 })} /></Field>
          <Field label="Name" full><input style={S.input} value={t.name} onChange={(e) => setT({ ...t, name: e.target.value })} /></Field>
          <Field label="Category"><input style={S.input} value={t.category} onChange={(e) => setT({ ...t, category: e.target.value })} placeholder="Hematology" /></Field>
          <Field label="Turnaround (TAT)"><input style={S.input} value={t.tat} onChange={(e) => setT({ ...t, tat: e.target.value })} placeholder="6h" /></Field>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
          <button style={S.btnGhost} onClick={onClose}>Cancel</button>
          <button style={{ ...S.btn, opacity: t.id && t.name ? 1 : 0.4 }} disabled={!t.id || !t.name}
            onClick={() => onSave({ id: t.id, name: t.name, price: t.price, tat: t.tat, category: t.category }, isNew)}>
            <Check size={16} /> {isNew ? "Add" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

// --- REFERRAL DOCTORS -------------------------------------------------------
function ReferralDoctors() {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: "", specialty: "", phone: "" });
  const [err, setErr] = useState("");

  const load = async () => {
    try { const res = await api(`/doctors`); setDocs(await res.json()); setErr(""); }
    catch { setErr("Cannot reach API."); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const add = async () => {
    try {
      await api(`/doctors`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      setForm({ name: "", specialty: "", phone: "" });
      await load();
    } catch { setErr("Save failed."); }
  };

  const del = async (id) => {
    if (!confirm("Remove this doctor?")) return;
    try { await api(`/doctors/${id}`, { method: "DELETE" }); await load(); }
    catch { setErr("Delete failed."); }
  };

  return (
    <div>
      {err && <div style={S.dueNote}>{err}</div>}
      <div style={S.panel}>
        <h3 style={{ fontFamily: "'Fraunces',serif", fontSize: 18, marginBottom: 14 }}>Add Doctor</h3>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1.5fr 1.5fr auto", gap: 12, alignItems: "end" }}>
          <Field label="Name"><input style={S.input} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Dr. Patel" /></Field>
          <Field label="Specialty"><input style={S.input} value={form.specialty} onChange={(e) => setForm({ ...form, specialty: e.target.value })} placeholder="Pediatrics" /></Field>
          <Field label="Phone"><input style={S.input} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
          <button style={{ ...S.btn, opacity: form.name ? 1 : 0.4 }} disabled={!form.name} onClick={add}><Plus size={16} /> Add</button>
        </div>
      </div>

      <div style={{ ...S.panel, marginTop: 18 }}>
        <h3 style={{ fontFamily: "'Fraunces',serif", fontSize: 18, marginBottom: 14 }}>{docs.length} Doctors</h3>
        {loading ? <p style={{ color: "var(--muted)" }}>Loading…</p> : (
          <table style={S.table}>
            <thead><tr>{["Name", "Specialty", "Phone", ""].map((h) => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
            <tbody>
              {docs.map((d) => (
                <tr key={d.id} style={S.tr}>
                  <td style={S.td}>{d.name}</td>
                  <td style={{ ...S.td, color: "var(--muted)" }}>{d.specialty || "—"}</td>
                  <td style={{ ...S.td, color: "var(--muted)" }}>{d.phone || "—"}</td>
                  <td style={{ ...S.td, textAlign: "right" }}>
                    <button style={{ ...S.linkBtn, marginRight: 0 }} onClick={() => del(d.id)}><Trash2 size={14} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// --- PATIENTS (grouped, collapsible) ----------------------------------------
function PatientsView({ orders, patients, onReport }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState({});

  // group orders by phone
  const groups = {};
  orders.forEach((o) => {
    if (!groups[o.phone]) groups[o.phone] = [];
    groups[o.phone].push(o);
  });

  const phones = Object.keys(groups).filter((ph) => {
    const p = patients[ph] || {};
    return (p.name || "").toLowerCase().includes(q.toLowerCase()) || ph.includes(q);
  });

  const toggle = (ph) => setOpen((o) => ({ ...o, [ph]: !o[ph] }));

  if (!phones.length) return (
    <div style={S.placeholder}>
      <Users size={40} color="var(--muted)" />
      <h2 style={{ margin: "14px 0 4px" }}>No patients yet</h2>
      <p style={{ color: "var(--muted)" }}>Register an order to see patients here.</p>
    </div>
  );

  return (
    <div>
      <div style={{ ...S.searchBox, maxWidth: 360, marginBottom: 16 }}>
        <Search size={16} color="var(--muted)" />
        <input style={S.searchInput} placeholder="Search patient or phone" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {phones.map((ph) => {
          const p = patients[ph] || { name: "?" };
          const visits = groups[ph].slice().sort((a, b) => (b.created || "").localeCompare(a.created || ""));
          const totalSpend = visits.reduce((s, v) => s + (v.total || 0), 0);
          const isOpen = !!open[ph];
          const initials = (p.name || "?").split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
          return (
            <div key={ph} style={S.pGroup}>
              <button style={S.pHead} onClick={() => toggle(ph)}>
                <ChevronRight size={16} style={{ color: "var(--muted)", transform: isOpen ? "rotate(90deg)" : "none", transition: "transform .15s", flexShrink: 0 }} />
                <div style={S.pAvatar}>{initials}</div>
                <div style={{ textAlign: "left" }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{p.name}</div>
                  <div style={{ fontSize: 12, color: "var(--muted)" }}>{ph}{p.age ? ` · ${p.age}/${p.sex}` : ""}</div>
                </div>
                <div style={{ marginLeft: "auto", fontSize: 12, color: "var(--muted)" }}>
                  {visits.length} visit{visits.length !== 1 ? "s" : ""} · ₹{totalSpend}
                </div>
              </button>

              {isOpen && (
                <div>
                  {visits.map((o) => (
                    <div key={o.id} style={S.pRow} className="p-row">
                      <span style={{ fontWeight: 600, fontSize: 13 }}>{o.id}</span>
                      <span style={{ fontSize: 13, color: "var(--muted)" }}>{o.created || "—"}</span>
                      <span style={{ fontSize: 13, color: "var(--muted)" }}>{o.tests.map((t) => t.name.split(" ")[0]).join(", ")}</span>
                      <span style={{ fontSize: 13 }}>₹{o.total}</span>
                      <span style={badge(o.status)}>{o.status}</span>
                      <button style={{ ...S.btnSm, justifySelf: "end" }} onClick={() => onReport(o)}>
                        <FileOutput size={13} /> Report
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// --- GLOBAL SEARCH RESULTS --------------------------------------------------
function SearchResults({ query, orders, patients, advance, onReport }) {
  const q = (query || "").toLowerCase().trim();

  if (!q) return (
    <div style={S.placeholder}>
      <Search size={40} color="var(--muted)" />
      <h2 style={{ margin: "14px 0 4px" }}>Search</h2>
      <p style={{ color: "var(--muted)" }}>Type a patient name, phone, order ID, or test name above.</p>
    </div>
  );

  const rows = orders
    .map((o) => ({ ...o, patient: patients[o.phone] || { name: "?" } }))
    .filter((o) => {
      const name = (o.patient.name || "").toLowerCase();
      const tests = o.tests.map((t) => t.name.toLowerCase()).join(" ");
      return name.includes(q) || o.phone.includes(q) || o.id.toLowerCase().includes(q) || tests.includes(q);
    });

  return (
    <div>
      <div style={{ fontSize: 14, color: "var(--muted)", marginBottom: 14 }}>
        {rows.length} result{rows.length !== 1 ? "s" : ""} for "{query}"
      </div>
      {rows.length === 0 ? (
        <div style={S.placeholder}>
          <Search size={40} color="var(--muted)" />
          <p style={{ color: "var(--muted)" }}>No matches. Try a different name, phone, order ID, or test.</p>
        </div>
      ) : (
        <div style={S.panel}>
          <table style={S.table}>
            <thead>
              <tr>{["Status", "Order ID", "Patient", "Phone", "Tests", "Amount", ""].map((h) => <th key={h} style={S.th}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((o) => (
                <tr key={o.id} style={S.tr}>
                  <td style={S.td}><span style={badge(o.status)}>{o.status}</span></td>
                  <td style={S.td}><b>{o.id}</b></td>
                  <td style={S.td}>{o.patient.name}</td>
                  <td style={{ ...S.td, color: "var(--muted)" }}>{o.phone}</td>
                  <td style={{ ...S.td, color: "var(--muted)" }}>{o.tests.map((t) => t.name.split(" ")[0]).join(", ")}</td>
                  <td style={S.td}>₹{o.total}</td>
                  <td style={{ ...S.td, textAlign: "right", whiteSpace: "nowrap" }}>
                    <button style={{ ...S.btnSm, marginRight: 8 }} onClick={() => onReport(o)}><FileOutput size={13} /> Report</button>
                    {o.status !== "Report Ready" && (
                      <button style={S.btnSm} onClick={() => advance(o.id)}><ArrowRight size={13} /> Next</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// --- AUTH (login + create lab) ----------------------------------------------
function AuthGate({ onLogin }) {
  const [mode, setMode] = useState("login");   // login | newlab
  const [labCode, setLabCode] = useState("");
  const [labName, setLabName] = useState("");
  const [u, setU] = useState("");
  const [p, setP] = useState("");
  const [name, setName] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const canSubmit = mode === "login"
    ? labCode && u && p && !busy
    : labName && labCode && u && p && !busy;

  const submit = async () => {
    if (!canSubmit) return;
    setErr(""); setBusy(true);
    try {
      const path = mode === "login" ? "/login" : "/register-lab";
      const body = mode === "login"
        ? { labCode: labCode.trim(), username: u.trim(), password: p }
        : { labName: labName.trim(), labCode: labCode.trim(), username: u.trim(), password: p, fullName: name };
      const res = await api(path, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.status === 401) { setErr("Invalid lab code, username, or password."); setBusy(false); return; }
      if (res.status === 409) { setErr("That lab code is already taken."); setBusy(false); return; }
      if (!res.ok) { setErr("Something went wrong."); setBusy(false); return; }
      const data = await res.json();
      setToken(data.token);
      onLogin(data);
    } catch {
      setErr("Cannot reach server. Is it running? (cd server && dotnet run)");
    }
    setBusy(false);
  };

  return (
    <div style={S.authWrap}>
      <div style={S.authCard}>
        <div style={S.authLogo}><FlaskConical size={26} /></div>
        <div style={S.authBrand}>SAI<span style={{ color: "var(--accent)" }}> PATH</span></div>
        <div style={S.authSub}>{mode === "login" ? "Staff Login" : "Create a New Lab"}</div>

        <div style={{ marginTop: 22, display: "flex", flexDirection: "column", gap: 12 }}>
          {mode === "newlab" && (
            <div>
              <label style={S.label}>Lab name</label>
              <input style={S.input} value={labName} onChange={(e) => setLabName(e.target.value)} placeholder="Sai Pathology Lab" />
            </div>
          )}
          <div>
            <label style={S.label}>Lab code</label>
            <input style={S.input} value={labCode} onChange={(e) => setLabCode(e.target.value.toUpperCase())} placeholder="LABA"
              onKeyDown={(e) => e.key === "Enter" && submit()} />
          </div>
          {mode === "newlab" && (
            <div>
              <label style={S.label}>Full name</label>
              <input style={S.input} value={name} onChange={(e) => setName(e.target.value)} placeholder="Dr. Tetambe" />
            </div>
          )}
          <div>
            <label style={S.label}>Username</label>
            <input style={S.input} value={u} onChange={(e) => setU(e.target.value)} placeholder="username"
              onKeyDown={(e) => e.key === "Enter" && submit()} />
          </div>
          <div>
            <label style={S.label}>Password</label>
            <input style={S.input} type="password" value={p} onChange={(e) => setP(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()} />
          </div>

          {err && <div style={{ color: "#f87171", fontSize: 13 }}>{err}</div>}

          <button style={{ ...S.btn, justifyContent: "center", opacity: canSubmit ? 1 : 0.5 }}
            disabled={!canSubmit} onClick={submit}>
            {mode === "login" ? <><LogIn size={16} /> Sign In</> : <><Building2 size={16} /> Create Lab</>}
          </button>

          <div style={{ textAlign: "center", fontSize: 13, color: "var(--muted)" }}>
            {mode === "login" ? "Setting up a new lab?" : "Already have a lab?"}{" "}
            <span style={{ color: "var(--accent)", cursor: "pointer", fontWeight: 600 }}
              onClick={() => { setMode(mode === "login" ? "newlab" : "login"); setErr(""); }}>
              {mode === "login" ? "Create one" : "Sign in"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function AddStaff() {
  const [u, setU] = useState(""); const [p, setP] = useState(""); const [name, setName] = useState("");
  const [msg, setMsg] = useState(""); const [err, setErr] = useState("");

  const add = async () => {
    setMsg(""); setErr("");
    try {
      const res = await api(`/users`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: u.trim(), password: p, fullName: name }),
      });
      if (res.status === 401) { setErr("Session expired. Please sign in again."); return; }
      if (res.status === 409) { setErr("Username already exists in this lab."); return; }
      if (!res.ok) { setErr("Failed to add staff."); return; }
      setMsg(`Staff "${u}" added successfully.`);
      setU(""); setP(""); setName("");
    } catch { setErr("Cannot reach server."); }
  };

  return (
    <div style={{ maxWidth: 480 }}>
      <div style={S.panel}>
        <h3 style={{ fontFamily: "'Fraunces',serif", fontSize: 20, marginBottom: 16 }}>Add New Staff</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div><label style={S.label}>Full name</label><input style={S.input} value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div><label style={S.label}>Username</label><input style={S.input} value={u} onChange={(e) => setU(e.target.value)} /></div>
          <div><label style={S.label}>Password</label><input style={S.input} type="password" value={p} onChange={(e) => setP(e.target.value)} /></div>
          {msg && <div style={{ color: "var(--accent)", fontSize: 13 }}>{msg}</div>}
          {err && <div style={{ color: "#f87171", fontSize: 13 }}>{err}</div>}
          <button style={{ ...S.btn, opacity: u && p ? 1 : 0.5 }} disabled={!u || !p} onClick={add}>
            <UserPlus size={16} /> Add Staff
          </button>
        </div>
      </div>
    </div>
  );
}

// --- REVENUE HELPERS --------------------------------------------------------
function revenueStats(orders) {
  const today = new Date().toISOString().slice(0, 10);
  const now = new Date();
  const weekAgo = new Date(); weekAgo.setDate(now.getDate() - 6);
  const weekKey = weekAgo.toISOString().slice(0, 10);

  let todayRev = 0, weekRev = 0;
  orders.forEach((o) => {
    const d = (o.created || "").slice(0, 10);
    if (d === today) todayRev += o.total || 0;
    if (d >= weekKey) weekRev += o.total || 0;
  });

  // revenue by test
  const byTest = {};
  orders.forEach((o) => o.tests.forEach((t) => {
    const n = t.name;
    byTest[n] = (byTest[n] || 0) + (t.price || 0);
  }));
  const testRows = Object.entries(byTest)
    .map(([name, rev]) => ({ name: name.length > 16 ? name.slice(0, 15) + "…" : name, rev }))
    .sort((a, b) => b.rev - a.rev).slice(0, 8);

  return { todayRev, weekRev, testRows };
}

// --- REVENUE PAGE -----------------------------------------------------------
function RevenueView({ orders, patients }) {
  const { todayRev, weekRev, testRows } = revenueStats(orders);

  const recent = orders.slice(0, 10).map((o) => ({
    ...o, patient: patients[o.phone] || { name: "?" },
  }));

  if (!orders.length) return (
    <div style={S.placeholder}>
      <TrendingUp size={40} color="var(--muted)" />
      <h2 style={{ margin: "14px 0 4px" }}>No revenue yet</h2>
      <p style={{ color: "var(--muted)" }}>Register orders to start tracking revenue.</p>
    </div>
  );

  return (
    <div style={S.dashGrid} className="dash-grid">
      <div style={{ ...S.statRow, gridTemplateColumns: "repeat(2,1fr)" }}>
        <div style={S.statCard}>
          <div style={{ ...S.statIcon, background: "#2dd4bf22", color: "#2dd4bf" }}><Wallet size={20} /></div>
          <div style={S.statVal}>₹{todayRev.toLocaleString()}</div>
          <div style={S.statLabel}>Today's Revenue</div>
        </div>
        <div style={S.statCard}>
          <div style={{ ...S.statIcon, background: "#a855f722", color: "#a855f7" }}><TrendingUp size={20} /></div>
          <div style={S.statVal}>₹{weekRev.toLocaleString()}</div>
          <div style={S.statLabel}>This Week's Revenue</div>
        </div>
      </div>

      <div style={{ ...S.panel, gridColumn: "span 2" }}>
        <PanelHead title="Revenue by Test" />
        {testRows.length === 0 ? <p style={{ color: "var(--muted)", fontSize: 14 }}>No tests yet.</p> : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={testRows} layout="vertical" margin={{ left: 20, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
              <XAxis type="number" stroke="var(--muted)" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => "₹" + v} />
              <YAxis type="category" dataKey="name" stroke="var(--muted)" fontSize={12} tickLine={false} axisLine={false} width={120} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--border)" }} formatter={(v) => "₹" + v} />
              <Bar dataKey="rev" fill="#2dd4bf" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div style={{ ...S.panel, gridColumn: "span 2" }}>
        <PanelHead title="Recent Transactions" />
        <table style={S.table}>
          <thead>
            <tr>{["Order", "Patient", "Date", "Tests", "Amount"].map((h) => <th key={h} style={S.th}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {recent.map((r) => (
              <tr key={r.id} style={S.tr}>
                <td style={S.td}><b>{r.id}</b></td>
                <td style={S.td}>{r.patient.name}</td>
                <td style={{ ...S.td, color: "var(--muted)" }}>{r.created}</td>
                <td style={{ ...S.td, color: "var(--muted)" }}>{r.tests.map((t) => t.name.split(" ")[0]).join(", ")}</td>
                <td style={{ ...S.td, fontWeight: 600 }}>₹{r.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// --- STYLES -----------------------------------------------------------------
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=Outfit:wght@300;400;500;600;700&display=swap');
:root,[data-theme="dark"]{--bg:#0d1117;--panel:#161b22;--card:#1c232d;--ink:#e8edf2;--muted:#8b97a5;--accent:#2dd4bf;--accent2:#0ea5a3;--border:#2a323d;--sidebar:#11161d;}
[data-theme="light"]{--bg:#f4f6fb;--panel:#ffffff;--card:#ffffff;--ink:#1a2230;--muted:#64748b;--accent:#0ea5a3;--accent2:#0d9488;--border:#e6ebf2;--sidebar:#ffffff;}
*{box-sizing:border-box;font-family:'Outfit',sans-serif;margin:0}
body{margin:0}
button{cursor:pointer;border:none;font-family:inherit;transition:all .15s ease}
button:active{transform:scale(0.98)}
tbody tr{transition:background .12s ease}
tbody tr:hover{background:var(--card)}
@keyframes slideIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
@keyframes loadSlide{0%{left:-40%}100%{left:100%}}
input,select{font-family:inherit}
::-webkit-scrollbar{width:8px;height:8px}::-webkit-scrollbar-thumb{background:var(--border);border-radius:4px}
.menu-btn{display:none !important}
.nav-overlay{display:none}
@media (max-width:860px){
  .app-sidebar{position:fixed !important;left:0;top:0;z-index:60;height:100vh !important;transform:translateX(-100%);transition:transform .22s ease;box-shadow:0 10px 40px rgba(0,0,0,.35)}
  .app-sidebar.open{transform:translateX(0)}
  .nav-overlay{display:block;position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:55}
  .menu-btn{display:grid !important}
  .app-topbar{padding:12px 14px !important;gap:10px !important;flex-wrap:wrap}
  .page-title{font-size:19px !important}
  .search-box{order:3;flex-basis:100% !important;max-width:none !important}
  .app-main{padding:14px !important}
  .dash-grid{grid-template-columns:1fr !important}
  .form-grid{grid-template-columns:1fr !important}
  .p-row{grid-template-columns:1fr 1fr !important;row-gap:4px}
  .queue-bar{flex-wrap:wrap}
  .app-main table{display:block;overflow-x:auto;white-space:nowrap}
}
@media (max-width:480px){
  .p-row{grid-template-columns:1fr !important}
  .app-topbar .profile > div:last-child{display:none}
}
`;

const S = {
  shell: { display: "flex", minHeight: "100vh", background: "var(--bg)", color: "var(--ink)" },
  sidebar: { width: 230, background: "var(--sidebar)", borderRight: "1px solid var(--border)", padding: "22px 16px", display: "flex", flexDirection: "column", position: "sticky", top: 0, height: "100vh" },
  brand: { display: "flex", gap: 12, alignItems: "center", padding: "0 6px 22px" },
  logo: { width: 38, height: 38, borderRadius: 11, background: "linear-gradient(135deg,var(--accent),var(--accent2))", display: "grid", placeItems: "center", color: "#04201d" },
  brandName: { fontFamily: "'Fraunces',serif", fontSize: 18, fontWeight: 600 },
  brandSub: { fontSize: 10, color: "var(--muted)", letterSpacing: 1, textTransform: "uppercase" },
  nav: { display: "flex", flexDirection: "column", gap: 4 },
  navItem: { display: "flex", alignItems: "center", gap: 11, padding: "11px 13px", borderRadius: 10, background: "transparent", color: "var(--muted)", fontSize: 14, fontWeight: 500, textAlign: "left", width: "100%" },
  navOn: { background: "var(--accent)", color: "#04201d", fontWeight: 600 },
  toastWrap: { position: "fixed", bottom: 24, right: 24, display: "flex", flexDirection: "column", gap: 10, zIndex: 100 },
  toast: { background: "var(--accent)", color: "#04201d", padding: "12px 18px", borderRadius: 12, fontWeight: 600, fontSize: 14, boxShadow: "0 8px 24px rgba(0,0,0,0.25)", animation: "slideIn .25s ease", minWidth: 200 },
  toastErr: { background: "#f87171", color: "#fff" },
  loadingBar: { position: "relative", height: 3, background: "var(--border)", borderRadius: 3, overflow: "hidden", marginBottom: 18 },
  loadingFill: { position: "absolute", top: 0, height: "100%", width: "40%", background: "var(--accent)", animation: "loadSlide 1s ease infinite", borderRadius: 3 },
  authWrap: { display: "grid", placeItems: "center", minHeight: "100vh", background: "var(--bg)", color: "var(--ink)", padding: 20 },
  authCard: { background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 18, padding: 32, width: "min(380px, 92vw)", textAlign: "center" },
  authLogo: { width: 50, height: 50, borderRadius: 13, margin: "0 auto", background: "linear-gradient(135deg,var(--accent),var(--accent2))", display: "grid", placeItems: "center", color: "#04201d" },
  authBrand: { fontFamily: "'Fraunces',serif", fontSize: 24, fontWeight: 600, marginTop: 12 },
  authSub: { fontSize: 12, color: "var(--muted)", letterSpacing: 1, textTransform: "uppercase", marginTop: 4 },
  pGroup: { border: "1px solid var(--border)", borderRadius: 14, background: "var(--panel)", overflow: "hidden" },
  pHead: { display: "flex", alignItems: "center", gap: 11, padding: "13px 16px", width: "100%", background: "transparent", border: "none", cursor: "pointer", color: "var(--ink)" },
  pAvatar: { width: 34, height: 34, borderRadius: "50%", background: "var(--accent)", color: "#04201d", display: "grid", placeItems: "center", fontWeight: 600, fontSize: 13, flexShrink: 0 },
  pRow: { display: "grid", gridTemplateColumns: "1fr 1.1fr 2fr 0.8fr 1.2fr 1fr", gap: 10, alignItems: "center", padding: "11px 16px 11px 40px", borderTop: "1px solid var(--border)" },
  subNav: { display: "flex", flexDirection: "column", gap: 2, marginLeft: 14, paddingLeft: 12, borderLeft: "1px solid var(--border)", marginTop: 2 },
  subItem: { display: "flex", alignItems: "center", gap: 9, padding: "9px 11px", borderRadius: 8, background: "transparent", color: "var(--muted)", fontSize: 13, fontWeight: 500, textAlign: "left", width: "100%" },
  subItemOn: { background: "var(--bg)", color: "var(--accent)", fontWeight: 600 },
  body: { flex: 1, display: "flex", flexDirection: "column", minWidth: 0 },
  topbar: { display: "flex", alignItems: "center", gap: 18, padding: "16px 26px", borderBottom: "1px solid var(--border)", background: "var(--panel)" },
  pageTitle: { fontFamily: "'Fraunces',serif", fontSize: 24, fontWeight: 600, whiteSpace: "nowrap" },
  searchBox: { flex: 1, maxWidth: 420, display: "flex", alignItems: "center", gap: 8, background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 11, padding: "9px 14px" },
  searchInput: { flex: 1, background: "transparent", border: "none", color: "var(--ink)", fontSize: 14, outline: "none" },
  topRight: { display: "flex", alignItems: "center", gap: 12, marginLeft: "auto" },
  iconBtn: { position: "relative", width: 38, height: 38, borderRadius: 10, background: "var(--bg)", border: "1px solid var(--border)", color: "var(--ink)", display: "grid", placeItems: "center" },
  iconBtnSm: { width: 32, height: 32, borderRadius: 8, background: "var(--bg)", border: "1px solid var(--border)", color: "var(--ink)", display: "grid", placeItems: "center" },
  badge: { position: "absolute", top: -4, right: -4, background: "#f87171", color: "#fff", fontSize: 10, fontWeight: 700, width: 17, height: 17, borderRadius: "50%", display: "grid", placeItems: "center" },
  profile: { display: "flex", alignItems: "center", gap: 9, paddingLeft: 6 },
  avatar: { width: 36, height: 36, borderRadius: "50%", background: "var(--accent)", color: "#04201d", display: "grid", placeItems: "center" },
  main: { padding: 26, overflowY: "auto" },
  apiError: { background: "#3a1212", border: "1px solid #f8717155", color: "#f87171", padding: "10px 26px", fontSize: 13 },

  dashGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 },
  statRow: { gridColumn: "1 / -1", display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16 },
  statCard: { background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 16, padding: 18 },
  statIcon: { width: 46, height: 46, borderRadius: 12, display: "grid", placeItems: "center", marginBottom: 14 },
  statVal: { fontFamily: "'Fraunces',serif", fontSize: 26, fontWeight: 600 },
  statLabel: { fontSize: 13, color: "var(--muted)", marginTop: 2 },
  statSub: { fontSize: 12, color: "var(--accent)", marginTop: 8, fontWeight: 500 },
  panel: { background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 16, padding: 18 },
  panelHead: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  panelTitle: { fontSize: 16, fontWeight: 600 },
  deptLegend: { display: "flex", flexDirection: "column", gap: 9, marginTop: 10 },
  deptItem: { display: "flex", alignItems: "center", gap: 9, fontSize: 13 },
  deptDot: { width: 10, height: 10, borderRadius: 3 },
  table: { width: "100%", borderCollapse: "collapse" },
  th: { textAlign: "left", fontSize: 12, color: "var(--muted)", fontWeight: 500, padding: "10px 8px", borderBottom: "1px solid var(--border)", textTransform: "uppercase", letterSpacing: 0.5 },
  tr: { borderBottom: "1px solid var(--border)" },
  td: { padding: "13px 8px", fontSize: 14 },
  placeholder: { textAlign: "center", padding: "80px 0", display: "flex", flexDirection: "column", alignItems: "center" },

  queueBar: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, gap: 12 },
  linkBtn: { background: "transparent", border: "1px solid var(--border)", color: "var(--ink)", width: 30, height: 30, borderRadius: 8, display: "inline-grid", placeItems: "center", marginRight: 8, verticalAlign: "middle" },

  overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "grid", placeItems: "center", padding: 20, zIndex: 50 },
  modal: { background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 18, padding: 24, width: 480, maxWidth: "100%", maxHeight: "85vh", overflowY: "auto" },
  modalHead: { display: "flex", justifyContent: "space-between", alignItems: "flex-start" },
  histCard: { background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 12, padding: 14 },
  chip: { fontSize: 12, background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 20, padding: "4px 10px" },

  regWrap: { maxWidth: 760, margin: "0 auto" },
  regStepper: { display: "flex", gap: 4, marginBottom: 22 },
  regStepItem: { display: "flex", alignItems: "center", gap: 8, flex: 1 },
  regDot: { width: 28, height: 28, borderRadius: "50%", background: "var(--panel)", border: "1px solid var(--border)", display: "grid", placeItems: "center", fontSize: 13, color: "var(--muted)", flexShrink: 0 },
  regDotOn: { background: "var(--accent)", color: "#04201d", border: "1px solid var(--accent)" },
  regLine: { height: 2, flex: 1 },
  formGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 },
  label: { fontSize: 12, color: "var(--muted)", display: "block", marginBottom: 6 },
  input: { width: "100%", background: "var(--bg)", border: "1px solid var(--border)", color: "var(--ink)", padding: "11px 12px", borderRadius: 10, fontSize: 14 },
  matchNote: { display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--accent)", marginTop: 8 },
  testGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(210px,1fr))", gap: 13 },
  testCard: { background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 13, padding: 15 },
  testCardOn: { borderColor: "var(--accent)", boxShadow: "0 0 0 1px var(--accent)" },
  catTag: { fontSize: 10, color: "var(--accent)", textTransform: "uppercase", letterSpacing: 1, fontWeight: 600 },
  testName: { fontSize: 14, fontWeight: 500, margin: "6px 0 8px", lineHeight: 1.3 },
  metaRow: { fontSize: 12, color: "var(--muted)", display: "flex", alignItems: "center", gap: 4 },
  testFoot: { display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 13 },
  price: { fontFamily: "'Fraunces',serif", fontSize: 17, fontWeight: 600 },
  summary: { background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 13, padding: 16 },
  sumRow: { display: "flex", justifyContent: "space-between", padding: "8px 0", fontSize: 14, borderBottom: "1px solid var(--border)" },
  sumTotal: { borderBottom: "none", fontWeight: 600, fontSize: 16, paddingTop: 12 },
  payRow: { display: "flex", gap: 10, margin: "10px 0", flexWrap: "wrap" },
  payBtn: { flex: 1, minWidth: 110, background: "var(--bg)", border: "1px solid var(--border)", color: "var(--ink)", padding: "13px", borderRadius: 11, display: "flex", gap: 8, alignItems: "center", justifyContent: "center", fontSize: 14 },
  payBtnOn: { borderColor: "var(--accent)", color: "var(--accent)" },
  dueNote: { background: "#3a2a10", border: "1px solid #f59e0b55", color: "#f59e0b", padding: 12, borderRadius: 10, fontSize: 13, marginTop: 12 },
  regNav: { display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 22 },
  btn: { background: "var(--accent)", color: "#04201d", padding: "11px 18px", borderRadius: 10, fontWeight: 600, fontSize: 14, display: "inline-flex", alignItems: "center", gap: 8 },
  btnSm: { background: "var(--accent)", color: "#04201d", padding: "7px 12px", borderRadius: 8, fontSize: 13, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 5, verticalAlign: "middle" },
  btnGhost: { background: "transparent", color: "var(--ink)", padding: "9px 14px", borderRadius: 8, border: "1px solid var(--border)", fontSize: 13, display: "inline-flex", alignItems: "center", gap: 5 },
};

const tooltipStyle = { background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, fontSize: 13, color: "var(--ink)" };
const badge = (s) => {
  const map = { "Registered": "#8b97a5", "Sample Collected": "#f59e0b", "In Lab": "#3b82f6", "Report Ready": "#2dd4bf" };
  return { fontSize: 12, fontWeight: 600, padding: "4px 11px", borderRadius: 20, color: "#04201d", background: map[s] || "#8b97a5", whiteSpace: "nowrap" };
};
