const SUPABASE_URL = 'https://meqrwrfopzzqnqshtkgq.supabase.co';
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
    'The event calendar and accounts are not connected yet.'
  );
  $('#events-list').innerHTML = '<div class="empty-events">Events will appear here once the website database is configured.</div>';
  setMessage($('#auth-status'), 'Account features are not configured yet.');
  $('#auth-submit').disabled = true;
  $('#auth-submit').title = 'Connect Supabase first';
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
      ? 'Admin access is enabled. You can publish and delete events in the Calendar section.'
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
    await loadEvents();
    return;
  }
  const role = await loadRole(user);
  renderAccount(user, role);
  await loadEvents();
}

$('#auth-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!supabaseClient) return;
  const formData = new FormData(event.currentTarget);
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
    event.currentTarget.reset();
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
  await loadEvents();
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
  if (!value) return 'Date to be announced';
  const datePart = String(value).slice(0, 10);
  const date = new Date(`${datePart}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return 'Date to be announced';
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeZone: 'UTC'
  }).format(date);
}

function formatEventDateRange(startValue, endValue) {
  const start = formatEventDate(startValue);
  if (!endValue || String(endValue).slice(0, 10) === String(startValue || '').slice(0, 10)) return start;
  return `${start} – ${formatEventDate(endValue)}`;
}

function addEventLink(container, label, value) {
  const linkUrl = safeHttpUrl(String(value || '').trim());
  if (!linkUrl) return;
  const link = document.createElement('a');
  link.className = 'event-link';
  link.href = linkUrl;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.textContent = `${label} ↗`;
  container.append(link);
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
    date.textContent = formatEventDateRange(item.event_date, item.end_date);
   const titleGroup = document.createElement('div');
titleGroup.className = 'event-title-group';

if (item.logo_url) {
  const logo = document.createElement('img');
  logo.className = 'event-logo';
  logo.src = item.logo_url;
  logo.alt = `${item.title} logo`;
  logo.loading = 'lazy';
  titleGroup.append(logo);
}

const title = document.createElement('h3');
title.textContent = item.title;
titleGroup.append(title);
    const links = document.createElement('div');
    links.className = 'event-links';
    addEventLink(links, 'Details', item.event_url);
    addEventLink(links, 'Twitch', item.twitch_url);
    addEventLink(links, 'Discord', item.discord_url);

    if (currentRole === 'admin') {
      const deleteButton = document.createElement('button');
      deleteButton.className = 'event-delete-button';
      deleteButton.type = 'button';
      deleteButton.textContent = 'Delete event';
      deleteButton.setAttribute('aria-label', `Delete event: ${item.title}`);
      deleteButton.addEventListener('click', () => deleteEvent(item.id, item.title, deleteButton));
      links.append(deleteButton);
    }

    card.append(date, titleGroup, links);
    list.append(card);
  }
}

async function deleteEvent(eventId, title, button) {
  if (!supabaseClient || !currentUser || currentRole !== 'admin') return;
  if (!window.confirm(`Delete “${title}”? This cannot be undone.`)) return;

  button.disabled = true;
  button.textContent = 'Deleting…';
  const { error } = await supabaseClient.from('events').delete().eq('id', eventId);
  if (error) {
    console.error('Could not delete event:', error.message);
    setMessage($('#events-status'), 'Could not delete event. Check admin permissions and database policies.', 'error');
    button.disabled = false;
    button.textContent = 'Delete event';
    return;
  }
  await loadEvents();
}

async function loadEvents() {
  if (!supabaseClient) return;
  setMessage($('#events-status'), 'Loading events…');
  const { data, error } = await supabaseClient
    .from('events')
    .select('id, title, event_date, end_date, event_url, twitch_url, discord_url, logo_url')
    .order('event_date', { ascending: true });
  if (error) {
    console.error('Could not load events:', error.message);
    setMessage($('#events-status'), 'Could not load events.', 'error');
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
  const eventUrl = safeHttpUrl(String(values.get('event_url') || '').trim());
  const twitchValue = String(values.get('twitch_url') || '').trim();
  const discordValue = String(values.get('discord_url') || '').trim();
  const twitchUrl = twitchValue ? safeHttpUrl(twitchValue) : null;
  const discordUrl = discordValue ? safeHttpUrl(discordValue) : null;
  const startDate = String(values.get('event_date') || '');
  const endDate = String(values.get('end_date') || '');
  const logoFile = values.get('event_logo');

if (logoFile && logoFile.size > 0) {
  const allowedTypes = [
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/gif'
  ];

  if (!allowedTypes.includes(logoFile.type)) {
    setMessage(
      $('#event-form-status'),
      'Choose a PNG, JPG, WEBP or GIF image.',
      'error'
    );
    return;
  }

  if (logoFile.size > 3 * 1024 * 1024) {
    setMessage(
      $('#event-form-status'),
      'The event logo must be 3 MB or smaller.',
      'error'
    );
    return;
  }
}
  if (!eventUrl) {
    setMessage($('#event-form-status'), 'Enter a valid http:// or https:// event details link.', 'error');
    return;
  }
  if ((twitchValue && !twitchUrl) || (discordValue && !discordUrl)) {
    setMessage($('#event-form-status'), 'Twitch and Discord links must be valid http:// or https:// URLs.', 'error');
    return;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
    setMessage($('#event-form-status'), 'Choose a valid start date and end date.', 'error');
    return;
  }
  if (endDate < startDate) {
    setMessage($('#event-form-status'), 'The end date must be on or after the start date.', 'error');
    return;
  }
  const submitButton = form.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  setMessage($('#event-form-status'), 'Publishing event…');
  
  const submitButton = form.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  setMessage($('#event-form-status'), 'Publishing event…');

  try {
    let logoUrl = null;

    if (logoFile && logoFile.size > 0) {
      setMessage($('#event-form-status'), 'Uploading event logo…');

      const extensionByType = {
        'image/png': 'png',
        'image/jpeg': 'jpg',
        'image/webp': 'webp',
        'image/gif': 'gif'
      };

      const extension = extensionByType[logoFile.type];
      const filePath = `${currentUser.id}/${crypto.randomUUID()}.${extension}`;

      const { error: uploadError } = await supabaseClient.storage
        .from('event-logos')
        .upload(filePath, logoFile, {
          contentType: logoFile.type,
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabaseClient.storage
        .from('event-logos')
        .getPublicUrl(filePath);

      logoUrl = publicUrlData.publicUrl;
    }

    setMessage($('#event-form-status'), 'Saving event…');

    const { error } = await supabaseClient.from('events').insert({
      title,
      event_date: `${startDate}T12:00:00.000Z`,
      end_date: endDate,
      event_url: eventUrl,
      twitch_url: twitchUrl,
      discord_url: discordUrl,
      logo_url: logoUrl,
      created_by: currentUser.id
    });

    if (error) throw error;

    form.reset();
    setMessage($('#event-form-status'), 'Event published!', 'success');
    await loadEvents();
  } catch (error) {
    console.error('Could not publish event:', error);
    setMessage(
      $('#event-form-status'),
      `Could not publish event: ${error.message || 'Please check your Supabase setup.'}`,
      'error'
    );
  } finally {
    submitButton.disabled = false;
  }

  submitButton.disabled = false;
  if (error) {
    console.error('Could not publish event:', error.message);
    setMessage($('#event-form-status'), 'Could not publish. Check admin permissions.', 'error');
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
  const { data: { session } } = await supabaseClient.auth.getSession();
  await refreshAccount(session?.user || null);
  supabaseClient.auth.onAuthStateChange((_event, sessionNow) => {
    // Avoid making Supabase calls directly inside the auth callback.
    setTimeout(() => refreshAccount(sessionNow?.user || null), 0);
  });
}

initialize();
