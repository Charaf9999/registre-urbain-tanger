export const columns = [
  "issueId",
  "issueType",
  "location",
  "description",
  "reportDate",
  "priority",
  "reportedBy",
  "assignedTo",
  "status",
];
export const priorities = ["Low", "Medium", "High"];
export const statuses = ["Reported", "Assigned", "InProgress", "Resolved", "Closed"];
export const statusLabels = ["Déclaré", "Affecté", "En cours", "Résolu", "Clôturé"];
export const priorityLabels = ["Basse", "Moyenne", "Haute"];
export const types = {
  StreetLight: "Éclairage",
  Road: "Voirie",
  Waste: "Propreté",
  Water: "Eau",
  GreenSpace: "Espaces verts",
};
export const actions = [
  "Déclaration",
  "Import du fichier",
  "Affectation",
  "Changement de statut",
];
export const formatDay = (day) =>
  new Date(Number(day) * 86400000).toLocaleDateString("fr-FR", { timeZone: "UTC" });
export const shortAddress = (s) => (s ? s.slice(0, 6) + "…" + s.slice(-4) : "");
export const blank = () => ({
  issueId: "",
  issueType: "StreetLight",
  location: "",
  description: "",
  reportDate: new Date().toLocaleDateString("en-CA"),
  priority: "Medium",
  reportedBy: "",
  assignedTo: "",
  status: "Reported",
});

export function validate(row) {
  if (!/^[A-Z0-9-]{1,32}$/.test(row.issueId))
    return "Identifiant attendu en majuscules (A–Z, 0–9, tiret), 32 caractères maximum.";
  for (const [field, max] of Object.entries({
    issueType: 64,
    location: 120,
    description: 280,
    reportedBy: 64,
    assignedTo: 64,
  })) {
    if (field === "assignedTo" && !row[field]) continue;
    if (!row[field]?.trim() || new TextEncoder().encode(row[field]).length > max)
      return "Champ " + field + " vide ou trop long (" + max + " octets maximum).";
  }
  if (!/^20\d\d-\d\d-\d\d$/.test(row.reportDate))
    return "Date attendue au format AAAA-MM-JJ entre 2000 et 2099.";
  const date = new Date(row.reportDate + "T00:00:00Z");
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== row.reportDate)
    return "Date impossible.";
  if (!priorities.includes(row.priority)) return "Priorité attendue : Low, Medium ou High.";
  if (!statuses.includes(row.status)) return "Statut inconnu.";
  if (row.status !== "Reported" && !row.assignedTo)
    return "Une équipe est requise pour ce statut.";
  return "";
}
export function toRecord(row) {
  return {
    ...row,
    reportDay: Date.parse(row.reportDate + "T00:00:00Z") / 86400000,
    status: statuses.indexOf(row.status),
    priority: priorities.indexOf(row.priority),
  };
}
export function message(error) {
  const code = error?.info?.error?.code ?? error?.code;
  if (code === 4001 || code === "ACTION_REJECTED")
    return "Demande refusée dans le portefeuille.";
  return error?.reason || error?.shortMessage || error?.message || String(error);
}
