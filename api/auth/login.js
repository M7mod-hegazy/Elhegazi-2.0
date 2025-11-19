export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  try {
    let body = req.body;
    
    // Manually parse body if it's a string
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch (e) {
        console.error('[AUTH/LOGIN] Failed to parse body:', e);
        return res.status(400).json({ ok: false, error: 'Invalid JSON body' });
      }
    }

    const email = body?.email?.trim?.() || body?.email;
    const password = body?.password?.trim?.() || body?.password;
    
    console.log('[AUTH/LOGIN] Request:', { 
      method: req.method,
      bodyType: typeof body,
      email: email || 'MISSING',
      hasPassword: !!password
    });
    
    if (!email || !password) {
      console.log('[AUTH/LOGIN] ✗ Missing credentials');
      return res.status(400).json({ ok: false, error: 'email and password required' });
    }

    // Hardcoded admin credentials
    const ADMIN_EMAIL = 'admin@elhegazi.com';
    const ADMIN_PASSWORD = 'admin123';

    const emailMatch = email === ADMIN_EMAIL;
    const passwordMatch = password === ADMIN_PASSWORD;

    console.log('[AUTH/LOGIN] Credentials check:', { 
      emailMatch,
      passwordMatch,
      email,
      password: '***'
    });

    if (emailMatch && passwordMatch) {
      console.log('[AUTH/LOGIN] ✓ Success');
      return res.json({
        ok: true,
        user: {
          id: 'admin-001',
          email: ADMIN_EMAIL,
          firstName: 'Admin',
          lastName: 'User',
          phone: '+966 12 345 6789',
          role: 'admin',
          isActive: true
        }
      });
    }

    console.log('[AUTH/LOGIN] ✗ Invalid credentials');
    return res.status(401).json({ ok: false, error: 'Invalid credentials' });
  } catch (error) {
    console.error('[AUTH/LOGIN] Exception:', error);
    return res.status(500).json({ ok: false, error: error.message });
  }
}
