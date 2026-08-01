// api/img/[id].js
const admin = require('firebase-admin');

// Initialize the Firebase Admin SDK once per serverless instance (cold start).
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
        }),
    });
}

const db = admin.firestore();

// Casa uma data URI tipo: data:image/jpeg;base64,/9j/4AAQ...
const DATA_URI_RE = /^data:(image\/[a-zA-Z0-9+.-]+);base64,(.+)$/;

module.exports = async (req, res) => {
    const { id } = req.query;
    const origin = `https://${req.headers.host}`;

    let image = null;
    try {
        if (id) {
            const docSnap = await db.collection('produtos').doc(id).get();
            if (docSnap.exists) {
                const product = docSnap.data();
                image = Array.isArray(product.imagensUrl) ? product.imagensUrl[0] : null;
            }
        }
    } catch (err) {
        console.error('Erro ao buscar imagem do produto:', err);
    }

    const value = typeof image === 'string' ? image.trim() : '';

    // Caso 1: imagem salva como base64 direto no Firestore -> decodifica e
    // devolve os bytes reais da imagem, com o Content-Type correto.
    const match = value.match(DATA_URI_RE);
    if (match) {
        const mimeType = match[1];
        const base64Data = match[2];
        try {
            const buffer = Buffer.from(base64Data, 'base64');
            res.setHeader('Content-Type', mimeType);
            res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=86400');
            res.status(200).send(buffer);
            return;
        } catch (err) {
            console.error('Erro ao decodificar base64 da imagem:', err);
        }
    }

    // Caso 2: já é uma URL https normal (ex: link externo) -> apenas redireciona.
    if (/^https?:\/\//i.test(value)) {
        res.writeHead(302, { Location: value });
        res.end();
        return;
    }

    // Caso 3: caminho relativo local (ex: "img/cream.jpg") -> redireciona pro arquivo estático.
    if (value) {
        res.writeHead(302, { Location: `${origin}/${value.replace(/^\//, '')}` });
        res.end();
        return;
    }

    // Caso 4: sem imagem nenhuma -> banner genérico.
    res.writeHead(302, { Location: `${origin}/img/banner.jpg` });
    res.end();
};
