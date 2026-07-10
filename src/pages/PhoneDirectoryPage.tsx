import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  InputAdornment,
  MenuItem,
  Stack,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";

import AddIcon from "@mui/icons-material/Add";
import CallIcon from "@mui/icons-material/Call";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import FileUploadIcon from "@mui/icons-material/FileUpload";
import SearchIcon from "@mui/icons-material/Search";

import { useAuth } from "../context/AuthContext";
import { useDirectoryContacts } from "../hooks/useDirectoryContacts";
import {
  createDirectoryContact,
  deleteDirectoryContact,
  importInitialDirectoryContacts,
  updateDirectoryContact,
} from "../services/directoryContactService";
import type {
  DirectoryContact,
  DirectoryContactInput,
  DirectoryTab,
} from "../types/directoryContact";
import { canManageResidents } from "../utils/permissions";

const HOSPITAL_PREFIX = "718670";

const emptyContact: DirectoryContactInput = {
  tab: "contacts",
  category: "Other",
  name: "",
  phoneNumbers: [],
  extensions: [],
  pagerNumbers: [],
  faxNumbers: [],
  notes: "",
  usualAdmittingAttendings: "",
  active: true,
};

function digits(value: string) {
  return value.replace(/\D/g, "");
}

function normalizePhoneForDial(value: string) {
  const valueDigits = digits(value);

  return valueDigits.length === 11 && valueDigits.startsWith("1")
    ? valueDigits.slice(1)
    : valueDigits;
}

function extensionDialNumber(extension: string) {
  return `${HOSPITAL_PREFIX}${digits(extension).slice(-4)}`;
}

function formatPhone(value: string) {
  const valueDigits = digits(value);

  if (valueDigits.length === 10) {
    return `(${valueDigits.slice(0, 3)}) ${valueDigits.slice(3, 6)}-${valueDigits.slice(6)}`;
  }

  return value;
}

function splitValues(value: string) {
  return Array.from(
    new Set(
      value
        .split(/[\n,;]+/)
        .map((item) => item.trim())
        .filter(Boolean)
    )
  );
}

function joinValues(values: string[]) {
  return values.join("\n");
}

function searchableText(contact: DirectoryContact) {
  return [
    contact.name,
    contact.category,
    ...contact.phoneNumbers,
    ...contact.extensions,
    ...contact.pagerNumbers,
    ...contact.faxNumbers,
    contact.notes,
    contact.usualAdmittingAttendings,
  ]
    .join(" ")
    .toLowerCase();
}

export default function PhoneDirectoryPage() {
  const { profile } = useAuth();
  const canManage = canManageResidents(profile?.role);
  const { contacts, loading, error } = useDirectoryContacts();

  const [tab, setTab] = useState<DirectoryTab>("contacts");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [editing, setEditing] = useState<DirectoryContact | null>(null);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState<{
    severity: "success" | "error";
    text: string;
  } | null>(null);

  const tabContacts = useMemo(
    () => contacts.filter((contact) => contact.tab === tab && contact.active),
    [contacts, tab]
  );

  const categories = useMemo(
    () =>
      Array.from(new Set(tabContacts.map((contact) => contact.category))).sort(
        (a, b) => a.localeCompare(b)
      ),
    [tabContacts]
  );

  const filteredContacts = useMemo(() => {
    const query = search.trim().toLowerCase();

    return tabContacts.filter((contact) => {
      if (category !== "All" && contact.category !== category) {
        return false;
      }

      return !query || searchableText(contact).includes(query);
    });
  }, [category, search, tabContacts]);

  function openCreate() {
    setEditing(null);
    setCreating(true);
  }

  function closeEditor() {
    if (saving) return;
    setEditing(null);
    setCreating(false);
  }

  async function saveContact(input: DirectoryContactInput) {
    setSaving(true);
    setMessage(null);

    try {
      if (editing) {
        await updateDirectoryContact({
          ...editing,
          ...input,
        });
        setMessage({ severity: "success", text: "Contact updated." });
      } else {
        await createDirectoryContact(input);
        setMessage({ severity: "success", text: "Contact added." });
      }

      setEditing(null);
      setCreating(false);
    } catch (saveError) {
      console.error(saveError);
      setMessage({
        severity: "error",
        text: "The contact could not be saved.",
      });
    } finally {
      setSaving(false);
    }
  }

  async function removeContact(contact: DirectoryContact) {
    const confirmed = window.confirm(`Delete ${contact.name}?`);
    if (!confirmed) return;

    try {
      await deleteDirectoryContact(contact.id);
      setMessage({ severity: "success", text: "Contact deleted." });
    } catch (deleteError) {
      console.error(deleteError);
      setMessage({
        severity: "error",
        text: "The contact could not be deleted.",
      });
    }
  }

  async function importProvidedList() {
    const confirmed = window.confirm(
      "Import or refresh the provided directory list in Firestore?"
    );
    if (!confirmed) return;

    setImporting(true);
    setMessage(null);

    try {
      const count = await importInitialDirectoryContacts();
      setMessage({
        severity: "success",
        text: `${count} directory entries imported or refreshed.`,
      });
    } catch (importError) {
      console.error(importError);
      setMessage({
        severity: "error",
        text: "The provided directory list could not be imported.",
      });
    } finally {
      setImporting(false);
    }
  }

  const editorInitial: DirectoryContactInput = editing
    ? {
        sourceKey: editing.sourceKey,
        tab: editing.tab,
        category: editing.category,
        name: editing.name,
        phoneNumbers: editing.phoneNumbers,
        extensions: editing.extensions,
        pagerNumbers: editing.pagerNumbers,
        faxNumbers: editing.faxNumbers,
        notes: editing.notes,
        usualAdmittingAttendings: editing.usualAdmittingAttendings,
        active: editing.active,
      }
    : {
        ...emptyContact,
        tab,
        category:
          tab === "pager"
            ? "Pagers"
            : tab === "nursing-home"
              ? "Nursing Home"
              : "Other",
      };

  return (
    <Box sx={{ width: "100%", maxWidth: 1500, mx: "auto" }}>
      <Stack
        direction={{ xs: "column", md: "row" }}
        justifyContent="space-between"
        alignItems={{ xs: "stretch", md: "flex-start" }}
        spacing={1.25}
        sx={{ mb: 1.25 }}
      >
        <Box>
          <Typography
            variant="h4"
            fontWeight={850}
            sx={{ fontSize: { xs: 24, md: 30 } }}
          >
            Phone Directory
          </Typography>

          <Typography
            color="text.secondary"
            sx={{ mt: 0.25, fontSize: { xs: 12.5, md: 13.5 } }}
          >
            Search contacts, extensions, pagers, and nursing homes.
          </Typography>
        </Box>

        {canManage && (
          <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
            <Button
              size="small"
              variant="outlined"
              startIcon={
                importing ? <CircularProgress size={15} /> : <FileUploadIcon />
              }
              onClick={importProvidedList}
              disabled={importing}
              sx={{ fontSize: 12 }}
            >
              Import list
            </Button>

            <Button
              size="small"
              variant="contained"
              startIcon={<AddIcon />}
              onClick={openCreate}
              sx={{ fontSize: 12 }}
            >
              Add
            </Button>
          </Stack>
        )}
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 1, py: 0.25 }}>
          {error}
        </Alert>
      )}

      {message && (
        <Alert severity={message.severity} sx={{ mb: 1, py: 0.25 }}>
          {message.text}
        </Alert>
      )}

      <Card variant="outlined">
        <CardContent sx={{ p: { xs: 0.75, sm: 1.25 } }}>
          <Tabs
            value={tab}
            onChange={(_, value: DirectoryTab) => {
              setTab(value);
              setCategory("All");
            }}
            variant="scrollable"
            scrollButtons="auto"
            sx={{
              minHeight: 36,
              mb: 1,
              "& .MuiTab-root": {
                minHeight: 36,
                py: 0.5,
                fontSize: 12.5,
                fontWeight: 800,
              },
            }}
          >
            <Tab value="contacts" label="Contacts" />
            <Tab value="pager" label="Pagers" />
            <Tab value="nursing-home" label="Nursing Homes" />
          </Tabs>

          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={0.75}
            sx={{ mb: 1 }}
          >
            <TextField
              fullWidth
              size="small"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search name, number, extension, pager, category, or comment"
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                ),
              }}
              sx={{
                "& .MuiInputBase-input": {
                  fontSize: 12.5,
                  py: 0.85,
                },
              }}
            />

            <TextField
              select
              size="small"
              label="Category"
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              sx={{
                minWidth: { xs: "100%", sm: 210 },
                "& .MuiInputBase-input": { fontSize: 12.5 },
              }}
            >
              <MenuItem value="All">All categories</MenuItem>
              {categories.map((item) => (
                <MenuItem key={item} value={item}>
                  {item}
                </MenuItem>
              ))}
            </TextField>
          </Stack>

          <Typography
            color="text.secondary"
            sx={{ mb: 0.75, fontSize: 11.5 }}
          >
            {filteredContacts.length} result
            {filteredContacts.length === 1 ? "" : "s"}
          </Typography>

          {loading ? (
            <Stack alignItems="center" sx={{ py: 5 }}>
              <CircularProgress size={28} />
            </Stack>
          ) : filteredContacts.length === 0 ? (
            <Alert severity="info" sx={{ py: 0.25 }}>
              No matching contacts were found.
            </Alert>
          ) : (
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: {
                  xs: "1fr",
                  md: "repeat(2, minmax(0, 1fr))",
                  xl: "repeat(3, minmax(0, 1fr))",
                },
                gap: 0.75,
                alignItems: "start",
              }}
            >
              {filteredContacts.map((contact) => (
                <ContactCard
                  key={contact.id}
                  contact={contact}
                  canManage={canManage}
                  onEdit={() => setEditing(contact)}
                  onDelete={() => removeContact(contact)}
                />
              ))}
            </Box>
          )}
        </CardContent>
      </Card>

      <ContactEditor
        open={creating || Boolean(editing)}
        initial={editorInitial}
        saving={saving}
        onClose={closeEditor}
        onSave={saveContact}
      />
    </Box>
  );
}

function ContactCard({
  contact,
  canManage,
  onEdit,
  onDelete,
}: {
  contact: DirectoryContact;
  canManage: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const hasNumbers =
    contact.phoneNumbers.length > 0 ||
    contact.extensions.length > 0 ||
    contact.pagerNumbers.length > 0 ||
    contact.faxNumbers.length > 0;

  return (
    <Card
      variant="outlined"
      sx={{
        borderRadius: 1.5,
        boxShadow: "none",
        minWidth: 0,
      }}
    >
      <CardContent
        sx={{
          p: 0.85,
          "&:last-child": { pb: 0.85 },
        }}
      >
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="flex-start"
          spacing={0.5}
        >
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography
              fontWeight={850}
              noWrap
              title={contact.name}
              sx={{ fontSize: 13.25, lineHeight: 1.2 }}
            >
              {contact.name}
            </Typography>

            <Typography
              color="text.secondary"
              noWrap
              title={contact.category}
              sx={{ fontSize: 10.75, mt: 0.15 }}
            >
              {contact.category}
            </Typography>
          </Box>

          {canManage && (
            <Stack direction="row" spacing={0}>
              <Tooltip title="Edit all contact details">
                <IconButton
                  size="small"
                  onClick={onEdit}
                  sx={{ p: 0.45 }}
                  aria-label={`Edit ${contact.name}`}
                >
                  <EditIcon sx={{ fontSize: 17 }} />
                </IconButton>
              </Tooltip>

              <Tooltip title="Delete contact">
                <IconButton
                  size="small"
                  color="error"
                  onClick={onDelete}
                  sx={{ p: 0.45 }}
                  aria-label={`Delete ${contact.name}`}
                >
                  <DeleteIcon sx={{ fontSize: 17 }} />
                </IconButton>
              </Tooltip>
            </Stack>
          )}
        </Stack>

        {hasNumbers && <Divider sx={{ my: 0.55 }} />}

        <Stack direction="row" flexWrap="wrap" gap={0.4}>
          {contact.phoneNumbers.map((phone) => (
            <Button
              key={`phone-${phone}`}
              size="small"
              variant="outlined"
              startIcon={<CallIcon sx={{ fontSize: "14px !important" }} />}
              component="a"
              href={`tel:${normalizePhoneForDial(phone)}`}
              sx={{
                minHeight: 25,
                py: 0.1,
                px: 0.65,
                fontSize: 10.75,
                lineHeight: 1.1,
                textTransform: "none",
                "& .MuiButton-startIcon": { mr: 0.35 },
              }}
            >
              {formatPhone(phone)}
            </Button>
          ))}

          {contact.extensions.map((extension) => (
            <Button
              key={`ext-${extension}`}
              size="small"
              variant="outlined"
              startIcon={<CallIcon sx={{ fontSize: "14px !important" }} />}
              component="a"
              href={`tel:${extensionDialNumber(extension)}`}
              sx={{
                minHeight: 25,
                py: 0.1,
                px: 0.65,
                fontSize: 10.75,
                lineHeight: 1.1,
                textTransform: "none",
                "& .MuiButton-startIcon": { mr: 0.35 },
              }}
            >
              Ext {extension}
            </Button>
          ))}

          {contact.pagerNumbers.map((pager) => (
            <Chip
              key={`pager-${pager}`}
              label={`Pager ${pager}`}
              size="small"
              sx={{
                height: 25,
                fontSize: 10.5,
                fontWeight: 750,
                "& .MuiChip-label": { px: 0.75 },
              }}
            />
          ))}

          {contact.faxNumbers.map((fax) => (
            <Chip
              key={`fax-${fax}`}
              label={`Fax ${formatPhone(fax)}`}
              size="small"
              sx={{
                height: 25,
                fontSize: 10.5,
                "& .MuiChip-label": { px: 0.75 },
              }}
            />
          ))}
        </Stack>

        {contact.usualAdmittingAttendings && (
          <Typography
            sx={{
              mt: 0.55,
              fontSize: 10.75,
              lineHeight: 1.3,
              overflowWrap: "anywhere",
            }}
          >
            <Box component="span" fontWeight={800}>
              Usually admits:
            </Box>{" "}
            {contact.usualAdmittingAttendings}
          </Typography>
        )}

        {contact.notes && (
          <Typography
            color="text.secondary"
            sx={{
              mt: 0.5,
              fontSize: 10.75,
              lineHeight: 1.3,
              whiteSpace: "pre-wrap",
              overflowWrap: "anywhere",
            }}
          >
            {contact.notes}
          </Typography>
        )}
      </CardContent>
    </Card>
  );
}

function ContactEditor({
  open,
  initial,
  saving,
  onClose,
  onSave,
}: {
  open: boolean;
  initial: DirectoryContactInput;
  saving: boolean;
  onClose: () => void;
  onSave: (input: DirectoryContactInput) => Promise<void>;
}) {
  const [form, setForm] = useState<DirectoryContactInput>(initial);
  const [phones, setPhones] = useState(joinValues(initial.phoneNumbers));
  const [extensions, setExtensions] = useState(joinValues(initial.extensions));
  const [pagers, setPagers] = useState(joinValues(initial.pagerNumbers));
  const [faxes, setFaxes] = useState(joinValues(initial.faxNumbers));

  useEffect(() => {
    if (!open) return;

    setForm(initial);
    setPhones(joinValues(initial.phoneNumbers));
    setExtensions(joinValues(initial.extensions));
    setPagers(joinValues(initial.pagerNumbers));
    setFaxes(joinValues(initial.faxNumbers));
  }, [initial, open]);

  const isEditing = Boolean(initial.name);

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle sx={{ pb: 1, fontWeight: 850 }}>
        {isEditing ? "Edit contact" : "Add contact"}
      </DialogTitle>

      <DialogContent dividers sx={{ py: 1.5 }}>
        <Alert severity="info" sx={{ mb: 1.5, py: 0.25 }}>
          Every field below can be edited. Enter multiple numbers one per line or
          separated with commas.
        </Alert>

        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
            gap: 1.25,
          }}
        >
          <TextField
            select
            size="small"
            label="Directory tab"
            value={form.tab}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                tab: event.target.value as DirectoryTab,
              }))
            }
          >
            <MenuItem value="contacts">Contacts</MenuItem>
            <MenuItem value="pager">Pagers</MenuItem>
            <MenuItem value="nursing-home">Nursing Homes</MenuItem>
          </TextField>

          <TextField
            required
            size="small"
            label="Category / section"
            value={form.category}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                category: event.target.value,
              }))
            }
          />

          <TextField
            required
            size="small"
            label="Title, person, or location name"
            value={form.name}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                name: event.target.value,
              }))
            }
            sx={{ gridColumn: { xs: "auto", md: "1 / -1" } }}
          />

          <TextField
            multiline
            minRows={3}
            size="small"
            label="Full phone numbers"
            helperText="Example: 718-670-1234"
            value={phones}
            onChange={(event) => setPhones(event.target.value)}
          />

          <TextField
            multiline
            minRows={3}
            size="small"
            label="Hospital extensions"
            helperText="Four digits; calling uses 718-670-XXXX"
            value={extensions}
            onChange={(event) => setExtensions(event.target.value)}
          />

          <TextField
            multiline
            minRows={3}
            size="small"
            label="Pager numbers"
            value={pagers}
            onChange={(event) => setPagers(event.target.value)}
          />

          <TextField
            multiline
            minRows={3}
            size="small"
            label="Fax numbers"
            value={faxes}
            onChange={(event) => setFaxes(event.target.value)}
          />

          {form.tab === "nursing-home" && (
            <TextField
              multiline
              minRows={3}
              size="small"
              label="Usual admitting attending(s)"
              value={form.usualAdmittingAttendings}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  usualAdmittingAttendings: event.target.value,
                }))
              }
              sx={{ gridColumn: { xs: "auto", md: "1 / -1" } }}
            />
          )}

          <TextField
            multiline
            minRows={4}
            size="small"
            label="Comments / notes"
            value={form.notes}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                notes: event.target.value,
              }))
            }
            sx={{ gridColumn: { xs: "auto", md: "1 / -1" } }}
          />
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 2, py: 1 }}>
        <Button onClick={onClose} disabled={saving}>
          Cancel
        </Button>

        <Button
          variant="contained"
          disabled={saving || !form.name.trim() || !form.category.trim()}
          onClick={() =>
            onSave({
              ...form,
              name: form.name.trim(),
              category: form.category.trim(),
              phoneNumbers: splitValues(phones),
              extensions: splitValues(extensions).map(digits).filter(Boolean),
              pagerNumbers: splitValues(pagers).map(digits).filter(Boolean),
              faxNumbers: splitValues(faxes),
              notes: form.notes.trim(),
              usualAdmittingAttendings:
                form.usualAdmittingAttendings.trim(),
            })
          }
        >
          {saving ? "Saving..." : "Save all changes"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
