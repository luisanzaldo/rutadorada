import { supabaseAdmin } from "./supabaseAdmin";

export type CellRun = { text: string; bold: boolean };
export type Cell = { runs: CellRun[] };

export type RatingsSnapshot = {
    headers: string[];
    rows: Cell[][];
    updatedAt: string;
};

export type FestivalKey = "cannes" | "fall";

export type FestivalConfig = {
    key: FestivalKey;
    /** Rango A1 dentro del Google Sheet. La primera fila del rango son los encabezados. */
    range: string;
    /** Columna del promedio: la que se pinta en dorado en la tabla y en el póster. */
    highlightColumn: number;
};

// Los rangos se leen con acceso estático a import.meta.env a propósito: Vite solo
// sustituye la propiedad literal al construir, así que un acceso dinámico
// (import.meta.env[nombre]) llegaría vacío en Cloudflare Workers.
//
// El rango de otoño trae un valor por defecto en código porque no es un secreto:
// así el despliegue funciona aunque el secret de GitHub no exista, en vez de
// fallar en silencio con undefined.
//
// Va holgado (hasta la fila 200) a propósito: las películas se agregan durante la
// temporada y fetchSheetValues descarta las filas vacías, así que sobrar filas no
// cuesta nada y evita tener que tocar el rango cada vez que crece la tabla.
export const FESTIVALS: Record<FestivalKey, FestivalConfig> = {
    cannes: {
        key: "cannes",
        range: import.meta.env.CANNES_SHEET_RANGE,
        highlightColumn: 1,
    },
    fall: {
        key: "fall",
        range: import.meta.env.FALL_SHEET_RANGE || "FallFestivals2026!A1:F200",
        highlightColumn: 2,
    },
};

export const FESTIVAL_KEYS = Object.keys(FESTIVALS) as FestivalKey[];

export function isFestivalKey(value: string | null | undefined): value is FestivalKey {
    return !!value && Object.prototype.hasOwnProperty.call(FESTIVALS, value);
}

const SHEETS_BASE = "https://sheets.googleapis.com/v4/spreadsheets";

// Ambos festivales viven en el mismo documento, así que solo cambia el rango.
const SNAPSHOT_ROW_ID = 1;

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

export async function fetchSheetValues(festival: FestivalKey): Promise<{ headers: string[]; rows: Cell[][] }> {
    const apiKey = import.meta.env.GOOGLE_API_KEY;
    const sheetId = import.meta.env.CANNES_SHEET_ID;
    const range = FESTIVALS[festival].range;

    if (!apiKey || !sheetId || !range) {
        throw new Error("Faltan variables de entorno: GOOGLE_API_KEY, CANNES_SHEET_ID o el rango del festival.");
    }

    const fields = "sheets.data.rowData.values(formattedValue,textFormatRuns,effectiveFormat.textFormat.bold)";
    const url = `${SHEETS_BASE}/${encodeURIComponent(sheetId)}?ranges=${encodeURIComponent(range)}&fields=${encodeURIComponent(fields)}&key=${encodeURIComponent(apiKey)}`;
    const res = await fetch(url);
    if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`Google Sheets API ${res.status} en "${range}": ${body.slice(0, 200)}`);
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

function emptySnapshot(): RatingsSnapshot {
    return { headers: [], rows: [], updatedAt: "" };
}

function emptyAll(): Record<FestivalKey, RatingsSnapshot> {
    return Object.fromEntries(
        FESTIVAL_KEYS.map((key) => [key, emptySnapshot()])
    ) as Record<FestivalKey, RatingsSnapshot>;
}

type StoredDoc = {
    // Shape actual: un documento por festival dentro de la misma fila.
    festivals?: Record<string, { headers?: string[]; rows?: unknown; updatedAt?: string }>;
    // Shape viejo: la tabla de Cannes plana, cuando era la única.
    headers?: string[];
    rows?: unknown;
};

export async function getAllSnapshots(): Promise<Record<FestivalKey, RatingsSnapshot>> {
    if (!supabaseAdmin) {
        return emptyAll();
    }

    const { data, error } = await supabaseAdmin
        .from("cannes_snapshot")
        .select("data, updated_at")
        .eq("id", SNAPSHOT_ROW_ID)
        .maybeSingle();

    if (error || !data) {
        return emptyAll();
    }

    const payload = (data.data ?? {}) as StoredDoc;
    const rowUpdatedAt = data.updated_at ?? "";

    // Mientras no se corra el primer refresh después del cambio, la fila sigue
    // teniendo el documento plano de Cannes.
    if (!payload.festivals && Array.isArray(payload.headers)) {
        return {
            ...emptyAll(),
            cannes: {
                headers: payload.headers,
                rows: migrateRows(payload.rows),
                updatedAt: rowUpdatedAt,
            },
        };
    }

    const out = emptyAll();
    for (const key of FESTIVAL_KEYS) {
        const stored = payload.festivals?.[key];
        if (!stored) continue;
        out[key] = {
            headers: Array.isArray(stored.headers) ? stored.headers : [],
            rows: migrateRows(stored.rows),
            updatedAt: stored.updatedAt || rowUpdatedAt,
        };
    }
    return out;
}

export async function getSnapshot(festival: FestivalKey): Promise<RatingsSnapshot> {
    const all = await getAllSnapshots();
    return all[festival];
}

export async function saveSnapshots(
    fresh: Partial<Record<FestivalKey, { headers: string[]; rows: Cell[][] }>>
): Promise<Record<FestivalKey, RatingsSnapshot>> {
    if (!supabaseAdmin) {
        throw new Error("Supabase admin no está configurado.");
    }

    const updatedAt = new Date().toISOString();

    // Se parte de lo guardado para no perder el festival que no se refrescó.
    const merged = await getAllSnapshots();
    for (const key of FESTIVAL_KEYS) {
        const incoming = fresh[key];
        if (!incoming) continue;
        merged[key] = { headers: incoming.headers, rows: incoming.rows, updatedAt };
    }

    const { error } = await supabaseAdmin
        .from("cannes_snapshot")
        .upsert({ id: SNAPSHOT_ROW_ID, data: { festivals: merged }, updated_at: updatedAt }, { onConflict: "id" });

    if (error) {
        throw new Error(`Error al guardar snapshot: ${error.message}`);
    }

    return merged;
}
