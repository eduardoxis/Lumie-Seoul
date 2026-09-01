/*
 * Lumié Seoul - Dynamic Database-Backed Product Catalog
 * Pure Vanilla ES6+ — integrado ao spa-router.js
 */

let productsList = [];
let shopConfig = {};
let catalogoInicializado = false;
let categoriaPendente = null;
let catalogPage = 1;
const CATALOG_PAGE_SIZE = 12;

document.addEventListener("spaNavigate", (e) => {
    const { page, params } = e.detail;
    if (page === "catalogo") {
        // A navegação para outra página não deve preservar a página anterior
        // do catálogo. Ao voltar, sempre começamos na primeira página.
        catalogPage = 1;
        categoriaPendente = params.get("categoria");
        garantirCatalogoCarregado().then(() => {
            renderCatalog(productsList);
            aplicarCategoriaPendente();
        });
    } else if (page === "inicio") {
        garantirCatalogoCarregado().then(renderFeatured);
    }
});

function garantirCatalogoCarregado() {
    if (catalogoInicializado) return Promise.resolve();

    return new Promise((resolve) => {
        const start = async () => {
            try {
                shopConfig = await DB.config.get();
                aplicarBannerHome();

                // Tempo real: qualquer alteração feita no painel admin reflete
                // automaticamente aqui, sem precisar dar F5.
                DB.products.listen((updatedList) => {
                    productsList = updatedList;
                    updateFilterSelects();
                    if (catalogoInicializado) {
                        // Já estava carregado: apenas re-renderiza com os dados novos.
                        renderCatalog(productsList);
                        renderFeatured();
                    }
                });

                DB.config.listen((updatedConfig) => {
                    shopConfig = updatedConfig;
                    updateFilterSelects();
                    aplicarBannerHome();
                });

                productsList = await DB.products.getAll();
                updateFilterSelects();
                renderCatalog(productsList);
                initFilters();
                catalogoInicializado = true;
            } catch (e) {
                console.error("Failed to load catalog database: ", e);
            }
            resolve();
        };

        if (window.dbReady) start();
        else document.addEventListener("db-ready", start, { once: true });
    });
}

// Aplica o filtro de categoria vindo de um link externo (ex: rodapé)
function aplicarCategoriaPendente() {
    if (!categoriaPendente) return;

    const pill = document.querySelector(`.category-pill[data-category="${categoriaPendente}"]`);
    if (pill) pill.click();
    categoriaPendente = null;
}

// Aplica o banner configurado no painel admin (aba Configurações) à imagem
// do hero da Home. Se nenhum banner customizado tiver sido salvo ainda,
// mantém a imagem padrão do repositório (img/banner.jpg).
function aplicarBannerHome() {
    const heroImg = document.getElementById('hero-banner-img');
    if (!heroImg) return;

    const bannerUrl = shopConfig.bannerDesktopUrl;
    if (bannerUrl && bannerUrl !== heroImg.getAttribute('src')) {
        heroImg.src = bannerUrl;
    }
}

// Populate brands and categories dynamically in selectors
function updateFilterSelects() {
    const filterBrand = document.getElementById("filter-brand");
    const categoryScroll = document.querySelector("#page-catalogo .category-scroll");

    if (filterBrand && shopConfig.marcas) {
        filterBrand.innerHTML = `<option value="todos">Marca: Todas</option>` +
            shopConfig.marcas.map(m => `<option value="${m}">${m}</option>`).join("");
    }

    if (categoryScroll && shopConfig.categorias) {
        categoryScroll.innerHTML = `<button class="category-pill active" data-category="todos">Todos</button>` +
            shopConfig.categorias.map(c => `<button class="category-pill" data-category="${c}">${c}</button>`).join("");
    }
}

function renderCatalog(filteredProducts = productsList) {
    const grid = document.querySelector("#page-catalogo .products-grid");
    if (!grid) return;

    if (filteredProducts.length === 0) {
        grid.innerHTML = `
            <div class="text-center" style="grid-column: 1 / -1; padding: var(--space-lg) 0;">
                <p style="color: var(--color-text-secondary); font-family: var(--font-serif); font-size: var(--fs-md);">
                    Nenhum produto encontrado com estes critérios.
                </p>
                <button class="btn btn-secondary" style="margin-top: var(--space-sm);" onclick="resetAllFilters()">Limpar Filtros</button>
            </div>
        `;
        return;
    }

    const totalPages = Math.max(1, Math.ceil(filteredProducts.length / CATALOG_PAGE_SIZE));
    catalogPage = Math.min(catalogPage, totalPages);
    const start = (catalogPage - 1) * CATALOG_PAGE_SIZE;
    grid.innerHTML = filteredProducts.slice(start, start + CATALOG_PAGE_SIZE).map(product => cardProdutoHtml(product)).join("");
    let pagination = document.getElementById('catalog-pagination');
    if (!pagination) { pagination = document.createElement('div'); pagination.id = 'catalog-pagination'; pagination.className = 'catalog-pagination'; grid.insertAdjacentElement('afterend', pagination); }
    pagination.innerHTML = totalPages > 1 ? `<button ${catalogPage === 1 ? 'disabled' : ''} data-page="prev">Anterior</button><span>Página ${catalogPage} de ${totalPages}</span><button ${catalogPage === totalPages ? 'disabled' : ''} data-page="next">Próxima</button>` : '';
    pagination.querySelector('[data-page="prev"]')?.addEventListener('click', () => { catalogPage--; renderCatalog(filteredProducts); window.scrollTo({ top: 0, behavior: 'smooth' }); });
    pagination.querySelector('[data-page="next"]')?.addEventListener('click', () => { catalogPage++; renderCatalog(filteredProducts); window.scrollTo({ top: 0, behavior: 'smooth' }); });

    if (typeof initScrollReveal === "function") initScrollReveal();
}

// Grade de destaques na página inicial (primeiros produtos do catálogo)
function renderFeatured() {
    const grid = document.getElementById("featured-grid");
    if (!grid) return;

    const destaques = productsList.slice(0, 4);
    grid.innerHTML = destaques.map(product => cardProdutoHtml(product)).join("");

    if (typeof initScrollReveal === "function") initScrollReveal();
}

function cardProdutoHtml(product) {
    return `
        <article class="product-card reveal reveal-up">
            <div class="product-card-img-wrapper" onclick="navegar('produto', {id: '${product.id}'})" style="cursor: pointer;">
                ${product.badge ? `<span class="product-badge">${product.badge}</span>` : ""}
                <img src="${product.imagensUrl && product.imagensUrl[0] ? product.imagensUrl[0] : "img/cream.jpg"}" alt="${product.nome}" class="product-card-img" loading="lazy">
            </div>
            <div class="product-card-info">
                <span class="product-brand">${product.marca}</span>
                <h3 class="product-title" onclick="navegar('produto', {id: '${product.id}'})" style="cursor: pointer;">${product.nome}</h3>
                <p class="product-meta">${product.descricaoCurta}</p>
                <div class="product-card-actions">
                    <button class="btn btn-secondary" onclick="navegar('produto', {id: '${product.id}'})">Ver Detalhes</button>
                    <button class="btn btn-whatsapp" onclick="contactMerchantForProduct('${product.nome}', '${product.marca}', '${product.id}')">
                        <i class="fab fa-whatsapp"></i> Falar WhatsApp
                    </button>
                </div>
            </div>
        </article>
    `;
}

// Filters logic
function initFilters() {
    const searchInput = document.querySelector("#page-catalogo .search-input");
    const categoryScroll = document.querySelector("#page-catalogo .category-scroll");
    const filterBrand = document.getElementById("filter-brand");
    const filterSkin = document.getElementById("filter-skin");
    const sortOrder = document.getElementById("sort-order");

    let currentCategory = "todos";

    if (categoryScroll) {
        categoryScroll.addEventListener("click", (e) => {
            const pill = e.target.closest(".category-pill");
            if (!pill) return;

            document.querySelectorAll("#page-catalogo .category-pill").forEach(p => p.classList.remove("active"));
            pill.classList.add("active");
            currentCategory = pill.dataset.category;
            applyFilters();
        });
    }

    const applyFilters = () => {
        catalogPage = 1;
        let results = [...productsList];

        if (searchInput && searchInput.value) {
            const query = searchInput.value.toLowerCase().trim();
            results = results.filter(p =>
                p.nome.toLowerCase().includes(query) ||
                p.marca.toLowerCase().includes(query) ||
                p.descricaoCurta.toLowerCase().includes(query)
            );
        }

        if (currentCategory !== "todos") {
            results = results.filter(p => p.categoria.toLowerCase() === currentCategory.toLowerCase());
        }

        if (filterBrand && filterBrand.value !== "todos") {
            results = results.filter(p => p.marca.toLowerCase() === filterBrand.value.toLowerCase());
        }

        if (filterSkin && filterSkin.value !== "todos") {
            results = results.filter(p =>
                p.tiposPele && p.tiposPele.some(t => t.toLowerCase().includes(filterSkin.value.toLowerCase()))
            );
        }

        if (sortOrder) {
            if (sortOrder.value === "nome-az") {
                results.sort((a, b) => a.nome.localeCompare(b.nome));
            }
        }

        renderCatalog(results);
    };

    if (searchInput) searchInput.addEventListener("input", applyFilters);
    if (filterBrand) filterBrand.addEventListener("change", applyFilters);
    if (filterSkin) filterSkin.addEventListener("change", applyFilters);
    if (sortOrder) sortOrder.addEventListener("change", applyFilters);

    window.resetAllFilters = () => {
        if (searchInput) searchInput.value = "";
        if (filterBrand) filterBrand.value = "todos";
        if (filterSkin) filterSkin.value = "todos";
        if (sortOrder) sortOrder.value = "destaque";

        const pills = document.querySelectorAll("#page-catalogo .category-pill");
        pills.forEach(p => p.classList.remove("active"));
        pills[0]?.classList.add("active");
        currentCategory = "todos";

        applyFilters();
    };
}
