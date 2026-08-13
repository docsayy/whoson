import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Card,
  Chip,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  Typography,
} from "@mui/material";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import CloseIcon from "@mui/icons-material/Close";
import {
  getSourceLectures,
  type SourceRecord,
} from "../services/sourceSchedulerService";

const dateValue = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const monthValue = (date: Date) => dateValue(date).slice(0, 7);
const bounds = (month: string) => {
  const [y, m] = month.split("-").map(Number);
  return { start: `${month}-01`, end: dateValue(new Date(y, m, 0)) };
};
const shift = (month: string, amount: number) => {
  const [y, m] = month.split("-").map(Number);
  return monthValue(new Date(y, m - 1 + amount, 1));
};
const slotTimes: Record<string, string> = {
  am_8: "8:00–9:00 AM",
  pm_12: "12:00–1:00 PM",
};
const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function SourceLectureSchedulePage() {
  const [month, setMonth] = useState(monthValue(new Date()));
  const [items, setItems] = useState<SourceRecord[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const range = useMemo(() => bounds(month), [month]);
  const today = dateValue(new Date());
  useEffect(() => {
    setLoading(true);
    setError("");
    void getSourceLectures(range.start, range.end)
      .then(setItems)
      .catch(() => setError("Unable to load the lecture schedule."))
      .finally(() => setLoading(false));
  }, [range.start, range.end]);
  const grouped = useMemo(() => {
    const map = new Map<string, SourceRecord[]>();
    for (const item of items) {
      const date = String(item.date);
      map.set(date, [...(map.get(date) || []), item]);
    }
    return map;
  }, [items]);
  const days = useMemo(() => {
    const [y, m] = month.split("-").map(Number);
    const first = new Date(y, m - 1, 1);
    const start = new Date(first);
    start.setDate(1 - first.getDay());
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return {
        date: dateValue(d),
        day: d.getDate(),
        inMonth: d.getMonth() === m - 1,
      };
    });
  }, [month]);
  const selectedItems = selected ? grouped.get(selected) || [] : [];
  return (
    <Box>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        justifyContent="space-between"
        alignItems={{ sm: "center" }}
        sx={{ mb: 1 }}
      >
        <Typography variant="h4" fontWeight={900}>
          Lecture Schedule
        </Typography>
        <Stack direction="row" alignItems="center">
          <IconButton onClick={() => setMonth(shift(month, -1))}>
            <ChevronLeftIcon />
          </IconButton>
          <Typography
            fontWeight={900}
            sx={{ minWidth: 150, textAlign: "center" }}
          >
            {new Date(`${month}-01T12:00:00`).toLocaleDateString("en-US", {
              month: "long",
              year: "numeric",
            })}
          </Typography>
          <IconButton onClick={() => setMonth(shift(month, 1))}>
            <ChevronRightIcon />
          </IconButton>
        </Stack>
      </Stack>
      {error && <Alert severity="error">{error}</Alert>}
      {loading ? (
        <Stack alignItems="center" sx={{ py: 8 }}>
          <CircularProgress />
        </Stack>
      ) : (
        <Card sx={{ overflow: "hidden" }}>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: "repeat(7,minmax(0,1fr))",
              bgcolor: "grey.100",
              borderBottom: "1px solid",
              borderColor: "divider",
            }}
          >
            {weekdays.map((day) => (
              <Typography
                key={day}
                fontSize={12}
                fontWeight={900}
                textAlign="center"
                sx={{ py: 0.8 }}
              >
                {day}
              </Typography>
            ))}
          </Box>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: "repeat(7,minmax(0,1fr))",
            }}
          >
            {days.map((day) => {
              const lectures = grouped.get(day.date) || [];
              const isToday = day.date === today;
              return (
                <Box
                  key={day.date}
                  onClick={() => lectures.length && setSelected(day.date)}
                  sx={{
                    minHeight: { xs: 82, md: isToday ? 145 : 112 },
                    p: 0.7,
                    borderRight: "1px solid",
                    borderBottom: "1px solid",
                    borderColor: "divider",
                    bgcolor: isToday
                      ? "#fff8db"
                      : day.inMonth
                        ? "background.paper"
                        : "grey.50",
                    opacity: day.inMonth ? 1 : 0.5,
                    cursor: lectures.length ? "pointer" : "default",
                    outline: isToday ? "3px solid #f59e0b" : "none",
                    outlineOffset: -3,
                    overflow: "hidden",
                  }}
                >
                  <Stack direction="row" justifyContent="space-between">
                    <Typography
                      fontWeight={isToday ? 900 : 700}
                      color={isToday ? "#92400e" : "inherit"}
                    >
                      {day.day}
                    </Typography>
                    {isToday && (
                      <Chip
                        label="Today"
                        size="small"
                        sx={{
                          height: 20,
                          fontSize: 10,
                          fontWeight: 900,
                          bgcolor: "#f59e0b",
                          color: "white",
                        }}
                      />
                    )}
                  </Stack>
                  {lectures.slice(0, isToday ? 4 : 2).map((item) => (
                    <Box
                      key={String(item.id)}
                      sx={{
                        mt: 0.45,
                        p: 0.45,
                        borderRadius: 1,
                        bgcolor: isToday ? "#ffedb0" : "primary.50",
                        borderLeft: "3px solid",
                        borderColor: isToday ? "#f59e0b" : "primary.main",
                      }}
                    >
                      <Typography fontSize={11} fontWeight={900} noWrap>
                        {String(item.title)}
                      </Typography>
                      {isToday && (
                        <Typography
                          fontSize={10.5}
                          color="text.secondary"
                          noWrap
                        >
                          {slotTimes[String(item.slot)] || String(item.slot)}
                          {item.presenter ? ` · ${item.presenter}` : ""}
                        </Typography>
                      )}
                    </Box>
                  ))}
                  {lectures.length > (isToday ? 4 : 2) && (
                    <Typography fontSize={10} color="primary" sx={{ mt: 0.3 }}>
                      +{lectures.length - (isToday ? 4 : 2)} more
                    </Typography>
                  )}
                </Box>
              );
            })}
          </Box>
        </Card>
      )}
      <Dialog
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle sx={{ fontWeight: 900, pr: 6 }}>
          {selected &&
            new Date(`${selected}T12:00:00`).toLocaleDateString("en-US", {
              weekday: "long",
              month: "long",
              day: "numeric",
              year: "numeric",
            })}
          <IconButton
            onClick={() => setSelected(null)}
            sx={{ position: "absolute", right: 8, top: 8 }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <Stack spacing={1}>
            {selectedItems.map((item) => (
              <Box
                key={String(item.id)}
                sx={{
                  p: 1.2,
                  border: "1px solid",
                  borderColor: "divider",
                  borderRadius: 2,
                }}
              >
                <Typography fontWeight={900}>{String(item.title)}</Typography>
                <Typography color="text.secondary">
                  {slotTimes[String(item.slot)] || String(item.slot)}
                </Typography>
                {Boolean(item.presenter) && (
                  <Typography>Presenter: {String(item.presenter)}</Typography>
                )}
                {Boolean(item.location) && (
                  <Typography>Location: {String(item.location)}</Typography>
                )}
              </Box>
            ))}
          </Stack>
        </DialogContent>
      </Dialog>
    </Box>
  );
}
