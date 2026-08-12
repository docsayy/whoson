import { useEffect, useMemo, useState } from "react";
import { Alert, Box, CircularProgress, Stack, Typography } from "@mui/material";
import SourceSyncBanner from "../components/SourceSyncBanner";
import { getSourceBlockSchedule, type SourceRecord } from "../services/sourceSchedulerService";

export default function SourceBlockSchedulePage(_props: { onOpenResidentProfile?: (id: string) => void }) {
  const [data, setData] = useState<SourceRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => { void getSourceBlockSchedule().then(setData).catch(() => setError("Unable to load the cached block schedule.")).finally(() => setLoading(false)); }, []);
  const model = useMemo(() => {
    const blocks = (data?.blocks as SourceRecord[] | undefined) || [];
    const residents = (data?.residents as SourceRecord[] | undefined) || [];
    const rotations = (data?.rotations as SourceRecord[] | undefined) || [];
    const assignments = (data?.assignments as Record<string, unknown> | undefined) || {};
    const rotationMap = new Map(rotations.map((item) => [String(item.id), item]));
    return { blocks, residents, assignments, rotationMap };
  }, [data]);
  return <Box><Typography variant="h4" fontWeight={900} sx={{ mb: 1 }}>Block Schedule</Typography><SourceSyncBanner />
    {error && <Alert severity="error">{error}</Alert>}
    {loading ? <Stack alignItems="center" sx={{ py: 8 }}><CircularProgress /></Stack> : !data ? <Alert severity="info">No synchronized block schedule is available yet.</Alert> :
      <Box sx={{ overflow: "auto", border: "1px solid", borderColor: "divider", borderRadius: 2, bgcolor: "background.paper" }}>
        <Box component="table" sx={{ borderCollapse: "collapse", minWidth: 1100, width: "100%", "th,td": { borderBottom: "1px solid", borderRight: "1px solid", borderColor: "divider", p: 0.7, fontSize: 12 }, th: { position: "sticky", top: 0, bgcolor: "grey.100", zIndex: 2, fontWeight: 900 }, "th:first-of-type,td:first-of-type": { position: "sticky", left: 0, bgcolor: "background.paper", zIndex: 1, minWidth: 155 } }}>
          <thead><tr><th>Resident</th>{model.blocks.map((block) => <th key={String(block.id)}>B{String(block.number)}<br />{String(block.start_date).slice(5)}–{String(block.end_date).slice(5)}</th>)}</tr></thead>
          <tbody>{model.residents.filter((resident) => resident.is_active !== false).map((resident) => <tr key={String(resident.id)}><td><strong>{String(resident.first_name)} {String(resident.last_name)}</strong></td>{model.blocks.map((block) => { const rotationId = model.assignments[`${resident.id}:${block.id}`]; const rotation = model.rotationMap.get(String(rotationId)); return <td key={String(block.id)} style={{ background: String(rotation?.color || "transparent") }}>{rotation ? String(rotation.code) : "—"}</td>; })}</tr>)}</tbody>
        </Box>
      </Box>}
  </Box>;
}
