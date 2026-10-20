const SUPABASE_URL = 'https://meqrwrfopzzqnqshtkgq.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_tTPIOcKy4thaTXnqsfgk2w_kOZ2Qii5';
const configured = SUPABASE_URL.startsWith('https://') && !SUPABASE_URL.includes('YOUR_SUPABASE') && SUPABASE_ANON_KEY && !SUPABASE_ANON_KEY.includes('YOUR_SUPABASE');
const supabaseClient = configured && window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;
const $ = selector => document.querySelector(selector);
let authMode = 'signup', currentUser = null, currentRole = 'member';

$('#year').textContent = new Date().getFullYear();
$('#menu-toggle').addEventListener('click', () => {
  const open = $('#nav-links').classList.toggle('open');
  $('#menu-toggle').setAttribute('aria-expanded', String(open));
});
$('#nav-links').querySelectorAll('a').forEach(link => link.addEventListener('click', () => {
  $('#nav-links').classList.remove('open');
  $('#menu-toggle').setAttribute('aria-expanded', 'false');
}));
function setMessage(element, message, type = '') {
  element.textContent = message;
  element.classList.remove('error', 'success');
  if (type) element.classList.add(type);
}
function showConfigurationWarning() {
  setMessage($('#events-status'), 'The event calendar is not connected yet.');
  $('#events-list').innerHTML = '<div class="empty-events">Events will appear here once the website database is configured.</div>';
  setMessage($('#archive-status'), 'The event archive is not connected yet.');
  $('#archive-list').innerHTML = '<div class="empty-events">Archived events will appear here once the website database is configured.</div>';
  setMessage($('#auth-status'), 'Account features are not configured yet.');
  $('#auth-submit').disabled = true;
  $('#auth-submit').title = 'Connect Supabase first';
}
function setAuthMode(mode) {
  authMode = mode;
  const signup = mode === 'signup';
  $('#signup-tab').classList.toggle('active', signup);
  $('#login-tab').classList.toggle('active', !signup);
  $('#signup-tab').setAttribute('aria-selected', String(signup));
  $('#login-tab').setAttribute('aria-selected', String(!signup));
  $('#auth-submit').textContent = signup ? 'Create account' : 'Log in';
  $('#auth-form [name="password"]').autocomplete = signup ? 'new-password' : 'current-password';
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
  $('#admin-archive-panel').classList.toggle('hidden', !user || currentRole !== 'admin');
  if (user) {
    $('#account-email').textContent = user.email || 'Signed-in account';
    $('#account-role').textContent = currentRole === 'admin' ? 'Administrator' : 'Member account';
  }
}
async function loadRole(user) {
  if (!supabaseClient || !user) return 'member';
  const { data, error } = await supabaseClient.from('profiles').select('role').eq('id', user.id).maybeSingle();
  if (error) { console.error('Could not load account role:', error.message); return 'member'; }
  return data?.role === 'admin' ? 'admin' : 'member';
}
async function refreshAccount(user) {
  if (!user) { renderAccount(null); await loadEvents(); return; }
  renderAccount(user, await loadRole(user));
  await loadEvents();
}
$('#auth-form').addEventListener('submit', async event => {
  event.preventDefault();
  if (!supabaseClient) return;
  const values = new FormData(event.currentTarget);
  const email = String(values.get('email') || '').trim(), password = String(values.get('password') || '');
  const button = $('#auth-submit');
  button.disabled = true;
  setMessage($('#auth-status'), authMode === 'signup' ? 'Creating your account…' : 'Logging in…');
  try {
    if (authMode === 'signup') {
      const { data, error } = await supabaseClient.auth.signUp({ email, password });
      if (error) throw error;
      if (data.session) {
        await refreshAccount(data.user);
        setMessage($('#auth-status'), 'Account created successfully.', 'success');
      } else setMessage($('#auth-status'), 'Account created. Check your email for a confirmation link, then log in.', 'success');
    } else {
      const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
      if (error) throw error;
      await refreshAccount(data.user);
      setMessage($('#auth-status'), 'You are now logged in.', 'success');
    }
    event.currentTarget.reset();
  } catch (error) { setMessage($('#auth-status'), error.message || 'Authentication failed. Please try again.', 'error'); }
  finally { button.disabled = false; }
});
$('#logout-button').addEventListener('click', async () => {
  if (!supabaseClient) return;
  const { error } = await supabaseClient.auth.signOut();
  if (error) { setMessage($('#logout-status'), error.message, 'error'); return; }
  renderAccount(null);
  await loadEvents();
  setMessage($('#logout-status'), 'You have logged out.', 'success');
});
function safeHttpUrl(value) {
  try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) ? url.href : null; }
  catch { return null; }
}
function formatEventDate(value) {
  if (!value) return 'Date to be announced';
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? 'Date to be announced' : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeZone: 'UTC' }).format(date);
}
function formatEventDateRange(start, end) {
  const first = formatEventDate(start);
  return !end || String(end).slice(0, 10) === String(start || '').slice(0, 10) ? first : `${first} – ${formatEventDate(end)}`;
}
function addEventLink(container, label, value) {
  const href = safeHttpUrl(String(value || '').trim());
  if (!href) return;
  const link = document.createElement('a');
  link.className = 'event-link'; link.href = href; link.target = '_blank'; link.rel = 'noopener noreferrer'; link.textContent = `${label} ↗`;
  container.append(link);
}
function renderEvents(events) {
  const list = $('#events-list');
  list.replaceChildren();
  if (!events?.length) {
    list.innerHTML = '<div class="empty-events">No upcoming events have been announced yet. Check back soon!</div>';
    return;
  }
  for (const item of events) {
    const card = document.createElement('article'); card.className = 'event-card';
    const date = document.createElement('p'); date.className = 'event-date'; date.textContent = formatEventDateRange(item.event_date, item.end_date);
    const title = document.createElement('h3'); title.textContent = item.title;
    const links = document.createElement('div'); links.className = 'event-links';
    addEventLink(links, 'Details', item.event_url);
    addEventLink(links, 'Twitch', item.twitch_url);
    addEventLink(links, 'Discord', item.discord_url);
    if (currentRole === 'admin') {
      const button = document.createElement('button'); button.className = 'event-delete-button'; button.type = 'button'; button.textContent = 'Delete event';
      button.setAttribute('aria-label', `Delete event: ${item.title}`);
      button.addEventListener('click', () => deleteEvent(item.id, item.title, button)); links.append(button);
    }
    card.append(date, title, links); list.append(card);
  }
}
function renderArchive(events) {
  const list = $('#archive-list');
  list.replaceChildren();
  if (!events?.length) {
    list.innerHTML = '<div class="empty-events">No previous events yet. Completed events will appear here.</div>';
    return;
  }
  for (const item of events) {
    const card = document.createElement('article'); card.className = 'archive-card';
    const date = document.createElement('p'); date.className = 'event-date'; date.textContent = formatEventDateRange(item.event_date, item.end_date);
    const title = document.createElement('h3'); title.textContent = item.title;
    const links = document.createElement('div'); links.className = 'event-links';
    addEventLink(links, 'Details', item.event_url);
    addEventLink(links, 'YouTube', item.youtube_url);
    if (currentRole === 'admin') {
      const button = document.createElement('button'); button.className = 'event-delete-button'; button.type = 'button'; button.textContent = 'Delete event';
      button.setAttribute('aria-label', `Delete event: ${item.title}`);
      button.addEventListener('click', () => deleteEvent(item.id, item.title, button)); links.append(button);
    }
    card.append(date, title, links); list.append(card);
  }
}
async function deleteEvent(id, title, button) {
  if (!supabaseClient || !currentUser || currentRole !== 'admin' || !window.confirm(`Delete “${title}”? This cannot be undone.`)) return;
  button.disabled = true; button.textContent = 'Deleting…';
  const { error } = await supabaseClient.from('events').delete().eq('id', id);
  if (error) {
    console.error('Could not delete event:', error.message);
    setMessage($('#events-status'), 'Could not delete event. Check admin permissions.', 'error');
    button.disabled = false; button.textContent = 'Delete event'; return;
  }
  await loadEvents();
}
async function loadEvents() {
  if (!supabaseClient) return;
  setMessage($('#events-status'), 'Loading events…');
  setMessage($('#archive-status'), 'Loading events…');
  const { data, error } = await supabaseClient
    .from('events')
    .select('id,title,event_date,end_date,event_url,twitch_url,discord_url,youtube_url,is_archived')
    .order('event_date', { ascending: true });
  if (error) {
    console.error('Could not load events:', error.message);
    setMessage($('#events-status'), 'Could not load events.', 'error');
    setMessage($('#archive-status'), 'Could not load events.', 'error');
    $('#events-list').innerHTML = '<div class="empty-events">The calendar is temporarily unavailable.</div>';
    $('#archive-list').innerHTML = '<div class="empty-events">The archive is temporarily unavailable.</div>';
    return;
  }
  const upcoming = data.filter(item => !item.is_archived);
  const archived = data.filter(item => item.is_archived).reverse();
  setMessage($('#events-status'), `${upcoming.length} event${upcoming.length === 1 ? '' : 's'}`);
  setMessage($('#archive-status'), `${archived.length} event${archived.length === 1 ? '' : 's'}`);
  renderEvents(upcoming);
  renderArchive(archived);
}
$('#event-form').addEventListener('submit', async event => {
  event.preventDefault();
  if (!supabaseClient || !currentUser || currentRole !== 'admin') return;
  const form = event.currentTarget, values = new FormData(form);
  const title = String(values.get('title') || '').trim(), eventUrl = safeHttpUrl(String(values.get('event_url') || '').trim());
  const twitchValue = String(values.get('twitch_url') || '').trim();
  const twitchUrl = twitchValue ? safeHttpUrl(twitchValue) : null;
  const discordValue = String(values.get('discord_url') || '').trim();
  const discordUrl = discordValue ? safeHttpUrl(discordValue) : null;
  const startDate = String(values.get('event_date') || ''), endDate = String(values.get('end_date') || '');
  if (!title) { setMessage($('#event-form-status'), 'Enter an event name.', 'error'); return; }
  if (!eventUrl) { setMessage($('#event-form-status'), 'Enter a valid http:// or https:// event details link.', 'error'); return; }
  if (twitchValue && !twitchUrl) { setMessage($('#event-form-status'), 'The Twitch link must be a valid http:// or https:// URL.', 'error'); return; }
  if (discordValue && !discordUrl) { setMessage($('#event-form-status'), 'The Discord link must be a valid http:// or https:// URL.', 'error'); return; }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) { setMessage($('#event-form-status'), 'Choose a valid start date and end date.', 'error'); return; }
  if (endDate < startDate) { setMessage($('#event-form-status'), 'The end date must be on or after the start date.', 'error'); return; }
  const button = form.querySelector('button[type="submit"]'); button.disabled = true; setMessage($('#event-form-status'), 'Publishing event…');
  try {
    const { error } = await supabaseClient.from('events').insert({ title, event_date: `${startDate}T12:00:00.000Z`, end_date: endDate, event_url: eventUrl, twitch_url: twitchUrl, discord_url: discordUrl, is_archived: false, created_by: currentUser.id });
    if (error) throw error;
    form.reset(); setMessage($('#event-form-status'), 'Event published!', 'success'); await loadEvents();
  } catch (error) { console.error('Could not publish event:', error.message); setMessage($('#event-form-status'), 'Could not publish. Check admin permissions.', 'error'); }
  finally { button.disabled = false; }
});

$('#archive-form').addEventListener('submit', async event => {
  event.preventDefault();
  if (!supabaseClient || !currentUser || currentRole !== 'admin') return;
  const form = event.currentTarget, values = new FormData(form);
  const title = String(values.get('title') || '').trim();
  const eventUrl = safeHttpUrl(String(values.get('event_url') || '').trim());
  const youtubeValue = String(values.get('youtube_url') || '').trim();
  const youtubeUrl = youtubeValue ? safeHttpUrl(youtubeValue) : null;
  const startDate = String(values.get('event_date') || ''), endDate = String(values.get('end_date') || '');
  if (!title) { setMessage($('#archive-form-status'), 'Enter an event name.', 'error'); return; }
  if (!eventUrl) { setMessage($('#archive-form-status'), 'Enter a valid http:// or https:// event details link.', 'error'); return; }
  if (youtubeValue && !youtubeUrl) { setMessage($('#archive-form-status'), 'The YouTube link must be a valid http:// or https:// URL.', 'error'); return; }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) { setMessage($('#archive-form-status'), 'Choose a valid start date and end date.', 'error'); return; }
  if (endDate < startDate) { setMessage($('#archive-form-status'), 'The end date must be on or after the start date.', 'error'); return; }
  const button = form.querySelector('button[type="submit"]'); button.disabled = true; setMessage($('#archive-form-status'), 'Adding archived event…');
  try {
    const { error } = await supabaseClient.from('events').insert({ title, event_date: `${startDate}T12:00:00.000Z`, end_date: endDate, event_url: eventUrl, youtube_url: youtubeUrl, is_archived: true, created_by: currentUser.id });
    if (error) throw error;
    form.reset(); setMessage($('#archive-form-status'), 'Event added to archive!', 'success'); await loadEvents();
  } catch (error) { console.error('Could not publish event:', error.message); setMessage($('#archive-form-status'), 'Could not publish. Check admin permissions.', 'error'); }
  finally { button.disabled = false; }
});

async function initialize() {
  if (!supabaseClient) { showConfigurationWarning(); renderAccount(null); return; }
  const { data: { session } } = await supabaseClient.auth.getSession();
  await refreshAccount(session?.user || null);
  supabaseClient.auth.onAuthStateChange((_event, sessionNow) => setTimeout(() => refreshAccount(sessionNow?.user || null), 0));
}
initialize();
