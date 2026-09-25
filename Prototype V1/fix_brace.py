import re

with open('src/main.ts', 'r', encoding='utf-8') as f:
    main_ts = f.read()

# Replace the broken block
old_block = """    const classInfo2 = PLAYER_CLASSES.find((c) => c.id === p2.playerClass);
    if (abilityMeterP2) { abilityMeterP2.classList.remove('hidden');
    abilityMeterP2.classList.add('flex');
    if (classInfo2) {
      abilityLabelP2.innerText = `R: ${classInfo2.ultimateName.toUpperCase()} ${p2.classMeter}/${classInfo2.ultimateCost}`;
      abilityFillP2.style.width = `${Math.min(100, (p2.classMeter / classInfo2.ultimateCost) * 100)}%`;
    }
  }"""

new_block = """    const classInfo2 = PLAYER_CLASSES.find((c) => c.id === p2.playerClass);
    if (abilityMeterP2) {
      abilityMeterP2.classList.remove('hidden');
      abilityMeterP2.classList.add('flex');
      if (classInfo2 && abilityLabelP2 && abilityFillP2) {
        abilityLabelP2.innerText = `R: ${classInfo2.ultimateName.toUpperCase()} ${p2.classMeter}/${classInfo2.ultimateCost}`;
        abilityFillP2.style.width = `${Math.min(100, (p2.classMeter / classInfo2.ultimateCost) * 100)}%`;
      }
    }
  }"""

if old_block in main_ts:
    main_ts = main_ts.replace(old_block, new_block)
else:
    print("Could not find the exact old_block.")

# Also, there was another bug I added in update_main_perfect.py:
# `const eCtx = effectsCanvas ? effectsCanvas.getContext('2d')! : ctx;`
# But I removed `const eCtx` in `update_main3.py` when I switched to `tCtx = target.getContext('2d')`.
# That's fine.

with open('src/main.ts', 'w', encoding='utf-8') as f:
    f.write(main_ts)

print("Fixed brace")
