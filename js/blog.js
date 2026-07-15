/*
 * Lumié Seoul - Blog & Article Reader Engine
 * Pure Vanilla ES6+ — integrado ao spa-router.js
 */

document.addEventListener("spaNavigate", (e) => {
    const { page, params } = e.detail;
    if (page !== "blog") return;

    const articleId = params.get("id");

    if (window.DB) mostrarBlog(articleId);
    else document.addEventListener("db-ready", () => mostrarBlog(articleId), { once: true });
});

function mostrarBlog(articleId) {
    const rollSection = document.getElementById("blog-roll-section");
    const singleSection = document.getElementById("blog-single-section");

    if (articleId) {
        if (rollSection) rollSection.style.display = "none";
        if (singleSection) singleSection.style.display = "block";
        renderSingleArticle(articleId);
    } else {
        if (rollSection) rollSection.style.display = "block";
        if (singleSection) singleSection.style.display = "none";
        renderArticleList();
    }
}

async function renderArticleList() {
    const grid = document.getElementById("blog-grid");
    if (!grid) return;

    try {
        const articles = await DB.blog.getAll();
        if (articles.length === 0) {
            grid.innerHTML = `<p style="grid-column: 1/-1; text-align: center; color: var(--color-text-secondary);">Nenhum artigo publicado no momento.</p>`;
            return;
        }

        grid.innerHTML = articles.map(post => {
            const dateStr = new Date(post.publicadoEm).toLocaleDateString("pt-BR", {
                day: "2-digit",
                month: "long",
                year: "numeric"
            });
            return `
                <article class="blog-card reveal reveal-up" style="background: var(--color-bg-card); border: 1px solid var(--color-border); border-radius: var(--radius-sm); overflow: hidden; display: flex; flex-direction: column; height: 100%;">
                    <div style="aspect-ratio: 16/10; overflow: hidden; background-color: var(--color-bg-base);">
                        <img src="${post.imagemCapaUrl || "img/banner.jpg"}" alt="${post.titulo}" style="width: 100%; height: 100%; object-fit: cover; transition: var(--transition-smooth);" class="blog-card-img">
                    </div>
                    <div style="padding: var(--space-sm); display: flex; flex-direction: column; flex-grow: 1;">
                        <div style="display: flex; gap: 8px; margin-bottom: var(--space-xs); flex-wrap: wrap;">
                            ${post.tags ? post.tags.map(t => `<span style="font-size: 9px; font-weight: 700; color: var(--color-gold); text-transform: uppercase; letter-spacing: 0.05em;">#${t}</span>`).join("") : ""}
                        </div>
                        <h3 class="serif-title" style="font-size: var(--fs-md); font-weight: 400; line-height: 1.3; margin-bottom: var(--space-xs); color: var(--color-text-primary); cursor: pointer;" onclick="navegar('blog', {id: '${post.id}'})">${post.titulo}</h3>
                        <p style="font-size: var(--fs-xs); color: var(--color-text-secondary); line-height: 1.5; margin-bottom: var(--space-sm); flex-grow: 1;">${post.resumo}</p>
                        <div style="display: flex; justify-content: space-between; align-items: center; padding-top: var(--space-xs); border-top: 1px solid rgba(234,227,219,0.5); font-size: 10px; color: var(--color-text-light);">
                            <span>Por ${post.autor}</span>
                            <span>${dateStr}</span>
                        </div>
                        <button class="btn btn-secondary btn-full" style="margin-top: var(--space-sm); padding: 0.5rem; font-size: 10px;" onclick="navegar('blog', {id: '${post.id}'})">Ler Artigo</button>
                    </div>
                </article>
            `;
        }).join("");

        if (typeof initScrollReveal === "function") initScrollReveal();
    } catch (e) {
        console.error("Error loading blog posts: ", e);
    }
}

async function renderSingleArticle(id) {
    try {
        const post = await DB.blog.getById(id);
        if (!post) {
            navegar("blog");
            return;
        }

        document.title = `${post.titulo} | Blog Lumié Seoul`;

        const dateStr = new Date(post.publicadoEm).toLocaleDateString("pt-BR", {
            day: "2-digit",
            month: "long",
            year: "numeric"
        });

        document.getElementById("post-title").innerText = post.titulo;
        document.getElementById("post-meta").innerText = `Publicado por ${post.autor} em ${dateStr}`;
        document.getElementById("post-body").innerHTML = post.conteudoHtml;

        const capImg = document.getElementById("post-capa");
        if (capImg) capImg.src = post.imagemCapaUrl || "img/banner.jpg";

        const tagsWrapper = document.getElementById("post-tags");
        if (tagsWrapper && post.tags) {
            tagsWrapper.innerHTML = post.tags.map(t => `<span style="background: var(--color-gold-light); color: var(--color-gold); padding: 4px 12px; border-radius: var(--radius-full); font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;">${t}</span>`).join("");
        }

        await renderRecentPostsSidebar(post.id);
        window.scrollTo({ top: 0 });
    } catch (e) {
        console.error("Error loading single blog post: ", e);
    }
}

async function renderRecentPostsSidebar(currentId) {
    const listContainer = document.getElementById("recent-posts-list");
    const sidebar = document.getElementById("blog-sidebar");
    if (!listContainer) return;

    try {
        const allPosts = await DB.blog.getAll();
        const recents = allPosts.filter(p => p.id !== currentId).slice(0, 3);

        if (recents.length === 0) {
            if (sidebar) sidebar.style.display = "none";
            return;
        }

        if (sidebar) sidebar.style.display = "";
        listContainer.innerHTML = recents.map(post => `
            <div style="display: flex; gap: var(--space-xs); align-items: center; padding-bottom: var(--space-xs); border-bottom: 1px solid var(--color-border); cursor: pointer;" onclick="navegar('blog', {id: '${post.id}'})">
                <img src="${post.imagemCapaUrl || "img/banner.jpg"}" alt="${post.titulo}" style="width: 60px; height: 60px; object-fit: cover; border-radius: var(--radius-sm);">
                <div>
                    <h5 class="serif-title" style="font-size: 13px; line-height: 1.2; color: var(--color-text-primary); margin-bottom: 2px;">${post.titulo}</h5>
                    <span style="font-size: 9px; color: var(--color-text-light);">${new Date(post.publicadoEm).toLocaleDateString("pt-BR")}</span>
                </div>
            </div>
        `).join("");
    } catch (e) {
        console.error("Error loading recent posts sidebar: ", e);
    }
}
