// Email clients cannot read the app's CSS variables or oklch colours, so the brand lives here again as hex. These
// mirror the advientea-light theme in src/app/globals.css; when the shadcn tokens replace it, update this object.
export const EMAIL_THEME = {
  background: "#9fd7a2",
  border: "#b2ddb5",
  brand: "#006330",
  brandForeground: "#ffffff",
  card: "#effee2",
  displayFont: "Griffy, Georgia, 'Times New Roman', serif",
  font: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif",
  foreground: "#203c25",
  link: "#00804a",
  mutedForeground: "#4d564c",
} as const;
