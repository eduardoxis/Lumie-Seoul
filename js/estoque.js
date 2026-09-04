/*
 * Lumié Seoul - Módulo de Gerenciamento de Estoque
 * Pure Vanilla ES6+
 *
 * Segue o mesmo padrão do js/admin-panel.js: um conjunto de funções
 * globais que manipulam o DOM da aba "estoque" já presente no modal
 * do painel administrativo, usando o mesmo DB wrapper (js/firebase.js)
 * e reaproveitando helpers já existentes (logAudit, closeAdminPanel...).
 *
 * O acesso a esta aba já é restrito a administradores, pois toda a
 * área do Painel Administrativo exige login (ver admin-panel.js).
 */

// ---- Estado em memória ----
let eqProducts = [];
let eqMovements = [];
let eqMovProductOptions = [];

let eqSearchTerm = '';
let eqFilterCategoria = '';
let eqFilterFornecedor = '';
let eqFilterStatus = '';
let eqSortField = 'nome';
let eqSortDir = 'asc';
let eqCurrentPage = 1;
const EQ_PAGE_SIZE = 10;

let eqMovCurrentPage = 1;
const EQ_MOV_PAGE_SIZE = 10;

let eqImportRows = []; // linhas validadas/normalizadas, prontas para importação

document.addEventListener('DOMContentLoaded', () => {
    bindEstoqueEvents();
});

/* ============================================================
   0. UTILITÁRIOS
   ============================================================ */
function eqEscapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function eqFormatCurrency(value) {
    const num = Number(value) || 0;
    return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function eqFormatDate(iso) {
    try {
        return new Date(iso).toLocaleString('pt-BR');
    } catch (e) {
        return iso || '-';
    }
}

// Situação de estoque de um produto: 'sem' | 'baixo' | 'ok'
function eqStockStatus(product) {
    const qty = Number(product.quantidade) || 0;
    const min = Number(product.estoqueMinimo) || 0;
    if (qty <= 0) return 'sem';
    if (qty <= min) return 'baixo';
    return 'ok';
}

/* ============================================================
   1. BINDING DE EVENTOS ESTÁTICOS
   ============================================================ */
function bindEstoqueEvents() {
    // Sub-navegação interna (Dashboard / Produtos / Movimentações)
    document.querySelectorAll('.ap-eq-subtab-btn[data-eq-tab]').forEach(btn => {
        btn.addEventListener('click', () => switchEstoqueSubtab(btn.dataset.eqTab));
    });

    // ---- Produtos ----
    document.getElementById('ap-eq-new-product-btn')?.addEventListener('click', () => openEstoqueProductPanel('new'));
    document.getElementById('ap-eq-product-panel-close')?.addEventListener('click', closeEstoqueProductPanel);
    document.getElementById('ap-eq-product-panel-cancel')?.addEventListener('click', closeEstoqueProductPanel);
    document.getElementById('ap-eq-save-product-btn')?.addEventListener('click', saveEstoqueProduct);

    document.getElementById('ap-eq-search-input')?.addEventListener('input', (e) => {
        eqSearchTerm = e.target.value.trim().toLowerCase();
        eqCurrentPage = 1;
        renderEstoqueProductsTable();
    });
    document.getElementById('ap-eq-filter-categoria')?.addEventListener('change', (e) => {
        eqFilterCategoria = e.target.value;
        eqCurrentPage = 1;
        renderEstoqueProductsTable();
    });
    document.getElementById('ap-eq-filter-fornecedor')?.addEventListener('change', (e) => {
        eqFilterFornecedor = e.target.value;
        eqCurrentPage = 1;
        renderEstoqueProductsTable();
    });
    document.getElementById('ap-eq-filter-status')?.addEventListener('change', (e) => {
        eqFilterStatus = e.target.value;
        eqCurrentPage = 1;
        renderEstoqueProductsTable();
    });
    document.querySelectorAll('.ap-eq-sortable-table th[data-sort]').forEach(th => {
        th.addEventListener('click', () => {
            const field = th.dataset.sort;
            if (eqSortField === field) {
                eqSortDir = eqSortDir === 'asc' ? 'desc' : 'asc';
            } else {
                eqSortField = field;
                eqSortDir = 'asc';
            }
            renderEstoqueProductsTable();
        });
    });

    // ---- Movimentações ----
    document.getElementById('ap-eq-new-movement-btn')?.addEventListener('click', openEstoqueMovementPanel);
    document.getElementById('ap-eq-movement-panel-close')?.addEventListener('click', closeEstoqueMovementPanel);
    document.getElementById('ap-eq-movement-panel-cancel')?.addEventListener('click', closeEstoqueMovementPanel);
    document.getElementById('ap-eq-save-movement-btn')?.addEventListener('click', saveEstoqueMovement);
    document.getElementById('ap-eq-mov-tipo')?.addEventListener('change', handleEstoqueMovTipoChange);
    document.getElementById('ap-eq-mov-produto-busca')?.addEventListener('input', handleEstoqueMovProdutoInput);

    // ---- Exportação ----
    document.getElementById('ap-eq-export-btn')?.addEventListener('click', (e) => {
        e.stopPropagation();
        document.getElementById('ap-eq-export-menu')?.classList.toggle('active');
    });
    document.querySelectorAll('#ap-eq-export-menu [data-export-format]').forEach(link => {
        link.addEventListener('click', () => {
            document.getElementById('ap-eq-export-menu')?.classList.remove('active');
            exportEstoqueData(link.dataset.exportFormat);
        });
    });
    document.addEventListener('click', () => {
        document.getElementById('ap-eq-export-menu')?.classList.remove('active');
    });

    // ---- Importação ----
    document.getElementById('ap-eq-sync-catalog-btn')?.addEventListener('click', handleSyncCatalogClick);
    document.getElementById('ap-eq-import-btn')?.addEventListener('click', openEstoqueImportModal);
    document.getElementById('ap-eq-import-cancel-btn')?.addEventListener('click', closeEstoqueImportModal);
    document.getElementById('ap-eq-import-close-btn')?.addEventListener('click', () => {
        closeEstoqueImportModal();
        switchEstoqueSubtab('produtos');
    });
    document.getElementById('ap-eq-import-file-input')?.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) handleEstoqueImportFile(file);
    });
    document.getElementById('ap-eq-import-confirm-btn')?.addEventListener('click', confirmEstoqueImport);
}

/* ============================================================
   1.1 SINCRONIZAÇÃO COM O CATÁLOGO DA LOJA
   ============================================================ */
async function handleSyncCatalogClick() {
    const btn = document.getElementById('ap-eq-sync-catalog-btn');
    if (!btn) return;

    const originalHtml = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Sincronizando...';

    try {
        const result = await DB.estoque.produtos.syncFromCatalog();
        alert(`Sincronização concluída!\n\n${result.novos} produto(s) novo(s) adicionado(s) ao estoque.\n${result.atualizados} produto(s) já existente(s) atualizado(s).\nTotal no catálogo: ${result.total}.`);
        await loadEstoqueDashboard();
        if (typeof loadEstoqueProdutosSubtab === 'function') {
            loadEstoqueProdutosSubtab();
        }
    } catch (e) {
        console.error('Erro ao sincronizar com o catálogo:', e);
        alert(`Não foi possível sincronizar com o catálogo.\n\nErro técnico: ${e.code || e.name || ''} ${e.message || e}`);
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalHtml;
    }
}

/* ============================================================
   2. NAVEGAÇÃO ENTRE SUB-ABAS
   ============================================================ */
function loadEstoqueTab() {
    // Chamado pelo admin-panel.js quando a aba "Estoque" é aberta.
    switchEstoqueSubtab('dashboard');
}

function switchEstoqueSubtab(tab) {
    document.querySelectorAll('.ap-eq-subtab-btn[data-eq-tab]').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.eqTab === tab);
    });
    document.querySelectorAll('.ap-eq-subtab-content[data-eq-tab-content]').forEach(panel => {
        panel.classList.toggle('active', panel.dataset.eqTabContent === tab);
    });

    switch (tab) {
        case 'dashboard': loadEstoqueDashboard(); break;
        case 'produtos': loadEstoqueProdutosSubtab(); break;
        case 'movimentacoes': loadEstoqueMovimentacoesSubtab(); break;
    }
}

/* ============================================================
   3. DASHBOARD DE ESTOQUE
   ============================================================ */
async function loadEstoqueDashboard() {
    try {
        [eqProducts, eqMovements] = await Promise.all([
            DB.estoque.produtos.getAll(),
            DB.estoque.movimentacoes.getAll()
        ]);
    } catch (e) {
        console.error('Erro ao carregar dados do estoque: ', e);
        return;
    }

    const totalProdutos = eqProducts.length;
    const emEstoque = eqProducts.filter(p => (Number(p.quantidade) || 0) > 0).length;
    const baixoEstoque = eqProducts.filter(p => eqStockStatus(p) === 'baixo').length;
    const semEstoque = eqProducts.filter(p => eqStockStatus(p) === 'sem').length;
    const valorTotal = eqProducts.reduce((sum, p) => sum + (Number(p.quantidade) || 0) * (Number(p.precoCusto) || 0), 0);

    document.getElementById('ap-eq-stat-total').innerText = totalProdutos;
    document.getElementById('ap-eq-stat-em-estoque').innerText = emEstoque;
    document.getElementById('ap-eq-stat-baixo').innerText = baixoEstoque;
    document.getElementById('ap-eq-stat-sem-estoque').innerText = semEstoque;
    document.getElementById('ap-eq-stat-valor-total').innerText = eqFormatCurrency(valorTotal);

    renderEstoqueAlerts();
    renderEstoqueTopVendidos();
    renderEstoqueRecentes();
}

function renderEstoqueAlerts() {
    const wrapper = document.getElementById('ap-eq-alerts-wrapper');
    if (!wrapper) return;

    const alerts = [];

    const semEstoque = eqProducts.filter(p => eqStockStatus(p) === 'sem');
    if (semEstoque.length) {
        alerts.push({
            type: 'danger',
            icon: 'fa-circle-xmark',
            title: `${semEstoque.length} produto(s) sem estoque`,
            detail: semEstoque.slice(0, 6).map(p => eqEscapeHtml(p.nome)).join(', ') + (semEstoque.length > 6 ? '...' : '')
        });
    }

    const baixoEstoque = eqProducts.filter(p => eqStockStatus(p) === 'baixo');
    if (baixoEstoque.length) {
        alerts.push({
            type: 'warning',
            icon: 'fa-triangle-exclamation',
            title: `${baixoEstoque.length} produto(s) com estoque baixo`,
            detail: baixoEstoque.slice(0, 6).map(p => eqEscapeHtml(p.nome)).join(', ') + (baixoEstoque.length > 6 ? '...' : '')
        });
    }

    // Detecta SKUs ou códigos de barras duplicados entre produtos cadastrados.
    const bySku = {};
    const byBarcode = {};
    eqProducts.forEach(p => {
        const sku = (p.sku || '').trim().toLowerCase();
        const bc = (p.codigoBarras || '').trim().toLowerCase();
        if (sku) (bySku[sku] = bySku[sku] || []).push(p);
        if (bc) (byBarcode[bc] = byBarcode[bc] || []).push(p);
    });
    const duplicateNames = new Set();
    Object.values(bySku).forEach(list => { if (list.length > 1) list.forEach(p => duplicateNames.add(p.nome)); });
    Object.values(byBarcode).forEach(list => { if (list.length > 1) list.forEach(p => duplicateNames.add(p.nome)); });
    if (duplicateNames.size) {
        alerts.push({
            type: 'warning',
            icon: 'fa-clone',
            title: `${duplicateNames.size} produto(s) com SKU ou código de barras duplicado`,
            detail: [...duplicateNames].slice(0, 6).map(n => eqEscapeHtml(n)).join(', ') + (duplicateNames.size > 6 ? '...' : '')
        });
    }

    if (alerts.length === 0) {
        wrapper.innerHTML = `<div class="ap-eq-alert-empty">Nenhum alerta no momento. Estoque sob controle.</div>`;
        return;
    }

    wrapper.innerHTML = alerts.map(a => `
        <div class="ap-eq-alert-card ${a.type === 'danger' ? 'ap-eq-alert-danger' : 'ap-eq-alert-warning'}">
            <i class="fa-solid ${a.icon}"></i>
            <div>
                <div class="ap-eq-alert-title">${a.title}</div>
                <div>${a.detail}</div>
            </div>
        </div>
    `).join('');
}

function renderEstoqueTopVendidos() {
    const tbody = document.getElementById('ap-eq-top-vendidos-tbody');
    if (!tbody) return;

    const vendidoPorProduto = {};
    eqMovements.filter(m => m.tipo === 'saida').forEach(m => {
        vendidoPorProduto[m.produtoId] = (vendidoPorProduto[m.produtoId] || 0) + (Number(m.quantidade) || 0);
    });

    const ranking = Object.entries(vendidoPorProduto)
        .map(([produtoId, total]) => ({ produto: eqProducts.find(p => p.id === produtoId), total }))
        .filter(r => r.produto)
        .sort((a, b) => b.total - a.total)
        .slice(0, 5);

    if (ranking.length === 0) {
        tbody.innerHTML = `<tr><td colspan="3" style="text-align: center; color: #9B8E85;">Nenhuma saída de estoque registrada ainda.</td></tr>`;
        return;
    }

    tbody.innerHTML = ranking.map(r => `
        <tr>
            <td><strong>${eqEscapeHtml(r.produto.nome)}</strong></td>
            <td>${eqEscapeHtml(r.produto.sku)}</td>
            <td>${r.total}</td>
        </tr>
    `).join('');
}

function renderEstoqueRecentes() {
    const tbody = document.getElementById('ap-eq-recentes-tbody');
    if (!tbody) return;

    const recentes = [...eqProducts]
        .sort((a, b) => new Date(b.criadoEm || 0) - new Date(a.criadoEm || 0))
        .slice(0, 5);

    if (recentes.length === 0) {
        tbody.innerHTML = `<tr><td colspan="3" style="text-align: center; color: #9B8E85;">Nenhum produto cadastrado.</td></tr>`;
        return;
    }

    tbody.innerHTML = recentes.map(p => `
        <tr>
            <td><strong>${eqEscapeHtml(p.nome)}</strong></td>
            <td>${eqEscapeHtml(p.sku)}</td>
            <td>${Number(p.quantidade) || 0}</td>
        </tr>
    `).join('');
}

/* ============================================================
   4. PRODUTOS DO ESTOQUE (listagem, busca, filtros, ordenação, paginação)
   ============================================================ */
async function loadEstoqueProdutosSubtab() {
    try {
        eqProducts = await DB.estoque.produtos.getAll();
    } catch (e) {
        console.error('Erro ao carregar produtos do estoque: ', e);
        return;
    }

    populateEstoqueFilterOptions();
    renderEstoqueProductsTable();
}

function populateEstoqueFilterOptions() {
    const categorias = [...new Set(eqProducts.map(p => p.categoria).filter(Boolean))].sort();
    const fornecedores = [...new Set(eqProducts.map(p => p.fornecedor).filter(Boolean))].sort();

    const catSelect = document.getElementById('ap-eq-filter-categoria');
    if (catSelect) {
        const current = catSelect.value;
        catSelect.innerHTML = `<option value="">Todas as Categorias</option>` +
            categorias.map(c => `<option value="${eqEscapeHtml(c)}">${eqEscapeHtml(c)}</option>`).join('');
        catSelect.value = categorias.includes(current) ? current : '';
    }

    const fornSelect = document.getElementById('ap-eq-filter-fornecedor');
    if (fornSelect) {
        const current = fornSelect.value;
        fornSelect.innerHTML = `<option value="">Todos os Fornecedores</option>` +
            fornecedores.map(f => `<option value="${eqEscapeHtml(f)}">${eqEscapeHtml(f)}</option>`).join('');
        fornSelect.value = fornecedores.includes(current) ? current : '';
    }

    const catDatalist = document.getElementById('ap-eq-categorias-datalist');
    if (catDatalist) catDatalist.innerHTML = categorias.map(c => `<option value="${eqEscapeHtml(c)}">`).join('');

    const fornDatalist = document.getElementById('ap-eq-fornecedores-datalist');
    if (fornDatalist) fornDatalist.innerHTML = fornecedores.map(f => `<option value="${eqEscapeHtml(f)}">`).join('');
}

function getFilteredSortedEstoqueProducts() {
    let list = [...eqProducts];

    if (eqSearchTerm) {
        list = list.filter(p =>
            (p.nome || '').toLowerCase().includes(eqSearchTerm) ||
            (p.sku || '').toLowerCase().includes(eqSearchTerm) ||
            (p.codigoBarras || '').toLowerCase().includes(eqSearchTerm)
        );
    }
    if (eqFilterCategoria) list = list.filter(p => p.categoria === eqFilterCategoria);
    if (eqFilterFornecedor) list = list.filter(p => p.fornecedor === eqFilterFornecedor);
    if (eqFilterStatus) list = list.filter(p => (p.status || 'Ativo') === eqFilterStatus);

    list.sort((a, b) => {
        let va = a[eqSortField];
        let vb = b[eqSortField];
        if (['quantidade', 'precoCusto', 'precoVenda', 'estoqueMinimo'].includes(eqSortField)) {
            va = Number(va) || 0;
            vb = Number(vb) || 0;
        } else {
            va = (va || '').toString().toLowerCase();
            vb = (vb || '').toString().toLowerCase();
        }
        if (va < vb) return eqSortDir === 'asc' ? -1 : 1;
        if (va > vb) return eqSortDir === 'asc' ? 1 : -1;
        return 0;
    });

    return list;
}

function renderEstoqueProductsTable() {
    const tbody = document.getElementById('ap-eq-products-tbody');
    if (!tbody) return;

    document.querySelectorAll('.ap-eq-sortable-table th[data-sort]').forEach(th => {
        th.classList.toggle('ap-eq-sort-active', th.dataset.sort === eqSortField);
        const icon = th.querySelector('i');
        if (icon) icon.className = th.dataset.sort === eqSortField
            ? (eqSortDir === 'asc' ? 'fa-solid fa-sort-up' : 'fa-solid fa-sort-down')
            : 'fa-solid fa-sort';
    });

    const filtered = getFilteredSortedEstoqueProducts();
    const totalPages = Math.max(1, Math.ceil(filtered.length / EQ_PAGE_SIZE));
    if (eqCurrentPage > totalPages) eqCurrentPage = totalPages;
    const start = (eqCurrentPage - 1) * EQ_PAGE_SIZE;
    const pageItems = filtered.slice(start, start + EQ_PAGE_SIZE);

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; color: #9B8E85; padding: 30px;">Nenhum produto encontrado.</td></tr>`;
    } else {
        tbody.innerHTML = pageItems.map(p => {
            const status = eqStockStatus(p);
            const qtyClass = status === 'sem' ? 'ap-eq-qty-sem' : (status === 'baixo' ? 'ap-eq-qty-baixo' : '');
            const isAtivo = (p.status || 'Ativo') === 'Ativo';
            return `
                <tr>
                    <td><strong>${eqEscapeHtml(p.nome)}</strong></td>
                    <td>${eqEscapeHtml(p.sku)}</td>
                    <td>${eqEscapeHtml(p.categoria)}</td>
                    <td>${eqEscapeHtml(p.fornecedor)}</td>
                    <td class="${qtyClass}">${Number(p.quantidade) || 0} ${eqEscapeHtml(p.unidade || 'un')}</td>
                    <td>${eqFormatCurrency(p.precoCusto)}</td>
                    <td>${eqFormatCurrency(p.precoVenda)}</td>
                    <td><span class="ap-eq-badge ${isAtivo ? 'ap-eq-badge-ativo' : 'ap-eq-badge-inativo'}">${isAtivo ? 'Ativo' : 'Inativo'}</span></td>
                    <td class="admin-actions-cell">
                        <a class="admin-action-link admin-action-edit" data-eq-edit-product="${p.id}" title="Editar"><i class="fa-regular fa-pen-to-square"></i></a>
                        <a class="admin-action-link admin-action-delete" data-eq-delete-product="${p.id}" title="Remover"><i class="fa-regular fa-trash-can"></i></a>
                    </td>
                </tr>
            `;
        }).join('');
    }

    tbody.querySelectorAll('[data-eq-edit-product]').forEach(el => {
        el.addEventListener('click', () => openEstoqueProductPanel('edit', el.dataset.eqEditProduct));
    });
    tbody.querySelectorAll('[data-eq-delete-product]').forEach(el => {
        el.addEventListener('click', () => deleteEstoqueProduct(el.dataset.eqDeleteProduct));
    });

    renderEstoquePagination('ap-eq-pagination', filtered.length, eqCurrentPage, EQ_PAGE_SIZE, (page) => {
        eqCurrentPage = page;
        renderEstoqueProductsTable();
    });
}

// Componente de paginação reutilizável (produtos e movimentações).
function renderEstoquePagination(containerId, totalItems, currentPage, pageSize, onPageClick) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
    if (totalPages <= 1) {
        container.innerHTML = '';
        return;
    }

    let buttons = [];
    buttons.push(`<button class="ap-eq-page-btn" data-page="${currentPage - 1}" ${currentPage === 1 ? 'disabled' : ''}><i class="fa-solid fa-chevron-left"></i></button>`);

    const maxButtons = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxButtons / 2));
    let endPage = Math.min(totalPages, startPage + maxButtons - 1);
    startPage = Math.max(1, endPage - maxButtons + 1);

    for (let i = startPage; i <= endPage; i++) {
        buttons.push(`<button class="ap-eq-page-btn ${i === currentPage ? 'active' : ''}" data-page="${i}">${i}</button>`);
    }

    buttons.push(`<button class="ap-eq-page-btn" data-page="${currentPage + 1}" ${currentPage === totalPages ? 'disabled' : ''}><i class="fa-solid fa-chevron-right"></i></button>`);

    container.innerHTML = buttons.join('');
    container.querySelectorAll('[data-page]').forEach(btn => {
        btn.addEventListener('click', () => onPageClick(parseInt(btn.dataset.page, 10)));
    });
}

/* ============================================================
   5. FORMULÁRIO DE PRODUTO (Criar / Editar / Excluir)
   ============================================================ */
function openEstoqueProductPanel(mode, id = '') {
    const panel = document.getElementById('ap-eq-product-panel');
    const title = document.getElementById('ap-eq-product-panel-title');

    document.getElementById('ap-eq-product-form').reset();
    document.getElementById('ap-eq-form-id').value = '';
    document.getElementById('ap-eq-form-quantidade').value = 0;
    document.getElementById('ap-eq-form-min').value = 0;
    document.getElementById('ap-eq-form-custo').value = 0;
    document.getElementById('ap-eq-form-venda').value = 0;

    if (mode === 'new') {
        title.innerText = 'Novo Produto';
    } else {
        title.innerText = 'Editar Produto';
        const product = eqProducts.find(p => p.id === id);
        if (product) {
            document.getElementById('ap-eq-form-id').value = product.id;
            document.getElementById('ap-eq-form-nome').value = product.nome || '';
            document.getElementById('ap-eq-form-sku').value = product.sku || '';
            document.getElementById('ap-eq-form-barcode').value = product.codigoBarras || '';
            document.getElementById('ap-eq-form-categoria').value = product.categoria || '';
            document.getElementById('ap-eq-form-fornecedor').value = product.fornecedor || '';
            document.getElementById('ap-eq-form-quantidade').value = product.quantidade || 0;
            document.getElementById('ap-eq-form-min').value = product.estoqueMinimo || 0;
            document.getElementById('ap-eq-form-custo').value = product.precoCusto || 0;
            document.getElementById('ap-eq-form-venda').value = product.precoVenda || 0;
            document.getElementById('ap-eq-form-unidade').value = product.unidade || 'un';
            document.getElementById('ap-eq-form-localizacao').value = product.localizacao || '';
            document.getElementById('ap-eq-form-descricao').value = product.descricao || '';
            document.getElementById('ap-eq-form-status').value = product.status || 'Ativo';
        }
    }

    panel.classList.add('active');
}

function closeEstoqueProductPanel() {
    document.getElementById('ap-eq-product-panel').classList.remove('active');
}

// Verifica se já existe outro produto com o mesmo SKU ou código de barras.
function eqFindDuplicate(sku, barcode, excludeId = '') {
    const skuNorm = (sku || '').trim().toLowerCase();
    const bcNorm = (barcode || '').trim().toLowerCase();
    return eqProducts.find(p => {
        if (p.id === excludeId) return false;
        const pSku = (p.sku || '').trim().toLowerCase();
        const pBc = (p.codigoBarras || '').trim().toLowerCase();
        return (skuNorm && pSku === skuNorm) || (bcNorm && pBc && pBc === bcNorm);
    });
}

async function saveEstoqueProduct() {
    const id = document.getElementById('ap-eq-form-id').value;
    const nome = document.getElementById('ap-eq-form-nome').value.trim();
    const sku = document.getElementById('ap-eq-form-sku').value.trim();
    const categoria = document.getElementById('ap-eq-form-categoria').value.trim();
    const fornecedor = document.getElementById('ap-eq-form-fornecedor').value.trim();
    const codigoBarras = document.getElementById('ap-eq-form-barcode').value.trim();
    const quantidade = parseInt(document.getElementById('ap-eq-form-quantidade').value, 10) || 0;
    const estoqueMinimo = parseInt(document.getElementById('ap-eq-form-min').value, 10) || 0;
    const precoCusto = parseFloat(document.getElementById('ap-eq-form-custo').value) || 0;
    const precoVenda = parseFloat(document.getElementById('ap-eq-form-venda').value) || 0;
    const unidade = document.getElementById('ap-eq-form-unidade').value;
    const localizacao = document.getElementById('ap-eq-form-localizacao').value.trim();
    const descricao = document.getElementById('ap-eq-form-descricao').value.trim();
    const status = document.getElementById('ap-eq-form-status').value;

    if (!nome || !sku || !categoria || !fornecedor) {
        alert('Por favor, preencha nome, SKU, categoria e fornecedor.');
        return;
    }
    if (quantidade < 0 || estoqueMinimo < 0 || precoCusto < 0 || precoVenda < 0) {
        alert('Quantidades e preços não podem ser negativos.');
        return;
    }

    const duplicate = eqFindDuplicate(sku, codigoBarras, id);
    if (duplicate) {
        const proceed = confirm(`Já existe um produto cadastrado com este SKU ou código de barras: "${duplicate.nome}".\n\nDeseja salvar mesmo assim?`);
        if (!proceed) return;
    }

    const productData = {
        id: id || undefined,
        nome, sku, codigoBarras, categoria, fornecedor,
        quantidade, estoqueMinimo, precoCusto, precoVenda,
        unidade, localizacao, descricao, status
    };

    const saveBtn = document.getElementById('ap-eq-save-product-btn');
    const originalText = saveBtn.innerHTML;
    saveBtn.disabled = true;
    saveBtn.innerHTML = 'Salvando...';

    try {
        await DB.estoque.produtos.save(productData);
        await eqSincronizarDisponibilidadePublica(productData);
        await logAudit(id ? 'Editou' : 'Criou', 'Produto de Estoque', productData.id || '', nome);
        closeEstoqueProductPanel();
        await loadEstoqueProdutosSubtab();
    } catch (e) {
        console.error('Erro ao salvar produto de estoque: ', e);
        alert('Não foi possível salvar o produto.');
    } finally {
        saveBtn.disabled = false;
        saveBtn.innerHTML = originalText;
    }
}

async function deleteEstoqueProduct(id) {
    const product = eqProducts.find(p => p.id === id);
    if (!confirm(`Tem certeza que deseja remover o produto "${product ? product.nome : ''}" do estoque?`)) return;

    try {
        await DB.estoque.produtos.delete(id);
        if (product) await eqSincronizarDisponibilidadePublica(product, null, false);
        await logAudit('Removeu', 'Produto de Estoque', id, product ? product.nome : '');
        await loadEstoqueProdutosSubtab();
    } catch (e) {
        console.error('Erro ao remover produto de estoque: ', e);
        alert('Não foi possível remover o produto.');
    }
}

// O catálogo público não expõe quantidade de estoque. Mantemos nele somente
// uma indicação sim/não: itens cadastrados no estoque participam do quiz.
async function eqSincronizarDisponibilidadePublica(produtoEstoque, catalogo = null, disponivel = true) {
    try {
        const produtosCatalogo = catalogo || await DB.products.getAll();
        const sku = String(produtoEstoque.sku || '').trim().toLowerCase();
        const produtoPublico = produtosCatalogo.find(produto =>
            produto.id === produtoEstoque.id ||
            (sku && String(produto.sku || '').trim().toLowerCase() === sku)
        );
        if (produtoPublico) {
            await DB.products.save({
                id: produtoPublico.id,
                disponivelNoQuiz: disponivel
            });
        }
    } catch (erro) {
        // A movimentação de estoque continua válida mesmo se a vitrine pública falhar.
        console.warn('Não foi possível sincronizar disponibilidade pública:', erro);
    }
}

/* ============================================================
   6. MOVIMENTAÇÃO DE ESTOQUE
   ============================================================ */
async function openEstoqueMovementPanel() {
    document.getElementById('ap-eq-movement-form').reset();
    document.getElementById('ap-eq-mov-produto').value = '';
    document.getElementById('ap-eq-mov-quantidade').value = 1;
    document.getElementById('ap-eq-mov-localizacao-group').style.display = 'none';

    try {
        eqProducts = await DB.estoque.produtos.getAll();
    } catch (e) {
        console.error('Erro ao carregar produtos para movimentação: ', e);
    }

    eqMovProductOptions = eqProducts.map(p => ({ id: p.id, label: `${p.nome} (${p.sku})` }));
    const datalist = document.getElementById('ap-eq-mov-produtos-datalist');
    if (datalist) datalist.innerHTML = eqMovProductOptions.map(o => `<option value="${eqEscapeHtml(o.label)}">`).join('');

    handleEstoqueMovTipoChange();
    document.getElementById('ap-eq-movement-panel').classList.add('active');
}

function closeEstoqueMovementPanel() {
    document.getElementById('ap-eq-movement-panel').classList.remove('active');
}

function handleEstoqueMovTipoChange() {
    const tipo = document.getElementById('ap-eq-mov-tipo').value;
    const label = document.getElementById('ap-eq-mov-qtd-label');
    const locGroup = document.getElementById('ap-eq-mov-localizacao-group');

    const labels = {
        entrada: 'Quantidade a Adicionar',
        saida: 'Quantidade a Remover',
        ajuste: 'Nova Quantidade (valor final em estoque)',
        transferencia: 'Quantidade Transferida'
    };
    label.innerText = labels[tipo] || 'Quantidade';
    locGroup.style.display = tipo === 'transferencia' ? 'block' : 'none';
}

function handleEstoqueMovProdutoInput(e) {
    const match = eqMovProductOptions.find(o => o.label === e.target.value);
    document.getElementById('ap-eq-mov-produto').value = match ? match.id : '';
}

async function saveEstoqueMovement() {
    const produtoId = document.getElementById('ap-eq-mov-produto').value;
    const tipo = document.getElementById('ap-eq-mov-tipo').value;
    const quantidade = parseInt(document.getElementById('ap-eq-mov-quantidade').value, 10);
    const novaLocalizacao = document.getElementById('ap-eq-mov-localizacao').value.trim();
    const observacoes = document.getElementById('ap-eq-mov-obs').value.trim();

    if (!produtoId) {
        alert('Selecione um produto válido na lista sugerida.');
        return;
    }
    if (isNaN(quantidade) || quantidade < 0) {
        alert('Digite uma quantidade válida.');
        return;
    }

    const product = eqProducts.find(p => p.id === produtoId);
    if (!product) {
        alert('Produto não encontrado. Tente novamente.');
        return;
    }

    const currentQty = Number(product.quantidade) || 0;
    let newQty = currentQty;

    if (tipo === 'entrada') {
        newQty = currentQty + quantidade;
    } else if (tipo === 'saida') {
        if (quantidade > currentQty) {
            alert(`Quantidade insuficiente em estoque. Disponível: ${currentQty}.`);
            return;
        }
        newQty = currentQty - quantidade;
    } else if (tipo === 'ajuste') {
        newQty = quantidade;
    } else if (tipo === 'transferencia') {
        newQty = currentQty; // transferência não altera o total, só a localização
    }

    const saveBtn = document.getElementById('ap-eq-save-movement-btn');
    const originalText = saveBtn.innerHTML;
    saveBtn.disabled = true;
    saveBtn.innerHTML = 'Registrando...';

    try {
        const updatedProduct = { ...product, quantidade: newQty };
        if (tipo === 'transferencia' && novaLocalizacao) updatedProduct.localizacao = novaLocalizacao;
        await DB.estoque.produtos.save(updatedProduct);
        await eqSincronizarDisponibilidadePublica(updatedProduct);

        await DB.estoque.movimentacoes.add({
            produtoId: product.id,
            produtoNome: product.nome,
            tipo,
            quantidade,
            localizacao: tipo === 'transferencia' ? novaLocalizacao : '',
            observacoes
        });

        await logAudit('Registrou', 'Movimentação de Estoque', product.id, `${tipo} de ${quantidade} un. em "${product.nome}"`);
        closeEstoqueMovementPanel();
        await loadEstoqueMovimentacoesSubtab();
    } catch (e) {
        console.error('Erro ao registrar movimentação: ', e);
        alert('Não foi possível registrar a movimentação.');
    } finally {
        saveBtn.disabled = false;
        saveBtn.innerHTML = originalText;
    }
}

async function loadEstoqueMovimentacoesSubtab() {
    try {
        eqMovements = await DB.estoque.movimentacoes.getAll();
    } catch (e) {
        console.error('Erro ao carregar movimentações: ', e);
        return;
    }
    renderEstoqueMovementsTable();
}

const EQ_MOV_LABELS = {
    entrada: 'Entrada',
    saida: 'Saída',
    ajuste: 'Ajuste Manual',
    transferencia: 'Transferência'
};

function renderEstoqueMovementsTable() {
    const tbody = document.getElementById('ap-eq-mov-tbody');
    if (!tbody) return;

    const sorted = [...eqMovements].sort((a, b) => new Date(b.data) - new Date(a.data));
    const totalPages = Math.max(1, Math.ceil(sorted.length / EQ_MOV_PAGE_SIZE));
    if (eqMovCurrentPage > totalPages) eqMovCurrentPage = totalPages;
    const start = (eqMovCurrentPage - 1) * EQ_MOV_PAGE_SIZE;
    const pageItems = sorted.slice(start, start + EQ_MOV_PAGE_SIZE);

    if (sorted.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: #9B8E85; padding: 30px;">Nenhuma movimentação registrada ainda.</td></tr>`;
    } else {
        tbody.innerHTML = pageItems.map(m => `
            <tr>
                <td style="white-space: nowrap;">${eqFormatDate(m.data)}</td>
                <td><strong>${eqEscapeHtml(m.produtoNome)}</strong></td>
                <td><span class="ap-eq-badge ap-eq-badge-${m.tipo}">${EQ_MOV_LABELS[m.tipo] || m.tipo}</span></td>
                <td>${m.quantidade}${m.localizacao ? ` → ${eqEscapeHtml(m.localizacao)}` : ''}</td>
                <td>${eqEscapeHtml(m.usuario)}</td>
                <td>${eqEscapeHtml(m.observacoes) || '-'}</td>
            </tr>
        `).join('');
    }

    renderEstoquePagination('ap-eq-mov-pagination', sorted.length, eqMovCurrentPage, EQ_MOV_PAGE_SIZE, (page) => {
        eqMovCurrentPage = page;
        renderEstoqueMovementsTable();
    });
}

/* ============================================================
   7. IMPORTAÇÃO DE DADOS (.json / .xlsx / .xls)
   ============================================================ */
function openEstoqueImportModal() {
    document.getElementById('ap-eq-import-file-input').value = '';
    document.getElementById('ap-eq-import-step-file').style.display = 'block';
    document.getElementById('ap-eq-import-step-preview').style.display = 'none';
    document.getElementById('ap-eq-import-step-progress').style.display = 'none';
    document.getElementById('ap-eq-import-confirm-btn').style.display = 'none';
    document.getElementById('ap-eq-import-close-btn').style.display = 'none';
    document.getElementById('ap-eq-import-cancel-btn').style.display = 'inline-flex';
    eqImportRows = [];
    document.getElementById('ap-eq-import-modal').classList.add('active');
}

function closeEstoqueImportModal() {
    document.getElementById('ap-eq-import-modal').classList.remove('active');
}

function eqPick(...vals) {
    return vals.find(v => v !== undefined && v !== null && String(v).trim() !== '') || '';
}

// Normaliza uma linha "crua" (vinda de JSON ou de uma planilha Excel) para o
// formato interno do produto de estoque, aceitando nomes de coluna alternativos.
function eqNormalizeImportRow(raw) {
    const nome = eqPick(raw.nome, raw.Nome, raw.name, raw.produto, raw.Produto);
    const sku = eqPick(raw.sku, raw.SKU, raw.codigo, raw.Codigo);
    const codigoBarras = eqPick(raw.codigoBarras, raw.codigo_barras, raw['Código de Barras'], raw.barcode, raw.ean);
    const categoria = eqPick(raw.categoria, raw.Categoria, raw.category);
    const fornecedor = eqPick(raw.fornecedor, raw.Fornecedor, raw.supplier);
    const quantidade = eqPick(raw.quantidade, raw.Quantidade, raw.qtd, raw.quantity, 0);
    const estoqueMinimo = eqPick(raw.estoqueMinimo, raw.estoque_minimo, raw['Estoque Mínimo'], raw.minStock, 0);
    const precoCusto = eqPick(raw.precoCusto, raw.preco_custo, raw['Preço de Custo'], raw.costPrice, 0);
    const precoVenda = eqPick(raw.precoVenda, raw.preco_venda, raw['Preço de Venda'], raw.sellPrice, 0);
    const unidade = eqPick(raw.unidade, raw.Unidade, raw.unit, 'un');
    const localizacao = eqPick(raw.localizacao, raw.Localização, raw.location);
    const descricao = eqPick(raw.descricao, raw.Descrição, raw.description);
    const status = eqPick(raw.status, raw.Status, 'Ativo');

    return {
        nome, sku, codigoBarras, categoria, fornecedor,
        quantidade: parseInt(quantidade, 10),
        estoqueMinimo: parseInt(estoqueMinimo, 10),
        precoCusto: parseFloat(precoCusto),
        precoVenda: parseFloat(precoVenda),
        unidade: unidade || 'un',
        localizacao, descricao,
        status: status || 'Ativo'
    };
}

function eqValidateImportRow(row) {
    const errors = [];
    if (!row.nome) errors.push('nome ausente');
    if (!row.sku) errors.push('SKU ausente');
    if (isNaN(row.quantidade) || row.quantidade < 0) errors.push('quantidade inválida');
    if (isNaN(row.precoCusto) || row.precoCusto < 0) errors.push('preço de custo inválido');
    if (isNaN(row.precoVenda) || row.precoVenda < 0) errors.push('preço de venda inválido');
    return errors;
}

function handleEstoqueImportFile(file) {
    const name = file.name.toLowerCase();

    if (name.endsWith('.json')) {
        const reader = new FileReader();
        reader.onload = (event) => {
            let parsed;
            try {
                parsed = JSON.parse(event.target.result);
            } catch (err) {
                alert('Não foi possível ler o arquivo: JSON inválido.');
                return;
            }
            const rows = Array.isArray(parsed) ? parsed : (Array.isArray(parsed.produtos) ? parsed.produtos : null);
            if (!rows) {
                alert('O arquivo JSON não contém uma lista de produtos válida.');
                return;
            }
            processEstoqueImportRows(rows);
        };
        reader.onerror = () => alert('Erro ao ler o arquivo selecionado.');
        reader.readAsText(file);
    } else if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
        if (typeof XLSX === 'undefined') {
            alert('Não foi possível carregar o suporte a Excel. Verifique sua conexão com a internet e tente novamente.');
            return;
        }
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const workbook = XLSX.read(event.target.result, { type: 'array' });
                const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                const rows = XLSX.utils.sheet_to_json(firstSheet, { defval: '' });
                processEstoqueImportRows(rows);
            } catch (err) {
                console.error('Erro ao ler planilha: ', err);
                alert('Não foi possível ler o arquivo Excel selecionado.');
            }
        };
        reader.onerror = () => alert('Erro ao ler o arquivo selecionado.');
        reader.readAsArrayBuffer(file);
    } else {
        alert('Formato de arquivo não suportado. Selecione um arquivo .json, .xlsx ou .xls.');
    }
}

function processEstoqueImportRows(rawRows) {
    if (!rawRows || rawRows.length === 0) {
        alert('O arquivo não contém nenhum produto para importar.');
        return;
    }

    let validCount = 0;
    let errorCount = 0;
    let duplicateCount = 0;

    eqImportRows = rawRows.map(raw => {
        const normalized = eqNormalizeImportRow(raw);
        const errors = eqValidateImportRow(normalized);
        const duplicate = errors.length === 0 ? eqFindDuplicate(normalized.sku, normalized.codigoBarras) : null;

        if (errors.length > 0) errorCount++;
        else if (duplicate) duplicateCount++;
        else validCount++;

        return { ...normalized, _errors: errors, _duplicateId: duplicate ? duplicate.id : null };
    });

    document.getElementById('ap-eq-import-step-file').style.display = 'none';
    document.getElementById('ap-eq-import-step-preview').style.display = 'block';
    document.getElementById('ap-eq-import-confirm-btn').style.display = (validCount + duplicateCount) > 0 ? 'inline-flex' : 'none';

    document.getElementById('ap-eq-import-summary').innerHTML = `
        <span><strong>${rawRows.length}</strong> registros lidos</span>
        <span><strong>${validCount}</strong> novos válidos</span>
        <span><strong>${duplicateCount}</strong> duplicados (SKU/Código de Barras)</span>
        <span><strong>${errorCount}</strong> com erro</span>
    `;

    const errorsBox = document.getElementById('ap-eq-import-errors');
    const rowsWithErrors = eqImportRows.filter(r => r._errors.length > 0);
    if (rowsWithErrors.length > 0) {
        errorsBox.classList.add('active');
        errorsBox.innerHTML = rowsWithErrors.slice(0, 30).map((r, i) =>
            `<div>Linha ${i + 1} (${eqEscapeHtml(r.nome) || 'sem nome'}): ${r._errors.join(', ')}</div>`
        ).join('') + (rowsWithErrors.length > 30 ? `<div>... e mais ${rowsWithErrors.length - 30} erro(s).</div>` : '');
    } else {
        errorsBox.classList.remove('active');
        errorsBox.innerHTML = '';
    }

    const previewTbody = document.getElementById('ap-eq-import-preview-tbody');
    previewTbody.innerHTML = eqImportRows.slice(0, 200).map(r => {
        let situacao = '<span class="ap-eq-badge ap-eq-badge-ativo">Novo</span>';
        if (r._errors.length > 0) situacao = `<span class="ap-eq-badge ap-eq-badge-sem">Erro: ${eqEscapeHtml(r._errors.join(', '))}</span>`;
        else if (r._duplicateId) situacao = '<span class="ap-eq-badge ap-eq-badge-baixo">Duplicado (atualizar)</span>';

        return `
            <tr>
                <td>${eqEscapeHtml(r.nome) || '-'}</td>
                <td>${eqEscapeHtml(r.sku) || '-'}</td>
                <td>${isNaN(r.quantidade) ? '-' : r.quantidade}</td>
                <td>${situacao}</td>
            </tr>
        `;
    }).join('');
}

async function confirmEstoqueImport() {
    const updateExisting = document.getElementById('ap-eq-import-update-existing').checked;
    const importable = eqImportRows.filter(r => r._errors.length === 0 && (!r._duplicateId || updateExisting));

    if (importable.length === 0) {
        alert('Não há nenhum registro válido para importar com as opções atuais.');
        return;
    }

    document.getElementById('ap-eq-import-step-preview').style.display = 'none';
    document.getElementById('ap-eq-import-step-progress').style.display = 'block';
    document.getElementById('ap-eq-import-confirm-btn').style.display = 'none';
    document.getElementById('ap-eq-import-cancel-btn').style.display = 'none';

    const statusEl = document.getElementById('ap-eq-import-status');
    const fillEl = document.getElementById('ap-eq-import-progress-fill');
    const countEl = document.getElementById('ap-eq-import-count');

    let imported = 0;
    let failed = 0;
    let catalogoPublico = [];
    try { catalogoPublico = await DB.products.getAll(); } catch (_) { catalogoPublico = []; }

    for (let i = 0; i < importable.length; i++) {
        const row = { ...importable[i] };
        delete row._errors;
        const duplicateId = row._duplicateId;
        delete row._duplicateId;
        if (duplicateId) row.id = duplicateId;

        try {
            await DB.estoque.produtos.save(row);
            await eqSincronizarDisponibilidadePublica(row, catalogoPublico);
            imported++;
        } catch (err) {
            console.error('Erro ao importar produto de estoque: ', row, err);
            failed++;
        }

        const pct = Math.round(((i + 1) / importable.length) * 100);
        fillEl.style.width = pct + '%';
        countEl.textContent = `${i + 1} de ${importable.length} produtos processados`;
    }

    statusEl.textContent = failed === 0
        ? 'Importação concluída com sucesso!'
        : `Importação concluída: ${imported} importados, ${failed} com falha.`;

    document.getElementById('ap-eq-import-close-btn').style.display = 'inline-flex';

    await logAudit('Importou', 'Estoque', '', `${imported} produto(s) via ${document.getElementById('ap-eq-import-file-input').value.toLowerCase().endsWith('.json') ? 'JSON' : 'Excel'}`);
}

/* ============================================================
   8. EXPORTAÇÃO DE DADOS (.xlsx / .json / .csv)
   ============================================================ */
function eqBuildExportRows() {
    return eqProducts.map(p => ({
        nome: p.nome || '',
        sku: p.sku || '',
        codigoBarras: p.codigoBarras || '',
        categoria: p.categoria || '',
        fornecedor: p.fornecedor || '',
        quantidade: Number(p.quantidade) || 0,
        estoqueMinimo: Number(p.estoqueMinimo) || 0,
        precoCusto: Number(p.precoCusto) || 0,
        precoVenda: Number(p.precoVenda) || 0,
        unidade: p.unidade || 'un',
        localizacao: p.localizacao || '',
        descricao: p.descricao || '',
        status: p.status || 'Ativo'
    }));
}

function eqDownloadBlob(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

async function exportEstoqueData(format) {
    try {
        eqProducts = await DB.estoque.produtos.getAll();
    } catch (e) {
        console.error('Erro ao buscar produtos para exportação: ', e);
    }

    const rows = eqBuildExportRows();
    if (rows.length === 0) {
        alert('Não há produtos cadastrados para exportar.');
        return;
    }

    const timestamp = new Date().toISOString().slice(0, 10);

    if (format === 'json') {
        eqDownloadBlob(JSON.stringify(rows, null, 2), `estoque-${timestamp}.json`, 'application/json');
    } else if (format === 'csv') {
        const headers = Object.keys(rows[0]);
        const escapeCsv = (val) => {
            const str = String(val ?? '');
            return /[",\n;]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
        };
        const csvLines = [
            headers.join(';'),
            ...rows.map(r => headers.map(h => escapeCsv(r[h])).join(';'))
        ];
        eqDownloadBlob('\uFEFF' + csvLines.join('\n'), `estoque-${timestamp}.csv`, 'text/csv;charset=utf-8');
    } else if (format === 'xlsx') {
        if (typeof XLSX === 'undefined') {
            alert('Não foi possível carregar o suporte a Excel. Verifique sua conexão com a internet e tente novamente.');
            return;
        }
        const sheet = XLSX.utils.json_to_sheet(rows);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, sheet, 'Estoque');
        XLSX.writeFile(workbook, `estoque-${timestamp}.xlsx`);
    }

    await logAudit('Exportou', 'Estoque', '', `${rows.length} produto(s) em formato ${format.toUpperCase()}`);
}
