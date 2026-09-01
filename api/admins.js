const admin = require('firebase-admin');
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert({ projectId: process.env.FIREBASE_PROJECT_ID, clientEmail: process.env.FIREBASE_CLIENT_EMAIL, privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n') }) });
const db = admin.firestore();
async function requireAdmin(req) {
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) throw new Error('Sessão inválida. Entre novamente.');
  const decoded = await admin.auth().verifyIdToken(token);
  const adminDoc = await db.collection('admins').doc(decoded.uid).get();
  if (!adminDoc.exists || adminDoc.data().ativo === false) throw new Error('Acesso administrativo negado.');
  return decoded;
}
module.exports = async (req, res) => {
  try {
    const caller = await requireAdmin(req);
    if (req.method === 'POST') {
      const { email, password } = req.body || {};
      if (!/^\S+@\S+\.\S+$/.test(String(email || '')) || String(password || '').length < 10) return res.status(400).json({ error: 'Use um e-mail válido e uma senha de pelo menos 10 caracteres.' });
      const user = await admin.auth().createUser({ email: email.trim().toLowerCase(), password });
      await db.collection('admins').doc(user.uid).set({ email: user.email, ativo: true, criadoEm: new Date().toISOString(), criadoPor: caller.uid });
      return res.status(201).json({ uid: user.uid, email: user.email });
    }
    if (req.method === 'DELETE') {
      const uid = String(req.query.uid || '');
      if (!uid) return res.status(400).json({ error: 'Administrador não informado.' });
      if (uid === caller.uid) return res.status(400).json({ error: 'Você não pode revogar o seu próprio acesso.' });
      await db.collection('admins').doc(uid).delete();
      return res.status(200).json({ ok: true });
    }
    res.setHeader('Allow', 'POST, DELETE'); return res.status(405).json({ error: 'Método não permitido.' });
  } catch (error) { console.error('Erro na administração de acessos:', error); return res.status(403).json({ error: error.message || 'Acesso negado.' }); }
};
