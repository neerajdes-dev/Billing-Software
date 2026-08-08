import { Stack } from "@mui/material";

export default function PageActionBar({
  children,
  justifyContent = "flex-end",
  sx = {},
}) {
  return (
    <Stack
      direction="row"
      spacing={1.25}
      useFlexGap
      flexWrap="wrap"
      justifyContent={justifyContent}
      alignItems="center"
      sx={sx}
    >
      {children}
    </Stack>
  );
}
