import React, { useState } from "react";
import { message, statusLabels, statuses, toRecord } from "./data.js";

export default function ImportPanel({ registry, account, isCity, transact, busy }) {
  const [rows, setRows] = useState([]),
    [chosen, choose] = useState([]),
    [reading, setReading] = useState(false);
  const [name, setName] = useState(""),
    [error, setError] = useState("");
  const restricted = (r) => r.data.status !== "Reported" || !!r.data.assignedTo;
  const eligible = (r) => !r.error && (!restricted(r) || isCity) && !r.done;
  const selected = rows.filter((r) => chosen.includes(r.line) && eligible(r));
  async function load(file) {
    if (!file) return;
    setReading(true);
    setRows([]);
    choose([]);
    setError("");
    setName(file.name);
    try {
      const { readRows } = await import("./importer.js");
      setRows(await readRows(file, registry));
    } catch (e) {
      setError(message(e));
    } finally {
      setReading(false);
    }
  }
  async function commit() {
    if (!selected.length || selected.length > 10) return;
    const ids = selected.map((r) => r.line);
    const ok = await transact((w) => w.importIssues(selected.map((r) => toRecord(r.data))));
    if (ok) {
      setRows((rs) => rs.map((r) => (ids.includes(r.line) ? { ...r, done: true } : r)));
      choose([]);
    }
  }
  return (
    <section className="card">
      <header className="cardhead">
        <div>
          <h2>Importer des signalements</h2>
          <p>
            Prévisualisez la première feuille, puis sélectionnez jusqu’à 10 lignes par
            transaction.
          </p>
        </div>
        <a className="link" href="/urban_issues.xlsx" download>
          Télécharger le modèle ↓
        </a>
      </header>
      <div className="filebox">
        <label className="button secondary">
          Choisir un fichier
          <input
            type="file"
            accept=".xlsx,.csv"
            disabled={busy || reading || !registry}
            onChange={(e) => {
              load(e.target.files[0]);
              e.target.value = "";
            }}
          />
        </label>
        <span>{name || "Excel (.xlsx) ou CSV"}</span>
      </div>
      {reading && <p role="status">Vérification des lignes et des identifiants sur chaîne…</p>}
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      {!!rows.length && (
        <>
          <div className="sectionline">
            <h3>Aperçu du fichier</h3>
            <span>{rows.length} lignes</span>
          </div>
          <div className="scroll">
            <table>
              <thead>
                <tr>
                  <th>Choix</th>
                  <th>Identifiant / lieu</th>
                  <th>Type / description</th>
                  <th>Date / priorité</th>
                  <th>Alias / équipe</th>
                  <th>Statut</th>
                  <th>Contrôle</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.line}>
                    <td>
                      <input
                        type="checkbox"
                        aria-label={"Sélectionner " + r.data.issueId}
                        checked={selected.some((s) => s.line === r.line)}
                        disabled={
                          busy ||
                          !eligible(r) ||
                          (!chosen.includes(r.line) && selected.length >= 10)
                        }
                        onChange={(e) =>
                          choose(
                            e.target.checked
                              ? [...chosen, r.line]
                              : chosen.filter((x) => x !== r.line)
                          )
                        }
                      />
                    </td>
                    <td>
                      <b>{r.data.issueId}</b>
                      <small>{r.data.location}</small>
                    </td>
                    <td>
                      {r.data.issueType}
                      <small>{r.data.description}</small>
                    </td>
                    <td>
                      {r.data.reportDate}
                      <small>{r.data.priority}</small>
                    </td>
                    <td>
                      {r.data.reportedBy}
                      <small>{r.data.assignedTo || "—"}</small>
                    </td>
                    <td>{statusLabels[statuses.indexOf(r.data.status)] || r.data.status}</td>
                    <td>
                      <span className={r.error ? "bad" : "good"}>
                        {r.error ||
                          (r.done
                            ? "Enregistré"
                            : restricted(r) && !isCity
                            ? "Accès municipal requis"
                            : "Valide")}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="footerline">
            <span>{selected.length} sélectionné(s)</span>
            <button disabled={!account || !selected.length || busy} onClick={commit}>
              Enregistrer la sélection
            </button>
          </div>
        </>
      )}
    </section>
  );
}
