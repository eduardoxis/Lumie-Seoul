/*
 * Lumié Seoul - Dynamic Database-Backed Product Catalog
 * Pure Vanilla ES6+ — integrado ao spa-router.js
 */

let productsList = [];
let shopConfig = {};
let catalogoInicializado = false;
let categoriaPendente = null;

document.addEventListener("spaNavigate", (e) => {
    const { page, params } = e.detail;
    if (page === "catalogo") {
        categoriaPendente = params.get("categoria");
        garantirCatalogoCarregado().then(() => aplicarCategoriaPendente());
    } else if (page === "inicio") {
        garantirCatalogoCarregado().then(renderFeatured);
    }
});

function garantirCatalogoCarregado() {
    if (catalogoInicializado) return Promise.resolve();

    return new Promise((resolve) => {
        const start = async () => {
            try {
                productsList = await DB.products.getAll();
                shopConfig = await DB.config.get();

                updateFilterSelects();
                renderCatalog(productsList);
                initFilters();
                catalogoInicializado = true;
            } catch (e) {
                console.error("Failed to load catalog database: ", e);
            }
            resolve();
        };

        if (window.DB) start();
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

    grid.innerHTML = filteredProducts.map(product => cardProdutoHtml(product)).join("");

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
                <div class="product-card-bottom">
                    <span class="product-price">${product.preco}</span>
                </div>
                <div class="product-card-actions">
                    <button class="btn btn-secondary" onclick="navegar('produto', {id: '${product.id}'})">Ver Detalhes</button>
                    <button class="btn btn-whatsapp" onclick="contactMerchantForProduct('${product.nome}', '${product.marca}', '${product.preco}', '${product.id}')">
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
            if (sortOrder.value === "preco-cres") {
                results.sort((a, b) => parseFloat(a.preco.replace("R$ ", "").replace(".", "").replace(",", ".")) - parseFloat(b.preco.replace("R$ ", "").replace(".", "").replace(",", ".")));
            } else if (sortOrder.value === "preco-decres") {
                results.sort((a, b) => parseFloat(b.preco.replace("R$ ", "").replace(".", "").replace(",", ".")) - parseFloat(a.preco.replace("R$ ", "").replace(".", "").replace(",", ".")));
            } else if (sortOrder.value === "nome-az") {
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
