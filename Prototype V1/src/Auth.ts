import { supabase } from './supabase';

export async function mountAuth() {
  const btnOpen = document.getElementById('btn-auth-open')!;
  const userDisplay = document.getElementById('auth-user-display')!;
  const usernameDisplay = document.getElementById('auth-username')!;
  const btnLogout = document.getElementById('btn-auth-logout')!;

  const modal = document.getElementById('auth-modal')!;
  const btnClose = document.getElementById('btn-auth-close')!;
  const form = document.getElementById('auth-form') as HTMLFormElement;
  const toggleBtn = document.getElementById('btn-auth-toggle')!;
  const title = document.getElementById('auth-modal-title')!;
  const submitBtn = document.getElementById('btn-auth-submit') as HTMLButtonElement;
  
  const usernameGroup = document.getElementById('auth-username-group')!;
  const usernameInput = document.getElementById('auth-username-input') as HTMLInputElement;
  const emailInput = document.getElementById('auth-email-input') as HTMLInputElement;
  const passwordInput = document.getElementById('auth-password-input') as HTMLInputElement;
  const errorMsg = document.getElementById('auth-error')!;

  let isRegistering = false;

  // Initialize UI based on current session
  const { data: { session } } = await supabase.auth.getSession();
  updateUI(session?.user ?? null);

  // Listen for auth changes
  supabase.auth.onAuthStateChange((_event, session) => {
    updateUI(session?.user ?? null);
  });

  function updateUI(user: any) {
    if (user) {
      btnOpen.classList.add('hidden');
      userDisplay.classList.remove('hidden');
      usernameDisplay.textContent = user.user_metadata?.username || user.email?.split('@')[0] || 'Player';
      modal.classList.add('hidden');
    } else {
      btnOpen.classList.remove('hidden');
      userDisplay.classList.add('hidden');
    }
  }

  btnOpen.addEventListener('click', () => {
    modal.classList.remove('hidden');
  });

  btnClose.addEventListener('click', () => {
    modal.classList.add('hidden');
    errorMsg.classList.add('hidden');
  });

  toggleBtn.addEventListener('click', () => {
    isRegistering = !isRegistering;
    errorMsg.classList.add('hidden');
    if (isRegistering) {
      title.textContent = 'Register';
      submitBtn.textContent = 'CREATE ACCOUNT';
      toggleBtn.textContent = 'Already have an account? Sign In';
      usernameGroup.classList.remove('hidden');
      usernameInput.required = true;
    } else {
      title.textContent = 'Sign In';
      submitBtn.textContent = 'SIGN IN';
      toggleBtn.textContent = 'Need an account? Register';
      usernameGroup.classList.add('hidden');
      usernameInput.required = false;
    }
  });

  btnLogout.addEventListener('click', async () => {
    await supabase.auth.signOut();
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorMsg.classList.add('hidden');
    submitBtn.disabled = true;
    submitBtn.textContent = 'PLEASE WAIT...';

    const email = emailInput.value;
    const password = passwordInput.value;
    const username = usernameInput.value;

    try {
      if (isRegistering) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { username }
          }
        });
        if (error) throw error;
        // On success, Supabase might require email confirmation, but usually logs in if disabled.
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
      }
    } catch (err: any) {
      errorMsg.textContent = err.message;
      errorMsg.classList.remove('hidden');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = isRegistering ? 'CREATE ACCOUNT' : 'SIGN IN';
    }
  });
}
