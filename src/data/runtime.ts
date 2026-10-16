// Explicit build mode: an unavailable real API must never become a demo session.
export const STATIC_PROTOTYPE = import.meta.env.MODE === "prototype";
export const LIVE_BACKEND = import.meta.env.MODE === "live";
