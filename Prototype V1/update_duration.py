import re

content = open('Server/battleRoyal.js', 'r', encoding='utf-8').read()

# Change all 3 * 60 * 1000 to 90 * 1000
content = content.replace('3 * 60 * 1000', '90 * 1000')

open('Server/battleRoyal.js', 'w', encoding='utf-8').write(content)
print("Updated round durations to 1:30")
