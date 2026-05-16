import { supabaseAdmin } from "./supabaseAdmin";

export type CellRun = { text: string; bold: boolean };
export type Cell = { runs: CellRun[] };

export type CannesSnapshot = {
    headers: string[];
    rows: Cell[][];
    updatedAt: string;
};

const SHEETS_BASE = "https://sheets.googleapis.com/v4/spreadsheets";

type SheetCell = {
    formattedValue?: string;
    textFormatRuns?: Array<{ startIndex?: number; format?: { bold?: boolean } }>;
    effectiveFormat?: { textFormat?: { bold?: boolean } };
};

function cellToParsed(raw: SheetCell | undefined): Cell {
    const text = (raw?.formattedValue ?? "").toString();
    if (text === "") return { runs: [] };

    const cellBold = !!raw?.effectiveFormat?.textFormat?.bold;
    const runs = raw?.textFormatRuns ?? [];

    if (runs.length === 0) {
        return { runs: [{ text, bold: cellBold }] };
    }

    const sorted = [...runs].sort((a, b) => (a.startIndex ?? 0) - (b.startIndex ?? 0));
    if ((sorted[0].startIndex ?? 0) !== 0) {
        sorted.unshift({ startIndex: 0, format: {} });
    }

    const parsed: CellRun[] = [];
    for (let i = 0; i < sorted.length; i++) {
        const start = sorted[i].startIndex ?? 0;
        const end = i + 1 < sorted.length ? (sorted[i + 1].startIndex ?? 0) : text.length;
        if (end <= start) continue;
        const fragment = text.slice(start, end);
        const fmt = sorted[i].format ?? {};
        const bold = fmt.bold !== undefined ? !!fmt.bold : cellBold;
        parsed.push({ text: fragment, bold });
    }
    return { runs: parsed };
}

export async function fetchSheetValues(): Promise<{ headers: string[]; rows: Cell[][] }> {
    const apiKey = import.meta.env.GOOGLE_API_KEY;
    const sheetId = import.meta.env.CANNES_SHEET_ID;
    const range = import.meta.env.CANNES_SHEET_RANGE;

    if (!apiKey || !sheetId || !range) {
        throw new Error("Faltan variables de entorno: GOOGLE_API_KEY, CANNES_SHEET_ID o CANNES_SHEET_RANGE.");
    }

    const fields = "sheets.data.rowData.values(formattedValue,textFormatRuns,effectiveFormat.textFormat.bold)";
    const url = `${SHEETS_BASE}/${encodeURIComponent(sheetId)}?ranges=${encodeURIComponent(range)}&fields=${encodeURIComponent(fields)}&key=${encodeURIComponent(apiKey)}`;
    const res = await fetch(url);
    if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`Google Sheets API ${res.status}: ${body.slice(0, 200)}`);
    }

    const json = (await res.json()) as {
        sheets?: Array<{ data?: Array<{ rowData?: Array<{ values?: SheetCell[] }> }> }>;
    };

    const rowData = json?.sheets?.[0]?.data?.[0]?.rowData ?? [];
    if (rowData.length === 0) {
        return { headers: [], rows: [] };
    }

    const headerCells = rowData[0]?.values ?? [];
    const headers = headerCells.map((v) => (v?.formattedValue ?? "").toString().trim());
    const colCount = headers.length;

    const rows: Cell[][] = [];
    for (let r = 1; r < rowData.length; r++) {
        const rowCells = rowData[r]?.values ?? [];
        const row: Cell[] = [];
        for (let c = 0; c < colCount; c++) {
            row.push(cellToParsed(rowCells[c]));
        }
        const hasContent = row.some((cell) => cell.runs.some((rn) => rn.text.trim() !== ""));
        if (hasContent) rows.push(row);
    }

    return { headers, rows };
}

// Para snapshots viejos con shape string[][]
function migrateRows(rawRows: unknown): Cell[][] {
    if (!Array.isArray(rawRows)) return [];
    return rawRows.map((row): Cell[] => {
        if (!Array.isArray(row)) return [];
        return row.map((cell): Cell => {
            if (typeof cell === "string") {
                return { runs: cell === "" ? [] : [{ text: cell, bold: false }] };
            }
            if (cell && typeof cell === "object" && Array.isArray((cell as { runs?: unknown }).runs)) {
                const runs = (cell as { runs: unknown[] }).runs;
                return {
                    runs: runs.map((r: any) => ({
                        text: (r?.text ?? "").toString(),
                        bold: !!r?.bold,
                    })),
                };
            }
            return { runs: [] };
        });
    });
}

export async function saveSnapshot(data: { headers: string[]; rows: Cell[][] }): Promise<CannesSnapshot> {
    if (!supabaseAdmin) {
        throw new Error("Supabase admin no está configurado.");
    }

    const updatedAt = new Date().toISOString();
    const { error } = await supabaseAdmin
        .from("cannes_snapshot")
        .upsert({ id: 1, data, updated_at: updatedAt }, { onConflict: "id" });

    if (error) {
        throw new Error(`Error al guardar snapshot: ${error.message}`);
    }

    return { headers: data.headers, rows: data.rows, updatedAt };
}

export async function getSnapshot(): Promise<CannesSnapshot> {
    if (!supabaseAdmin) {
        return { headers: [], rows: [], updatedAt: "" };
    }

    const { data, error } = await supabaseAdmin
        .from("cannes_snapshot")
        .select("data, updated_at")
        .eq("id", 1)
        .maybeSingle();

    if (error || !data) {
        return { headers: [], rows: [], updatedAt: "" };
    }

    const payload = (data.data ?? {}) as { headers?: string[]; rows?: unknown };
    return {
        headers: payload.headers ?? [],
        rows: migrateRows(payload.rows),
        updatedAt: data.updated_at ?? "",
    };
}
