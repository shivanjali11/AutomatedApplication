// One-time setup for MAIL_PROVIDER=gmail-api: authorizes this app to send
// mail from your Gmail and prints the GMAIL_REFRESH_TOKEN to put in .env /
// your host's environment. Run it on your own computer (it needs a browser).
//
// Usage: set GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET in .env, then
//   npm run gmail:auth

require('dotenv').config({ quiet: true });
const http = require('http');
const crypto = require('crypto');

const clientId = process.env.GMAIL_CLIENT_ID;
const clientSecret = process.env.GMAIL_CLIENT_SECRET;
if (!clientId || !clientSecret) {
  console.error('[gmail:auth] Set GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET in .env first (see README → Gmail API).');
  process.exit(1);
}

const SCOPE = 'https://www.googleapis.com/auth/gmail.send'; // send only — cannot read your mailbox
const state = crypto.randomBytes(16).toString('hex');
let redirectUri; // set once the server is listening
let finished = false;

function finish(exitCode = 0) {
  finished = true;
  process.exitCode = exitCode;
  server.close();
  server.closeAllConnections(); // drop browser keep-alive sockets so the process exits
}

// A "Desktop app" OAuth client accepts any http://127.0.0.1:<port> redirect,
// so listen on a free port and point Google back at it.
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, redirectUri);
  // Browsers also request /favicon.ico, sometimes after we're done — ignore those.
  if (finished || url.pathname !== '/') {
    res.writeHead(404).end();
    return;
  }

  const fail = (msg) => {
    console.error(`[gmail:auth] ${msg}`);
    res.writeHead(400, { 'Content-Type': 'text/plain' }).end(`Authorization failed: ${msg}`, () => finish(1));
  };

  if (url.searchParams.get('error')) return fail(url.searchParams.get('error'));
  if (url.searchParams.get('state') !== state) return fail('state mismatch — start again with npm run gmail:auth');

  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code: url.searchParams.get('code'),
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });
    const body = await tokenRes.json();
    if (!tokenRes.ok) return fail(`${body.error}: ${body.error_description || ''}`);
    if (!body.refresh_token) {
      return fail('Google returned no refresh token. Remove the app at https://myaccount.google.com/permissions and run again.');
    }

    console.log('\n[gmail:auth] Success. Add this to .env and to your host\'s environment variables:\n');
    console.log(`GMAIL_REFRESH_TOKEN=${body.refresh_token}\n`);
    res.writeHead(200, { 'Content-Type': 'text/plain' }).end('Done — you can close this tab and return to the terminal.', () => finish());
  } catch (err) {
    fail(err.message);
  }
});

server.listen(0, '127.0.0.1', () => {
  redirectUri = `http://127.0.0.1:${server.address().port}`;
  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authUrl.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: SCOPE,
    access_type: 'offline', // ask for a refresh token
    prompt: 'consent', // always return one, even if previously authorized
    state,
  });
  console.log('[gmail:auth] Open this URL in your browser and sign in with the Gmail account you send from:\n');
  console.log(`${authUrl}\n`);
  console.log('[gmail:auth] Waiting for Google to redirect back…');
});
