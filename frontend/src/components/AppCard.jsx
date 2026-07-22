import { Card, CardContent, Typography } from "@mui/material";

function AppCard({ title, children, action }) {
  return (
    <Card sx={{ mb: 3 }}>
      <CardContent>
        {title && (
          <Typography variant="h6" mb={2}>
            {title}
          </Typography>
        )}

        {action}

        {children}
      </CardContent>
    </Card>
  );
}

export default AppCard;