content = open('src/TutorialManager.ts', 'r', encoding='utf-8').read()

old_hydrate = """    // Only push back to cloud if our local merged state is different than what cloud had
    const cloudHasChanges = JSON.stringify(metaMap) !== JSON.stringify(merged);
    if (cloudHasChanges) {
      void syncCompletedTutorialsToCloud(merged);
    }"""

new_hydrate = """    // Only push back to cloud if our local merged state is different than what cloud had
    const metaKeys = Object.keys(metaMap).sort().join(',');
    const mergedKeys = Object.keys(merged).sort().join(',');
    if (metaKeys !== mergedKeys) {
      void syncCompletedTutorialsToCloud(merged);
    }"""

if old_hydrate in content:
    content = content.replace(old_hydrate, new_hydrate)
    open('src/TutorialManager.ts', 'w', encoding='utf-8').write(content)
    print("Replaced cloudHasChanges check!")
else:
    print("Could not find old cloudHasChanges check!")
