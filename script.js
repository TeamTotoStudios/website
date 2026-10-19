const SUPABASE_URL = 'meqrwrfopzzqnqshtkgq';
const SUPABASE_ANON_KEY = 'sb_publishable_tTPIOcKy4thaTXnqsfgk2w_kOZ2Qii5';

const isConfigured =
  SUPABASE_URL.startsWith('https://') &&
  !SUPABASE_URL.includes('YOUR_SUPABASE') &&
  SUPABASE_ANON_KEY &&
  !SUPABASE_ANON_KEY.includes('YOUR_SUPABASE');

const supabaseClient = isConfigured && window.supabase
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

const $ = (selector) => document.querySelector(selector);
let authMode = 'signup';
let currentUser = null;
let currentRole = 'member';

$('#year').textContent = new Date().getFullYear();

// Mobile navigation
$('#menu-toggle').addEventListener('click', () => {
  const links = $('#nav-links');
  const isOpen = links.classList.toggle('open');
  $('#menu-toggle').setAttribute('aria-expanded', String(isOpen));
});
$('#nav-links').querySelectorAll('a').forEach((link) => {
  link.addEventListener('click', () => {
    $('#nav-links').classList.remove('open');
    $('#menu-toggle').setAttribute('aria-expanded', 'false');
  });
});

function setMessage(element, message, type = '') {
  element.textContent = message;
  element.classList.remove('error', 'success');
  if (type) element.classList.add(type);
}

function showConfigurationWarning() {
  setMessage(
    $('#events-status'),
    'The event calendar and accounts are not connected yet. Follow SETUP.md to connect a Supabase project.'
  );
  $('#events-list').innerHTML = '<div class="empty-events">Events will appear here once the website database is configured.</div>';
  setMessage($('#auth-status'), 'Account features are not configured yet. Follow SETUP.md to connect Supabase.');
  $('#auth-submit').disabled = true;
  $('#auth-submit').title = 'Connect Supabase first; see SETUP.md';
}

function setAuthMode(mode) {
  authMode = mode;
  const isSignup = mode === 'signup';
  $('#signup-tab').classList.toggle('active', isSignup);
  $('#login-tab').classList.toggle('active', !isSignup);
  $('#signup-tab').setAttribute('aria-selected', String(isSignup));
  $('#login-tab').setAttribute('aria-selected', String(!isSignup));
  $('#auth-submit').textContent = isSignup ? 'Create account' : 'Log in';
  $('#auth-form [name="password"]').autocomplete = isSignup ? 'new-password' : 'current-password';
  setMessage($('#auth-status'), '');
}
$('#signup-tab').addEventListener('click', () => setAuthMode('signup'));
$('#login-tab').addEventListener('click', () => setAuthMode('login'));

function renderAccount(user, role = 'member') {
  currentUser = user || null;
  currentRole = role || 'member';
  $('#account-signed-out').classList.toggle('hidden', Boolean(user));
  $('#account-signed-in').classList.toggle('hidden', !user);
  $('#admin-event-panel').classList.toggle('hidden', !user || currentRole !== 'admin');

  if (user) {
    $('#account-email').textContent = user.email || 'Signed-in account';
    $('#account-role').textContent = currentRole === 'admin' ? 'Administrator' : 'Member account';
    $('#admin-hint').textContent = currentRole === 'admin'
      ? 'Admin access is enabled. You can publish events in the Calendar section.'
      : 'Your account is a member account. Only an administrator can grant admin privileges.';
  }
}

async function loadRole(user) {
  if (!supabaseClient || !user) return 'member';
  const { data, error } = await supabaseClient
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();
  if (error) {
    console.error('Could not load account role:', error.message);
    return 'member';
  }
  return data?.role === 'admin' ? 'admin' : 'member';
}

async function refreshAccount(user) {
  if (!user) {
    renderAccount(null);
    return;
  }
  const role = await loadRole(user);
  renderAccount(user, role);
}

$('#auth-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!supabaseClient) return;
  const form = event.currentTarget;
  const formData = new FormData(form);
  const email = String(formData.get('email') || '').trim();
  const password = String(formData.get('password') || '');
  const submitButton = $('#auth-submit');
  submitButton.disabled = true;
  setMessage($('#auth-status'), authMode === 'signup' ? 'Creating your account…' : 'Logging in…');

  try {
    if (authMode === 'signup') {
      const { data, error } = await supabaseClient.auth.signUp({ email, password });
      if (error) throw error;
      if (data.session) {
        await refreshAccount(data.user);
        setMessage($('#auth-status'), 'Account created successfully.', 'success');
      } else {
        setMessage($('#auth-status'), 'Account created. Check your email for a confirmation link, then log in.', 'success');
      }
    } else {
      const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
      if (error) throw error;
      await refreshAccount(data.user);
      setMessage($('#auth-status'), 'You are now logged in.', 'success');
    }
    form.reset();
  } catch (error) {
    setMessage($('#auth-status'), error.message || 'Authentication failed. Please try again.', 'error');
  } finally {
    submitButton.disabled = false;
  }
});

$('#logout-button').addEventListener('click', async () => {
  if (!supabaseClient) return;
  const { error } = await supabaseClient.auth.signOut();
  if (error) {
    setMessage($('#logout-status'), error.message, 'error');
    return;
  }
  renderAccount(null);
  setMessage($('#logout-status'), 'You have logged out.', 'success');
});

function safeHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null;
  } catch {
    return null;
  }
}

function formatEventDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Date to be announced';
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(date);
}

function renderEvents(events) {
  const list = $('#events-list');
  list.replaceChildren();
  if (!events || events.length === 0) {
    list.innerHTML = '<div class="empty-events">No events have been announced yet. Check back soon!</div>';
    return;
  }
  for (const item of events) {
    const card = document.createElement('article');
    card.className = 'event-card';
    const date = document.createElement('p');
    date.className = 'event-date';
    date.textContent = formatEventDate(item.event_date);
    const title = document.createElement('h3');
    title.textContent = item.title;
    const description = document.createElement('p');
    description.textContent = item.description || 'More details are available through the event link.';
    const linkUrl = safeHttpUrl(item.event_url);
    card.append(date, title, description);
    if (linkUrl) {
      const link = document.createElement('a');
      link.className = 'event-link';
      link.href = linkUrl;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = 'Event details ↗';
      card.append(link);
    }
    list.append(card);
  }
}

async function loadEvents() {
  if (!supabaseClient) return;
  setMessage($('#events-status'), 'Loading events…');
  const { data, error } = await supabaseClient
    .from('events')
    .select('id, title, description, event_date, event_url')
    .order('event_date', { ascending: true });
  if (error) {
    console.error('Could not load events:', error.message);
    setMessage($('#events-status'), 'Could not load events. Check the Supabase setup and database policies.', 'error');
    $('#events-list').innerHTML = '<div class="empty-events">The calendar is temporarily unavailable.</div>';
    return;
  }
  setMessage($('#events-status'), data.length ? `${data.length} event${data.length === 1 ? '' : 's'} listed` : 'No upcoming events yet.');
  renderEvents(data);
}

$('#event-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!supabaseClient || !currentUser || currentRole !== 'admin') return;
  const form = event.currentTarget;
  const values = new FormData(form);
  const title = String(values.get('title') || '').trim();
  const description = String(values.get('description') || '').trim();
  const eventUrl = safeHttpUrl(String(values.get('event_url') || '').trim());
  const dateValue = String(values.get('event_date') || '');
  const eventDate = new Date(dateValue);
  if (!eventUrl) {
    setMessage($('#event-form-status'), 'Enter a valid http:// or https:// event link.', 'error');
    return;
  }
  if (Number.isNaN(eventDate.getTime())) {
    setMessage($('#event-form-status'), 'Choose a valid date and time.', 'error');
    return;
  }
  const submitButton = form.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  setMessage($('#event-form-status'), 'Publishing event…');
  const { error } = await supabaseClient.from('events').insert({
    title,
    description,
    event_date: eventDate.toISOString(),
    event_url: eventUrl,
    created_by: currentUser.id
  });
  submitButton.disabled = false;
  if (error) {
    console.error('Could not publish event:', error.message);
    setMessage($('#event-form-status'), 'Could not publish. Check that your account has admin privileges and the database policies are installed.', 'error');
    return;
  }
  form.reset();
  setMessage($('#event-form-status'), 'Event published!', 'success');
  await loadEvents();
});

async function initialize() {
  if (!supabaseClient) {
    showConfigurationWarning();
    renderAccount(null);
    return;
  }
  await loadEvents();
  const { data: { session } } = await supabaseClient.auth.getSession();
  await refreshAccount(session?.user || null);
  supabaseClient.auth.onAuthStateChange((_event, sessionNow) => {
    // Avoid making Supabase calls directly inside the auth callback.
    setTimeout(() => refreshAccount(sessionNow?.user || null), 0);
  });
}

initialize();
