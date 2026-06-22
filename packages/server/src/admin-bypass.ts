// In-memory admin bypass flag. Toggled via POST /admin/bypass.
// When enabled: production ignores resource requirements, caravans arrive instantly.
export const adminState = {
  bypassEnabled: false,
};
