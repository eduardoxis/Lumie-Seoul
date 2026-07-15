/*
 * Lumié Seoul - SPA Router
 * Mesma lógica de navegação usada no painel Papelaria Futura:
 * um único index.html, várias <section class="page" id="page-X">,
 * e uma função navegar() que mostra/esconde cada uma.
 *
 * Aqui é usado o hash da URL (#pagina?param=valor) para permitir
 * links diretos (ex: compartilhar um produto ou um post do blog).
 */

const TITULOS = {
    "inicio":   "Lumié Seoul | Catálogo Premium de Skincare Coreano (K-Beauty)",
    "catalogo": "Catálogo de Produtos | Lumié Seoul",
    "produto":  "Detalhes do Produto | Lumié Seoul",
    "sobre":    "Sobre Nós | Lumié Seoul",
    "blog":     "Dicas e Blog K-Beauty | Lumié Seoul",
    "contato":  "Contato | Lumié Seoul"
};

const DESCRICOES = {
    "inicio":   "Explore o catálogo exclusivo de Lumié Seoul. Produtos originais de skincare coreano importados diretamente para o Brasil.",
    "catalogo": "Navegue pela nossa seleção exclusiva de skincare coreano. Filtragem rápida por marca, tipo de pele e categoria.",
    "produto":  "Confira os detalhes deste produto de K-Beauty original, importado diretamente da Coreia do Sul.",
    "sobre":    "Conheça a filosofia e a origem da Lumié Seoul, curadoria de skincare coreano no Brasil.",
    "blog":     "Dicas, rotinas e novidades do universo K-Beauty.",
    "contato":  "Fale diretamente com nossa equipe de especialistas em rotina de beleza coreana."
};

/**
 * Lê o hash atual e devolve { page, params }.
 * Formato aceito: #pagina  ou  #pagina?chave=valor&chave2=valor2
 */
function lerHash() {
    const hash = window.location.hash.replace(/^#/, "");
    const [page, queryString] = hash.split("?");
    return {
        page: page || "inicio",
        params: new URLSearchParams(queryString || "")
    };
}

/**
 * Navega para uma página, atualizando o hash da URL.
 * Chamado tanto pelos links (data-page) quanto programaticamente pelos módulos.
 */
function navegar(pageId, params = {}) {
    let hash = pageId;
    const qs = new URLSearchParams(params).toString();
    if (qs) hash += `?${qs}`;

    if (window.location.hash.replace(/^#/, "") === hash) {
        // Mesmo destino: força o re-render (ex: clicar em outro produto)
        renderizarRota();
    } else {
        window.location.hash = hash;
    }
}
window.navegar = navegar;

/**
 * Mostra a section da página ativa e esconde as demais,
 * atualiza os itens de navegação (desktop, drawer, bottom nav, footer)
 * e o título/meta description da aba.
 */
function exibirPagina(pageId) {
    document.querySelectorAll(".page").forEach(p => {
        p.hidden = p.id !== `page-${pageId}`;
    });

    document.querySelectorAll("[data-page]").forEach(el => {
        el.classList.toggle("active", el.dataset.page === pageId);
    });

    if (TITULOS[pageId]) document.title = TITULOS[pageId];
    const metaDesc = document.getElementById("metaDescription");
    if (metaDesc && DESCRICOES[pageId]) metaDesc.setAttribute("content", DESCRICOES[pageId]);

    fecharMenuMobile();
    window.scrollTo({ top: 0, behavior: "instant" in window ? "instant" : "auto" });
}

function fecharMenuMobile() {
    document.querySelector(".menu-toggle")?.classList.remove("active");
    document.querySelector(".sidebar-drawer")?.classList.remove("active");
    document.querySelector(".sidebar-overlay")?.classList.remove("active");
    document.body.style.overflow = "";
}

/**
 * Roteia a página atual: mostra a section certa e dispara o evento
 * "spaNavigate" para que catalogo.js / produto.js / blog.js façam
 * a renderização dinâmica dos dados daquela página.
 */
function renderizarRota() {
    const { page, params } = lerHash();
    const paginaValida = document.getElementById(`page-${page}`) ? page : "inicio";

    exibirPagina(paginaValida);

    document.dispatchEvent(new CustomEvent("spaNavigate", {
        detail: { page: paginaValida, params }
    }));

    // Suporte a #inicio?scroll=faq — usado pelo link de FAQ do rodapé
    const scrollAlvo = params.get("scroll");
    if (scrollAlvo) {
        setTimeout(() => {
            document.getElementById(scrollAlvo)?.scrollIntoView({ behavior: "smooth" });
        }, 100);
    }
}

/**
 * Delegação de cliques: qualquer elemento com [data-page] navega via router,
 * em vez de recarregar a página.
 */
document.addEventListener("click", (e) => {
    const link = e.target.closest("[data-page]");
    if (link) {
        e.preventDefault();
        const page = link.dataset.page;
        const scrollTo = link.dataset.scrollTo;
        navegar(page, scrollTo ? { scroll: scrollTo } : {});
        return;
    }

    // Links de categoria no rodapé -> vai para o catálogo já filtrado
    const catLink = e.target.closest("[data-category-link]");
    if (catLink) {
        e.preventDefault();
        navegar("catalogo", { categoria: catLink.dataset.categoryLink });
    }
});

window.addEventListener("hashchange", renderizarRota);
document.addEventListener("DOMContentLoaded", renderizarRota);
