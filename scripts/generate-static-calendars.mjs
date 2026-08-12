#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const backupPath = process.argv[2];
if (!backupPath) {
  console.error("Usage: npm run calendars:generate -- /path/to/whoson-backup.json");
  process.exit(1);
}

const backup = JSON.parse(fs.readFileSync(backupPath, "utf8"));
const collections = backup.collections || {};
const records = (name) => (collections[name] || []).map((item) => ({ id: item.id, ...item.data }));

const subscriptions = records("calendarSubscriptions").filter((item) => item.enabled !== false && item.token);
const residents = records("residents");
const blocks = records("academicBlocks");
const blockAssignments = records("blockAssignments");
const scheduleMonths = records("scheduleMonths");
const attendingAssignments = records("attendingScheduleAssignments").filter((item) => !item.archived);

const holidays = [
  ["2026-01-01", "New Year's Day"],
  ["2026-01-19", "Martin Luther King Jr. Day"],
  ["2026-02-16", "Presidents Day"],
  ["2026-05-25", "Memorial Day"],
  ["2026-06-19", "Juneteenth"],
  ["2026-07-03", "Independence Day (Observed)"],
  ["2026-09-07", "Labor Day"],
  ["2026-11-26", "Thanksgiving Day"],
  ["2026-12-25", "Christmas Day"],
];

function esc(value = "") {
  return String(value).replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}
function compactDate(value) { return value.replace(/-/g, ""); }
function parseDate(value) { const [y,m,d]=value.split("-").map(Number); return new Date(y,m-1,d); }
function addDays(value, days) { const d=parseDate(value); d.setDate(d.getDate()+days); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; }
function dt(date,time) { return `${compactDate(date)}T${(time || "0700").replace(":","")}00`; }
function stamp() { return new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z"); }
function dateRange(start,end) { const out=[]; let d=start; while(d<=end){out.push(d); d=addDays(d,1);} return out; }
function academicYearForDate(date) { const y=Number(date.slice(0,4)); const m=Number(date.slice(5,7)); return m>=7?`${y}-${y+1}`:`${y-1}-${y}`; }
function latestPublishedForYear(year) {
  const published=blockAssignments.filter((a)=>a.academicYear===year && a.status==="published");
  if (published.length) { const v=Math.max(...published.map((a)=>a.version||1)); return published.filter((a)=>(a.version||1)===v); }
  return blockAssignments.filter((a)=>a.academicYear===year && !a.status);
}
function isAutoNfDate(serviceId,date) {
  const dow=parseDate(date).getDay();
  if (["2n-ccu-pgy1-nf","4n-3w-pgy1-nf"].includes(serviceId)) return dow>=0 && dow<=5;
  if (["2n-ccu-pgy2-nf","4n-3w-pgy2-nf","pgy3-nf"].includes(serviceId)) return dow>=0 && dow<=4;
  return false;
}
const nfServices = [
  ["2n-ccu-pgy1-nf","2N-CCU PGY1 NF","19:00","07:00"],
  ["2n-ccu-pgy2-nf","2N-CCU PGY2 NF","19:00","07:00"],
  ["4n-3w-pgy1-nf","4N-3W PGY1 NF","19:00","07:00"],
  ["4n-3w-pgy2-nf","4N-3W PGY2 NF","19:00","07:00"],
  ["pgy3-nf","PGY3 NF","19:00","07:00"],
];
function buildCalendar(name,events) {
  const lines=["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//WhosOn//Residency Schedule//EN","CALSCALE:GREGORIAN","METHOD:PUBLISH",`X-WR-CALNAME:${esc(name)}`];
  for (const event of events) {
    lines.push("BEGIN:VEVENT",`UID:${esc(event.uid)}@whoson`,`DTSTAMP:${stamp()}`);
    if (event.allDay) {
      lines.push(`DTSTART;VALUE=DATE:${compactDate(event.startDate)}`,`DTEND;VALUE=DATE:${compactDate(addDays(event.endDate||event.startDate,1))}`);
    } else {
      const start=event.startTime||"07:00";
      const end=/^\d{2}:\d{2}$/.test(event.endTime||"")?event.endTime:"12:00";
      const endDate=event.endDate || (end<=start?addDays(event.startDate,1):event.startDate);
      lines.push(`DTSTART:${dt(event.startDate,start)}`,`DTEND:${dt(endDate,end)}`);
    }
    lines.push(`SUMMARY:${esc(event.title)}`);
    if (event.description) lines.push(`DESCRIPTION:${esc(event.description)}`);
    if (event.location) lines.push(`LOCATION:${esc(event.location)}`);
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return `${lines.join("\r\n")}\r\n`;
}

const outputDir = path.resolve("public/calendar");
fs.mkdirSync(outputDir,{recursive:true});
const manifest=[];

for (const sub of subscriptions) {
  const program=sub.scope==="program";
  const events=[];
  const years=[...new Set(blocks.map((b)=>b.academicYear))];

  if (sub.includeBlocks !== false) {
    for (const year of years) {
      for (const a of latestPublishedForYear(year)) {
        if (!program && a.residentId!==sub.residentId) continue;
        const block=blocks.find((b)=>b.id===a.blockId);
        if (!block) continue;
        events.push({uid:`block-${a.id}`,title:program?`${a.residentName} — ${a.rotationName}`:`Block ${a.blockNumber}: ${a.rotationName}`,startDate:block.startDate,endDate:block.endDate,allDay:true,description:`${a.residentName}, ${a.rotationName}`});
      }
    }
  }

  if (sub.includeCalls !== false) {
    for (const schedule of scheduleMonths.filter((m)=>m.status==="published")) {
      for (const cell of Object.values(schedule.assignments || {})) {
        if (!program && cell.residentId!==sub.residentId) continue;
        events.push({uid:`call-${cell.date}-${cell.serviceId}-${cell.residentId}`,title:program?`${cell.serviceName} — ${cell.residentName}`:cell.serviceName,startDate:cell.date,startTime:cell.startTime,endTime:cell.endTime,description:`${cell.residentName} (${cell.training||""}) ${cell.notes||""}`,location:"Flushing Hospital Medical Center"});
      }
    }
    for (const block of blocks) {
      const published=latestPublishedForYear(block.academicYear);
      for (const [serviceId,serviceName,startTime,endTime] of nfServices) {
        const a=published.find((item)=>item.blockId===block.id && item.rotationId===serviceId);
        if (!a) continue;
        if (!program && a.residentId!==sub.residentId) continue;
        for (const date of dateRange(block.startDate,block.endDate)) {
          if (!isAutoNfDate(serviceId,date)) continue;
          const month=scheduleMonths.find((m)=>m.id===date.slice(0,7) && m.status==="published");
          if (!month) continue;
          const manual=(month.assignments||{})[`${date}_${serviceId}`];
          if (manual) continue;
          events.push({uid:`auto-nf-${date}-${serviceId}-${a.residentId}`,title:program?`${serviceName} — ${a.residentName}`:serviceName,startDate:date,startTime,endTime,description:`${a.residentName}; auto from published block schedule`,location:"Flushing Hospital Medical Center"});
        }
      }
    }
  }

  if (sub.includeActiveChief !== false) {
    for (const block of blocks) {
      const chief=block.activeChiefPublished;
      if (!chief) continue;
      if (!program && chief.residentId!==sub.residentId) continue;
      events.push({uid:`active-chief-${block.id}-${chief.residentId}`,title:program?`Active Chief — ${chief.residentName}`:"Active Chief",startDate:block.startDate,endDate:block.endDate,allDay:true,description:`${chief.residentName} is Active Chief for ${block.name}.`});
    }
  }

  if (sub.includeAttendingAssignments !== false) {
    for (const a of attendingAssignments) {
      if (!program && a.attendingId!==sub.attendingId) continue;
      events.push({uid:`attending-${a.id}`,title:program?`${a.serviceName} — ${a.attendingName}`:a.serviceName,startDate:a.startDate,endDate:a.endDate,allDay:true,description:`${a.attendingName}. ${a.coverageNote||a.notes||""}`});
    }
  }

  if (sub.includeHolidays) {
    for (const [date,name] of holidays) events.push({uid:`holiday-${date}`,title:name,startDate:date,allDay:true,description:"Hospital-observed holiday; weekend coverage rules apply."});
  }

  const filename=`${sub.token}.ics`;
  fs.writeFileSync(path.join(outputDir,filename),buildCalendar(program?"WhosOn Program Schedule":`WhosOn — ${sub.displayName}`,events));
  manifest.push({uid:sub.uid,displayName:sub.displayName,filename,events:events.length,scope:sub.scope||"personal"});
}

fs.writeFileSync(path.join(outputDir,"feeds-manifest.json"),JSON.stringify({generatedAt:new Date().toISOString(),feeds:manifest},null,2));
console.log(`Generated ${manifest.length} static calendar feed(s) in ${outputDir}.`);
for (const item of manifest) console.log(`- ${item.displayName}: ${item.filename} (${item.events} events)`);
