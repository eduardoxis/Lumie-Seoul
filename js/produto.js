/*
 * Lumié Seoul - Product Detail Page Logic
 * Pure Vanilla ES6+ — integrado ao spa-router.js
 */

let currentProduct = null;
let currentProductId = null;
let currentPageIsProduto = false;
let produtoListenerIniciado = false;

document.addEventListener("spaNavigate", (e) => {
    const { page, params } = e.detail;
    currentPageIsProduto = page === "produto";
    if (!currentPageIsProduto) return;

    const productId = params.get("id");
    if (!productId) {
        navegar("catalogo");
        return;
    }

    currentProductId = productId;
    if (window.dbReady) carregarProduto(productId);
    else document.addEventListener("db-ready", () => carregarProduto(productId), { once: true });
});

async function carregarProduto(productId) {
    try {
        currentProduct = await DB.products.getById(productId);
        if (!currentProduct) {
            navegar("catalogo");
            return;
        }

        renderProductDetails();
        renderRelatedProducts();
        initGalleryControls();
        initTabControls();
        iniciarAtualizacaoEmTempoReal();
    } catch (e) {
        console.error("Error loading product detail page: ", e);
    }
}

// Tempo real: se um admin editar (ou remover) este produto no painel,
// a página reflete a mudança sozinha, sem precisar de F5. O listener é
// montado uma única vez e permanece ativo enquanto o site estiver aberto,
// só age quando a pessoa ainda está vendo a página de produto.
function iniciarAtualizacaoEmTempoReal() {
    if (produtoListenerIniciado) return;
    produtoListenerIniciado = true;

    DB.products.listen((updatedList) => {
        if (!currentPageIsProduto || !currentProductId) return;

        const updatedProduct = updatedList.find((p) => p.id === currentProductId);
        if (!updatedProduct) {
            // Produto foi removido do catálogo enquanto a pessoa via a página.
            navegar("catalogo");
            return;
        }

        currentProduct = updatedProduct;
        renderProductDetails();
        renderRelatedProducts();
        initGalleryControls();
    });
}

function renderProductDetails() {
    document.title = `${currentProduct.nome} | Lumié Seoul`;
    document.getElementById("p-title-breadcrumb").innerText = currentProduct.nome;

    document.getElementById("p-brand").innerText = currentProduct.marca;
    document.getElementById("p-title").innerText = currentProduct.nome;
    document.getElementById("p-desc-short").innerText = currentProduct.descricaoCurta;

    document.getElementById("p-origem").innerText = currentProduct.origem || "Coreia do Sul";
    document.getElementById("p-categoria").innerText = currentProduct.categoria;
    document.getElementById("p-ind").innerText = currentProduct.indicacao || "Uso Geral";
    document.getElementById("p-peles").innerText = currentProduct.tiposPele ? currentProduct.tiposPele.join(", ") : "Todos os tipos";

    document.getElementById("tab-content-desc").innerHTML = `<p>${currentProduct.descricaoCompleta || currentProduct.descricaoCurta}</p>`;

    const benefitsList = currentProduct.beneficios || ["Fórmula nutritiva de rápida absorção"];
    document.getElementById("tab-content-ben").innerHTML = `
        <ul style="list-style: none; padding-left: 0;">
            ${benefitsList.map(b => `
                <li style="margin-bottom: var(--space-xs); display: flex; align-items: center; gap: 8px;">
                    <i class="fas fa-check" style="color: var(--color-gold); font-size: 10px;"></i>
                    <span>${b}</span>
                </li>
            `).join("")}
        </ul>
    `;

    const ingredientsArray = currentProduct.ingredientes || ["Extratos botânicos naturais"];
    document.getElementById("tab-content-ing").innerHTML = `<p>${ingredientsArray.join(", ")}.</p>`;

    const mainImg = document.getElementById("p-main-img");
    const imagesArray = currentProduct.imagensUrl && currentProduct.imagensUrl.length ? currentProduct.imagensUrl : ["img/cream.jpg"];
    if (mainImg) mainImg.src = imagesArray[0];

    const thumbsWrapper = document.getElementById("p-thumbs");
    if (thumbsWrapper) {
        thumbsWrapper.innerHTML = imagesArray.map((img, i) => `
            <div class="gallery-thumb ${i === 0 ? "active" : ""}" data-img="${img}">
                <img src="${img}" alt="Thumbnail ${i + 1}">
            </div>
        `).join("");
    }

    // Reseta as abas para a primeira sempre que um novo produto é aberto
    document.querySelectorAll(".product-tab-btn").forEach(b => b.classList.remove("active"));
    document.querySelector('.product-tab-btn[data-tab="desc"]')?.classList.add("active");
    document.querySelectorAll(".product-tab-panel").forEach(p => p.classList.remove("active"));
    document.getElementById("tab-content-desc")?.classList.add("active");

    const ctaBtn = document.getElementById("p-cta-btn");
    if (ctaBtn) {
        ctaBtn.onclick = () => contactMerchantForProduct(currentProduct.nome, currentProduct.marca, currentProduct.id);
    }
}

async function renderRelatedProducts() {
    const relatedGrid = document.getElementById("related-grid");
    const relatedSection = document.getElementById("related-section");
    if (!relatedGrid) return;

    try {
        const allProducts = await DB.products.getAll();
        const related = allProducts
            .filter(p => p.id !== currentProduct.id && (p.categoria === currentProduct.categoria || p.marca === currentProduct.marca))
            .slice(0, 4);

        const lista = related.length ? related : allProducts.filter(p => p.id !== currentProduct.id).slice(0, 4);

        if (lista.length === 0) {
            if (relatedSection) relatedSection.style.display = "none";
            return;
        }

        if (relatedSection) relatedSection.style.display = "";
        relatedGrid.innerHTML = lista.map(product => `
            <article class="product-card">
                <div class="product-card-img-wrapper" onclick="navegar('produto', {id: '${product.id}'})" style="cursor: pointer;">
                    ${product.badge ? `<span class="product-badge">${product.badge}</span>` : ""}
                    <img src="${product.imagensUrl[0]}" alt="${product.nome}" class="product-card-img" loading="lazy">
                </div>
                <div class="product-card-info">
                    <span class="product-brand">${product.marca}</span>
                    <h3 class="product-title" onclick="navegar('produto', {id: '${product.id}'})" style="cursor: pointer;">${product.nome}</h3>
                    <p class="product-meta">${product.descricaoCurta}</p>
                    <div class="product-card-actions">
                        <button class="btn btn-secondary" onclick="navegar('produto', {id: '${product.id}'})">Ver Detalhes</button>
                        <button class="btn btn-whatsapp" onclick="contactMerchantForProduct('${product.nome}', '${product.marca}', '${product.id}')">
                            <i class="fab fa-whatsapp"></i> WhatsApp
                        </button>
                    </div>
                </div>
            </article>
        `).join("");
    } catch (e) {
        console.error("Error rendering related products: ", e);
    }
}

function initGalleryControls() {
    const thumbs = document.querySelectorAll("#p-thumbs .gallery-thumb");
    const mainImg = document.getElementById("p-main-img");

    thumbs.forEach(thumb => {
        thumb.addEventListener("click", () => {
            thumbs.forEach(t => t.classList.remove("active"));
            thumb.classList.add("active");
            mainImg.src = thumb.dataset.img;
        });
    });
}

function initTabControls() {
    document.querySelectorAll(".product-tab-btn").forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll(".product-tab-btn").forEach(b => b.classList.remove("active"));
            document.querySelectorAll(".product-tab-panel").forEach(p => p.classList.remove("active"));

            btn.classList.add("active");
            document.getElementById(`tab-content-${btn.dataset.tab}`)?.classList.add("active");
        };
    });
}
