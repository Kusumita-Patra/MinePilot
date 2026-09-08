/** "sector_north_wall" -> "Sector North Wall" */
export function formatSectorId(sectorId: string): string {
  return sectorId.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
