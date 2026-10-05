import os

html_files = ["lobby.html", "modeselect.html"]

consent_html = """
          <div id="auth-consent-group" class="hidden flex-col gap-2 mt-2">
            <label class="flex items-start gap-2 text-xs text-gray-400 cursor-pointer">
              <input type="checkbox" id="auth-consent-telemetry" class="mt-0.5 rounded border-gray-600 text-neon-cyan focus:ring-neon-cyan bg-deep-purple/80" />
              <span>I consent to the collection of my gameplay telemetry for academic research (UMREC).</span>
            </label>
            <label class="flex items-start gap-2 text-xs text-gray-400 cursor-pointer">
              <input type="checkbox" id="auth-consent-age" class="mt-0.5 rounded border-gray-600 text-neon-cyan focus:ring-neon-cyan bg-deep-purple/80" />
              <span>I am 18 years of age or older.</span>
            </label>
          </div>
"""

for fname in html_files:
    if os.path.exists(fname):
        with open(fname, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # inject consent group right after username group
        if 'id="auth-consent-group"' not in content:
            content = content.replace('</div>\n          <div class="flex flex-col gap-1">\n            <label class="text-[10px] text-gray-400 uppercase tracking-widest font-semibold">Email</label>',
            '</div>' + consent_html + '          <div class="flex flex-col gap-1">\n            <label class="text-[10px] text-gray-400 uppercase tracking-widest font-semibold">Email</label>')
            
            # also add the consent banner at the bottom of the body
            if 'cookie-banner' not in content:
                banner_html = """
    <!-- UMREC Consent Banner -->
    <div id="cookie-banner" class="fixed bottom-0 left-0 right-0 bg-deep-purple border-t border-card-border p-4 z-[9999] flex flex-col sm:flex-row justify-between items-center gap-4">
      <p class="text-xs text-gray-300">
        We use local storage strictly for session authentication and offline telemetry caching as part of our academic research (UMREC approved). 
        <a href="/privacy.html" class="text-neon-cyan underline">Privacy Policy</a> &bull; <a href="/tos.html" class="text-neon-cyan underline">Terms of Service</a>
      </p>
      <button id="btn-cookie-accept" class="px-4 py-2 bg-card-bg border border-neon-cyan text-neon-cyan rounded hover:bg-neon-cyan hover:text-black transition-colors text-xs font-bold tracking-widest cursor-pointer">ACKNOWLEDGE</button>
    </div>
    <script>
      if(localStorage.getItem('umrec_consent_ack')) {
        document.getElementById('cookie-banner').style.display = 'none';
      }
      document.getElementById('btn-cookie-accept')?.addEventListener('click', () => {
        localStorage.setItem('umrec_consent_ack', 'true');
        document.getElementById('cookie-banner').style.display = 'none';
      });
    </script>
</body>"""
                content = content.replace('</body>', banner_html)
            
            with open(fname, 'w', encoding='utf-8') as f:
                f.write(content)

with open('src/Auth.ts', 'r', encoding='utf-8') as f:
    auth_ts = f.read()

if 'auth-consent-group' not in auth_ts:
    auth_ts = auth_ts.replace("const usernameGroup = document.getElementById('auth-username-group')!;",
    "const usernameGroup = document.getElementById('auth-username-group')!;\n  const consentGroup = document.getElementById('auth-consent-group');\n  const consentTelemetry = document.getElementById('auth-consent-telemetry') as HTMLInputElement;\n  const consentAge = document.getElementById('auth-consent-age') as HTMLInputElement;")

    auth_ts = auth_ts.replace("usernameGroup.classList.remove('hidden');",
    "usernameGroup.classList.remove('hidden');\n      if(consentGroup) consentGroup.classList.remove('hidden');")

    auth_ts = auth_ts.replace("usernameGroup.classList.add('hidden');",
    "usernameGroup.classList.add('hidden');\n      if(consentGroup) consentGroup.classList.add('hidden');")

    validation_logic = """
    try {
      if (isRegistering) {
        if (consentTelemetry && !consentTelemetry.checked) {
          throw new Error('You must consent to telemetry collection for academic research.');
        }
        if (consentAge && !consentAge.checked) {
          throw new Error('You must be 18 years or older to participate.');
        }
"""
    auth_ts = auth_ts.replace("try {\n      if (isRegistering) {", validation_logic)
    
    with open('src/Auth.ts', 'w', encoding='utf-8') as f:
        f.write(auth_ts)

print("Applied UMREC Auth changes.")
