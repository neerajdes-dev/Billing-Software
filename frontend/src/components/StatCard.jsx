import { Card, CardContent, Typography, Stack } from "@mui/material";

function StatCard({ title, value, icon, color = "primary.main" }) {
  return (
    <Card>
      <CardContent>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <div>
            <Typography color="text.secondary">{title}</Typography>
            <Typography variant="h4" fontWeight={800} mt={1}>
              {value}
            </Typography>
          </div>

          {icon && (
            <Stack
              alignItems="center"
              justifyContent="center"
              sx={{
                width: 48,
                height: 48,
                borderRadius: 3,
                bgcolor: color,
                color: "#fff",
              }}
            >
              {icon}
            </Stack>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}

export default StatCard;