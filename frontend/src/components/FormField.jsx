import { Grid } from "@mui/material";

function FormField({ children, xs = 12, md = 6 }) {
  return (
    <Grid item xs={xs} md={md}>
      {children}
    </Grid>
  );
}

export default FormField;