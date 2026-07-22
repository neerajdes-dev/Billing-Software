import { Paper, Typography, Stack } from "@mui/material";

function PageHeader({ title, subtitle, action }) {
  return (
    <Paper sx={{ p: 3, mb: 3 }}>
      <Stack
        direction={{ xs: "column", md: "row" }}
        justifyContent="space-between"
        alignItems={{ xs: "flex-start", md: "center" }}
        spacing={2}
      >
        <div>
          <Typography variant="h4">{title}</Typography>
          {subtitle && (
            <Typography color="text.secondary" mt={0.5}>
              {subtitle}
            </Typography>
          )}
        </div>

        {action}
      </Stack>
    </Paper>
  );
}

export default PageHeader;