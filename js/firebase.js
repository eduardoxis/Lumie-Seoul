/*
 * Lumié Seoul - Firebase connection & Local Data Fallback Layer (CRUD wrapper)
 * Pure Vanilla ES6+
 *
 * This wrapper transparently switches between Firebase (when valid credentials are set)
 * and LocalStorage. This allows the catalog and administrative panel to function
 * out-of-the-box in local environments before Firebase project creation.
 */

// 1. Firebase configuration credentials (Merchant updates this when ready)
const firebaseConfig = {
    apiKey: "AIzaSyDV_mi3G1Dafpxd03aKi47oS_Gn-b5B1t8",
    authDomain: "lumie-seoul.firebaseapp.com",
    projectId: "lumie-seoul",
    storageBucket: "lumie-seoul.firebasestorage.app",
    messagingSenderId: "293903812406",
    appId: "1:293903812406:web:c7650b377aaa22325f1597",
    measurementId: "G-0W8MF29JBB"
};

// Check if credentials are placeholders
const isFirebaseConfigured = 
    firebaseConfig.apiKey && 
    !firebaseConfig.apiKey.includes("YOUR_") && 
    !firebaseConfig.apiKey.includes("HERE");

let firebaseApp = null;
let firestoreDb = null;
let firebaseAuth = null;
let firebaseStorage = null;
let dbMode = "local"; // "local" or "firebase"

// Sinal real de "banco pronto pra uso". Diferente de `window.DB` (que existe
// desde o início do arquivo), esta flag só vira true depois que já sabemos
// se o modo é "firebase" ou "local" — evita ler dados mockados por engano
// enquanto o Firebase ainda está conectando.
window.dbReady = false;

function markDbReady(mode) {
    window.dbReady = true;
    document.dispatchEvent(new CustomEvent("db-ready", { detail: { mode } }));
}

// Load Firebase dynamically if configured
if (isFirebaseConfigured) {
    try {
        // We import Firebase modules from CDN
        import("https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js").then((App) => {
            firebaseApp = App.initializeApp(firebaseConfig);
            
            Promise.all([
                import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js"),
                import("https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js"),
                import("https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js")
            ]).then(([Firestore, Auth, Storage]) => {
                firestoreDb = Firestore.getFirestore(firebaseApp);
                firebaseAuth = Auth.getAuth(firebaseApp);
                firebaseStorage = Storage.getStorage(firebaseApp);
                dbMode = "firebase";
                console.log("Lumié Seoul: Connected to Firebase Cloud Services.");
                markDbReady("firebase");
            }).catch((e) => {
                console.error("Lumié Seoul: Failed to load Firebase SDK modules. Falling back to local storage.", e);
                dbMode = "local";
                markDbReady("local");
            });
        }).catch((e) => {
            console.error("Lumié Seoul: Failed to load Firebase App SDK. Falling back to local storage.", e);
            dbMode = "local";
            markDbReady("local");
        });
    } catch (e) {
        console.warn("Lumié Seoul: Failed to load Firebase SDKs. Falling back to local storage.", e);
        dbMode = "local";
        markDbReady("local");
    }
} else {
    console.log("Lumié Seoul: Firebase credentials not set. Running in LocalStorage fallback mode.");
    // Wait for DOM load to fire ready event
    document.addEventListener("DOMContentLoaded", () => {
        markDbReady("local");
    });
}


// 2. Mock / Initial Datasets (Local Fallback storage)
const INITIAL_PRODUCTS = [
    {
        id: 'glow-essence',
        nome: 'Glow Ginseng Water Essence',
        marca: 'Sulwhasoo',
        categoria: 'Tônico',
        descricaoCurta: 'Tônico facial hidratante formulado com ginseng vermelho coreano para restaurar a luminosidade natural e elasticidade da pele.',
        descricaoCompleta: 'Esta essência aquosa luxuosa infunde a pele com o lendário Ginseng Vermelho Coreano e ervas preciosas para hidratar profundamente, melhorar a elasticidade e restaurar a luminosidade natural da barreira. Sua textura de rápida absorção prepara a pele para os tratamentos seguintes, deixando-a macia e radiante.',
        beneficios: [
            'Luminosidade imediata (efeito glass skin)',
            'Hidratação profunda por 24 horas',
            'Melhora visível da elasticidade e firmeza',
            'Nutrição antienvelhecimento premium'
        ],
        ingredientes: [
            'Panax Ginseng Root Water (82%)',
            'Sodium Hyaluronate',
            'Glycyrrhiza Glabra (Licorice) Root Extract',
            'Honey Extract',
            'Adenosine (Anti-aging)'
        ],
        modoUso: 'Após a limpeza da pele, despeje algumas gotas nas palmas das mãos e pressione suavemente no rosto e pescoço até a completa absorção. Use de manhã e à noite.',
        indicacao: 'Prevenção de rugas, perda de tônus facial e pele opaca.',
        tiposPele: ['Todos os tipos de pele', 'Pele Seca'],
        origem: 'Coreia do Sul',
        destacado: true,
        novidade: false,
        maisVendido: true,
        imagensUrl: ['img/toner.jpg', 'img/serum.jpg'],
        badge: 'Mais Vendido'
    },
    {
        id: 'wrinkle-peptide-serum',
        nome: 'Vanish Wrinkle Peptide Serum',
        marca: 'COSRX',
        categoria: 'Sérum',
        descricaoCurta: 'Soro altamente concentrado com 6 peptídeos e ácido hialurônico para preencher linhas finas e revitalizar peles cansadas.',
        descricaoCompleta: 'O Vanish Wrinkle Peptide Serum é um elixir antienvelhecimento ultraleve que combina um complexo avançado de 6 peptídeos ativos com ácido hialurônico fragmentado. Ele age diretamente na estimulação do colágeno, reduzindo a aparência de rugas de expressão e restaurando o viço juvenil.',
        beneficios: [
            'Redução visível das linhas de expressão',
            'Aumento da síntese de colágeno natural',
            'Suavização de texturas e poros dilatados',
            'Efeito tensor suave imediato'
        ],
        ingredientes: [
            'Peptide Complex-6 (Copper Tripeptide-1, Acetyl Hexapeptide-8)',
            'Hydrolyzed Hyaluronic Acid',
            'Niacinamide (Vitamina B3)',
            'Allantoin'
        ],
        modoUso: 'Aplique de 3 a 4 gotas no rosto limpo e seco. Espalhe uniformemente com as pontas dos dedos em movimentos circulares ascendentes. Finalize com o hidratante.',
        indicacao: 'Linhas finas, flacidez precoce e perda de elasticidade.',
        tiposPele: ['Pele Madura', 'Pele Seca', 'Pele Normal'],
        origem: 'Coreia do Sul',
        destacado: true,
        novidade: true,
        maisVendido: false,
        imagensUrl: ['img/serum.jpg', 'img/cream.jpg'],
        badge: 'Lançamento'
    },
    {
        id: 'ceramide-barrier-cream',
        nome: 'Ceramide Barrier Cream',
        marca: 'Innisfree',
        categoria: 'Hidratante',
        descricaoCurta: 'Creme hidratante calmante com ceramidas essenciais e extrato purificado de Centelha Asiática (Cica) para restaurar a barreira cutânea.',
        descricaoCompleta: 'Um creme hidratante rico e sedoso formulado com 5 tipos de ceramidas biomiméticas e extrato de Centelha Asiática. Ideal para reestruturar peles sensibilizadas por fatores externos, acalmar coceiras e descamações, mantendo a hidratação trancada na pele.',
        beneficios: [
            'Reparação e fortalecimento da barreira de proteção natural',
            'Alívio instantâneo para vermelhidão ou pele repuxada',
            'Nutrição profunda de liberação prolongada',
            'Fórmula dermatologicamente testada e livre de parabenos'
        ],
        ingredientes: [
            'Ceramides (NP, AP, AS, NS, EOP)',
            'Centella Asiatica Extract (Cica)',
            'Madecassoside',
            'Panthenol (Pro-vitamina B5)',
            'Squalane'
        ],
        modoUso: 'Como último passo da rotina (ou antes do filtro solar), aplique uma pequena quantidade nas bochechas, testa e queixo, massageando suavemente até absorver.',
        indicacao: 'Desidratação intensa, pele sensibilizada, vermelhidão ou pós-procedimentos.',
        tiposPele: ['Pele Sensível', 'Pele Seca', 'Pele Mista'],
        origem: 'Coreia do Sul',
        destacado: true,
        novidade: false,
        maisVendido: false,
        imagensUrl: ['img/cream.jpg', 'img/toner.jpg'],
        badge: 'Destaque'
    }
];

const INITIAL_BLOG = [
    {
        id: 'rotina-coreana-10-passos',
        titulo: 'Rotina Coreana: O Guia Definitivo dos 10 Passos',
        resumo: 'Entenda os princípios da rotina de beleza que revolucionou os cosméticos e aprenda a adaptá-la para o seu dia a dia.',
        conteudoHtml: `<p>A famosa rotina coreana de 10 passos não é sobre usar todos os produtos ao mesmo tempo todos os dias, mas sim entender o que a sua pele precisa em cada momento. O foco é a prevenção, a hidratação em camadas e o tratamento delicado da barreira cutânea.</p>
                       <h3>Os 10 Passos do K-Beauty</h3>
                       <ol>
                         <li><strong>Limpador à base de óleo:</strong> Para derreter a maquiagem e o filtro solar.</li>
                         <li><strong>Limpador à base de água:</strong> Para remover suor e impurezas restantes.</li>
                         <li><strong>Esfoliante:</strong> Remocão de células mortas (1 a 2 vezes por semana).</li>
                         <li><strong>Tônico:</strong> Reequilibra o pH e prepara para absorção.</li>
                         <li><strong>Essência:</strong> O coração do K-Beauty. Hidratação celular profunda.</li>
                         <li><strong>Ampolas e Séruns:</strong> Tratamento direcionado (manchas, rugas, acne).</li>
                         <li><strong>Máscara facial (Sheet Mask):</strong> Nutrição concentrada ocasional.</li>
                         <li><strong>Creme para os olhos:</strong> Prevenção de linhas e olheiras.</li>
                         <li><strong>Hidratante:</strong> Selagem de todas as camadas anteriores.</li>
                         <li><strong>Protetor Solar (Dia) ou Máscara Noturna (Noite):</strong> Proteção ou regeneração.</li>
                       </ol>`,
        imagemCapaUrl: 'img/banner.jpg',
        autor: 'Consultoria Lumié',
        publicadoEm: '2026-07-01T10:00:00Z',
        tags: ['K-Beauty', 'Rotina de Pele', 'Iniciantes']
    },
    {
        id: 'acido-hialuronico-vs-ceramidas',
        titulo: 'Ácido Hialurônico vs Ceramidas: Qual escolher?',
        resumo: 'Saiba como estes dois ativos trabalham juntos para garantir hidratação profunda e barreira cutânea fortalecida.',
        conteudoHtml: `<p>Muitas pessoas confundem o papel do Ácido Hialurônico e das Ceramidas na pele. Embora ambos sejam hidratantes excepcionais, eles funcionam de formas completamente diferentes.</p>
                       <p>O <strong>Ácido Hialurônico</strong> atua como uma esponja, atraindo moléculas de água do ambiente e das camadas internas da pele para o seu estrato córneo. Ele é essencial para preencher rugas finas e dar viço.</p>
                       <p>As <strong>Ceramidas</strong>, por outro lado, funcionam como o "cimento" que une os tijolos da barreira protetora da sua pele. Elas não trazem água, mas impedem que a água atraída pelo ácido hialurônico evapore.</p>
                       <h3>Qual deles eu preciso?</h3>
                       <p>Se a sua pele está opaca e desidratada, você precisa de Ácido Hialurônico. Se a sua pele está vermelha, descamando ou sensível, sua barreira lipídica está danificada, exigindo o uso de Ceramidas.</p>`,
        imagemCapaUrl: 'img/cream.jpg',
        autor: 'Dra. Kim Seoul',
        publicadoEm: '2026-07-08T14:30:00Z',
        tags: ['Ingredientes', 'Pele Sensível', 'Hidratação']
    }
];

const INITIAL_CONFIG = {
    whatsappNumero: '5511999998888',
    whatsappMensagemPadrao: 'Olá! Gostaria de tirar algumas dúvidas sobre os produtos de skincare.',
    seoTituloPadrao: 'Lumié Seoul | Premium Korean Skincare',
    seoDescricaoPadrao: 'Importação direta de K-Beauty original com suporte personalizado via WhatsApp.',
    bannerDesktopUrl: 'img/banner.jpg',
    bannerMobileUrl: 'img/banner.jpg',
    categorias: ['Tônico', 'Sérum', 'Hidratante', 'Protetor Solar', 'Limpeza'],
    marcas: ['Sulwhasoo', 'COSRX', 'Innisfree', 'Skin1004', 'Laneige', 'Beauty of Joseon']
};

// Initialize local fallback databases only when Firebase isn't configured.
// (When Firebase is active, all reads/writes go straight to Firestore/Auth.)
if (!isFirebaseConfigured) {
    if (!localStorage.getItem('lumie_products')) {
        localStorage.setItem('lumie_products', JSON.stringify(INITIAL_PRODUCTS));
    }
    if (!localStorage.getItem('lumie_blog')) {
        localStorage.setItem('lumie_blog', JSON.stringify(INITIAL_BLOG));
    }
    if (!localStorage.getItem('lumie_config')) {
        localStorage.setItem('lumie_config', JSON.stringify(INITIAL_CONFIG));
    }
    if (!localStorage.getItem('lumie_admins')) {
        // Local-only dev fallback admin, used exclusively when no Firebase project is connected.
        localStorage.setItem('lumie_admins', JSON.stringify([{ email: 'admin@local.dev', password: 'trocar-esta-senha' }]));
    }
}

// Helper: sorts a list by its "ordem" field (manual drag-and-drop order),
// falling back to a high number so un-ordered items go to the end.
function sortByOrdem(list) {
    return [...list].sort((a, b) => {
        const oa = typeof a.ordem === 'number' ? a.ordem : 9999;
        const ob = typeof b.ordem === 'number' ? b.ordem : 9999;
        return oa - ob;
    });
}

// 3. Centralized Database Gateway (DB API Wrapper)
const DB = {
    // Mode checker
    getMode: () => dbMode,

    // --- PRODUCTS COLLECTION ---
    products: {
        getAll: async () => {
            if (dbMode === "firebase" && firestoreDb) {
                try {
                    const { getDocs, collection, query, orderBy } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
                    const q = query(collection(firestoreDb, "produtos"), orderBy("criadoEm", "desc"));
                    const querySnapshot = await getDocs(q);
                    const list = [];
                    querySnapshot.forEach((doc) => {
                        list.push({ id: doc.id, ...doc.data() });
                    });
                    return sortByOrdem(list);
                } catch (e) {
                    console.error("Firebase read products error. Falling back to local.", e);
                }
            }
            return sortByOrdem(JSON.parse(localStorage.getItem('lumie_products')) || []);
        },

        // Escuta mudanças em tempo real na coleção "produtos".
        // Retorna uma função "unsubscribe" para parar de escutar quando não for mais preciso.
        listen: (callback) => {
            if (dbMode === "firebase" && firestoreDb) {
                let unsub = () => {};
                import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js").then(({ collection, query, orderBy, onSnapshot }) => {
                    const q = query(collection(firestoreDb, "produtos"), orderBy("criadoEm", "desc"));
                    unsub = onSnapshot(q, (snapshot) => {
                        const list = [];
                        snapshot.forEach((doc) => list.push({ id: doc.id, ...doc.data() }));
                        callback(sortByOrdem(list));
                    }, (e) => console.error("Firebase products listener error.", e));
                });
                return () => unsub();
            }
            // Modo local: sem tempo real nativo, só entrega o snapshot atual uma vez.
            DB.products.getAll().then(callback);
            return () => {};
        },
        
        getById: async (id) => {
            if (dbMode === "firebase" && firestoreDb) {
                try {
                    const { doc, getDoc } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
                    const docRef = doc(firestoreDb, "produtos", id);
                    const docSnap = await getDoc(docRef);
                    if (docSnap.exists()) {
                        return { id: docSnap.id, ...docSnap.data() };
                    }
                } catch (e) {
                    console.error("Firebase doc fetch error. Falling back to local.", e);
                }
            }
            const list = JSON.parse(localStorage.getItem('lumie_products')) || [];
            return list.find(p => p.id === id) || null;
        },

        save: async (productData) => {
            if (!productData.id) {
                productData.id = productData.nome.toLowerCase().replace(/[^a-z0-9]+/g, '-');
            }

            if (typeof productData.ordem !== 'number') {
                const existingList = JSON.parse(localStorage.getItem('lumie_products')) || [];
                const existingItem = existingList.find(p => p.id === productData.id);
                productData.ordem = existingItem && typeof existingItem.ordem === 'number' ? existingItem.ordem : existingList.length;
            }
            
            if (dbMode === "firebase" && firestoreDb) {
                try {
                    const { doc, setDoc } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
                    productData.criadoEm = productData.criadoEm || new Date().toISOString();
                    await setDoc(doc(firestoreDb, "produtos", productData.id), productData, { merge: true });
                    return productData.id;
                } catch (e) {
                    console.error("Firebase write product error. Attempting local save.", e);
                }
            }
            
            const list = JSON.parse(localStorage.getItem('lumie_products')) || [];
            const index = list.findIndex(p => p.id === productData.id);
            if (index > -1) {
                list[index] = { ...list[index], ...productData };
            } else {
                productData.criadoEm = new Date().toISOString();
                list.push(productData);
            }
            localStorage.setItem('lumie_products', JSON.stringify(list));
            return productData.id;
        },

        // Persists a new manual display order for products (drag-and-drop in admin panel).
        reorder: async (orderedIds) => {
            if (dbMode === "firebase" && firestoreDb) {
                try {
                    const { doc, updateDoc } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
                    await Promise.all(orderedIds.map((id, index) => updateDoc(doc(firestoreDb, "produtos", id), { ordem: index })));
                    return true;
                } catch (e) {
                    console.error("Firebase reorder products error.", e);
                }
            }

            const list = JSON.parse(localStorage.getItem('lumie_products')) || [];
            orderedIds.forEach((id, index) => {
                const item = list.find(p => p.id === id);
                if (item) item.ordem = index;
            });
            localStorage.setItem('lumie_products', JSON.stringify(list));
            return true;
        },

        delete: async (id) => {
            if (dbMode === "firebase" && firestoreDb) {
                try {
                    const { doc, deleteDoc } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
                    await deleteDoc(doc(firestoreDb, "produtos", id));
                    return true;
                } catch (e) {
                    console.error("Firebase delete product error.", e);
                }
            }
            
            let list = JSON.parse(localStorage.getItem('lumie_products')) || [];
            list = list.filter(p => p.id !== id);
            localStorage.setItem('lumie_products', JSON.stringify(list));
            return true;
        }
    },

    // --- BLOG COLLECTION ---
    blog: {
        getAll: async () => {
            if (dbMode === "firebase" && firestoreDb) {
                try {
                    const { getDocs, collection, query, orderBy } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
                    const q = query(collection(firestoreDb, "blog"), orderBy("publicadoEm", "desc"));
                    const querySnapshot = await getDocs(q);
                    const list = [];
                    querySnapshot.forEach((doc) => {
                        list.push({ id: doc.id, ...doc.data() });
                    });
                    return sortByOrdem(list);
                } catch (e) {
                    console.error("Firebase read blog error. Falling back to local.", e);
                }
            }
            return sortByOrdem(JSON.parse(localStorage.getItem('lumie_blog')) || []);
        },

        listen: (callback) => {
            if (dbMode === "firebase" && firestoreDb) {
                let unsub = () => {};
                import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js").then(({ collection, query, orderBy, onSnapshot }) => {
                    const q = query(collection(firestoreDb, "blog"), orderBy("publicadoEm", "desc"));
                    unsub = onSnapshot(q, (snapshot) => {
                        const list = [];
                        snapshot.forEach((doc) => list.push({ id: doc.id, ...doc.data() }));
                        callback(sortByOrdem(list));
                    }, (e) => console.error("Firebase blog listener error.", e));
                });
                return () => unsub();
            }
            DB.blog.getAll().then(callback);
            return () => {};
        },
        
        getById: async (id) => {
            if (dbMode === "firebase" && firestoreDb) {
                try {
                    const { doc, getDoc } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
                    const docRef = doc(firestoreDb, "blog", id);
                    const docSnap = await getDoc(docRef);
                    if (docSnap.exists()) {
                        return { id: docSnap.id, ...docSnap.data() };
                    }
                } catch (e) {
                    console.error("Firebase article fetch error.", e);
                }
            }
            const list = JSON.parse(localStorage.getItem('lumie_blog')) || [];
            return list.find(a => a.id === id) || null;
        },

        save: async (articleData) => {
            if (!articleData.id) {
                articleData.id = articleData.titulo.toLowerCase().replace(/[^a-z0-9]+/g, '-');
            }

            if (typeof articleData.ordem !== 'number') {
                const existingList = JSON.parse(localStorage.getItem('lumie_blog')) || [];
                const existingItem = existingList.find(a => a.id === articleData.id);
                articleData.ordem = existingItem && typeof existingItem.ordem === 'number' ? existingItem.ordem : existingList.length;
            }
            
            if (dbMode === "firebase" && firestoreDb) {
                try {
                    const { doc, setDoc } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
                    articleData.publicadoEm = articleData.publicadoEm || new Date().toISOString();
                    await setDoc(doc(firestoreDb, "blog", articleData.id), articleData, { merge: true });
                    return articleData.id;
                } catch (e) {
                    console.error("Firebase write article error.", e);
                }
            }
            
            const list = JSON.parse(localStorage.getItem('lumie_blog')) || [];
            const index = list.findIndex(a => a.id === articleData.id);
            if (index > -1) {
                list[index] = { ...list[index], ...articleData };
            } else {
                articleData.publicadoEm = new Date().toISOString();
                list.push(articleData);
            }
            localStorage.setItem('lumie_blog', JSON.stringify(list));
            return articleData.id;
        },

        // Persists a new manual display order for blog articles (drag-and-drop in admin panel).
        reorder: async (orderedIds) => {
            if (dbMode === "firebase" && firestoreDb) {
                try {
                    const { doc, updateDoc } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
                    await Promise.all(orderedIds.map((id, index) => updateDoc(doc(firestoreDb, "blog", id), { ordem: index })));
                    return true;
                } catch (e) {
                    console.error("Firebase reorder blog error.", e);
                }
            }

            const list = JSON.parse(localStorage.getItem('lumie_blog')) || [];
            orderedIds.forEach((id, index) => {
                const item = list.find(a => a.id === id);
                if (item) item.ordem = index;
            });
            localStorage.setItem('lumie_blog', JSON.stringify(list));
            return true;
        },

        delete: async (id) => {
            if (dbMode === "firebase" && firestoreDb) {
                try {
                    const { doc, deleteDoc } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
                    await deleteDoc(doc(firestoreDb, "blog", id));
                    return true;
                } catch (e) {
                    console.error("Firebase delete article error.", e);
                }
            }
            
            let list = JSON.parse(localStorage.getItem('lumie_blog')) || [];
            list = list.filter(a => a.id !== id);
            localStorage.setItem('lumie_blog', JSON.stringify(list));
            return true;
        }
    },

    // --- GLOBAL CONFIG / SYSTEM ---
    config: {
        get: async () => {
            if (dbMode === "firebase" && firestoreDb) {
                try {
                    const { doc, getDoc } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
                    const docRef = doc(firestoreDb, "configuracoes", "geral");
                    const docSnap = await getDoc(docRef);
                    if (docSnap.exists()) {
                        return docSnap.data();
                    }
                } catch (e) {
                    console.error("Firebase config fetch error.", e);
                }
            }
            return JSON.parse(localStorage.getItem('lumie_config')) || INITIAL_CONFIG;
        },

        listen: (callback) => {
            if (dbMode === "firebase" && firestoreDb) {
                let unsub = () => {};
                import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js").then(({ doc, onSnapshot }) => {
                    const docRef = doc(firestoreDb, "configuracoes", "geral");
                    unsub = onSnapshot(docRef, (docSnap) => {
                        callback(docSnap.exists() ? docSnap.data() : INITIAL_CONFIG);
                    }, (e) => console.error("Firebase config listener error.", e));
                });
                return () => unsub();
            }
            DB.config.get().then(callback);
            return () => {};
        },

        save: async (configData) => {
            if (dbMode === "firebase" && firestoreDb) {
                try {
                    const { doc, setDoc } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
                    await setDoc(doc(firestoreDb, "configuracoes", "geral"), configData, { merge: true });
                    return true;
                } catch (e) {
                    console.error("Firebase write config error.", e);
                }
            }
            const current = JSON.parse(localStorage.getItem('lumie_config')) || INITIAL_CONFIG;
            const updated = { ...current, ...configData };
            localStorage.setItem('lumie_config', JSON.stringify(updated));
            return true;
        }
    },

    // --- STORAGE (Upload de Imagens) ---
    // Faz upload do arquivo para o Firebase Storage e devolve a URL pública
    // (curta) para ser salva no Firestore. Isso evita o bug de salvar a
    // imagem inteira em base64 dentro do documento de configuração/produto/
    // artigo, o que estoura o limite de 1 MiB por documento do Firestore
    // (e a cota do localStorage no fallback local).
    storage: {
        uploadImage: async (file, folder = 'uploads') => {
            if (dbMode === "firebase" && firebaseStorage) {
                const { ref, uploadBytes, getDownloadURL } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js");
                const safeName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
                const storageRef = ref(firebaseStorage, `${folder}/${safeName}`);
                await uploadBytes(storageRef, file);
                return await getDownloadURL(storageRef);
            }

            // Fallback SEM Firebase (modo local/dev): não existe um servidor de
            // arquivos disponível, então convertemos para base64 apenas para
            // pré-visualização em memória/localStorage. Isso é aceitável só
            // porque o modo "local" já não persiste nada em um banco real —
            // em produção (dbMode === "firebase") este caminho não é usado.
            if (file.size > 700 * 1024) {
                throw new Error('Imagem grande demais para o modo local (sem Firebase configurado). Use uma imagem menor que 700KB ou configure o Firebase Storage.');
            }
            return await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = (e) => resolve(e.target.result);
                reader.onerror = () => reject(new Error('Falha ao ler o arquivo.'));
                reader.readAsDataURL(file);
            });
        }
    },

    // --- AUDIT LOG (Histórico de Ações do Painel) ---
    historico: {
        add: async (entry) => {
            const currentUser = DB.auth.getCurrentUser();
            const record = {
                acao: entry.acao,
                entidade: entry.entidade,
                entidadeId: entry.entidadeId || '',
                detalhes: entry.detalhes || '',
                usuario: (currentUser && currentUser.email) || 'sistema',
                data: new Date().toISOString()
            };

            if (dbMode === "firebase" && firestoreDb) {
                try {
                    const { addDoc, collection } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
                    await addDoc(collection(firestoreDb, "historico"), record);
                    return true;
                } catch (e) {
                    console.error("Firebase historico write error. Falling back to local.", e);
                }
            }

            const list = JSON.parse(localStorage.getItem('lumie_historico')) || [];
            list.unshift(record);
            localStorage.setItem('lumie_historico', JSON.stringify(list.slice(0, 300)));
            return true;
        },

        getAll: async () => {
            if (dbMode === "firebase" && firestoreDb) {
                try {
                    const { getDocs, collection, query, orderBy, limit } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
                    const q = query(collection(firestoreDb, "historico"), orderBy("data", "desc"), limit(200));
                    const querySnapshot = await getDocs(q);
                    const list = [];
                    querySnapshot.forEach((doc) => list.push({ id: doc.id, ...doc.data() }));
                    if (list.length) return list;
                } catch (e) {
                    console.error("Firebase historico read error. Falling back to local.", e);
                }
            }
            return JSON.parse(localStorage.getItem('lumie_historico')) || [];
        }
    },

    // --- AUTHENTICATION SHIM ---
    auth: {
        login: async (email, password, remember = false) => {
            const storage = remember ? localStorage : sessionStorage;
            const otherStorage = remember ? sessionStorage : localStorage;

            if (dbMode === "firebase" && firebaseAuth) {
                try {
                    const { signInWithEmailAndPassword, setPersistence, browserLocalPersistence, browserSessionPersistence } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js");
                    await setPersistence(firebaseAuth, remember ? browserLocalPersistence : browserSessionPersistence);
                    const userCredential = await signInWithEmailAndPassword(firebaseAuth, email, password);
                    otherStorage.removeItem("lumie_user_session");
                    storage.setItem("lumie_user_session", JSON.stringify({ email: userCredential.user.email }));
                    return userCredential.user;
                } catch (e) {
                    throw new Error("Erro de login Firebase: " + e.message);
                }
            }
            
            // Local fallback login check
            const admins = JSON.parse(localStorage.getItem('lumie_admins')) || [];
            const user = admins.find(a => a.email === email && a.password === password);
            if (user) {
                otherStorage.removeItem("lumie_user_session");
                storage.setItem("lumie_user_session", JSON.stringify({ email }));
                return { email };
            } else {
                throw new Error("E-mail ou senha incorretos.");
            }
        },

        logout: async () => {
            if (dbMode === "firebase" && firebaseAuth) {
                try {
                    const { signOut } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js");
                    await signOut(firebaseAuth);
                } catch (e) {
                    console.error("Error signing out from Firebase.", e);
                }
            }
            sessionStorage.removeItem("lumie_user_session");
            localStorage.removeItem("lumie_user_session");
            return true;
        },

        getCurrentUser: () => {
            const session = sessionStorage.getItem("lumie_user_session") || localStorage.getItem("lumie_user_session");
            return session ? JSON.parse(session) : null;
        },

        // Cria um novo administrador SEM derrubar a sessão do admin atual.
        // Truque: abre uma instância secundária e isolada do Firebase App só
        // para esse cadastro, e a descarta logo em seguida.
        createAdmin: async (email, password) => {
            if (dbMode !== "firebase" || !firebaseApp) {
                throw new Error("Cadastro de administradores só está disponível em modo Firebase.");
            }
            const App = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js");
            const Auth = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js");
            const Firestore = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");

            // Instância secundária com nome único, mesmas credenciais do projeto.
            const secondaryApp = App.initializeApp(firebaseConfig, "SecondaryAdminCreation_" + Date.now());
            const secondaryAuth = Auth.getAuth(secondaryApp);

            try {
                const cred = await Auth.createUserWithEmailAndPassword(secondaryAuth, email, password);

                // Salva metadados na coleção "admins" pra listar no painel
                // (o cadastro em si de login/senha já fica no Firebase Authentication).
                await Firestore.setDoc(Firestore.doc(firestoreDb, "admins", cred.user.uid), {
                    email,
                    criadoEm: new Date().toISOString()
                });

                await Auth.signOut(secondaryAuth);
                await App.deleteApp(secondaryApp);

                return { email, uid: cred.user.uid };
            } catch (e) {
                await App.deleteApp(secondaryApp).catch(() => {});
                if (e.code === "auth/email-already-in-use") {
                    throw new Error("Este e-mail já está cadastrado como administrador.");
                }
                if (e.code === "auth/weak-password") {
                    throw new Error("Senha muito fraca. Use ao menos 6 caracteres.");
                }
                throw new Error("Erro ao criar administrador: " + e.message);
            }
        },

        // Lista os administradores cadastrados (metadados salvos no Firestore).
        listAdmins: async () => {
            if (dbMode !== "firebase" || !firestoreDb) return [];
            const { collection, getDocs, orderBy, query } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
            const q = query(collection(firestoreDb, "admins"), orderBy("criadoEm", "desc"));
            const snap = await getDocs(q);
            return snap.docs.map(d => ({ uid: d.id, ...d.data() }));
        },

        // Remove só o registro de metadados no Firestore (a conta de login continua
        // existindo no Firebase Authentication até ser removida manualmente pelo Console —
        // o SDK do navegador não tem permissão para excluir contas de terceiros).
        removeAdminRecord: async (uid) => {
            if (dbMode !== "firebase" || !firestoreDb) return;
            const { doc, deleteDoc } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
            await deleteDoc(doc(firestoreDb, "admins", uid));
        }
    },

    // --- ESTOQUE (Gerenciamento de Estoque interno, separado do catálogo público) ---
    estoque: {
        produtos: {
            getAll: async () => {
                if (dbMode === "firebase" && firestoreDb) {
                    try {
                        const { getDocs, collection, query, orderBy } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
                        const q = query(collection(firestoreDb, "estoque_produtos"), orderBy("criadoEm", "desc"));
                        const snap = await getDocs(q);
                        const list = [];
                        snap.forEach((doc) => list.push({ id: doc.id, ...doc.data() }));
                        return list;
                    } catch (e) {
                        console.error("Firebase read estoque_produtos error. Falling back to local.", e);
                    }
                }
                return JSON.parse(localStorage.getItem('lumie_estoque_produtos')) || [];
            },

            getById: async (id) => {
                if (dbMode === "firebase" && firestoreDb) {
                    try {
                        const { doc, getDoc } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
                        const docSnap = await getDoc(doc(firestoreDb, "estoque_produtos", id));
                        if (docSnap.exists()) return { id: docSnap.id, ...docSnap.data() };
                    } catch (e) {
                        console.error("Firebase estoque product fetch error.", e);
                    }
                }
                const list = JSON.parse(localStorage.getItem('lumie_estoque_produtos')) || [];
                return list.find((p) => p.id === id) || null;
            },

            // Cria (sem id) ou atualiza (com id) um produto do estoque.
            save: async (productData) => {
                if (!productData.id) {
                    productData.id = 'eq-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
                    productData.criadoEm = new Date().toISOString();
                }

                if (dbMode === "firebase" && firestoreDb) {
                    try {
                        const { doc, setDoc } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
                        await setDoc(doc(firestoreDb, "estoque_produtos", productData.id), productData, { merge: true });
                        return productData.id;
                    } catch (e) {
                        console.error("Firebase write estoque product error. Attempting local save.", e);
                    }
                }

                const list = JSON.parse(localStorage.getItem('lumie_estoque_produtos')) || [];
                const index = list.findIndex((p) => p.id === productData.id);
                if (index > -1) {
                    list[index] = { ...list[index], ...productData };
                } else {
                    list.push(productData);
                }
                localStorage.setItem('lumie_estoque_produtos', JSON.stringify(list));
                return productData.id;
            },

            delete: async (id) => {
                if (dbMode === "firebase" && firestoreDb) {
                    try {
                        const { doc, deleteDoc } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
                        await deleteDoc(doc(firestoreDb, "estoque_produtos", id));
                        return true;
                    } catch (e) {
                        console.error("Firebase delete estoque product error.", e);
                    }
                }

                let list = JSON.parse(localStorage.getItem('lumie_estoque_produtos')) || [];
                list = list.filter((p) => p.id !== id);
                localStorage.setItem('lumie_estoque_produtos', JSON.stringify(list));
                return true;
            }
        },

        // Histórico de movimentações de estoque (entrada, saída, ajuste, transferência).
        movimentacoes: {
            add: async (entry) => {
                const currentUser = DB.auth.getCurrentUser();
                const record = {
                    id: 'mv-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
                    produtoId: entry.produtoId,
                    produtoNome: entry.produtoNome,
                    tipo: entry.tipo,
                    quantidade: entry.quantidade,
                    localizacao: entry.localizacao || '',
                    observacoes: entry.observacoes || '',
                    usuario: (currentUser && currentUser.email) || 'sistema',
                    data: new Date().toISOString()
                };

                if (dbMode === "firebase" && firestoreDb) {
                    try {
                        const { doc, setDoc } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
                        await setDoc(doc(firestoreDb, "estoque_movimentacoes", record.id), record);
                        return record;
                    } catch (e) {
                        console.error("Firebase write movimentacao error. Falling back to local.", e);
                    }
                }

                const list = JSON.parse(localStorage.getItem('lumie_estoque_movimentacoes')) || [];
                list.unshift(record);
                localStorage.setItem('lumie_estoque_movimentacoes', JSON.stringify(list.slice(0, 1000)));
                return record;
            },

            getAll: async () => {
                if (dbMode === "firebase" && firestoreDb) {
                    try {
                        const { getDocs, collection, query, orderBy, limit } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
                        const q = query(collection(firestoreDb, "estoque_movimentacoes"), orderBy("data", "desc"), limit(500));
                        const snap = await getDocs(q);
                        const list = [];
                        snap.forEach((doc) => list.push({ id: doc.id, ...doc.data() }));
                        if (list.length) return list;
                    } catch (e) {
                        console.error("Firebase read movimentacoes error. Falling back to local.", e);
                    }
                }
                return JSON.parse(localStorage.getItem('lumie_estoque_movimentacoes')) || [];
            }
        }
    }
};

// Make DB available globally
window.DB = DB;
window.isFirebaseConfigured = isFirebaseConfigured;
