import { Grid } from "@mui/material";

function FormSection({ children }) {
  return (
    <Grid container spacing={2}>
      {children}
    </Grid>
  );
}

export default FormSection;