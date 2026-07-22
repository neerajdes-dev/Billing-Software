import Button from "@mui/material/Button";

/**
 * Standard ERP action button.
 * Matches the Dashboard quick-action buttons: white background,
 * blue border/icon/text, left aligned content and consistent sizing.
 */
export default function ActionButton({
  children,
  startIcon,
  fullWidth = false,
  align = "left",
  sx,
  ...props
}) {
  return (
    <Button
      variant="outlined"
      startIcon={startIcon}
      fullWidth={fullWidth}
      {...props}
      sx={{
        minHeight: 46,
        borderRadius: "12px",
        px: 2.25,
        borderWidth: "1px",
        borderColor: "primary.main",
        bgcolor: "common.white",
        color: "primary.main",
        fontWeight: 750,
        textTransform: "none",
        justifyContent: align === "center" ? "center" : "flex-start",
        whiteSpace: "nowrap",
        boxShadow: "none",
        transition: "background-color .18s ease, border-color .18s ease, transform .18s ease",
        "&:hover": {
          bgcolor: "#EEF4FF",
          borderColor: "primary.dark",
          borderWidth: "1px",
          transform: "translateY(-1px)",
          boxShadow: "none",
        },
        "&:active": {
          transform: "translateY(0)",
        },
        "&.Mui-disabled": {
          borderColor: "#CBD5E1",
          bgcolor: "#F8FAFC",
          color: "#94A3B8",
        },
        ...sx,
      }}
    >
      {children}
    </Button>
  );
}
