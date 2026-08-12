import { useEffect, useMemo, useState } from "react";
import { Alert, Box, Button, Card, CircularProgress, IconButton, Link, Stack, Typography } from "@mui/material";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import SourceSyncBanner from "../components/SourceSyncBanner";
import { getSourceCallDays, type SourceRecord } from "../services/sourceSchedulerService";
import { getResidents } from "../services/residentService";
import type { Resident } from "../types/resident";
import { findProfile } from "../utils/sourceProfileMatching";

const value=(d:Date)=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
const add=(d:Date,n:number)=>{const next=new Date(d);next.setDate(next.getDate()+n);return next};
const weekThursday=(d=new Date())=>{const day=d.getDay();const delta=day>=4?4-day:-(day+3);return add(d,delta)};
export default function SourceCallSchedulePage({onOpenResidentProfile}:{onOpenResidentProfile?:(id:string)=>void}){
  const[start,setStart]=useState(()=>value(weekThursday()));
  const[days,setDays]=useState<SourceRecord[]>([]);
  const[profiles,setProfiles]=useState<Resident[]>([]);
  const[loading,setLoading]=useState(true);
  const[error,setError]=useState("");
  const end=useMemo(()=>value(add(new Date(`${start}T12:00:00`),6)),[start]);
  useEffect(()=>{setLoading(true);setError("");void Promise.all([getSourceCallDays(start,end),getResidents()]).then(([schedule,people])=>{setDays(schedule);setProfiles(people)}).catch(()=>setError("Unable to load the cached call schedule.")).finally(()=>setLoading(false));},[start,end]);
  const shift=(n:number)=>setStart(value(add(new Date(`${start}T12:00:00`),n)));
  return <Box><Stack direction={{xs:"column",md:"row"}} justifyContent="space-between" alignItems={{md:"center"}} sx={{mb:1}}><Box><Typography variant="h4" fontWeight={900}>Daily Call Schedule</Typography><Typography color="text.secondary">Weekly view runs Thursday through Wednesday.</Typography></Box><Stack direction="row" alignItems="center"><IconButton onClick={()=>shift(-7)}><ChevronLeftIcon/></IconButton><Typography fontWeight={850} sx={{minWidth:{xs:180,sm:255},textAlign:"center"}}>{new Date(`${start}T12:00:00`).toLocaleDateString("en-US",{month:"short",day:"numeric"})} – {new Date(`${end}T12:00:00`).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}</Typography><IconButton onClick={()=>shift(7)}><ChevronRightIcon/></IconButton><Button size="small" variant="outlined" onClick={()=>setStart(value(weekThursday()))}>This week</Button></Stack></Stack><SourceSyncBanner/>{error&&<Alert severity="error">{error}</Alert>}{loading?<Stack alignItems="center" sx={{py:8}}><CircularProgress/></Stack>:<Stack spacing={1}>{days.map(day=><Card key={String(day.date)} sx={{p:1.2,border:String(day.date)===value(new Date())?"2px solid #f59e0b":undefined,bgcolor:String(day.date)===value(new Date())?"#fffdf5":undefined}}><Typography fontWeight={900} sx={{mb:.7}}>{new Date(`${day.date}T12:00:00`).toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"})}</Typography><Box sx={{display:"grid",gridTemplateColumns:{xs:"1fr",md:"repeat(2,minmax(0,1fr))"},gap:.55}}>{((day.entries as SourceRecord[])||[]).filter(entry=>((entry.residents as SourceRecord[])||[]).length).map((entry,index)=><Stack key={index} direction="row" justifyContent="space-between" alignItems="center" sx={{border:"1px solid",borderColor:"divider",borderRadius:1.3,p:.65,minWidth:0}}><Typography fontWeight={850} fontSize={12.5}>{String((entry.role as SourceRecord)?.code||"")}</Typography><Stack direction="row" spacing={.5} sx={{minWidth:0}}>{((entry.residents as SourceRecord[])||[]).map((person,i)=>{const name=String(person.name);const profile=findProfile(name,profiles);return profile&&onOpenResidentProfile?<Link key={i} component="button" onClick={()=>onOpenResidentProfile(profile.id)} underline="hover" sx={{fontSize:12.5,fontWeight:800}}>{name}</Link>:<Typography key={i} fontSize={12.5}>{name}</Typography>})}</Stack></Stack>)}</Box></Card>)}</Stack>}</Box>;
}
