/**
 * Hosted mode = the app runs as a single website on a cloud server (e.g. Railway).
 * Then there is only one server, so the shared-drive "one computer at a time" lock isn't needed.
 */
export const HOSTED = Boolean(process.env.OFFICE_HOSTED || process.env.RAILWAY_ENVIRONMENT);
