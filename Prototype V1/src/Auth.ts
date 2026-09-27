import { supabase } from './supabase';
import { showToast } from './Toast';

export function openAuthModal() {
  const modal = document.getElementById('auth-modal');
  if (modal) modal.classList.remove('hidden');
}

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

  const testSuccessBtn = document.getElementById('btn-test-success');
  if (testSuccessBtn) {
    testSuccessBtn.addEventListener('click', () => {
      showToast('Registration successful! Please check your email.', 'success');
      modal.classList.add('hidden');
    });
  }

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
        const { error, data } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { username }
          }
        });
        if (error) throw error;
        
        // Show success message instead of instantly closing the modal if they need to verify
        if (data.user && data.user.identities && data.user.identities.length === 0) {
          throw new Error('This email is already registered.');
        }

        if (data.session) {
          // Email confirmation is OFF, they are instantly logged in!
          modal.classList.add('hidden');
          form.reset();
          showToast('Account created and logged in!', 'success');
        } else {
          // Email confirmation is ON, session is null, they need to check email
          showToast('Registration successful! Please check your email.', 'success');
          modal.classList.add('hidden'); // Close modal so they can go check their email
          form.reset(); // clear fields
        }
        
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
