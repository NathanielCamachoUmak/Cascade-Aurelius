/**
 * A repository of names for AI Bots.
 * Add your 50+ names to this list!
 */
export const BOT_NAMES: string[] = [
  "Gorr", "HAL 9000", "Skynet", "GLaDOS", "Deep Blue",
  "Gorr", "R2-D2", "C-3PO", "T-800", "WALL-E", "Optimus Prime",
  "Data", "Bender", "Marvin", "KITT", "Johnny 5", "Ava",
  "Jarvis", "Ultron", "Cortana", "Samantha", "TARS",
  "EVE", "Bishop", "Ash", "Roy Batty", "David",
  "Sonny", "Chappie", "RoboCop", "Megatron", "Starscream",
  "Soundwave", "Shockwave", "Iron Giant", "Baymax", "BB-8",
  "D-O", "IG-88", "HK-47", "ED-209", "T-1000",
  "T-3000", "T-X", "BoB", "Lars", "Bigdong",
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
