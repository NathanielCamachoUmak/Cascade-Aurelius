/**
 * A repository of names for AI Bots.
 */
export const BOT_NAMES: string[] = [
  "Gorr [Bot]", "HAL 9000 [Bot]", "Skynet [Bot]", "GLaDOS [Bot]", "Deep Blue [Bot]",
  "Corin [Bot]", "Belial [Bot]", "Blocks Verstrappen [Bot]", "Neru [Bot]", "Miku [Bot]", "Teto [Bot]",
  "Data [Bot]", "Bender [Bot]", "RafRaf [Bot]", "Rome [Bot]", "Djikstra [Bot]", "ArawAraw [Bot]",
  "Jarvis [Bot]", "Ultron [Bot]", "Cortana [Bot]", "Samantha [Bot]", "TARS [Bot]",
  "EVE [Bot]", "Bishop [Bot]", "Ash [Bot]", "Shockwave [Bot]", "David [Bot]",
  "Sonny [Bot]", "Shitler [Bot]", "Daboi [Bot]", "Megatron [Bot]", "Starscream [Bot]",
  "Soundwave [Bot]", "Alexa [Bot]", "Aela [Bot]", "Elisha [Bot]", "Ken [Bot]",
  "Tricia [Bot]", "MattPat [Bot]", "Gab [Bot]", "EDP445 [Bot]", "T-Hex [Bot]",
  "Red [Bot]", "Rico [Bot]", "BoB [Bot]", "Lars [Bot]", "Bigdong [Bot]",
  "Jelly [Bot]", "Migol [Bot]", "Kcelvs [Bot]", "Simoun [Bot]", "Patrick [Bot]",
  "SpoggleDod [Bot]", "SpungGog [Bot]", "Phoneas [Bot]", "Frob"
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
