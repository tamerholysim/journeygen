// middleware/auth.js
export function requireAdmin(req, res, next) {
  // We only have one user: username "admin", password "pass".
  // Expect credentials in headers as Basic Auth (for simplicity).
  //   Authorization: Basic [base64(admin:pass)]
  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Basic ')) {
    return res.status(401).json({ error: 'Missing Authorization header' });
  }

  const base64 = auth.split(' ')[1];
  let decoded;
  try {
    decoded = Buffer.from(base64, 'base64').toString(); // "admin:pass"
  } catch {
    return res.status(401).json({ error: 'Invalid Authorization header' });
  }

  const [user, pass] = decoded.split(':');
  if (user === 'admin' && pass === 'pass') {
    return next();
  }
  return res.status(403).json({ error: 'Invalid credentials' });
}
