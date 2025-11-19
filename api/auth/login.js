export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  try {
    // Parse body - handle both JSON and form data
    let email, password;
    
    if (typeof req.body === 'string') {
      try {
        const parsed = JSON.parse(req.body);
        email = parsed.email;
        password = parsed.password;
      } catch {
        return res.status(400).json({ ok: false, error: 'Invalid JSON' });
      }
    } else {
      email = req.body?.email;
      password = req.body?.password;
    }
    
    console.log('[AUTH/LOGIN] Received body:', { 
      bodyType: typeof req.body,
      bodyKeys: req.body ? Object.keys(req.body) : 'none',
      email, 
      password: password ? '***' : 'empty' 
    });
    
    if (!email || !password) {
      console.log('[AUTH/LOGIN] Missing email or password');
      return res.status(400).json({ ok: false, error: 'email and password required' });
    }

    // Hardcoded admin credentials
    const ADMIN_EMAIL = 'admin@elhegazi.com';
    const ADMIN_PASSWORD = 'admin123';

    console.log('[AUTH/LOGIN] Checking:', { 
      email, 
      expectedEmail: ADMIN_EMAIL, 
      emailMatch: email === ADMIN_EMAIL,
      passwordMatch: password === ADMIN_PASSWORD
    });

    if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
      console.log('[AUTH/LOGIN] ✓ Login successful');
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
    console.error('[AUTH/LOGIN] Error:', error);
    return res.status(500).json({ ok: false, error: error.message });
  }
}
