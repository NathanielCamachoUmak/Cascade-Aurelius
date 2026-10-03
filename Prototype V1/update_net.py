import re

with open("src/NetworkManager.ts", "r", encoding="utf-8") as f:
    content = f.read()

content = content.replace("cullThreshold?: number }) => void", "cullThreshold?: number; scoreMultiplier?: number }) => void")

with open("src/NetworkManager.ts", "w", encoding="utf-8") as f:
    f.write(content)
