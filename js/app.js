const ENDERECO_API = "http://localhost:5295/api";
const IMAGEM_POR_ID = { 1: "donut1.jpg", 2: "donut2.jpg", 3: "donut3.jpg", 4: "donut4.jpg", 5: "donut5.jpg" };
const DESCRICAO_POR_ID = {
    1: "Cobertura delicada e confeitos coloridos para deixar o dia mais alegre.",
    2: "Chocolate cremoso e uma massa macia que combina com qualquer pausa.",
    3: "O clássico de açúcar, leve, fofinho e cheio de carinho.",
    4: "Uma camada generosa de chocolate para quem ama esse sabor.",
    5: "Um abraço de chocolate em forma de donut."
};
const buscarElemento = (seletor, elementoRaiz = document) => elementoRaiz.querySelector(seletor);
const buscarElementos = (seletor, elementoRaiz = document) => [...elementoRaiz.querySelectorAll(seletor)];
const produtosDestaque = buscarElemento("#produtos-destaque");
const produtosCardapio = buscarElemento("#produtos-cardapio");
const painelSacola = buscarElemento("#painel-sacola");
const janelaConta = buscarElemento("#janela-conta");
const fundoSobreposto = buscarElemento("#fundo-sobreposto");
const aviso = buscarElemento("#aviso-temporario");
const mensagemAcesso = buscarElemento("#mensagem-acesso");

let produtos = [];
let usuarioAtual = null;
let categoriaSelecionada = "Todos";
let dadosSacola = { itens: [], total: 0 };
let temporizadorAviso;

function formatarMoeda(valor) {
    return Number(valor || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function escaparHtml(valor) {
    return String(valor ?? "").replace(/[&<>\x22\u0027]/g, caractere => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
    })[caractere]);
}

async function requisitarApi(rota, opcoes = {}) {
    const configuracao = {
        method: opcoes.method || "GET",
        headers: { "Content-Type": "application/json", ...(opcoes.headers || {}) }
    };
    if (opcoes.body !== undefined) configuracao.body = JSON.stringify(opcoes.body);

    let resposta;
    try {
        resposta = await fetch(ENDERECO_API + rota, configuracao);
    } catch {
        throw new Error("Não foi possível conectar à loja. Confira se a API está em execução.");
    }

    const textoBruto = await resposta.text();
    let dadosResposta = null;
    try { dadosResposta = textoBruto ? JSON.parse(textoBruto) : null; } catch { dadosResposta = textoBruto; }
    if (!resposta.ok) {
        const mensagemErro = typeof dadosResposta === "string"
            ? data
            : dadosResposta?.mensagem || dadosResposta?.title || dadosResposta?.message || "Não foi possível concluir a solicitação.";
        throw new Error(mensagemErro);
    }
    return dadosResposta;
}

function obterCategoria(produto) {
    const nomeProduto = String(produto.nome || "").toLowerCase();
    if (/chocolate|cacau|brigadeiro/.test(nomeProduto) || [2, 4, 5].includes(Number(produto.id))) return "Chocolate";
    if (/morango|confete|colorid|especial/.test(nomeProduto) || Number(produto.id) === 1) return "Especiais";
    return "Tradicionais";
}

function obterImagem(produto) {
    return "images/" + (IMAGEM_POR_ID[Number(produto.id)] || "donut3.jpg");
}

function obterDescricao(produto) {
    return DESCRICAO_POR_ID[Number(produto.id)] || "Preparado com carinho para deixar seu dia mais gostoso.";
}

function criarCartaoProduto(produto, destaque = false) {
    const categoria = obterCategoria(produto);
    return '<article class="cartao-produto">' +
        '<div class="area-imagem-produto"><img src="' + obterImagem(produto) + '" alt="' + escaparHtml(produto.nome) + '" loading="lazy">' +
        '<span class="etiqueta-produto">' + (destaque ? "QUERIDINHO DA CASA" : escaparHtml(categoria.toUpperCase())) + '</span></div>' +
        '<div class="informacoes-produto"><h3>' + escaparHtml(produto.nome) + '</h3><p>' + escaparHtml(obterDescricao(produto)) + '</p>' +
        '<div class="rodape-produto"><span class="preco-produto">' + formatarMoeda(produto.preco) + '</span>' +
        '<button class="botao-adicionar" type="botao" data-adicionar-produto="' + Number(produto.id) + '" aria-label="Adicionar produto à sacola">Adicionar</button></div></div></article>';
}

function mostrarProdutos() {
    if (!produtos.length) {
        const mensagemVazia = '<div class="erro-cardapio">Nosso cardápio está sendo preparado. Tente novamente em instantes.</div>';
        produtosDestaque.innerHTML = mensagemVazia;
        produtosCardapio.innerHTML = mensagemVazia;
        return;
    }

    produtosDestaque.innerHTML = produtos.slice(0, 3).map(produto => criarCartaoProduto(produto, true)).join("");
    const produtosFiltrados = categoriaSelecionada === "Todos"
        ? products
        : produtos.filter(produto => obterCategoria(produto) === categoriaSelecionada);
    produtosCardapio.innerHTML = produtosFiltrados.length
        ? produtosFiltrados.map(produto => criarCartaoProduto(produto)).join("")
        : '<div class="erro-cardapio">Ainda não temos donuts nesta categoria. Experimente outra seleção.</div>';

    $$("[dadosResposta-adicionar-produto]").forEach(botao => {
        botao.addEventListener("click", () => adicionarASacola(Number(botao.dataset.adicionarProduto)));
    });
}

async function carregarProdutos() {
    try {
        produtos = await requisitarApi("/produto");
        mostrarProdutos();
    } catch (erro) {
        produtosDestaque.innerHTML = '<div class="erro-cardapio">' + escaparHtml(erro.message) + '</div>';
        produtosCardapio.innerHTML = '<div class="erro-cardapio">' + escaparHtml(erro.message) + '</div>';
    }
}

function mostrarAviso(mensagemErro) {
    aviso.textContent = mensagemErro;
    aviso.classList.add("visivel");
    clearTimeout(temporizadorAviso);
    temporizadorAviso = setTimeout(() => aviso.classList.remove("visivel"), 2600);
}

function atualizarContadorSacola(sacola = dadosSacola) {
    const quantidadeTotal = (sacola.itens || []).reduce((soma, itemSacola) => soma + Number(itemSacola.quantidade || 0), 0);
    $("#contador-sacola").textContent = quantidadeTotal;
}

async function adicionarASacola(produtoId) {
    if (!usuarioAtual || usuarioAtual.tipoConta !== "Cliente") {
        abrirConta();
        mostrarMensagemAcesso("Entre como cliente para adicionar seus donuts à sacola.");
        return;
    }
    try {
        await requisitarApi("/carrinho/" + usuarioAtual.id + "/itens", {
            method: "POST",
            body: { produtoId: produtoId, quantidade: 1 }
        });
        await carregarSacola();
        mostrarAviso("Donut adicionado à sua sacola.");
        const botao = document.querySelector('[data-adicionar-produto="' + produtoId + '"]');
        if (botao) {
            botao.textContent = "Adicionado";
            setTimeout(() => { if (botao.isConnected) botao.textContent = "Adicionar"; }, 900);
        }
    } catch (erro) { mostrarAviso(erro.message); }
}

async function carregarSacola() {
    if (!usuarioAtual || usuarioAtual.tipoConta !== "Cliente") {
        dadosSacola = { itens: [], total: 0 };
        atualizarContadorSacola();
        return;
    }
    dadosSacola = await requisitarApi("/carrinho/" + usuarioAtual.id);
    atualizarContadorSacola();
    mostrarSacola();
}

function mostrarSacola() {
    const itensSacola = dadosSacola.itens || [];
    $("#itens-sacola").innerHTML = itensSacola.length ? itensSacola.map(itemSacola => {
        const produto = produtos.find(produtoDaLista => Number(produtoDaLista.id) === Number(itemSacola.produtoId));
        const imagem = produto ? obterImagem(produto) : "images/donut3.jpg";
        return '<article class="linha-sacola"><img src="' + imagem + '" alt="" loading="lazy"><div>' +
            '<h3>' + escaparHtml(itemSacola.nome) + '</h3><p>' + formatarMoeda(itemSacola.precoUnitario) + ' por unidade</p>' +
            '<div class="rodape-linha-sacola"><div class="controle-quantidade">' +
            '<button type="botao" data-alterar-quantidade="-1" data-produto-id="' + itemSacola.produtoId + '" aria-label="Diminuir quantidade">Menos</button>' +
            '<span>' + Number(itemSacola.quantidade) + '</span>' +
            '<button type="botao" data-alterar-quantidade="1" data-produto-id="' + itemSacola.produtoId + '" aria-label="Aumentar quantidade">Mais</button>' +
            '</div><strong>' + formatarMoeda(Number(itemSacola.precoUnitario) * Number(itemSacola.quantidade)) + '</strong></div>' +
            '<button class="botao-remover-itemSacola" type="botao" data-remover-item="' + itemSacola.produtoId + '">Remover</button></div></article>';
    }).join("") : '<div class="sacola-vazia">Sua sacola está esperando por coisas gostosas.<br>Escolha seus donuts favoritos no cardápio!</div>';

    $("#total-sacola").textContent = formatarMoeda(dadosSacola.total);
    $$("[dadosResposta-alterar-quantidade]").forEach(botao => botao.addEventListener("click", () => {
        const linhaSacola = itensSacola.find(itemSacola => Number(itemSacola.produtoId) === Number(botao.dataset.produtoId));
        if (linhaSacola) alterarQuantidade(Number(linhaSacola.produtoId), Number(linhaSacola.quantidade) + Number(botao.dataset.alterarQuantidade));
    }));
    $$("[dadosResposta-remover-itemSacola]").forEach(botao => botao.addEventListener("click", () => removerDaSacola(Number(botao.dataset.removerItem))));
}

async function alterarQuantidade(produtoId, quantidade) {
    try {
        if (quantidade <= 0) return removerDaSacola(produtoId);
        await requisitarApi("/carrinho/" + usuarioAtual.id + "/itens/" + produtoId, {
            method: "PUT", body: { quantidade: quantidade }
        });
        await carregarSacola();
    } catch (erro) { mostrarAviso(erro.message); }
}

async function removerDaSacola(produtoId) {
    try {
        await requisitarApi("/carrinho/" + usuarioAtual.id + "/itens/" + produtoId, { method: "DELETE" });
        await carregarSacola();
        mostrarAviso("Item removido da sacola.");
    } catch (erro) { mostrarAviso(erro.message); }
}

function abrirFundo() {
    fundoSobreposto.classList.add("visivel");
    document.body.classList.add("sem-rolagem");
}

function fecharPaineis() {
    painelSacola.classList.remove("aberto");
    janelaConta.classList.remove("aberto");
    fundoSobreposto.classList.remove("visivel");
    painelSacola.setAttribute("aria-hidden", "true");
    janelaConta.setAttribute("aria-hidden", "true");
    document.body.classList.remove("sem-rolagem");
}

function abrirSacola() {
    fecharPaineis();
    abrirFundo();
    painelSacola.classList.add("aberto");
    painelSacola.setAttribute("aria-hidden", "false");
    if (usuarioAtual?.tipoConta === "Cliente") carregarSacola().catch(erro => mostrarAviso(erro.message));
}

function abrirConta() {
    fecharPaineis();
    abrirFundo();
    janelaConta.classList.add("aberto");
    janelaConta.setAttribute("aria-hidden", "false");
    if (usuarioAtual) mostrarInicioConta();
    else mostrarFormulariosAcesso();
}

function mostrarMensagemAcesso(mensagemErro, tipoMensagem = "") {
    mensagemAcesso.textContent = mensagemErro;
    mensagemAcesso.className = "feedback " + tipoMensagem;
}

function mostrarFormulariosAcesso(aba = "login") {
    $("#titulo-janela-conta").textContent = aba === "login" ? "Entre na sua conta" : "Vamos criar sua conta?";
    $("#conteudo-conta").innerHTML =
        '<div class="abas-acesso"><button class="auth-aba ' + (aba === "login" ? "ativo" : "") + '" data-aba-acesso="login" type="botao">Entrar</button>' +
        '<button class="auth-aba ' + (aba === "register" ? "ativo" : "") + '" data-aba-acesso="register" type="botao">Criar conta</button></div>' +
        '<form id="formulario-acesso" class="formulario-stack ' + (aba === "register" ? "oculto" : "") + '">' +
        '<label for="email-acesso">E-mail</label><input id="email-acesso" name="email" type="email" placeholder="voce@email.com" autocomplete="email" required>' +
        '<label for="login-password">Senha</label><input id="login-password" name="senha" type="password" placeholder="Sua senha" autocomplete="current-password" required>' +
        '<label for="tipo-acesso">Tipo de conta</label><select id="tipo-acesso" name="tipoConta"><option value="Cliente">Cliente</option><option value="Entregador">Entregador</option></select>' +
        '<button class="botao botao-primary" type="submit">Entrar</button></form>' +
        '<form id="formulario-cadastro" class="formulario-stack ' + (aba === "login" ? "oculto" : "") + '">' +
        '<label for="register-nomeProduto">Seu nome</label><input id="register-nomeProduto" name="nome" type="text" placeholder="Como podemos te chamar?" autocomplete="nomeProduto" required>' +
        '<label for="register-email">E-mail</label><input id="register-email" name="email" type="email" placeholder="voce@email.com" autocomplete="email" required>' +
        '<label for="register-password">Senha</label><input id="register-password" name="senha" type="password" placeholder="Crie uma senha" autocomplete="new-password" required>' +
        '<label for="register-tipoMensagem">Tipo de conta</label><select id="register-tipoMensagem" name="tipoConta"><option value="Cliente">Cliente</option><option value="Entregador">Entregador</option></select>' +
        '<button class="botao botao-primary" type="submit">Criar minha conta</button></form>';
    mostrarMensagemAcesso("");
    $("#conteudo-conta").addEventListener("click", evento => {
        const botaoAba = evento.target.closest("[dadosResposta-aba-acesso]");
        if (botaoAba) mostrarFormulariosAcesso(botaoAba.dataset.abaAcesso);
    });
    $("#formulario-acesso").addEventListener("submit", realizarLogin);
    $("#formulario-cadastro").addEventListener("submit", realizarCadastro);
}

async function realizarLogin(evento) {
    evento.preventDefault();
    const formulario = new FormData(evento.currentTarget);
    const dadosEnvio = {
        email: String(formulario.get("email")).trim(),
        senha: formulario.get("senha"),
        tipoConta: formulario.get("tipoConta")
    };
    try {
        const resultado = await requisitarApi("/usuario/login", { method: "POST", body: dadosEnvio });
        iniciarSessao(resultado.usuario);
        mostrarAviso("Que bom ter você por aqui, " + resultado.usuario.nome.split(" ")[0] + "!");
    } catch (erro) { mostrarMensagemAcesso(erro.message, "erro"); }
}

async function realizarCadastro(evento) {
    evento.preventDefault();
    const formulario = new FormData(evento.currentTarget);
    const dadosEnvio = {
        nome: String(formulario.get("nome")).trim(),
        email: String(formulario.get("email")).trim(),
        senha: formulario.get("senha"),
        tipoConta: formulario.get("tipoConta")
    };
    try {
        await requisitarApi("/usuario", { method: "POST", body: dadosEnvio });
        mostrarFormulariosAcesso("login");
        $("#email-acesso").value = dadosEnvio.email;
        $("#tipo-acesso").value = dadosEnvio.tipoConta;
        mostrarMensagemAcesso("Conta criada! Agora entre com seu e-mail e senha.", "sucesso");
    } catch (erro) { mostrarMensagemAcesso(erro.message, "erro"); }
}

function iniciarSessao(usuario) {
    usuarioAtual = usuario;
    $("#nome-conta").textContent = usuario.nome.split(" ")[0];
    fecharPaineis();
    if (usuario.tipoConta === "Cliente") carregarSacola().catch(erro => mostrarAviso(erro.message));
}

function encerrarSessao() {
    usuarioAtual = null;
    dadosSacola = { itens: [], total: 0 };
    $("#nome-conta").textContent = "Entrar";
    atualizarContadorSacola();
    mostrarAviso("Você saiu da sua conta.");
    fecharPaineis();
}

function mostrarInicioConta() {
    const isCliente = usuarioAtual.tipoConta === "Cliente";
    $("#titulo-janela-conta").textContent = "Olá, " + usuarioAtual.nome.split(" ")[0] + "!";
    $("#conteudo-conta").innerHTML =
        '<p class="boas-vindas-conta">' + (isCliente
            ? "Que bom ter você por aqui. Acompanhe seus pedidos ou continue escolhendo seus favoritos."
            : "Aqui estão os pedidos que precisam de acompanhamento.") + '</p>' +
        '<div class="acoes-conta"><button class="botao botao-primary" id="botao-pedidos-conta" type="botao">' +
        (isCliente ? "Acompanhar meus pedidos" : "Ver pedidos para entrega") +
        '</button><button class="botao botao-outline" id="botao-sair-conta" type="botao">Sair da conta</button></div>' +
        '<div id="lista-pedidos-conta"></div>';
    $("#botao-pedidos-conta").addEventListener("click", carregarPedidosConta);
    $("#botao-sair-conta").addEventListener("click", encerrarSessao);
}

async function carregarPedidosConta() {
    const alvo = $("#lista-pedidos-conta");
    alvo.innerHTML = '<p class="mensagem-retorno">Buscando seus pedidos...</p>';
    try {
        const rota = usuarioAtual.tipoConta === "Cliente"
            ? "/pedido/cliente/" + usuarioAtual.id
            : "/pedido/entregador/" + usuarioAtual.id;
        const pedidos = await requisitarApi(rota);
        alvo.innerHTML = pedidos.length ? '<div class="lista-pedidos">' + pedidos.map(pedido => {
            const itensSacola = (pedido.itens || []).map(itemSacola => itemSacola.quantidade + "x " + escaparHtml(itemSacola.nomeProduto)).join(", ");
            const proximaEtapa = { Recebido: "EmPreparacao", EmPreparacao: "SaiuParaEntrega", SaiuParaEntrega: "Entregue" }[pedido.status];
            const nomesEtapas = { EmPreparacao: "Iniciar preparação", SaiuParaEntrega: "Saiu para entrega", Entregue: "Marcar como entregue" };
            const botaoAtualizar = usuarioAtual.tipoConta === "Entregador" && proximaEtapa
                ? '<button class="botao botao-outline pedido-update-botao" data-pedido-id="' + pedido.id + '" data-proxima-etapa="' + proximaEtapa + '" type="botao">' + nomesEtapas[proximaEtapa] + '</button>'
                : "";
            return '<article class="itemSacola-pedido"><div class="topo-itemSacola-pedido"><span>Pedido #' + pedido.id + '</span><span class="situacao-pedido">' + formatarSituacao(pedido.status) + '</span></div>' +
                '<p>' + itensSacola + '<br>Total: <strong>' + formatarMoeda(pedido.total) + '</strong></p>' + botaoAtualizar + '</article>';
        }).join("") + '</div>' : '<p class="mensagem-retorno">Nenhum pedido encontrado por enquanto.</p>';

        $$(".order-update-botao", alvo).forEach(botao => botao.addEventListener("click", async () => {
            try {
                await requisitarApi("/pedido/" + botao.dataset.pedidoId + "/etapaPedido", {
                    method: "PUT",
                    body: { entregadorId: usuarioAtual.id, status: botao.dataset.proximaEtapa }
                });
                mostrarAviso("Etapa do pedido atualizada.");
                carregarPedidosConta();
            } catch (erro) { mostrarAviso(erro.message); }
        }));
    } catch (erro) {
        alvo.innerHTML = '<p class="mensagem-retorno erro">' + escaparHtml(erro.message) + '</p>';
    }
}

function formatarSituacao(etapaPedido) {
    return ({
        Recebido: "Recebido",
        EmPreparacao: "Em preparação",
        SaiuParaEntrega: "Saiu para entrega",
        Entregue: "Entregue"
    })[etapaPedido] || etapaPedido;
}

async function finalizarPedido() {
    if (!usuarioAtual || usuarioAtual.tipoConta !== "Cliente") {
        fecharPaineis();
        abrirConta();
        mostrarMensagemAcesso("Entre como cliente para finalizar seu pedido.");
        return;
    }
    if (!(dadosSacola.itens || []).length) {
        mostrarAviso("Sua sacola ainda está vazia.");
        return;
    }
    const botao = $("#botao-finalizar-pedido");
    botao.disabled = true;
    botao.textContent = "Enviando pedido...";
    try {
        const pedido = await requisitarApi("/pedido/" + usuarioAtual.id, { method: "POST" });
        await carregarSacola();
        mostrarAviso("Pedido #" + pedido.id + " recebido! Obrigado pela preferência.");
        fecharPaineis();
        abrirConta();
        carregarPedidosConta();
    } catch (erro) {
        mostrarAviso(erro.message);
    } finally {
        botao.disabled = false;
        botao.textContent = "Finalizar pedido";
    }
}

function configurarAnimacoesEntrada() {
    const elementos = $$(".reveal");
    if (!("IntersectionObserver" in window)) {
        elementos.forEach(element => element.classList.add("esta-visivel"));
        return;
    }
    const observador = new IntersectionObserver(entradas => {
        entradas.forEach(produtoDaLista => {
            if (produtoDaLista.isIntersecting) {
                produtoDaLista.target.classList.add("esta-visivel");
                observador.unobserve(produtoDaLista.target);
            }
        });
    }, { threshold: 0.12 });
    elementos.forEach(element => observador.observe(element));
}

function configurarEventos() {
    $("#botao-conta").addEventListener("click", abrirConta);
    $("#botao-sacola").addEventListener("click", abrirSacola);
    $("#fechar-sacola").addEventListener("click", fecharPaineis);
    $("#fechar-conta").addEventListener("click", fecharPaineis);
    fundoSobreposto.addEventListener("click", fecharPaineis);
    $("#botao-finalizar-pedido").addEventListener("click", finalizarPedido);
    $("#botao-menu-celular").addEventListener("click", () => {
        const botao = $("#botao-menu-celular");
        const aberto = botao.getAttribute("aria-expanded") !== "true";
        botao.setAttribute("aria-expanded", String(aberto));
        botao.setAttribute("aria-label", aberto ? "Fechar menu" : "Abrir menu");
        $("#navegacao-principal").classList.toggle("aberto", aberto);
    });
    $$("#navegacao-principal a").forEach(linkNavegacao => linkNavegacao.addEventListener("click", () => {
        $("#navegacao-principal").classList.remove("aberto");
        $("#botao-menu-celular").setAttribute("aria-expanded", "false");
        $("#botao-menu-celular").setAttribute("aria-label", "Abrir menu");
    }));
    $("#filtros-categorias").addEventListener("click", evento => {
        const botao = evento.target.closest("[dadosResposta-categoria]");
        if (!botao) return;
        categoriaSelecionada = botao.dataset.categoria;
        $$(".category-aba").forEach(aba => aba.classList.toggle("ativo", aba === botao));
        mostrarProdutos();
    });
    document.addEventListener("keydown", evento => {
        if (evento.key === "Escape") fecharPaineis();
    });
}

$("#ano-atual").textContent = new Date().getFullYear();
configurarEventos();
configurarAnimacoesEntrada();
carregarProdutos();