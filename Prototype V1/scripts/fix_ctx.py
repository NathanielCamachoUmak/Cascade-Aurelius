with open('src/main.ts', 'r', encoding='utf-8') as f:
    ts = f.read()

# Only replace inside renderPlayer to be absolutely safe
import re
render_player_match = re.search(r"(function renderPlayer\(.*?\{)(.*?)(\}\n\nfunction render\(\))", ts, re.DOTALL)
if render_player_match:
    header = render_player_match.group(1)
    body = render_player_match.group(2)
    footer = render_player_match.group(3)
    
    new_body = body.replace("drawBlock(ctx,", "drawBlock(tCtx,")
    
    ts = ts.replace(header + body + footer, header + new_body + footer)
    with open('src/main.ts', 'w', encoding='utf-8') as f:
        f.write(ts)
    print("Fixed drawBlock target context!")
else:
    print("Could not find renderPlayer!")
