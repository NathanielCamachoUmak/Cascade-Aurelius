import re

with open('src/main.ts', 'r', encoding='utf-8') as f:
    ts = f.read()

# Just remove all lines containing "hudP2."
ts = re.sub(r"^\s*hudP2\..*\n", "", ts, flags=re.MULTILINE)

with open('src/main.ts', 'w', encoding='utf-8') as f:
    f.write(ts)

print("Removed all hudP2 method calls")
