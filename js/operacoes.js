/* Pedidos, clientes, campanhas, relatórios, alertas e backup do painel. */
const opMoney = value => (Number(value) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const opEsc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#039;' }[char]));
const OP_STATUS = ['Novo', 'Confirmado', 'Separando', 'Enviado', 'Entregue', 'Cancelado'];

async function loadOperacoesTab() {
  const root = document.getElementById('ap-operacoes-root'); if (!root) return;
  root.innerHTML = '<p style="color:#70655C">Carregando dados operacionais...</p>';
  try {
    const [pedidos, clientes, campanhas, estoque] = await Promise.all([DB.adminData.getAll('pedidos'), DB.adminData.getAll('clientes'), DB.adminData.getAll('campanhas'), DB.estoque.produtos.getAll()]);
    const abertos = pedidos.filter(p => !['Entregue','Cancelado'].includes(p.status)).length;
    const faturamento = pedidos.filter(p => p.status !== 'Cancelado').reduce((sum,p) => sum + Number(p.total || 0), 0);
    const baixo = estoque.filter(p => Number(p.quantidade || 0) <= Number(p.estoqueMinimo || 0));
    const vencendo = estoque.filter(p => p.validade && new Date(p.validade) <= new Date(Date.now() + 30 * 86400000));
    root.innerHTML = `<div class="admin-header"><div><h1 class="admin-title">Central de operação</h1><p style="color:#70655C">Pedidos, clientes, campanhas e indicadores em tempo real.</p></div><button id="op-backup" class="admin-btn admin-btn-secondary">Backup JSON</button></div>
      <div class="admin-stats-grid" style="margin-bottom:20px"><div class="admin-stat-card"><strong>${abertos}</strong><span>Pedidos abertos</span></div><div class="admin-stat-card"><strong>${opMoney(faturamento)}</strong><span>Faturamento</span></div><div class="admin-stat-card"><strong>${baixo.length}</strong><span>Estoque baixo</span></div><div class="admin-stat-card"><strong>${vencendo.length}</strong><span>Validade em 30 dias</span></div></div>
      <div class="admin-table-card" style="margin-bottom:18px"><div class="admin-header"><h3>Pedidos</h3><button id="op-order" class="admin-btn admin-btn-accent">+ Pedido</button></div><table class="admin-table"><thead><tr><th>Cliente</th><th>Total</th><th>Status</th></tr></thead><tbody>${pedidos.slice(0,20).map(p=>`<tr><td>${opEsc(p.cliente)}</td><td>${opMoney(p.total)}</td><td><select data-op-order="${p.id}">${OP_STATUS.map(s=>`<option ${p.status===s?'selected':''}>${s}</option>`).join('')}</select></td></tr>`).join('') || '<tr><td colspan="3">Nenhum pedido.</td></tr>'}</tbody></table></div>
      <div class="admin-table-card" style="margin-bottom:18px"><div class="admin-header"><h3>Clientes e favoritos</h3><button id="op-client" class="admin-btn admin-btn-secondary">+ Cliente</button></div><p style="padding:0 16px 16px">${clientes.map(c=>`${opEsc(c.nome)} — ${opEsc(c.contato || '')} ${c.interesse ? `(${opEsc(c.interesse)})` : ''}`).join('<br>') || 'Ainda não há clientes registrados.'}</p></div>
      <div class="admin-table-card"><div class="admin-header"><h3>Cupons e campanhas</h3><button id="op-campaign" class="admin-btn admin-btn-secondary">+ Campanha</button></div><p style="padding:0 16px 16px">${campanhas.map(c=>`${opEsc(c.codigo)} — ${c.desconto || 0}% — ${opEsc(c.descricao || '')}`).join('<br>') || 'Nenhuma campanha cadastrada.'}</p><p style="padding:0 16px 16px;color:#70655C">Perfis: use o campo <strong>papel</strong> nos administradores: dono, gerente ou atendente.</p></div>`;
    root.querySelectorAll('[data-op-order]').forEach(el => el.addEventListener('change', async () => { const p = pedidos.find(item => item.id === el.dataset.opOrder); await DB.adminData.save('pedidos', {...p, status:el.value}); loadOperacoesTab(); }));
    root.querySelector('#op-order').onclick = async () => { const cliente=prompt('Cliente'); if(!cliente)return; await DB.adminData.save('pedidos',{cliente,total:Number(prompt('Valor total','0')),status:'Novo'}); loadOperacoesTab(); };
    root.querySelector('#op-client').onclick = async () => { const nome=prompt('Nome'); if(!nome)return; await DB.adminData.save('clientes',{nome,contato:prompt('Contato',''),interesse:prompt('Interesse/favoritos','')}); loadOperacoesTab(); };
    root.querySelector('#op-campaign').onclick = async () => { const codigo=prompt('Código do cupom'); if(!codigo)return; await DB.adminData.save('campanhas',{codigo:codigo.toUpperCase(),desconto:Number(prompt('Desconto %','0')),descricao:prompt('Descrição',''),ativo:true}); loadOperacoesTab(); };
    root.querySelector('#op-backup').onclick = () => opBackup(pedidos,clientes,campanhas,estoque);
  } catch (error) { root.innerHTML = `<p style="color:#C0392B">Erro: ${opEsc(error.message)}</p>`; }
}
function opBackup(pedidos,clientes,campanhas,estoque) { const text=JSON.stringify({geradoEm:new Date().toISOString(),pedidos,clientes,campanhas,estoque},null,2); const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([text],{type:'application/json'})); a.download=`lumie-backup-${new Date().toISOString().slice(0,10)}.json`; a.click(); URL.revokeObjectURL(a.href); }
