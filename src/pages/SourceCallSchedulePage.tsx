import { useEffect, useMemo, useState } from "react";
import { Alert, Box, Card, CardContent, CircularProgress, IconButton, Stack, Typography } from "@mui/material";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import SourceSyncBanner from "../components/SourceSyncBanner";
import { getSourceCallDays, type SourceRecord } from "../services/sourceSchedulerService";

const value = (date: Date) => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
const add = (date: Date, days: number) => { const next = new Date(date); next.setDate(next.getDate()+days); return next; };
export default function SourceCallSchedulePage(_props: { onOpenResidentProfile?: (id: string) => void }) {
  const [start, setStart] = useState(() => value(new Date())); const [days, setDays] = useState<SourceRecord[]>([]); const [loading,setLoading]=useState(true); const [error,setError]=useState("");
  const end = useMemo(() => value(add(new Date(`${start}T12:00:00`), 6)), [start]);
  useEffect(() => { setLoading(true); void getSourceCallDays(start,end).then(setDays).catch(()=>setError("Unable to load the cached call schedule.")).finally(()=>setLoading(false)); },[start,end]);
  const shift=(amount:number)=>setStart(value(add(new Date(`${start}T12:00:00`),amount)));
  return <Box><Stack direction="row" justifyContent="space-between" alignItems="center" sx={{mb:1}}><Typography variant="h4" fontWeight={900}>Daily Call Schedule</Typography><Stack direction="row" alignItems="center"><IconButton onClick={()=>shift(-7)}><ChevronLeftIcon /></IconButton><Typography fontWeight={850}>{start} – {end}</Typography><IconButton onClick={()=>shift(7)}><ChevronRightIcon /></IconButton></Stack></Stack><SourceSyncBanner />{error&&<Alert severity="error">{error}</Alert>}{loading?<Stack alignItems="center" sx={{py:8}}><CircularProgress /></Stack>:<Stack spacing={1}>{days.map(day=><Card key={String(day.date)}><CardContent><Typography fontWeight={900} sx={{mb:1}}>{new Date(`${day.date}T12:00:00`).toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"})}</Typography><Box sx={{display:"grid",gridTemplateColumns:{xs:"1fr",md:"repeat(2,minmax(0,1fr))"},gap:.7}}>{((day.entries as SourceRecord[])||[]).filter(entry=>((entry.residents as SourceRecord[])||[]).length).map((entry,index)=><Stack key={index} direction="row" justifyContent="space-between" sx={{border:"1px solid",borderColor:"divider",borderRadius:1.5,p:.8}}><Typography fontWeight={800} fontSize={13}>{String((entry.role as SourceRecord)?.code||"")}</Typography><Typography fontSize={13}>{((entry.residents as SourceRecord[])||[]).map(person=>String(person.name)).join(", ")}</Typography></Stack>)}</Box></CardContent></Card>)}</Stack>}</Box>;
}
