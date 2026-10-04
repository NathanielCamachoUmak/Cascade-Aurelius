content = open('Server/index.js', 'r', encoding='utf-8').read()
# Get context around startTeamMatchTimer
idx = 19348
print(repr(content[max(0,idx-300):idx+300]))
