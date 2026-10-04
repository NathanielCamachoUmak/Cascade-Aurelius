content = open('src/lobby.ts', 'r', encoding='utf-8').read()

old_interval = """    // Start repeating update for UI
    if (teamTimerInterval) window.clearInterval(teamTimerInterval);
    teamTimerInterval = window.setInterval(updateTeamScoreHud, 250);
    updateTeamScoreHud();
  }
}"""

new_interval = """    // Start repeating update for UI
    if (teamTimerInterval) window.clearInterval(teamTimerInterval);
    teamTimerInterval = window.setInterval(() => {
      updateTeamScoreHud();
      updateBattleRoyalHud();
    }, 250);
    updateTeamScoreHud();
    updateBattleRoyalHud();
  } else if (mode?.id === 'battle-royale') {
    if (teamTimerInterval) window.clearInterval(teamTimerInterval);
    teamTimerInterval = window.setInterval(updateBattleRoyalHud, 250);
  }
}"""

if old_interval in content:
    content = content.replace(old_interval, new_interval)
    open('src/lobby.ts', 'w', encoding='utf-8').write(content)
    print("Added setInterval for battle royale HUD updates!")
else:
    print("Could not find teamTimerInterval block!")
