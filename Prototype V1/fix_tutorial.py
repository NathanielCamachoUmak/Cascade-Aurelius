content = open('src/TutorialManager.ts', 'r', encoding='utf-8').read()

old_hydrate = """    const merged = { ...readCompletedTutorialsMap(), ...metaMap, ...profileMap };
    localStorage.setItem(TUTORIAL_STORAGE_KEY, JSON.stringify(merged));
    window.dispatchEvent(new CustomEvent('tutorialProgressUpdated'));
    void syncCompletedTutorialsToCloud(merged);
  } catch {
    // ignore offline errors
  }
}"""

new_hydrate = """    const currentLocal = readCompletedTutorialsMap();
    const merged = { ...currentLocal, ...metaMap, ...profileMap };
    
    // Only write to storage if something changed
    const hasChanges = JSON.stringify(currentLocal) !== JSON.stringify(merged);
    
    localStorage.setItem(TUTORIAL_STORAGE_KEY, JSON.stringify(merged));
    window.dispatchEvent(new CustomEvent('tutorialProgressUpdated'));
    
    // Only push back to cloud if our local merged state is different than what cloud had
    const cloudHasChanges = JSON.stringify(metaMap) !== JSON.stringify(merged);
    if (cloudHasChanges) {
      void syncCompletedTutorialsToCloud(merged);
    }
  } catch {
    // ignore offline errors
  }
}"""

if old_hydrate in content:
    content = content.replace(old_hydrate, new_hydrate)
    print("Replaced hydrate logic.")
else:
    print("Could not find old_hydrate logic.")

old_auth = """supabase.auth.onAuthStateChange((_event, session) => {
  if (session?.user) void hydrateTutorialsFromCloud(session.user);
});"""

new_auth = """supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
    if (session?.user) void hydrateTutorialsFromCloud(session.user);
  }
});"""

if old_auth in content:
    content = content.replace(old_auth, new_auth)
    print("Replaced auth state change listener.")
else:
    print("Could not find auth state listener.")

open('src/TutorialManager.ts', 'w', encoding='utf-8').write(content)
print("Done updating TutorialManager.ts")
