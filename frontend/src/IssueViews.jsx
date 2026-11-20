import React, { useEffect, useState } from "react";
import {
  actions,
  blank,
  formatDay,
  message,
  priorities,
  priorityLabels,
  statusLabels,
  toRecord,
  types,
  validate,
} from "./data.js";

export function Badge({ status }) {
  return <span className={"badge s" + Number(status)}>{statusLabels[Number(status)]}</span>;
}
export function CreateIssue({ account, busy, transact, open }) {
  const [row, setRow] = useState(blank),
    [error, setError] = useState("");
  const bind = (k) => ({
    value: row[k],
    onChange: (e) => setRow({ ...row, [k]: e.target.value }),
  });
  async function submit(e) {
    e.preventDefault();
    const data = Object.fromEntries(Object.entries(row).map(([k, v]) => [k, v.trim()]));
    const problem = validate(data);
    setError(problem);
    if (problem) return;
    if (await transact((w) => w.createIssue(toRecord(data)))) open(data.issueId);
  }
  return (
    <section className="card">
      <header className="cardhead">
        <div>
          <h2>Nouveau signalement</h2>
          <p>
            Décrivez le problème avec des données fictives. Votre déclaration sera consultable
            publiquement.
          </p>
        </div>
      </header>
      <form onSubmit={submit} className="gridform">
        <label>
          Identifiant
          <input required placeholder="CITY-2026-001" maxLength="32" {...bind("issueId")} />
        </label>
        <label>
          Type de problème
          <select {...bind("issueType")}>
            {Object.entries(types).map(([k, t]) => (
              <option key={k} value={k}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label className="wide">
          Localisation
          <input required placeholder="Avenue Mohammed V, Tanger" {...bind("location")} />
        </label>
        <label className="wide">
          Description
          <textarea
            required
            placeholder="Quel problème avez-vous constaté ?"
            {...bind("description")}
          />
        </label>
        <label>
          Date du signalement
          <input
            required
            type="date"
            min="2000-01-01"
            max="2099-12-31"
            {...bind("reportDate")}
          />
        </label>
        <label>
          Priorité
          <select {...bind("priority")}>
            {priorities.map((v, i) => (
              <option key={v} value={v}>
                {priorityLabels[i]}
              </option>
            ))}
          </select>
        </label>
        <label className="wide">
          Pseudonyme fictif
          <input required placeholder="Citizen01" {...bind("reportedBy")} />
        </label>
        {error && (
          <p className="notice error wide" role="alert">
            {error}
          </p>
        )}
        <div className="wide footerline">
          <span>
            {account
              ? "La transaction sera signée par votre portefeuille."
              : "Connectez un portefeuille pour publier."}
          </span>
          <button disabled={!account || busy}>Publier le signalement</button>
        </div>
      </form>
    </section>
  );
}
function Municipality({ row, transact, busy, refresh }) {
  const id = row.issueId,
    status = Number(row.status);
  const [team, setTeam] = useState(""),
    [note, setNote] = useState(""),
    [mode, setMode] = useState("");
  const assign = status === 0 || mode === "team";
  if (status === 4) return null;
  async function save(e) {
    e.preventDefault();
    if (
      await transact((w) =>
        assign
          ? w.assignTeam(id, team.trim(), note.trim())
          : w.updateStatus(id, status + 1, note.trim())
      )
    ) {
      setTeam("");
      setNote("");
      setMode("");
      refresh();
    }
  }
  return (
    <section className="card">
      <header className="cardhead">
        <div>
          <h2>Intervention municipale</h2>
          <p>Chaque opération ajoute une entrée signée à l’historique.</p>
        </div>
      </header>
      <form className="gridform" onSubmit={save}>
        {(status === 1 || status === 2) && (
          <label className="wide">
            Opération
            <select value={mode} onChange={(e) => setMode(e.target.value)}>
              <option value="">Passer au statut « {statusLabels[status + 1]} »</option>
              <option value="team">Réaffecter l’équipe</option>
            </select>
          </label>
        )}
        {assign && (
          <label className="wide">
            Équipe d’intervention
            <input
              required
              value={team}
              placeholder={row.assignedTo || "UrbanTeam01"}
              onChange={(e) => setTeam(e.target.value)}
            />
          </label>
        )}
        <label className="wide">
          Commentaire d’intervention
          <input
            required
            value={note}
            placeholder="Décrivez l’action réalisée"
            onChange={(e) => setNote(e.target.value)}
          />
        </label>
        <div className="wide">
          <button disabled={busy || !note.trim() || (assign && !team.trim())}>
            {assign
              ? "Affecter l’équipe"
              : "Passer au statut « " + statusLabels[status + 1] + " »"}
          </button>
        </div>
      </form>
    </section>
  );
}
export function IssueDetail({ id, registry, isCity, transact, busy, back, revision }) {
  const [item, setItem] = useState(null),
    [history, setHistory] = useState([]),
    [error, setError] = useState(""),
    [tick, refresh] = useState(0);
  useEffect(() => {
    let active = true;
    setError("");
    if (!registry) return;
    Promise.all([registry.getIssue(id), registry.getHistory(id)])
      .then(([row, h]) => {
        if (active) {
          setItem(row);
          setHistory(h);
        }
      })
      .catch((e) => {
        if (active) setError(message(e));
      });
    return () => {
      active = false;
    };
  }, [id, registry, revision, tick]);
  return (
    <>
      <button className="back" onClick={back}>
        ← Retour au registre
      </button>
      {error && (
        <p role="alert" className="notice error">
          {error}
        </p>
      )}
      {item && (
        <>
          <section className="card">
            <header className="cardhead">
              <div>
                <div className="mono">{item.issueId}</div>
                <h2>
                  {types[item.issueType] || item.issueType} · {item.location}
                </h2>
              </div>
              <Badge status={item.status} />
            </header>
            <p className="description">{item.description}</p>
            <dl className="facts">
              {[
                ["Priorité", priorityLabels[Number(item.priority)]],
                ["Date déclarée", formatDay(item.reportDay)],
                ["Déclaré par", item.reportedBy],
                ["Équipe", item.assignedTo || "À affecter"],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
          </section>
          {isCity && (
            <Municipality
              key={id}
              row={item}
              transact={transact}
              busy={busy}
              refresh={() => refresh(tick + 1)}
            />
          )}
          <section className="card">
            <header className="cardhead">
              <div>
                <h2>Historique des interventions</h2>
                <p>
                  Actions inscrites sur la blockchain, de la plus récente à la plus ancienne.
                </p>
              </div>
              <span className="number">{history.length}</span>
            </header>
            <ol className="timeline">
              {Array.from(history)
                .reverse()
                .map((entry, i) => (
                  <li key={history.length - i}>
                    <div className="timelineTitle">
                      <b>{actions[Number(entry.action)]}</b>
                      <Badge status={entry.status} />
                    </div>
                    {entry.comment && <p>{entry.comment}</p>}
                    {entry.team && <small>Équipe · {entry.team}</small>}
                    <small>
                      {new Date(Number(entry.timestamp) * 1000).toLocaleString("fr-FR")} ·{" "}
                      <span className="actor" title={entry.actor}>
                        {entry.actor}
                      </span>
                    </small>
                  </li>
                ))}
            </ol>
          </section>
        </>
      )}
      {!item && !error && <p>Chargement de la fiche…</p>}
    </>
  );
}
export function Register({ registry, revision, open, busy, refresh }) {
  const [page, setPage] = useState(0),
    [rows, setRows] = useState([]),
    [counts, setCounts] = useState(null);
  const [query, setQuery] = useState(""),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!registry) return;
    let active = true;
    setLoading(true);
    setError("");
    (async () => {
      const totals = await Promise.all([
        registry.issueCount(),
        registry.countByStatus(0),
        registry.countByStatus(3),
        registry.countByStatus(4),
      ]);
      const [all, reported, resolved, closed] = totals.map(Number),
        end = Math.max(0, all - page * 8);
      const ids = await Promise.all(
        Array.from({ length: Math.min(8, end) }, (_, i) => registry.idAt(end - i - 1))
      );
      const data = await Promise.all(ids.map((id) => registry.getIssue(id)));
      if (active) {
        setRows(data);
        setCounts([all, reported, resolved + closed]);
      }
    })()
      .catch((e) => {
        if (active) setError(message(e));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [registry, revision, page]);
  async function search(e) {
    e.preventDefault();
    let id = query.trim().toUpperCase();
    if (!id || !registry) return;
    try {
      if (await registry.exists(id)) {
        setError("");
        open(id);
      } else setError("Aucun signalement pour " + id + ".");
    } catch (e) {
      setError(message(e));
    }
  }
  return (
    <>
      <div className="stats">
        {["Signalements", "En attente d’affectation", "Résolus ou clôturés"].map((t, i) => (
          <div className={"stat stat" + i} key={t}>
            <span>{t}</span>
            <strong>{counts ? counts[i] : "—"}</strong>
          </div>
        ))}
      </div>
      <section className="card">
        <header className="cardhead">
          <div>
            <h2>Signalements récents</h2>
            <p>Ouvrez une fiche pour consulter ses interventions.</p>
          </div>
          <button disabled={busy} className="secondary" onClick={refresh}>
            Actualiser
          </button>
        </header>
        <form className="search" onSubmit={search}>
          <input
            aria-label="Identifiant à rechercher"
            placeholder="Rechercher par identifiant exact…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button className="secondary" disabled={!registry || !query.trim()}>
            Rechercher
          </button>
        </form>
        {error && (
          <p role="alert" className="notice error">
            {error}
          </p>
        )}
        <div className="scroll">
          <table>
            <thead>
              <tr>
                <th>Signalement</th>
                <th>Localisation</th>
                <th>Priorité</th>
                <th>Statut</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.issueId}>
                  <td>
                    <button className="rowlink" onClick={() => open(r.issueId)}>
                      {r.issueId}
                    </button>
                    <small>{types[r.issueType] || r.issueType}</small>
                  </td>
                  <td>{r.location}</td>
                  <td>{priorityLabels[Number(r.priority)]}</td>
                  <td>
                    <Badge status={r.status} />
                  </td>
                  <td>
                    <button
                      className="openbtn"
                      aria-label={"Ouvrir " + r.issueId}
                      onClick={() => open(r.issueId)}
                    >
                      ↗
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!rows.length && (
          <p className="empty">
            {loading
              ? "Lecture du réseau…"
              : "Le registre est vide. Vous pouvez déclarer un problème ou importer le fichier d’exemple."}
          </p>
        )}
        {counts && counts[0] > 8 && (
          <div className="footerline">
            <button className="secondary" disabled={!page} onClick={() => setPage(page - 1)}>
              Précédent
            </button>
            <span>
              Page {page + 1} sur {Math.ceil(counts[0] / 8)}
            </span>
            <button
              className="secondary"
              disabled={(page + 1) * 8 >= counts[0]}
              onClick={() => setPage(page + 1)}
            >
              Suivant
            </button>
          </div>
        )}
      </section>
    </>
  );
}
