import React from "react";

// ---------------------------------------------------------------------------
// ReportView — printable lab report matching Sai Pathology Lab format.
// Drop your 3 images into client/public/ :
//   logo.png        (the colored "SAI PATHOLOGY LAB" header logo)
//   iso-badge.png   (the ISO 9001:2015 badge)
//   signature.png   (Dr. Tetambe's signature)
// Then this renders an exact-style report. Print with window.print().
// ---------------------------------------------------------------------------

const LAB = {
  name: "SAI PATHOLOGY LAB",
  tagline: "(COMPUTERISED)",
  addr1: "NEAR LAXMI MATA MANDIR MAIN ROAD RANJANGAON (SP),",
  addr2: "TQ. GANGAPUR, DIST. CHH. SAMBHAJINAGAR-431136",
  contact: "7020337412",
  doctor: "Dr. S. H. TETAMBE",
  doctorTitle: "(M.D. PATHOLOGIST)",
  footer: "Note: Laboratory Does Not Responsibility Of Patient's Identity, This Documents Is Not Valid For Medico Legal Case.",
};

// order = { patientId, sampleId, name, age, sex, ref, regDate, reportDate, groups }
// groups = [{ heading?, rows: [{ name, method, result, unit, refLow, refHigh }] }]
export default function ReportView({ order, onClose }) {
  return (
    <div style={S.screen}>
      <style>{PRINT_CSS}</style>

      <div style={S.toolbar} className="no-print">
        <button style={S.btnGhost} onClick={onClose}>Close</button>
        <button style={S.btn} onClick={() => window.print()}>Print / Save PDF</button>
      </div>

      <div style={S.page} id="report-page">
        {/* HEADER */}
        <div style={S.header}>
          <img src="/logo.png" alt="logo" style={S.logo}
            onError={(e) => { e.target.style.display = "none"; }} />
          <div style={S.headerText}>
            <div style={S.labName}>{LAB.name}</div>
            <div style={S.tagline}>{LAB.tagline}</div>
            <div style={S.addr}>{LAB.addr1}</div>
            <div style={S.addr}>{LAB.addr2}</div>
          </div>
        </div>
        <div style={S.contactBar}>Contact No. :- {LAB.contact}</div>

        {/* PATIENT BLOCK */}
        <div style={S.patientBlock}>
          <div style={S.patCol}>
            <Row k="Patient ID" v={order.patientId} />
            <Row k="Name" v={order.name} bold />
            <Row k="Age/Gender" v={`${order.age} Yrs/${order.sex}`} />
            <Row k="Ref. Dr." v={order.ref || "Self"} />
          </div>
          <div style={S.patCol}>
            <Row k="Sample ID" v={order.sampleId} />
            <Row k="Registration Date" v={order.regDate} />
            <Row k="Report Date" v={order.reportDate} />
          </div>
          <div style={S.qrBox}>QR</div>
        </div>

        {/* RESULTS TABLE HEADER */}
        <div style={S.tableHead}>
          <div style={{ flex: 3 }}>Test Description</div>
          <div style={{ flex: 1.5 }}>Result</div>
          <div style={{ flex: 1.2 }}>Unit</div>
          <div style={{ flex: 2 }}>Bio. Reference Ranges</div>
        </div>

        {/* RESULTS */}
        <div style={S.results}>
          {order.groups.map((g, gi) => (
            <div key={gi} className={gi > 0 ? "page-break" : ""} style={gi > 0 ? { paddingTop: 12 } : {}}>
              {g.heading && <div style={S.groupHeading}>{g.heading}</div>}
              {g.rows.length === 0 && <div style={{ color: "#888", fontSize: 12, fontStyle: "italic", padding: "8px 0" }}>No results entered for this test yet.</div>}
              {g.rows.map((r, ri) => {
                const val = parseFloat(r.result);
                const high = !isNaN(val) && r.refHigh != null && val > r.refHigh;
                const low = !isNaN(val) && r.refLow != null && val < r.refLow;
                return (
                  <div key={ri} style={S.resultRow}>
                    <div style={{ flex: 3 }}>
                      <div style={S.paramName}>{r.name}</div>
                      {r.method && <div style={S.method}>Method: {r.method}</div>}
                    </div>
                    <div style={{ flex: 1.5 }}>
                      <span style={{ fontWeight: high || low ? 700 : 400 }}>{r.result}</span>
                      {high && <span style={S.arrow}> &#8593;</span>}
                      {low && <span style={S.arrow}> &#8595;</span>}
                    </div>
                    <div style={{ flex: 1.2 }}>{r.unit}</div>
                    <div style={{ flex: 2 }}>
                      {r.refLow != null && r.refHigh != null ? `${r.refLow} - ${r.refHigh}` : ""}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
          <div style={S.endLine}>**** End of the report. ****</div>
          <div style={S.correlate}>Please correlate clinically.</div>
        </div>

        {/* FOOTER */}
        <div style={S.footerArea}>
          <div style={S.footerSide} />
          <div style={S.footerCenter}>
            <img src="/iso-badge.png" alt="ISO" style={S.iso}
              onError={(e) => { e.target.style.display = "none"; }} />
          </div>
          <div style={S.sign}>
            <img src="/signature.png" alt="sign" style={S.signImg}
              onError={(e) => { e.target.style.display = "none"; }} />
            <div style={S.docName}>{LAB.doctor}</div>
            <div style={S.docTitle}>{LAB.doctorTitle}</div>
          </div>
        </div>
        <div style={S.disclaimer}>{LAB.footer}</div>
      </div>
    </div>
  );
}

function Row({ k, v, bold }) {
  return (
    <div style={S.kv}>
      <span style={S.k}>{k}</span>
      <span style={S.colon}>:</span>
      <span style={{ ...S.v, fontWeight: bold ? 700 : 400 }}>{v}</span>
    </div>
  );
}

const PRINT_CSS = `
@media print {
  body * { visibility: hidden !important; }
  #report-page, #report-page * { visibility: visible !important; }
  #report-page {
    position: absolute !important;
    left: 0 !important; top: 0 !important;
    width: 100% !important;
    min-height: 100vh !important;
    margin: 0 !important;
    box-shadow: none !important;
  }
  .no-print { display: none !important; }
}
@page { size: A4; margin: 10mm; }
@media print { .page-break { break-before: page; page-break-before: always; } }
`;

const S = {
  screen: { background: "#525659", minHeight: "100vh", padding: 24, display: "flex", flexDirection: "column", alignItems: "center" },
  toolbar: { display: "flex", gap: 10, marginBottom: 18 },
  btn: { background: "#2dd4bf", color: "#04201d", padding: "10px 18px", borderRadius: 8, fontWeight: 600, border: "none", cursor: "pointer", fontSize: 14 },
  btnGhost: { background: "#fff", color: "#333", padding: "10px 18px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 14 },
  page: { background: "#fff", color: "#000", width: 794, minHeight: 1123, padding: "0 0 20px", fontFamily: "Arial, sans-serif", fontSize: 13, boxShadow: "0 4px 24px rgba(0,0,0,0.4)", display: "flex", flexDirection: "column" },
  header: { display: "flex", alignItems: "center", gap: 16, padding: "16px 24px 8px" },
  logo: { height: 70, objectFit: "contain" },
  headerText: { flex: 1, textAlign: "center" },
  labName: { fontSize: 30, fontWeight: 800, color: "#e11d48", letterSpacing: 1, fontFamily: "Arial Black, Arial, sans-serif" },
  tagline: { fontSize: 11, fontWeight: 700, color: "#0891b2", marginTop: -2 },
  addr: { fontSize: 12, fontWeight: 600, color: "#111", marginTop: 2 },
  contactBar: { background: "#06b6d4", color: "#fff", textAlign: "right", fontWeight: 700, fontSize: 14, padding: "4px 24px" },
  patientBlock: { display: "flex", padding: "14px 24px", gap: 20, borderBottom: "2px solid #1e3a8a" },
  patCol: { flex: 1, display: "flex", flexDirection: "column", gap: 4 },
  qrBox: { width: 70, height: 70, border: "1px solid #ccc", display: "grid", placeItems: "center", fontSize: 11, color: "#999" },
  kv: { display: "flex", fontSize: 13 },
  k: { width: 110, color: "#000" },
  colon: { width: 10 },
  v: { flex: 1 },
  tableHead: { display: "flex", background: "#f1f5f9", fontWeight: 700, padding: "8px 24px", fontSize: 13, borderBottom: "2px solid #1e3a8a" },
  results: { padding: "12px 24px", flex: 1 },
  groupHeading: { fontWeight: 700, fontSize: 15, margin: "4px 0 10px", color: "#1e3a8a" },
  resultRow: { display: "flex", alignItems: "flex-start", padding: "10px 0", fontSize: 13 },
  paramName: { fontWeight: 700 },
  method: { fontSize: 10, fontStyle: "italic", color: "#444", marginTop: 1 },
  arrow: { color: "#dc2626", fontWeight: 700 },
  endLine: { textAlign: "center", marginTop: 24, fontSize: 12 },
  correlate: { textAlign: "center", fontSize: 12 },
  footerArea: { display: "flex", justifyContent: "space-between", alignItems: "flex-end", padding: "40px 40px 8px", marginTop: "auto" },
  footerSide: { flex: 1 },
  footerCenter: { flex: 1, display: "flex", justifyContent: "center" },
  iso: { height: 64, objectFit: "contain" },
  sign: { flex: 1, textAlign: "right" },
  signImg: { height: 40, objectFit: "contain" },
  docName: { fontWeight: 700, fontSize: 13, marginTop: 2 },
  docTitle: { fontWeight: 700, fontSize: 12 },
  disclaimer: { textAlign: "center", fontWeight: 700, fontSize: 11, borderTop: "1px solid #000", padding: "8px 24px 0", margin: "0 24px" },
};
