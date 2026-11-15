/**
 * Prefix marking a system-generated "covered" attendance note. Such rows exist
 * so a lecture can be closed without recording an unfair absence for a
 * student who attended a parallel session of the same course — they are NOT
 * evidence of a physical second attendance and must never be counted in
 * attendance statistics or follow-up counters.
 */
export const COVER_NOTE_PREFIX = 'حاضر عبر';
