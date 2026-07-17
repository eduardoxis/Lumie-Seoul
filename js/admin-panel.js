/*
 * Lumié Seoul - Painel Administrativo (versão modal embutida)
 * Pure Vanilla ES6+
 *
 * Substitui as antigas páginas separadas (/admin/*.html). Agora existe
 * um único modal de painel dentro do index.html, e este arquivo é quem
 * gerencia a troca entre as "abas" (Dashboard, Produtos, Categorias,
 * Blog, Administradores, Configurações) e todo o CRUD de cada uma.
 */

// ---- Estado em memória ----
let apConfig = {};
let apProducts = [];
let apArticles = [];

document.addEventListener('DOMContentLoaded', () => {
    if (window.DB) {
        initAdminAuthUI();
    } else {
        document.addEventListener('db-ready', initAdminAuthUI);
    }

    bindStaticAdminEvents();
});

/* ============================================================
   1. NAV AUTH STATE (Entrar / Painel Admin)
   ============================================================ */
function initAdminAuthUI() {
    refreshAuthUI();
}

function refreshAuthUI() {
    const isLogged = !!DB.auth.getCurrentUser();
    document.querySelectorAll('.js-auth-nav-btn').forEach(btn => {
        if (isLogged) {
            btn.innerHTML = '<i class="fa-solid fa-user-shield"></i> <span>Painel Admin</span>';
            btn.dataset.authState = 'admin';
        } else {
            btn.innerHTML = '<i class="fa-solid fa-right-to-bracket"></i> <span>Entrar</span>';
            btn.dataset.authState = 'guest';
        }
    });
}

function bindStaticAdminEvents() {
    // Nav / drawer "Entrar" <-> "Painel Admin" buttons
    document.querySelectorAll('.js-auth-nav-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            // Close mobile drawer if open
            const drawer = document.querySelector('.sidebar-drawer');
            if (drawer && drawer.classList.contains('active')) {
                document.querySelector('.menu-toggle')?.click();
            }

            if (btn.dataset.authState === 'admin') {
                openAdminPanel();
            } else {
                openLoginModal();
            }
        });
    });

    // Login modal
    document.getElementById('ap-login-close')?.addEventListener('click', closeLoginModal);
    document.getElementById('ap-login-overlay')?.addEventListener('click', (e) => {
        if (e.target.id === 'ap-login-overlay') closeLoginModal();
    });
    document.getElementById('ap-login-form')?.addEventListener('submit', handleLoginSubmit);

    // Admin panel modal
    document.getElementById('ap-panel-close')?.addEventListener('click', closeAdminPanel);
    document.getElementById('ap-panel-overlay')?.addEventListener('click', (e) => {
        if (e.target.id === 'ap-panel-overlay') closeAdminPanel();
    });
    document.getElementById('ap-logout-btn')?.addEventListener('click', async (e) => {
        e.preventDefault();
        await DB.auth.logout();
        closeAdminPanel();
        refreshAuthUI();
    });

    // Tab navigation inside the admin panel
    document.querySelectorAll('.ap-menu-link[data-tab]').forEach(link => {
        link.addEventListener('click', () => switchAdminTab(link.dataset.tab));
    });

    // ---- Produtos ----
    document.getElementById('ap-new-product-btn')?.addEventListener('click', () => openProductPanel('new'));
    document.getElementById('ap-product-panel-close')?.addEventListener('click', closeProductPanel);
    document.getElementById('ap-product-panel-cancel')?.addEventListener('click', closeProductPanel);
    document.getElementById('ap-save-product-btn')?.addEventListener('click', saveProduct);
    document.getElementById('ap-p-form-file')?.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            document.getElementById('ap-p-form-img-url').value = event.target.result;
            showProductPreview(event.target.result);
        };
        reader.readAsDataURL(file);
    });
    document.getElementById('ap-p-form-img-url')?.addEventListener('input', (e) => showProductPreview(e.target.value));

    // ---- Categorias ----
    document.getElementById('ap-add-category-btn')?.addEventListener('click', addCategory);
    document.getElementById('ap-add-brand-btn')?.addEventListener('click', addBrand);

    // ---- Blog ----
    document.getElementById('ap-new-article-btn')?.addEventListener('click', () => openBlogPanel('new'));
    document.getElementById('ap-blog-panel-close')?.addEventListener('click', closeBlogPanel);
    document.getElementById('ap-blog-panel-cancel')?.addEventListener('click', closeBlogPanel);
    document.getElementById('ap-save-blog-btn')?.addEventListener('click', saveArticle);
    document.getElementById('ap-b-form-file')?.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            document.getElementById('ap-b-form-img-url').value = event.target.result;
            showBlogPreview(event.target.result);
        };
        reader.readAsDataURL(file);
    });
    document.getElementById('ap-b-form-img-url')?.addEventListener('input', (e) => showBlogPreview(e.target.value));

    // ---- Administradores ----
    document.getElementById('ap-new-admin-btn')?.addEventListener('click', openAdminUserPanel);
    document.getElementById('ap-admin-user-panel-close')?.addEventListener('click', closeAdminUserPanel);
    document.getElementById('ap-admin-user-panel-cancel')?.addEventListener('click', closeAdminUserPanel);
    document.getElementById('ap-save-admin-user-btn')?.addEventListener('click', saveAdminUser);

    // ---- Configurações ----
    document.getElementById('ap-config-form')?.addEventListener('submit', saveConfigForm);
    document.getElementById('ap-cfg-banner-file')?.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            document.getElementById('ap-cfg-banner-desktop').value = event.target.result;
        };
        reader.readAsDataURL(file);
    });
}

/* ============================================================
   2. LOGIN MODAL
   ============================================================ */
function openLoginModal() {
    document.getElementById('ap-login-overlay')?.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeLoginModal() {
    document.getElementById('ap-login-overlay')?.classList.remove('active');
    document.body.style.overflow = '';
    document.getElementById('ap-login-error').style.display = 'none';
    document.getElementById('ap-login-form')?.reset();
}

async function handleLoginSubmit(e) {
    e.preventDefault();
    const email = document.getElementById('ap-login-email').value;
    const password = document.getElementById('ap-login-password').value;
    const errorBox = document.getElementById('ap-login-error');
    errorBox.style.display = 'none';

    try {
        await DB.auth.login(email, password);
        closeLoginModal();
        refreshAuthUI();
        openAdminPanel();
    } catch (err) {
        errorBox.innerText = err.message;
        errorBox.style.display = 'block';
    }
}

/* ============================================================
   3. ADMIN PANEL MODAL + TABS
   ============================================================ */
function openAdminPanel() {
    if (!DB.auth.getCurrentUser()) {
        openLoginModal();
        return;
    }
    document.getElementById('ap-panel-overlay')?.classList.add('active');
    document.body.style.overflow = 'hidden';
    switchAdminTab('dashboard');
}

function closeAdminPanel() {
    document.getElementById('ap-panel-overlay')?.classList.remove('active');
    document.body.style.overflow = '';
}

function switchAdminTab(tab) {
    document.querySelectorAll('.ap-menu-link[data-tab]').forEach(link => {
        link.classList.toggle('active', link.dataset.tab === tab);
    });
    document.querySelectorAll('.ap-tab-content').forEach(panel => {
        panel.classList.toggle('active', panel.dataset.tabContent === tab);
    });

    switch (tab) {
        case 'dashboard': loadDashboardTab(); break;
        case 'produtos': loadProductsTab(); break;
        case 'categorias': loadCategoriasTab(); break;
        case 'blog': loadBlogTab(); break;
        case 'administradores': loadAdminsTab(); break;
        case 'configuracoes': loadConfigTab(); break;
    }
}

/* ============================================================
   4. DASHBOARD
   ============================================================ */
async function loadDashboardTab() {
    const badge = document.getElementById('ap-db-status-badge');
    if (badge) {
        if (DB.getMode() === 'firebase') {
            badge.innerText = 'Firebase Conectado';
            badge.style.backgroundColor = '#EBF6EE';
            badge.style.color = '#607255';
        } else {
            badge.innerText = 'Modo Local (LocalStorage)';
            badge.style.backgroundColor = '#F4EFEA';
            badge.style.color = '#AE8C68';
        }
    }

    try {
        const products = await DB.products.getAll();
        const blog = await DB.blog.getAll();
        const config = await DB.config.get();

        document.getElementById('ap-stat-products-count').innerText = products.length;
        document.getElementById('ap-stat-articles-count').innerText = blog.length;
        document.getElementById('ap-stat-cats-count').innerText = config.categorias ? config.categorias.length : 0;

        const recentTbody = document.getElementById('ap-recent-products-tbody');
        const recentList = products.slice(0, 5);

        if (recentList.length === 0) {
            recentTbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: #9B8E85;">Nenhum produto cadastrado.</td></tr>`;
            return;
        }

        recentTbody.innerHTML = recentList.map(p => `
            <tr>
                <td><strong>${p.nome}</strong></td>
                <td>${p.marca}</td>
                <td>${p.categoria}</td>
                <td>${p.preco}</td>
            </tr>
        `).join('');
    } catch (e) {
        console.error("Dashboard database fetch error: ", e);
    }
}

/* ============================================================
   5. PRODUTOS
   ============================================================ */
async function loadProductsTab() {
    apConfig = await DB.config.get();

    const brandSelect = document.getElementById('ap-p-form-marca');
    const catSelect = document.getElementById('ap-p-form-categoria');
    if (brandSelect) brandSelect.innerHTML = (apConfig.marcas || []).map(m => `<option value="${m}">${m}</option>`).join('');
    if (catSelect) catSelect.innerHTML = (apConfig.categorias || []).map(c => `<option value="${c}">${c}</option>`).join('');

    try {
        apProducts = await DB.products.getAll();
        const tbody = document.getElementById('ap-products-tbody');

        if (apProducts.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: #9B8E85;">Nenhum produto cadastrado.</td></tr>`;
            return;
        }

        tbody.innerHTML = apProducts.map(p => {
            const imgUrl = p.imagensUrl && p.imagensUrl[0] ? p.imagensUrl[0] : 'img/cream.jpg';
            return `
                <tr>
                    <td><img src="${imgUrl}" style="width: 45px; height: 45px; object-fit: cover; border-radius: 4px; border: 1px solid var(--admin-color-border);"></td>
                    <td><strong>${p.nome}</strong></td>
                    <td>${p.marca}</td>
                    <td>${p.categoria}</td>
                    <td>${p.preco}</td>
                    <td>${p.badge ? `<span style="font-size: 10px; background: #FAF9F6; border: 1px solid var(--admin-color-border); padding: 2px 6px; border-radius: 99px;">${p.badge}</span>` : '-'}</td>
                    <td class="admin-actions-cell">
                        <a class="admin-action-link admin-action-edit" data-edit-product="${p.id}" title="Editar"><i class="fa-regular fa-pen-to-square"></i></a>
                        <a class="admin-action-link admin-action-delete" data-delete-product="${p.id}" title="Remover"><i class="fa-regular fa-trash-can"></i></a>
                    </td>
                </tr>
            `;
        }).join('');

        tbody.querySelectorAll('[data-edit-product]').forEach(el => {
            el.addEventListener('click', () => openProductPanel('edit', el.dataset.editProduct));
        });
        tbody.querySelectorAll('[data-delete-product]').forEach(el => {
            el.addEventListener('click', () => deleteProduct(el.dataset.deleteProduct));
        });
    } catch (e) {
        console.error("Error loading products list: ", e);
    }
}

function openProductPanel(mode, id = '') {
    const panel = document.getElementById('ap-product-panel');
    const title = document.getElementById('ap-product-panel-title');

    document.getElementById('ap-product-form').reset();
    document.getElementById('ap-p-form-id').value = '';
    document.getElementById('ap-p-img-preview-wrapper').style.display = 'none';

    if (mode === 'new') {
        title.innerText = 'Novo Produto';
    } else {
        title.innerText = 'Editar Produto';
        const product = apProducts.find(p => p.id === id);
        if (product) {
            document.getElementById('ap-p-form-id').value = product.id;
            document.getElementById('ap-p-form-nome').value = product.nome;
            document.getElementById('ap-p-form-marca').value = product.marca;
            document.getElementById('ap-p-form-categoria').value = product.categoria;
            document.getElementById('ap-p-form-preco').value = product.preco;
            document.getElementById('ap-p-form-origem').value = product.origem || 'Coreia do Sul';
            document.getElementById('ap-p-form-badge').value = product.badge || '';
            document.getElementById('ap-p-form-desc-curta').value = product.descricaoCurta;
            document.getElementById('ap-p-form-desc-completa').value = product.descricaoCompleta || '';
            document.getElementById('ap-p-form-beneficios').value = product.beneficios ? product.beneficios.join('\n') : '';
            document.getElementById('ap-p-form-ingredientes').value = product.ingredientes ? product.ingredientes.join(', ') : '';
            document.getElementById('ap-p-form-modo').value = product.modoUso || '';
            document.getElementById('ap-p-form-ind').value = product.indicacao || '';

            const skinSelect = document.getElementById('ap-p-form-peles');
            Array.from(skinSelect.options).forEach(opt => {
                opt.selected = product.tiposPele && product.tiposPele.includes(opt.value);
            });

            if (product.imagensUrl && product.imagensUrl[0]) {
                document.getElementById('ap-p-form-img-url').value = product.imagensUrl[0];
                showProductPreview(product.imagensUrl[0]);
            }
        }
    }

    panel.classList.add('active');
}

function closeProductPanel() {
    document.getElementById('ap-product-panel').classList.remove('active');
}

function showProductPreview(url) {
    const wrapper = document.getElementById('ap-p-img-preview-wrapper');
    const img = document.getElementById('ap-p-img-preview');
    if (url) {
        img.src = url;
        wrapper.style.display = 'block';
    } else {
        wrapper.style.display = 'none';
    }
}

async function saveProduct() {
    const nome = document.getElementById('ap-p-form-nome').value;
    if (!nome) {
        alert("Por favor, digite o nome do produto.");
        return;
    }

    const id = document.getElementById('ap-p-form-id').value;
    const marca = document.getElementById('ap-p-form-marca').value;
    const categoria = document.getElementById('ap-p-form-categoria').value;
    const preco = document.getElementById('ap-p-form-preco').value;
    const origem = document.getElementById('ap-p-form-origem').value;
    const badge = document.getElementById('ap-p-form-badge').value;
    const descricaoCurta = document.getElementById('ap-p-form-desc-curta').value;
    const descricaoCompleta = document.getElementById('ap-p-form-desc-completa').value;
    const modoUso = document.getElementById('ap-p-form-modo').value;
    const indicacao = document.getElementById('ap-p-form-ind').value;

    const beneficios = document.getElementById('ap-p-form-beneficios').value.split('\n').filter(b => b.trim() !== '');
    const ingredientes = document.getElementById('ap-p-form-ingredientes').value.split(',').map(i => i.trim()).filter(i => i !== '');

    const skinSelect = document.getElementById('ap-p-form-peles');
    const tiposPele = Array.from(skinSelect.selectedOptions).map(opt => opt.value);

    const imgUrl = document.getElementById('ap-p-form-img-url').value || 'img/cream.jpg';

    const productData = {
        nome, marca, categoria, preco, origem, badge,
        descricaoCurta, descricaoCompleta, modoUso, indicacao,
        beneficios, ingredientes, tiposPele,
        imagensUrl: [imgUrl]
    };

    if (id) productData.id = id;

    try {
        await DB.products.save(productData);
        closeProductPanel();
        await loadProductsTab();
    } catch (e) {
        console.error("Save product error: ", e);
        alert("Erro ao salvar produto.");
    }
}

async function deleteProduct(id) {
    if (confirm("Tem certeza que deseja remover este produto do catálogo?")) {
        try {
            await DB.products.delete(id);
            await loadProductsTab();
        } catch (e) {
            console.error("Delete error: ", e);
        }
    }
}

/* ============================================================
   6. CATEGORIAS & MARCAS
   ============================================================ */
async function loadCategoriasTab() {
    try {
        apConfig = await DB.config.get();
        renderCategoriesTable();
        renderBrandsTable();
    } catch (e) {
        console.error("Error loading configurations: ", e);
    }
}

function renderCategoriesTable() {
    const tbody = document.getElementById('ap-categories-tbody');
    const cats = apConfig.categorias || [];

    if (cats.length === 0) {
        tbody.innerHTML = `<tr><td colspan="2" style="text-align: center; color: #9B8E85;">Nenhuma categoria configurada.</td></tr>`;
        return;
    }

    tbody.innerHTML = cats.map((c, index) => `
        <tr>
            <td><strong>${c}</strong></td>
            <td class="admin-actions-cell">
                <a class="admin-action-link admin-action-delete" data-delete-cat="${index}" title="Remover"><i class="fa-regular fa-trash-can"></i></a>
            </td>
        </tr>
    `).join('');

    tbody.querySelectorAll('[data-delete-cat]').forEach(el => {
        el.addEventListener('click', () => deleteCategory(parseInt(el.dataset.deleteCat, 10)));
    });
}

function renderBrandsTable() {
    const tbody = document.getElementById('ap-brands-tbody');
    const marcas = apConfig.marcas || [];

    if (marcas.length === 0) {
        tbody.innerHTML = `<tr><td colspan="2" style="text-align: center; color: #9B8E85;">Nenhuma marca configurada.</td></tr>`;
        return;
    }

    tbody.innerHTML = marcas.map((m, index) => `
        <tr>
            <td><strong>${m}</strong></td>
            <td class="admin-actions-cell">
                <a class="admin-action-link admin-action-delete" data-delete-brand="${index}" title="Remover"><i class="fa-regular fa-trash-can"></i></a>
            </td>
        </tr>
    `).join('');

    tbody.querySelectorAll('[data-delete-brand]').forEach(el => {
        el.addEventListener('click', () => deleteBrand(parseInt(el.dataset.deleteBrand, 10)));
    });
}

async function addCategory() {
    const name = prompt("Digite o nome da nova categoria:");
    if (!name || name.trim() === "") return;

    apConfig.categorias = apConfig.categorias || [];
    if (apConfig.categorias.includes(name.trim())) {
        alert("Esta categoria já existe.");
        return;
    }

    apConfig.categorias.push(name.trim());
    await saveConfigSilently();
    renderCategoriesTable();
}

async function addBrand() {
    const name = prompt("Digite o nome da nova marca:");
    if (!name || name.trim() === "") return;

    apConfig.marcas = apConfig.marcas || [];
    if (apConfig.marcas.includes(name.trim())) {
        alert("Esta marca já existe.");
        return;
    }

    apConfig.marcas.push(name.trim());
    await saveConfigSilently();
    renderBrandsTable();
}

async function deleteCategory(index) {
    if (confirm(`Tem certeza que deseja remover a categoria "${apConfig.categorias[index]}"?`)) {
        apConfig.categorias.splice(index, 1);
        await saveConfigSilently();
        renderCategoriesTable();
    }
}

async function deleteBrand(index) {
    if (confirm(`Tem certeza que deseja remover a marca "${apConfig.marcas[index]}"?`)) {
        apConfig.marcas.splice(index, 1);
        await saveConfigSilently();
        renderBrandsTable();
    }
}

async function saveConfigSilently() {
    try {
        await DB.config.save(apConfig);
    } catch (e) {
        console.error("Error saving categories/brands config: ", e);
        alert("Falha ao salvar configuração.");
    }
}

/* ============================================================
   7. BLOG
   ============================================================ */
async function loadBlogTab() {
    try {
        apArticles = await DB.blog.getAll();
        const tbody = document.getElementById('ap-blog-tbody');

        if (apArticles.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: #9B8E85;">Nenhum artigo cadastrado.</td></tr>`;
            return;
        }

        tbody.innerHTML = apArticles.map(post => {
            const dateStr = new Date(post.publicadoEm).toLocaleDateString('pt-BR');
            const imgUrl = post.imagemCapaUrl || 'img/banner.jpg';
            return `
                <tr>
                    <td><img src="${imgUrl}" style="width: 60px; height: 40px; object-fit: cover; border-radius: 4px; border: 1px solid var(--admin-color-border);"></td>
                    <td><strong>${post.titulo}</strong></td>
                    <td>${post.autor}</td>
                    <td>${dateStr}</td>
                    <td>${post.tags ? post.tags.map(t => `<span style="font-size: 9px; padding: 2px 6px; background:#FAF9F6; border:1px solid var(--admin-color-border); border-radius:99px; margin-right:4px;">#${t}</span>`).join('') : '-'}</td>
                    <td class="admin-actions-cell">
                        <a class="admin-action-link admin-action-edit" data-edit-article="${post.id}" title="Editar"><i class="fa-regular fa-pen-to-square"></i></a>
                        <a class="admin-action-link admin-action-delete" data-delete-article="${post.id}" title="Remover"><i class="fa-regular fa-trash-can"></i></a>
                    </td>
                </tr>
            `;
        }).join('');

        tbody.querySelectorAll('[data-edit-article]').forEach(el => {
            el.addEventListener('click', () => openBlogPanel('edit', el.dataset.editArticle));
        });
        tbody.querySelectorAll('[data-delete-article]').forEach(el => {
            el.addEventListener('click', () => deleteArticle(el.dataset.deleteArticle));
        });
    } catch (e) {
        console.error("Error loading blog table: ", e);
    }
}

function openBlogPanel(mode, id = '') {
    const panel = document.getElementById('ap-blog-panel');
    const title = document.getElementById('ap-blog-panel-title');

    document.getElementById('ap-blog-form').reset();
    document.getElementById('ap-b-form-id').value = '';
    document.getElementById('ap-b-img-preview-wrapper').style.display = 'none';

    if (mode === 'new') {
        title.innerText = 'Novo Artigo';
    } else {
        title.innerText = 'Editar Artigo';
        const post = apArticles.find(a => a.id === id);
        if (post) {
            document.getElementById('ap-b-form-id').value = post.id;
            document.getElementById('ap-b-form-titulo').value = post.titulo;
            document.getElementById('ap-b-form-autor').value = post.autor;
            document.getElementById('ap-b-form-resumo').value = post.resumo;
            document.getElementById('ap-b-form-conteudo').value = post.conteudoHtml;
            document.getElementById('ap-b-form-tags').value = post.tags ? post.tags.join(', ') : '';

            if (post.imagemCapaUrl) {
                document.getElementById('ap-b-form-img-url').value = post.imagemCapaUrl;
                showBlogPreview(post.imagemCapaUrl);
            }
        }
    }

    panel.classList.add('active');
}

function closeBlogPanel() {
    document.getElementById('ap-blog-panel').classList.remove('active');
}

function showBlogPreview(url) {
    const wrapper = document.getElementById('ap-b-img-preview-wrapper');
    const img = document.getElementById('ap-b-img-preview');
    if (url) {
        img.src = url;
        wrapper.style.display = 'block';
    } else {
        wrapper.style.display = 'none';
    }
}

async function saveArticle() {
    const titulo = document.getElementById('ap-b-form-titulo').value;
    if (!titulo) {
        alert("Por favor, digite o título do artigo.");
        return;
    }

    const id = document.getElementById('ap-b-form-id').value;
    const autor = document.getElementById('ap-b-form-autor').value;
    const resumo = document.getElementById('ap-b-form-resumo').value;
    const conteudoHtml = document.getElementById('ap-b-form-conteudo').value;
    const tags = document.getElementById('ap-b-form-tags').value.split(',').map(t => t.trim()).filter(t => t !== '');
    const imagemCapaUrl = document.getElementById('ap-b-form-img-url').value || 'img/banner.jpg';

    const articleData = { titulo, autor, resumo, conteudoHtml, tags, imagemCapaUrl };
    if (id) articleData.id = id;

    try {
        await DB.blog.save(articleData);
        closeBlogPanel();
        await loadBlogTab();
    } catch (e) {
        console.error("Save article error: ", e);
        alert("Erro ao salvar artigo.");
    }
}

async function deleteArticle(id) {
    if (confirm("Tem certeza que deseja remover este artigo do blog?")) {
        try {
            await DB.blog.delete(id);
            await loadBlogTab();
        } catch (e) {
            console.error("Delete error: ", e);
        }
    }
}

/* ============================================================
   8. ADMINISTRADORES
   ============================================================ */
function loadAdminsTab() {
    const warning = document.getElementById('ap-fb-auth-warning');
    if (warning) warning.style.display = DB.getMode() === 'firebase' ? 'block' : 'none';

    const tbody = document.getElementById('ap-admins-tbody');
    const admins = JSON.parse(localStorage.getItem('lumie_admins')) || [];

    if (admins.length === 0) {
        tbody.innerHTML = `<tr><td colspan="3" style="text-align: center; color: #9B8E85;">Nenhum administrador local cadastrado.</td></tr>`;
        return;
    }

    tbody.innerHTML = admins.map((adm, index) => `
        <tr>
            <td><strong>${adm.email}</strong></td>
            <td><span style="font-size: 11px; background: #EBF6EE; color: #607255; padding: 2px 8px; border-radius: 99px; font-weight:600;">Ativo</span></td>
            <td class="admin-actions-cell">
                ${adm.email === 'admin@lumie.com' ? '-' : `<a class="admin-action-link admin-action-delete" data-delete-admin="${index}" title="Remover"><i class="fa-regular fa-trash-can"></i></a>`}
            </td>
        </tr>
    `).join('');

    tbody.querySelectorAll('[data-delete-admin]').forEach(el => {
        el.addEventListener('click', () => deleteAdminUser(parseInt(el.dataset.deleteAdmin, 10)));
    });
}

function openAdminUserPanel() {
    document.getElementById('ap-admin-user-form')?.reset();
    document.getElementById('ap-admin-user-panel').classList.add('active');
}

function closeAdminUserPanel() {
    document.getElementById('ap-admin-user-panel').classList.remove('active');
}

function saveAdminUser() {
    const email = document.getElementById('ap-adm-email').value;
    const password = document.getElementById('ap-adm-password').value;

    if (!email || !password || password.length < 4) {
        alert("Por favor, digite um e-mail válido e uma senha de no mínimo 4 caracteres.");
        return;
    }

    const admins = JSON.parse(localStorage.getItem('lumie_admins')) || [];
    if (admins.some(a => a.email === email)) {
        alert("Este e-mail administrativo já está cadastrado.");
        return;
    }

    admins.push({ email, password });
    localStorage.setItem('lumie_admins', JSON.stringify(admins));

    closeAdminUserPanel();
    loadAdminsTab();
}

function deleteAdminUser(index) {
    const admins = JSON.parse(localStorage.getItem('lumie_admins')) || [];
    if (confirm(`Tem certeza que deseja revogar o acesso administrativo da conta "${admins[index].email}"?`)) {
        admins.splice(index, 1);
        localStorage.setItem('lumie_admins', JSON.stringify(admins));
        loadAdminsTab();
    }
}

/* ============================================================
   9. CONFIGURAÇÕES
   ============================================================ */
async function loadConfigTab() {
    try {
        apConfig = await DB.config.get();

        document.getElementById('ap-cfg-whatsapp').value = apConfig.whatsappNumero || '5511999998888';
        document.getElementById('ap-cfg-msg').value = apConfig.whatsappMensagemPadrao || '';
        document.getElementById('ap-cfg-seo-title').value = apConfig.seoTituloPadrao || '';
        document.getElementById('ap-cfg-seo-desc').value = apConfig.seoDescricaoPadrao || '';
        document.getElementById('ap-cfg-banner-desktop').value = apConfig.bannerDesktopUrl || 'img/banner.jpg';
    } catch (e) {
        console.error("Error loading config form: ", e);
    }
}

async function saveConfigForm(e) {
    e.preventDefault();

    const whatsappNumero = document.getElementById('ap-cfg-whatsapp').value.trim();
    const whatsappMensagemPadrao = document.getElementById('ap-cfg-msg').value;
    const seoTituloPadrao = document.getElementById('ap-cfg-seo-title').value;
    const seoDescricaoPadrao = document.getElementById('ap-cfg-seo-desc').value;
    const bannerDesktopUrl = document.getElementById('ap-cfg-banner-desktop').value;

    if (/[^0-9]/.test(whatsappNumero)) {
        alert("O número de WhatsApp deve conter apenas dígitos (números). Sem espaços ou caracteres especiais.");
        return;
    }

    const updatedConfig = {
        ...apConfig,
        whatsappNumero,
        whatsappMensagemPadrao,
        seoTituloPadrao,
        seoDescricaoPadrao,
        bannerDesktopUrl,
        bannerMobileUrl: bannerDesktopUrl
    };

    try {
        await DB.config.save(updatedConfig);
        apConfig = updatedConfig;
        alert("Configurações atualizadas com sucesso!");

        if (window.WHATSAPP_CONFIG) {
            window.WHATSAPP_CONFIG.phone = whatsappNumero;
            window.WHATSAPP_CONFIG.defaultMessage = whatsappMensagemPadrao;
        }
    } catch (err) {
        console.error("Error updating config form: ", err);
        alert("Falha ao salvar as configurações.");
    }
}
