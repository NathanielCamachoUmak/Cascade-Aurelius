/**
 * A repository of names for AI Bots.
 */
export const BOT_NAMES: string[] = [
  "Gorr", "HAL 9000", "Skynet", "GLaDOS", "Deep Blue",
  "Corin", "Belial", "Blocks Verstrappen", "Neru", "Miku", "Teto",
  "Data", "Bender", "Marvin", "KITT", "Djikstra", "ArawAraw",
  "Jarvis", "Ultron", "Cortana", "Samantha", "TARS",
  "EVE", "Bishop", "Ash", "Shockwave", "David",
  "Sonny", "Grammatra", "Senyatta", "Megatron", "Starscream",
  "Soundwave", "Alexa", "Aela", "Elisha", "Ken",
  "Tricia", "MattPat", "Gab", "EDP445", "T-Hex",
  "Red", "Rico", "BoB", "Lars", "Bigdong",
  "Jelly", "Migol", "Kcelvs", "Simoun", "Patrick",
  "SpoggleDod", "SpungGog", "Phoneas", "Frob"
  // Add more names here as needed
];

/**
 * Returns a random name from the BOT_NAMES array that isn't already in use.
 * @param existingNames Array of names currently in the lobby/game
 * @returns A randomly selected unused name, or a fallback if all are used
 */
export function getUniqueBotName(existingNames: string[] = []): string {
  const available = BOT_NAMES.filter(name => !existingNames.includes(name));
  
  if (available.length === 0) {
    // Fallback if we somehow run out of names
    return `AI Bot ${Math.floor(Math.random() * 9999)}`;
  }
  
  const randomIndex = Math.floor(Math.random() * available.length);
  return available[randomIndex];
}
