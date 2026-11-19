import { supabase } from './supabase';
import { showToast } from './Toast';

export function openAuthModal() {
  const modal = document.getElementById('auth-modal');
  if (modal) modal.classList.remove('hidden');
}

export function openPasswordResetModal() {
  const modal = ensurePasswordResetModal();
  const errorMsg = document.getElementById('password-reset-error');
  const form = document.getElementById('password-reset-form') as HTMLFormElement | null;
  if (errorMsg) {
    errorMsg.textContent = '';
    errorMsg.classList.add('hidden');
  }
  if (form) form.reset();
  modal.classList.remove('hidden');
}

function wirePasswordResetModal(modal: HTMLElement) {
  if (modal.dataset.wired === 'true') return;
  modal.dataset.wired = 'true';

  const btnClose = modal.querySelector('#btn-password-reset-close');
  btnClose?.addEventListener('click', () => {
    modal.classList.add('hidden');
  });

  const form = modal.querySelector('#password-reset-form') as HTMLFormElement | null;
  const newPassInput = modal.querySelector('#new-password-input') as HTMLInputElement | null;
  const confirmPassInput = modal.querySelector('#confirm-password-input') as HTMLInputElement | null;
  const errorMsg = modal.querySelector('#password-reset-error') as HTMLElement | null;
  const submitBtn = modal.querySelector('#btn-password-reset-submit') as HTMLButtonElement | null;

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (errorMsg) errorMsg.classList.add('hidden');

    const newPassword = newPassInput?.value || '';
    const confirmPassword = confirmPassInput?.value || '';

    if (newPassword.length < 6) {
      if (errorMsg) {
        errorMsg.textContent = 'Password must be at least 6 characters.';
        errorMsg.classList.remove('hidden');
      }
      return;
    }

    if (newPassword !== confirmPassword) {
      if (errorMsg) {
        errorMsg.textContent = 'Passwords do not match.';
        errorMsg.classList.remove('hidden');
      }
      return;
    }

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'UPDATING...';
    }

    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;

      showToast('Password updated successfully! You are now logged in.', 'success');
      modal.classList.add('hidden');
      form.reset();

      // Clean hash tokens from address bar if present
      if (window.location.hash) {
        history.replaceState(null, '', window.location.pathname + window.location.search);
      }
    } catch (err: any) {
      if (errorMsg) {
        errorMsg.textContent = err.message || 'Failed to update password.';
        errorMsg.classList.remove('hidden');
      }
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'SAVE NEW PASSWORD';
      }
    }
  });
}

export function ensurePasswordResetModal(): HTMLElement {
  let modal = document.getElementById('password-reset-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'password-reset-modal';
    modal.className = 'hidden fixed inset-0 z-[110] flex items-center justify-center bg-black/80 backdrop-blur-sm px-4';
    modal.innerHTML = `
      <div class="relative w-full max-w-sm bg-card-bg border border-neon-cyan/50 rounded-xl shadow-[0_0_30px_rgba(0,255,255,0.2)] p-6">
        <button id="btn-password-reset-close" type="button" class="absolute top-4 right-4 text-gray-400 hover:text-white text-xl leading-none cursor-pointer">&times;</button>
        <h2 class="text-white font-extrabold text-lg tracking-wide mb-1">Set New Password</h2>
        <p class="text-gray-400 text-xs mb-5">Choose a new password for your account.</p>

        <form id="password-reset-form" class="flex flex-col gap-4">
          <div class="flex flex-col gap-1">
            <label class="text-[10px] text-gray-400 uppercase tracking-widest font-semibold">New Password</label>
            <input id="new-password-input" type="password" required minlength="6" placeholder="••••••••" class="w-full bg-deep-purple/80 border border-card-border text-white px-3 py-2 text-sm rounded focus:outline-none focus:border-neon-cyan" />
          </div>
          <div class="flex flex-col gap-1">
            <label class="text-[10px] text-gray-400 uppercase tracking-widest font-semibold">Confirm Password</label>
            <input id="confirm-password-input" type="password" required minlength="6" placeholder="••••••••" class="w-full bg-deep-purple/80 border border-card-border text-white px-3 py-2 text-sm rounded focus:outline-none focus:border-neon-cyan" />
          </div>
          <p id="password-reset-error" class="text-red-500 text-xs hidden"></p>
          <button type="submit" id="btn-password-reset-submit" class="mt-2 w-full px-4 py-2.5 bg-neon-cyan text-deep-purple font-bold tracking-widest rounded transition-all hover:brightness-110 cursor-pointer uppercase">SAVE NEW PASSWORD</button>
        </form>
      </div>
    `;
    document.body.appendChild(modal);
  }

  wirePasswordResetModal(modal);
  return modal;
}

export type AuthMode = 'signin' | 'register' | 'forgot';

export async function mountAuth() {
  const btnOpen = document.getElementById('btn-auth-open');
  const userDisplay = document.getElementById('auth-user-display');
  const usernameDisplay = document.getElementById('auth-username');
  const btnLogout = document.getElementById('btn-auth-logout');

  const modal = document.getElementById('auth-modal');
  if (!modal) return;

  const btnClose = document.getElementById('btn-auth-close');
  const form = document.getElementById('auth-form') as HTMLFormElement;
  const toggleBtn = document.getElementById('btn-auth-toggle') as HTMLButtonElement;
  const title = document.getElementById('auth-modal-title');
  const subtitle = document.getElementById('auth-modal-subtitle');
  const submitBtn = document.getElementById('btn-auth-submit') as HTMLButtonElement;

  const usernameGroup = document.getElementById('auth-username-group');
  const consentGroup = document.getElementById('auth-consent-group');
  const consentTelemetry = document.getElementById('auth-consent-telemetry') as HTMLInputElement | null;
  const consentAge = document.getElementById('auth-consent-age') as HTMLInputElement | null;
  const usernameInput = document.getElementById('auth-username-input') as HTMLInputElement;
  const emailInput = document.getElementById('auth-email-input') as HTMLInputElement;
  const passwordInput = document.getElementById('auth-password-input') as HTMLInputElement;
  const errorMsg = document.getElementById('auth-error')!;

  // Locate or dynamically create "Forgot Password" and "Back to Sign In" controls
  let passwordGroup = document.getElementById('auth-password-group');
  if (!passwordGroup && passwordInput) {
    passwordGroup = passwordInput.parentElement;
    if (passwordGroup) passwordGroup.id = 'auth-password-group';
  }

  let forgotBtn = document.getElementById('btn-auth-forgot') as HTMLButtonElement | null;
  if (!forgotBtn && passwordGroup) {
    const labelRow = passwordGroup.querySelector('label')?.parentElement;
    forgotBtn = document.createElement('button');
    forgotBtn.type = 'button';
    forgotBtn.id = 'btn-auth-forgot';
    forgotBtn.className = 'text-[10px] text-neon-cyan hover:underline cursor-pointer ml-auto';
    forgotBtn.textContent = 'Forgot?';
    if (labelRow && labelRow !== passwordGroup) {
      labelRow.appendChild(forgotBtn);
    } else {
      const headerRow = document.createElement('div');
      headerRow.className = 'flex justify-between items-center';
      const label = passwordGroup.querySelector('label');
      if (label) {
        passwordGroup.insertBefore(headerRow, label);
        headerRow.appendChild(label);
        headerRow.appendChild(forgotBtn);
      }
    }
  }

  let btnBackSignin = document.getElementById('btn-auth-back-signin') as HTMLButtonElement | null;
  if (!btnBackSignin && toggleBtn?.parentElement) {
    btnBackSignin = document.createElement('button');
    btnBackSignin.type = 'button';
    btnBackSignin.id = 'btn-auth-back-signin';
    btnBackSignin.className = 'hidden text-xs text-gray-400 hover:text-white cursor-pointer underline';
    btnBackSignin.textContent = 'Back to Sign In';
    toggleBtn.parentElement.appendChild(btnBackSignin);
  }

  let currentMode: AuthMode = 'signin';

  function setMode(mode: AuthMode) {
    currentMode = mode;
    errorMsg.classList.add('hidden');

    if (mode === 'register') {
      if (title) title.textContent = 'Register';
      if (subtitle) subtitle.textContent = 'Create an account to track progression & stats.';
      if (submitBtn) submitBtn.textContent = 'CREATE ACCOUNT';
      if (toggleBtn) {
        toggleBtn.textContent = 'Already have an account? Sign In';
        toggleBtn.classList.remove('hidden');
      }
      btnBackSignin?.classList.add('hidden');
      usernameGroup?.classList.remove('hidden');
      passwordGroup?.classList.remove('hidden');
      forgotBtn?.classList.add('hidden');
      consentGroup?.classList.remove('hidden');
      if (usernameInput) usernameInput.required = true;
      if (passwordInput) passwordInput.required = true;
    } else if (mode === 'forgot') {
      if (title) title.textContent = 'Reset Password';
      if (subtitle) subtitle.textContent = 'Enter your email to receive recovery instructions.';
      if (submitBtn) submitBtn.textContent = 'SEND RECOVERY EMAIL';
      toggleBtn?.classList.add('hidden');
      btnBackSignin?.classList.remove('hidden');
      usernameGroup?.classList.add('hidden');
      passwordGroup?.classList.add('hidden');
      forgotBtn?.classList.add('hidden');
      consentGroup?.classList.add('hidden');
      if (usernameInput) usernameInput.required = false;
      if (passwordInput) passwordInput.required = false;
    } else {
      // signin
      if (title) title.textContent = 'Sign In';
      if (subtitle) subtitle.textContent = 'Access your profile and cloud saves.';
      if (submitBtn) submitBtn.textContent = 'SIGN IN';
      if (toggleBtn) {
        toggleBtn.textContent = 'Need an account? Register';
        toggleBtn.classList.remove('hidden');
      }
      btnBackSignin?.classList.add('hidden');
      usernameGroup?.classList.add('hidden');
      passwordGroup?.classList.remove('hidden');
      forgotBtn?.classList.remove('hidden');
      consentGroup?.classList.add('hidden');
      if (usernameInput) usernameInput.required = false;
      if (passwordInput) passwordInput.required = true;
    }
  }

  // Initialize UI based on current session
  const { data: { session } } = await supabase.auth.getSession();
  updateUI(session?.user ?? null);

  // Initialize Password Reset Modal elements
  ensurePasswordResetModal();

  // Listen for auth changes
  supabase.auth.onAuthStateChange((event, newSession) => {
    updateUI(newSession?.user ?? null);

    if (event === 'PASSWORD_RECOVERY') {
      openPasswordResetModal();
      showToast('Password recovery verified. Enter your new password.', 'info');
    } else if (event === 'SIGNED_IN') {
      const hash = window.location.hash.replace(/^#/, '');
      if (hash.includes('type=magiclink')) {
        showToast('Signed in via Magic Link!', 'success');
        history.replaceState(null, '', window.location.pathname + window.location.search);
      }
    }
  });

  // Check URL hash directly for recovery or magiclink
  const rawHash = window.location.hash.replace(/^#/, '');
  if (rawHash) {
    const hashParams = new URLSearchParams(rawHash);
    const hashType = hashParams.get('type');
    if (hashType === 'recovery' || rawHash.includes('type=recovery')) {
      openPasswordResetModal();
      showToast('Password recovery verified. Enter your new password.', 'info');
    } else if (hashType === 'magiclink' || rawHash.includes('type=magiclink')) {
      showToast('Signed in via Magic Link!', 'success');
      history.replaceState(null, '', window.location.pathname + window.location.search);
    }
  }

  function updateUI(user: any) {
    if (user) {
      btnOpen?.classList.add('hidden');
      userDisplay?.classList.remove('hidden');
      const name = user.user_metadata?.display_name || user.user_metadata?.username || user.email?.split('@')[0] || 'Player';
      if (usernameDisplay) {
        usernameDisplay.textContent = name;
      }
      modal?.classList.add('hidden');

      // Auto-heal existing user metadata so display_name shows in Supabase dashboard
      if (user.user_metadata?.username && !user.user_metadata?.display_name) {
        supabase.auth.updateUser({
          data: {
            display_name: user.user_metadata.username,
            full_name: user.user_metadata.username,
            name: user.user_metadata.username,
          }
        }).catch(() => {});
      }
    } else {
      btnOpen?.classList.remove('hidden');
      userDisplay?.classList.add('hidden');
    }
  }

  btnOpen?.addEventListener('click', () => {
    setMode('signin');
    modal.classList.remove('hidden');
  });

  btnClose?.addEventListener('click', () => {
    modal.classList.add('hidden');
    errorMsg.classList.add('hidden');
    setMode('signin');
  });

  toggleBtn?.addEventListener('click', () => {
    setMode(currentMode === 'register' ? 'signin' : 'register');
  });

  forgotBtn?.addEventListener('click', () => {
    setMode('forgot');
  });

  btnBackSignin?.addEventListener('click', () => {
    setMode('signin');
  });

  btnLogout?.addEventListener('click', async () => {
    await supabase.auth.signOut();
    showToast('Logged out.', 'info');
  });

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorMsg.classList.add('hidden');
    submitBtn.disabled = true;
    const prevBtnText = submitBtn.textContent;
    submitBtn.textContent = 'PLEASE WAIT...';

    const email = emailInput.value.trim();
    const password = passwordInput.value;
    const username = usernameInput ? usernameInput.value.trim() : '';

    try {
      if (currentMode === 'forgot') {
        const redirectUrl = `${window.location.origin}${window.location.pathname}`;
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: redirectUrl,
        });
        if (error) throw error;

        showToast('Password recovery email sent! Check your inbox.', 'success');
        modal.classList.add('hidden');
        setMode('signin');
        form.reset();
      } else if (currentMode === 'register') {
        if (!username) {
          throw new Error('Please enter a username.');
        }
        if (username.length < 3 || username.length > 20) {
          throw new Error('Username must be between 3 and 20 characters.');
        }
        if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
          throw new Error('Username can only contain letters, numbers, underscores, and dashes.');
        }
        if (consentTelemetry && !consentTelemetry.checked) {
          throw new Error('You must consent to telemetry collection for academic research.');
        }
        if (consentAge && !consentAge.checked) {
          throw new Error('You must be 18 years or older to participate.');
        }

        // Check if username is already taken (case-insensitive check)
        const { data: isAvail, error: rpcErr } = await supabase.rpc('is_username_available', { check_username: username });
        if (!rpcErr && isAvail === false) {
          throw new Error(`Username "${username}" is already taken. Please choose another.`);
        }
        if (rpcErr) {
          // Fallback direct check against profiles table
          const { data: existingProfile } = await supabase
            .from('profiles')
            .select('username')
            .ilike('username', username)
            .maybeSingle();

          if (existingProfile) {
            throw new Error(`Username "${username}" is already taken. Please choose another.`);
          }
        }

        const { error, data } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              username: username,
              display_name: username,
              full_name: username,
              name: username,
            },
            emailRedirectTo: `${window.location.origin}${window.location.pathname}`,
          }
        });
        if (error) throw error;

        if (data.user && data.user.identities && data.user.identities.length === 0) {
          throw new Error('This email is already registered.');
        }

        // Ensure profile row exists if session is established immediately
        if (data.session?.user) {
          await supabase.from('profiles').upsert({
            id: data.session.user.id,
            username: username,
          }, { onConflict: 'id' }).catch(() => {});
        }

        if (data.session) {
          modal.classList.add('hidden');
          form.reset();
          showToast('Account created and logged in!', 'success');
        } else {
          showToast('Registration successful! Please check your email.', 'success');
          modal.classList.add('hidden');
          form.reset();
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        showToast('Signed in successfully!', 'success');
        modal.classList.add('hidden');
        form.reset();
      }
    } catch (err: any) {
      errorMsg.textContent = err.message || 'An error occurred during authentication.';
      errorMsg.classList.remove('hidden');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = prevBtnText;
    }
  });
}
