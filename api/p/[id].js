// api/p/[id].js
const admin = require('firebase-admin');

// Initialize the Firebase Admin SDK once per serverless instance (cold start).
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            // Vercel stores env vars as plain strings, so literal "\n" needs to
            // be converted back into real newlines for the PEM key to be valid.
            privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
        }),
    });
}

const db = admin.firestore();

function escapeHtml(str = '') {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function absoluteUrl(origin, maybeRelative, id) {
    const value = typeof maybeRelative === 'string' ? maybeRelative.trim() : '';
    if (!value) return `${origin}/img/banner.jpg`;
    if (/^data:/i.test(value)) return `${origin}/api/img/${encodeURIComponent(id)}`;
    if (/^https?:\/\//i.test(value)) return value;
    return `${origin}/${value.replace(/^\//, '')}`;
}

module.exports = async (req, res) => {
    const { id } = req.query;
    const origin = `https://${req.headers.host}`;
    const appUrl = `${origin}/#produto?id=${encodeURIComponent(id || '')}`;

    let product = null;
    try {
        if (id) {
            const docSnap = await db.collection('produtos').doc(id).get();
            if (docSnap.exists) product = docSnap.data();
        }
    } catch (err) {
        console.error('Erro ao buscar produto para preview:', err);
    }

    // Produto não encontrado: manda todo mundo (bot ou humano) pro catálogo geral.
    if (!product) {
        res.writeHead(302, { Location: `${origin}/#catalogo` });
        res.end();
        return;
    }

    const title = escapeHtml(product.nome || 'Lumié Seoul');
    const brand = product.marca ? ` — ${escapeHtml(product.marca)}` : '';
    const description = escapeHtml(
        product.descricaoCurta ||
        (product.descricaoCompleta ? String(product.descricaoCompleta).slice(0, 180) : 'Curadoria K-Beauty premium. Fale conosco pelo WhatsApp.')
    );
    const image = absoluteUrl(origin, Array.isArray(product.imagensUrl) ? product.imagensUrl[0] : null, id);
    const shareUrl = `${origin}/p/${encodeURIComponent(id)}`;

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>${title}${brand} | Lumié Seoul</title>
<meta name="description" content="${description}">

<meta property="og:type" content="product">
<meta property="og:title" content="${title}${brand}">
<meta property="og:description" content="${description}">
<meta property="og:image" content="${image}">
<meta property="og:image:secure_url" content="${image}">
<meta property="og:url" content="${shareUrl}">
<meta property="og:site_name" content="Lumié Seoul">

<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${title}${brand}">
<meta name="twitter:description" content="${description}">
<meta name="twitter:image" content="${image}">
</head>
<body>
<p>Redirecionando para <a href="${appUrl}">${title}</a>...</p>
<script>window.location.replace(${JSON.stringify(appUrl)});</script>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=600');
    res.status(200).send(html);
};
