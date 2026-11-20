import * as XLSX from "xlsx";
import { columns, validate } from "./data.js";

export async function readRows(file, registry) {
  if (!/\.(xlsx|csv)$/i.test(file.name)) throw Error("Choisissez un fichier .xlsx ou .csv.");
  if (file.size > 5 * 1024 * 1024) throw Error("Limite de lecture : 5 Mo par fichier.");
  const book = XLSX.read(await file.arrayBuffer(), {
    type: "array",
    raw: true,
    codepage: 65001,
  });
  const sheet = book.Sheets[book.SheetNames[0]];
  if (!sheet || !sheet["!ref"]) throw Error("La première feuille est vide.");
  const range = XLSX.utils.decode_range(sheet["!ref"]);
  if (range.e.r - range.s.r > 1000 || range.e.c - range.s.c > 100)
    throw Error("Aperçu limité à 1 000 lignes et 101 colonnes.");
  const [header = [], ...matrix] = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: "",
    blankrows: true,
    raw: true,
  });
  const names = header.map((x) =>
    String(x)
      .replace(/^\uFEFF/, "")
      .trim()
  );
  for (const name of columns)
    if (names.filter((x) => x === name).length !== 1)
      throw Error("Colonne absente ou répétée : " + name);
  const rows = [];
  for (const [i, cells] of matrix.entries()) {
    if (cells.every((x) => String(x).trim() === "")) continue;
    const data = Object.fromEntries(
      columns.map((k) => [k, String(cells[names.indexOf(k)] ?? "").trim()])
    );
    const serial = cells[names.indexOf("reportDate")];
    if (typeof serial === "number") {
      const d = XLSX.SSF.parse_date_code(serial, {
        date1904: !!book.Workbook?.WBProps?.date1904,
      });
      if (d)
        data.reportDate = [
          d.y,
          String(d.m).padStart(2, "0"),
          String(d.d).padStart(2, "0"),
        ].join("-");
    }
    rows.push({ line: range.s.r + i + 2, data, error: validate(data) });
  }
  if (!rows.length) throw Error("Le fichier contient uniquement les en-têtes.");
  const frequencies = new Map();
  for (const { data } of rows)
    frequencies.set(data.issueId, (frequencies.get(data.issueId) || 0) + 1);
  for (const row of rows)
    if (frequencies.get(row.data.issueId) > 1)
      row.error ||= "Identifiant répété dans le fichier.";
  const candidates = rows.filter((x) => !x.error);
  for (let i = 0; i < candidates.length; i += 20) {
    await Promise.all(
      candidates.slice(i, i + 20).map(async (row) => {
        if (await registry.exists(row.data.issueId)) row.error = "Identifiant déjà enregistré.";
      })
    );
  }
  return rows;
}
