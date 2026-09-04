/* Lumié Seoul — renderização pública do Ritual Lumiê em 3 Passos */
(function () {
  const app = document.getElementById('ritual-lumie-app');
  if (!app) return;

  const fallback = {
    eyebrow: 'RITUAL LUMIÊ',
    title: 'O Ritual Lumiê em 3 Passos',
    subtitle: 'Um caminho simples e delicado para descobrir, viver e sentir o seu ritual.',
    steps: [
      { number: '01', title: 'Descubra sua rotina', description: 'Encontre os produtos ideais para as necessidades da sua pele.', imageUrl: 'img/bastidores/bastidores-3.jpg' },
      { number: '02', title: 'Viva o ritual K-Beauty', description: 'Transforme o cuidado diário em um momento especial de autocuidado.', imageUrl: 'img/bastidores/bastidores-1.jpg' },
      { number: '03', title: 'Sinta a diferença', description: 'Texturas, hidratação e luminosidade inspiradas na rotina coreana.', imageUrl: 'img/serum.jpg' }
    ]
  };

  const esc = value => { const node = document.createElement('div'); node.textContent = String(value || ''); return node.innerHTML; };
  const normalizar = data => ({ ...fallback, ...data, steps: Array.isArray(data?.steps) && data.steps.length ? data.steps : fallback.steps });

  function render(data) {
    const ritual = normalizar(data);
    app.innerHTML = `<header class="ritual-lumie-header reveal reveal-fade"><span class="ritual-lumie-eyebrow">${esc(ritual.eyebrow)}</span><h2 id="ritual-lumie-title" class="serif-title">${esc(ritual.title)}</h2><p>${esc(ritual.subtitle)}</p><div class="ritual-lumie-divider"></div></header><div class="ritual-lumie-grid">${ritual.steps.map((step, index) => `<article class="ritual-lumie-card reveal reveal-up ${index === 1 ? 'delay-100' : index === 2 ? 'delay-200' : ''}"><div class="ritual-lumie-number">${esc(step.number || String(index + 1).padStart(2, '0'))}</div><div class="ritual-lumie-image"><img src="${esc(step.imageUrl || fallback.steps[index % fallback.steps.length].imageUrl)}" alt="${esc(step.title)}" loading="lazy"></div><div class="ritual-lumie-content"><h3>${esc(step.title)}</h3><p>${esc(step.description)}</p></div></article>`).join('')}</div>`;
    if (typeof initScrollReveal === 'function') initScrollReveal();
  }

  function iniciar() {
    if (!window.DB?.ritualLumie) { render(fallback); return; }
    DB.ritualLumie.listen(render);
    document.addEventListener('ritual-lumie-updated', event => render(event.detail));
  }

  if (window.dbReady) iniciar();
  else document.addEventListener('db-ready', iniciar, { once: true });
})();
