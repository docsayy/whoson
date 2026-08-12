import { useMemo, useState } from "react";
import {
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Container,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";

import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";

import { sampleResidents } from "../data/sampleResidents";

export default function AdminResidents() {
  const [search, setSearch] = useState("");

  const residents = useMemo(() => {
    return sampleResidents.filter((resident) => {
      const text = `
        ${resident.displayName}
        ${resident.firstName}
        ${resident.lastName}
        ${resident.email}
        ${resident.pager}
        ${resident.pgy}
      `.toLowerCase();

      return text.includes(search.toLowerCase());
    });
  }, [search]);

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Stack spacing={3}>
        <Box
          display="flex"
          justifyContent="space-between"
          alignItems="center"
        >
          <Box>
            <Typography variant="h4" fontWeight={700}>
              Resident Management
            </Typography>

            <Typography color="text.secondary">
              Add, edit and manage residency program members
            </Typography>
          </Box>

          <Button
            variant="contained"
            startIcon={<AddIcon />}
          >
            Add Resident
          </Button>
        </Box>

        <Card>
          <CardContent>

            <TextField
              fullWidth
              label="Search resident..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              sx={{ mb: 3 }}
            />

            <TableContainer>
              <Table>

                <TableHead>
                  <TableRow>
                    <TableCell>Name</TableCell>
                    <TableCell>PGY</TableCell>
                    <TableCell>Role</TableCell>
                    <TableCell>Pager</TableCell>
                    <TableCell>Email</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>

                <TableBody>

                  {residents.map((resident) => (

                    <TableRow
                      key={resident.id}
                      hover
                    >
                      <TableCell>

                        <Stack
                          direction="row"
                          spacing={2}
                          alignItems="center"
                        >
                          <Avatar>
                            {resident.displayName.charAt(0)}
                          </Avatar>

                          <Box>
                            <Typography fontWeight={600}>
                              {resident.displayName}
                            </Typography>

                            <Typography
                              variant="body2"
                              color="text.secondary"
                            >
                              {resident.firstName} {resident.lastName}
                            </Typography>
                          </Box>

                        </Stack>

                      </TableCell>

                      <TableCell>
                        <Chip
                          label={resident.pgy}
                          color="primary"
                          size="small"
                        />
                      </TableCell>

                      <TableCell>
                        {resident.role}
                      </TableCell>

                      <TableCell>
                        {resident.pager}
                      </TableCell>

                      <TableCell>
                        {resident.email || "-"}
                      </TableCell>

                      <TableCell>

                        <Chip
                          label={resident.active ? "Active" : "Inactive"}
                          color={resident.active ? "success" : "default"}
                          size="small"
                        />

                      </TableCell>

                      <TableCell align="right">

                        <Button
                          startIcon={<EditIcon />}
                          size="small"
                        >
                          Edit
                        </Button>

                      </TableCell>

                    </TableRow>

                  ))}

                </TableBody>

              </Table>
            </TableContainer>

          </CardContent>
        </Card>
      </Stack>
    </Container>
  );
}