/* Fahrtbriefing — Laufzeitkonfiguration (kein Modul, wird vor der App geladen).
 * apiBase: Adresse des Cloudflare Workers. Leer = lokaler Modus ohne Server.
 * Nach dem Deployment des Workers (SETUP.md) hier die Domain eintragen.
 */
window.BRIEFING_CONFIG = {
  apiBase: 'https://briefing-api.balthasar.workers.dev',
};
