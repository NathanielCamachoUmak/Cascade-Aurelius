import re

with open('src/main.ts', 'r', encoding='utf-8') as f:
    main_ts = f.read()

with open('modeselect.html', 'r', encoding='utf-8') as f:
    html = f.read()

# Find all getElementById calls
matches = re.findall(r"document\.getElementById\(['\"]([^'\"]+)['\"]\)", main_ts)
missing = []
for m in matches:
    # Check if id="m" exists in html
    if f'id="{m}"' not in html and f"id='{m}'" not in html:
        missing.append(m)

print("Missing IDs in HTML:", set(missing))
