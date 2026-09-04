/* Lumié Seoul - quiz de rotina de skincare baseado no catálogo real */
(function () {
  const STORAGE_KEY = "lumie_rotina_quiz_v1";
  const app = document.getElementById("rotina-app");
  if (!app) return;

  const perguntas = [
    { chave: "skinType", titulo: "Como sua pele costuma ficar ao longo do dia?", opcoes: ["Seca", "Oleosa", "Mista", "Normal", "Não sei"] },
    { chave: "concerns", titulo: "O que mais incomoda você atualmente na sua pele?", max: 2, opcoes: ["Manchas ou tom desigual", "Poros aparentes", "Oleosidade", "Ressecamento", "Sensibilidade", "Vermelhidão", "Textura irregular", "Falta de luminosidade", "Linhas / perda de firmeza", "Não sei"] },
    { chave: "sensitivity", titulo: "Sua pele costuma ficar vermelha, arder ou reagir facilmente a cosméticos?", opcoes: ["Sim, frequentemente", "Às vezes", "Raramente", "Não", "Não sei"] },
    { chave: "hydration", titulo: "Como você sente sua pele depois de lavar o rosto?", opcoes: ["Repuxando / ressecada", "Confortável", "Oleosa pouco tempo depois", "Depende da região do rosto", "Não sei"] },
    { chave: "goals", titulo: "Qual resultado você mais gostaria de perceber na sua pele?", max: 2, opcoes: ["Mais glow", "Tom mais uniforme", "Poros menos aparentes", "Pele mais hidratada", "Pele mais calma", "Barreira da pele fortalecida", "Textura mais uniforme", "Mais firmeza", "Não sei"] },
    { chave: "experience", titulo: "Como é sua rotina de skincare atualmente?", opcoes: ["Estou começando agora", "Uso apenas alguns produtos", "Já tenho uma rotina completa", "Uso vários ativos", "Não sei / não tenho rotina"] }
  ];

  const perfis = {
    "zero-pore-cream-2-0": { tags: ["pores", "texture", "hydrated", "oily"], tipo: "hydration", etapa: "03 · HIDRATAÇÃO" },
    "zero-pore-pad-2-0": { tags: ["pores", "texture", "oily"], tipo: "treatment", etapa: "01 · TRATAMENTO", cautela: ["sensitive"] },
    "pdrn-pink-collagen-capsule-cream": { tags: ["hydrated", "firmness", "glow"], tipo: "hydration", etapa: "03 · HIDRATAÇÃO" },
    "deep-vita-c-capsule-cream": { tags: ["pigmentation", "dullness", "glow"], tipo: "hydration", etapa: "03 · HIDRATAÇÃO", cautela: ["sensitive"] },
    "dual-barrier-cream": { tags: ["dry", "sensitive", "barrier", "hydrated", "redness"], tipo: "hydration", etapa: "03 · HIDRATAÇÃO" },
    "glow-deep-serum-rice-alpha-arbutin": { tags: ["pigmentation", "dullness", "glow"], tipo: "serum", etapa: "02 · SÉRUM" },
    "niacinamide-10-txa-4-serum": { tags: ["pigmentation", "pores", "texture", "oily"], tipo: "serum", etapa: "02 · SÉRUM", cautela: ["sensitive", "beginner"] },
    "madagascar-centella-ampoule": { tags: ["sensitive", "redness", "barrier", "hydrated"], tipo: "treatment", etapa: "01 · TRATAMENTO" },
    "m-scara-facial-iluminadora-de-col-geno": { tags: ["glow", "hydrated"], tipo: "extra", etapa: "EXTRA · MÁSCARA" },
    "bio-collagen-face-mask": { tags: ["hydrated", "glow", "firmness"], tipo: "extra", etapa: "EXTRA · MÁSCARA" }
  };

  const mapaTags = {
    "Seca": ["dry", "hydrated"], "Oleosa": ["oily", "pores"], "Mista": ["combination"], "Normal": [],
    "Manchas ou tom desigual": ["pigmentation"], "Poros aparentes": ["pores"], "Oleosidade": ["oily"], "Ressecamento": ["dry", "hydrated"], "Sensibilidade": ["sensitive", "barrier"], "Vermelhidão": ["redness", "sensitive"], "Textura irregular": ["texture"], "Falta de luminosidade": ["dullness", "glow"], "Linhas / perda de firmeza": ["firmness"],
    "Sim, frequentemente": ["sensitive", "redness"], "Às vezes": ["sensitive"],
    "Repuxando / ressecada": ["dry", "dehydrated", "hydrated"], "Oleosa pouco tempo depois": ["oily"], "Depende da região do rosto": ["combination"],
    "Mais glow": ["glow"], "Tom mais uniforme": ["pigmentation"], "Poros menos aparentes": ["pores"], "Pele mais hidratada": ["hydrated"], "Pele mais calma": ["sensitive", "redness"], "Barreira da pele fortalecida": ["barrier"], "Textura mais uniforme": ["texture"], "Mais firmeza": ["firmness"],
    "Estou começando agora": ["beginner"], "Não sei / não tenho rotina": ["beginner"]
  };

  let estado = carregarEstado();

  function estadoInicial() { return { iniciada: false, indice: 0, respostas: {}, concluido: false }; }
  function carregarEstado() { try { return { ...estadoInicial(), ...JSON.parse(localStorage.getItem(STORAGE_KEY) || "null") }; } catch { return estadoInicial(); } }
  function salvarEstado() { localStorage.setItem(STORAGE_KEY, JSON.stringify(estado)); }
  function esc(valor) { const el = document.createElement("div"); el.textContent = String(valor || ""); return el.innerHTML; }

  function tagsDoPerfil() {
    const tags = [];
    Object.values(estado.respostas).flat().forEach(resposta => {
      if (resposta !== "Não sei") tags.push(...(mapaTags[resposta] || []));
    });
    return tags;
  }

  async function produtosReaisDisponiveis() {
    const catalogo = await DB.products.getAll();
    return catalogo.map(produto => {
      const chave = String(produto.sku || produto.id || "").toLowerCase();
      const perfil = perfis[chave];
      // A quantidade real fica privada no estoque. Enquanto o inventário está
      // sendo conferido, todo item de skincare do catálogo participa do quiz;
      // somente um item marcado explicitamente como indisponível é ocultado.
      return { ...produto, perfil, disponivel: produto.disponivelNoQuiz !== false };
    }).filter(produto => produto.perfil && produto.disponivel);
  }

  function pontuar(produto, tags) {
    let score = 0;
    produto.perfil.tags.forEach(tag => { if (tags.includes(tag)) score += 3; });
    produto.perfil.cautela?.forEach(tag => { if (tags.includes(tag)) score -= 2; });
    return score;
  }

  function escolherRotina(produtos, tags) {
    const porPontuacao = produtos.map(produto => ({ ...produto, score: pontuar(produto, tags) })).filter(p => p.score > 0).sort((a, b) => b.score - a.score);
    const limite = tags.includes("beginner") ? 3 : 5;
    const selecionados = [];
    ["treatment", "serum", "hydration"].forEach(tipo => {
      const candidato = porPontuacao.find(p => p.perfil.tipo === tipo && !selecionados.includes(p));
      if (candidato) selecionados.push(candidato);
    });
    porPontuacao.forEach(produto => {
      if (selecionados.length < limite && !selecionados.includes(produto) && (produto.perfil.tipo !== "extra" || selecionados.length >= 3)) selecionados.push(produto);
    });
    return selecionados.slice(0, limite);
  }

  function motivo(produto, tags) {
    if (tags.includes("sensitive") && produto.perfil.tags.some(t => ["sensitive", "barrier", "redness"].includes(t))) return "Como você indicou sensibilidade, priorizamos uma opção voltada ao conforto e ao cuidado da barreira.";
    if (tags.includes("pigmentation") && produto.perfil.tags.includes("pigmentation")) return "Você busca mais uniformidade para a pele, por isso este produto ganhou destaque no seu Ritual Lumiê.";
    if (tags.includes("pores") && produto.perfil.tags.includes("pores")) return "Você contou que os poros e a textura incomodam; esta opção combina com esse objetivo.";
    if (tags.includes("glow") && produto.perfil.tags.includes("glow")) return "Você disse que deseja mais luminosidade, então esta opção foi selecionada para complementar seu ritual.";
    return "Selecionamos esta opção por ser compatível com as necessidades que você nos contou.";
  }

  function chips(tags) {
    const nomes = { dry: "Pele seca", oily: "Oleosidade", combination: "Pele mista", sensitive: "Sensibilidade", redness: "Vermelhidão", pores: "Poros", texture: "Textura", pigmentation: "Tom desigual", dullness: "Luminosidade", barrier: "Barreira", firmness: "Firmeza", glow: "Glow" };
    return [...new Set(tags)].filter(tag => nomes[tag]).slice(0, 5).map(tag => `<span class="rotina-chip">${nomes[tag]}</span>`).join("");
  }

  function renderIntroducao() {
    app.innerHTML = `<div class="rotina-intro"><span class="rotina-eyebrow">01 · CONSULTORIA DIGITAL</span><h2 class="serif-title">Descubra sua rotina</h2><p>Responda algumas perguntas rápidas e descubra quais produtos Lumiê podem complementar o seu ritual de cuidados.</p><button id="rotina-start" class="btn btn-primary" type="button">Começar</button></div>`;
    app.querySelector("#rotina-start").onclick = () => { estado = estadoInicial(); estado.iniciada = true; salvarEstado(); renderPergunta(); };
  }

  function renderPergunta() {
    const pergunta = perguntas[estado.indice];
    const selecionadas = Array.isArray(estado.respostas[pergunta.chave]) ? estado.respostas[pergunta.chave] : [];
    const multipla = Boolean(pergunta.max);
    app.innerHTML = `<div class="rotina-journey-head"><span class="rotina-eyebrow">RITUAL PERSONALIZADO</span><h2 class="serif-title"><b>01 —</b> Descubra sua rotina</h2><p>Responda algumas perguntas rápidas e descubra os produtos ideais para as necessidades da sua pele.</p></div><div class="rotina-quiz"><span class="rotina-step">Pergunta ${estado.indice + 1} de ${perguntas.length}</span><div class="rotina-progress" aria-label="Progresso"><span style="width:${((estado.indice + 1) / perguntas.length) * 100}%"></span></div><h2 class="rotina-question">${pergunta.titulo}</h2><div class="rotina-options" role="listbox" aria-multiselectable="${multipla}">${pergunta.opcoes.map(opcao => `<button type="button" class="rotina-option ${selecionadas.includes(opcao) ? "is-selected" : ""}" data-opcao="${esc(opcao)}" aria-selected="${selecionadas.includes(opcao)}"><span class="rotina-option-check">✓</span>${esc(opcao)}</button>`).join("")}</div><div class="rotina-actions"><button class="btn btn-secondary" id="rotina-back" type="button" ${estado.indice === 0 ? "disabled" : ""}>Voltar</button><p class="rotina-note">${multipla ? `Escolha até ${pergunta.max} opções` : "Escolha uma opção"}</p><button class="btn btn-primary" id="rotina-next" type="button" ${selecionadas.length ? "" : "disabled"}>${estado.indice === perguntas.length - 1 ? "Ver meu ritual" : "Continuar →"}</button></div></div>`;
    const avancarComTransicao = () => {
      const quiz = app.querySelector(".rotina-quiz");
      if (quiz) quiz.classList.add("is-leaving");
      window.setTimeout(() => {
        if (estado.indice < perguntas.length - 1) {
          estado.indice++;
          salvarEstado();
          renderPergunta();
        } else {
          renderAnalise();
        }
      }, 340);
    };

    app.querySelectorAll(".rotina-option").forEach(botao => botao.onclick = () => {
      const opcao = botao.dataset.opcao;
      let escolhas = [...selecionadas];
      if (multipla) escolhas = escolhas.includes(opcao) ? escolhas.filter(x => x !== opcao) : (escolhas.length < pergunta.max ? [...escolhas, opcao] : escolhas);
      else escolhas = [opcao];
      estado.respostas[pergunta.chave] = escolhas;
      salvarEstado();

      // Respostas únicas avançam no clique. Nas perguntas de até duas escolhas,
      // a transição acontece ao completar a segunda resposta.
      if (!multipla || escolhas.length === pergunta.max) avancarComTransicao();
      else renderPergunta();
    });
    app.querySelector("#rotina-back").onclick = () => { if (estado.indice) { estado.indice--; salvarEstado(); renderPergunta(); } };
    app.querySelector("#rotina-next").onclick = () => { if (selecionadas.length) avancarComTransicao(); };
  }

  function renderAnalise() { app.innerHTML = `<div class="rotina-quiz rotina-loading"><span class="rotina-sparkle">✦</span><h2 class="rotina-question">Estamos preparando seu Ritual Lumiê…</h2><p class="rotina-note">Analisando as necessidades da sua pele...</p></div>`; setTimeout(renderResultado, 1200); }

  async function renderResultado() {
    const tags = tagsDoPerfil();
    const produtos = escolherRotina(await produtosReaisDisponiveis(), tags);
    estado.concluido = true; salvarEstado();
    if (!produtos.length) {
      app.innerHTML = `<div class="rotina-result"><div class="rotina-result-head"><span class="rotina-eyebrow">SEU RITUAL LUMIÊ ✦</span><h2 class="serif-title">Estamos atualizando nossa curadoria</h2><p class="rotina-empty">No momento, não encontramos produtos disponíveis para esta combinação. Fale com uma consultora Lumiê para receber uma indicação personalizada.</p><button class="btn btn-primary" type="button" onclick="contactMerchantGeneral()">Falar com consultora</button><button class="btn btn-secondary" id="rotina-restart" type="button">Refazer o teste</button></div></div>`;
      app.querySelector("#rotina-restart").onclick = renderIntroducao; return;
    }
    app.innerHTML = `<div class="rotina-result"><div class="rotina-result-head"><span class="rotina-eyebrow">SEU RITUAL LUMIÊ ✦</span><h2 class="serif-title">Seu Ritual Lumiê</h2><p>Com base nas suas respostas, selecionamos produtos que podem combinar melhor com as necessidades que você nos contou.</p><div class="rotina-chips">${chips(tags)}</div>${tags.includes("beginner") ? `<p><strong>Comece aos poucos ✦</strong><br>Uma rotina não precisa ser complicada. Comece com poucos produtos e observe como sua pele responde.</p>` : ""}</div><div class="rotina-products">${produtos.map(produto => `<article class="rotina-product"><div class="rotina-product-image">${produto.imagensUrl?.[0] ? `<img src="${esc(produto.imagensUrl[0])}" alt="${esc(produto.nome)}" loading="lazy">` : ""}</div><div class="rotina-product-body"><span class="rotina-product-step">${produto.perfil.etapa}</span><span class="rotina-product-brand">${esc(produto.marca)}</span><h3>${esc(produto.nome)}</h3><p><strong>Por que escolhemos para você:</strong><br>${motivo(produto, tags)}</p><button class="btn btn-secondary" type="button" data-produto-id="${esc(produto.id)}">Ver produto</button></div></article>`).join("")}</div><div class="text-center" style="margin-top:2rem"><button id="rotina-catalogo" class="btn btn-primary" type="button">Conhecer os produtos</button><button id="rotina-restart" class="btn btn-secondary" type="button">Refazer o teste</button></div><p class="rotina-disclaimer">As recomendações têm finalidade cosmética e não substituem uma avaliação dermatológica profissional.</p></div>`;
    app.querySelectorAll("[data-produto-id]").forEach(botao => botao.onclick = () => navegar("produto", { id: botao.dataset.produtoId }));
    app.querySelector("#rotina-catalogo").onclick = () => navegar("catalogo");
    app.querySelector("#rotina-restart").onclick = renderIntroducao;
  }

  document.addEventListener("DOMContentLoaded", () => { estado.iniciada && !estado.concluido ? renderPergunta() : estado.concluido ? renderResultado() : renderIntroducao(); });
})();
