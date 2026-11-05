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
const buscarElementos = (seletor, elementoRaiz = document) => [...root.querySelectorAll(seletor)];
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
    return String(valor ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
    })[char]);
}

async function apiRequest(path, options = {}) {
    const config = {
        method: options.method || "GET",
        headers: { "Content-Type": "application/json", ...(options.headers || {}) }
    };
    if (options.body !== undefined) config.body = JSON.stringify(options.body);

    let response;
    try {
        response = await fetch(API_URL + path, config);
    } catch {
        throw new Error("Não foi possível conectar à loja. Confira se a API está em execução.");
    }

    const raw = await response.text();
    let data = null;
    try { data = raw ? JSON.parse(raw) : null; } catch { data = raw; }
    if (!response.ok) {
        const message = typeof data === "string"
            ? data
            : data?.mensagem || data?.title || data?.message || "Não foi possível concluir a solicitação.";
        throw new Error(message);
    }
    return data;
}

function categoryFor(product) {
    const name = String(product.nome || "").toLowerCase();
    if (/chocolate|cacau|brigadeiro/.test(name) || [2, 4, 5].includes(Number(product.id))) return "Chocolate";
    if (/morango|confete|colorid|especial/.test(name) || Number(product.id) === 1) return "Especiais";
    return "Tradicionais";
}

function imageFor(product) {
    return "images/" + (IMAGE_BY_ID[Number(product.id)] || "donut3.jpg");
}

function descriptionFor(product) {
    return DESCRIPTION_BY_ID[Number(product.id)] || "Preparado com carinho para deixar seu dia mais gostoso.";
}

function productCard(product, featured = false) {
    const category = categoryFor(product);
    return '<article class="cartao-produto">' +
        '<div class="area-imagem-produto"><img src="' + imageFor(product) + '" alt="' + escapeHtml(product.nome) + '" loading="lazy">' +
        '<span class="etiqueta-produto">' + (featured ? "QUERIDINHO DA CASA" : escapeHtml(category.toUpperCase())) + '</span></div>' +
        '<div class="informacoes-produto"><h3>' + escapeHtml(product.nome) + '</h3><p>' + escapeHtml(descriptionFor(product)) + '</p>' +
        '<div class="rodape-produto"><span class="preco-produto">' + money(product.preco) + '</span>' +
        '<button class="botao-adicionar" type="botao" data-adicionar-produto="' + Number(product.id) + '" aria-label="Adicionar produto à sacola">Adicionar</button></div></div></article>';
}

function renderProducts() {
    if (!products.length) {
        const empty = '<div class="erro-cardapio">Nosso cardápio está sendo preparado. Tente novamente em instantes.</div>';
        featuredProducts.innerHTML = empty;
        menuProducts.innerHTML = empty;
        return;
    }

    featuredProducts.innerHTML = products.slice(0, 3).map(product => productCard(product, true)).join("");
    const filtered = selectedCategory === "Todos"
        ? products
        : products.filter(product => categoryFor(product) === selectedCategory);
    menuProducts.innerHTML = filtered.length
        ? filtered.map(product => productCard(product)).join("")
        : '<div class="erro-cardapio">Ainda não temos donuts nesta categoria. Experimente outra seleção.</div>';

    $$("[dadosResposta-adicionar-produto]").forEach(button => {
        button.addEventListener("click", () => addToCart(Number(button.dataset.adicionarProduto)));
    });
}

async function loadProducts() {
    try {
        products = await apiRequest("/produto");
        renderProducts();
    } catch (error) {
        featuredProducts.innerHTML = '<div class="erro-cardapio">' + escapeHtml(error.message) + '</div>';
        menuProducts.innerHTML = '<div class="erro-cardapio">' + escapeHtml(error.message) + '</div>';
    }
}

function showToast(message) {
    toast.textContent = message;
    toast.classList.add("visivel");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("visivel"), 2600);
}

function updateCartBadge(cart = cartData) {
    const count = (cart.itens || []).reduce((sum, item) => sum + Number(item.quantidade || 0), 0);
    $("#contador-sacola").textContent = count;
}

async function addToCart(productId) {
    if (!currentUser || currentUser.tipoConta !== "Cliente") {
        openAccount();
        showAuthMessage("Entre como cliente para adicionar seus donuts à sacola.");
        return;
    }
    try {
        await apiRequest("/carrinho/" + currentUser.id + "/itens", {
            method: "POST",
            body: { produtoId: productId, quantidade: 1 }
        });
        await loadCart();
        showToast("Donut adicionado à sua sacola.");
        const button = document.querySelector('[data-adicionar-produto="' + productId + '"]');
        if (button) {
            button.textContent = "Adicionado";
            setTimeout(() => { if (button.isConnected) button.textContent = "Adicionar"; }, 900);
        }
    } catch (error) { showToast(error.message); }
}

async function loadCart() {
    if (!currentUser || currentUser.tipoConta !== "Cliente") {
        cartData = { itens: [], total: 0 };
        updateCartBadge();
        return;
    }
    cartData = await apiRequest("/carrinho/" + currentUser.id);
    updateCartBadge();
    renderCart();
}

function renderCart() {
    const items = cartData.itens || [];
    $("#itens-sacola").innerHTML = items.length ? items.map(item => {
        const product = products.find(entry => Number(entry.id) === Number(item.produtoId));
        const image = product ? imageFor(product) : "images/donut3.jpg";
        return '<article class="linha-sacola"><img src="' + image + '" alt="" loading="lazy"><div>' +
            '<h3>' + escapeHtml(item.nome) + '</h3><p>' + money(item.precoUnitario) + ' por unidade</p>' +
            '<div class="rodape-linha-sacola"><div class="controle-quantidade">' +
            '<button type="botao" data-alterar-quantidade="-1" data-produto-id="' + item.produtoId + '" aria-label="Diminuir quantidade">Menos</button>' +
            '<span>' + Number(item.quantidade) + '</span>' +
            '<button type="botao" data-alterar-quantidade="1" data-produto-id="' + item.produtoId + '" aria-label="Aumentar quantidade">Mais</button>' +
            '</div><strong>' + money(Number(item.precoUnitario) * Number(item.quantidade)) + '</strong></div>' +
            '<button class="botao-remover-itemSacola" type="botao" data-remover-item="' + item.produtoId + '">Remover</button></div></article>';
    }).join("") : '<div class="sacola-vazia">Sua sacola está esperando por coisas gostosas.<br>Escolha seus donuts favoritos no cardápio!</div>';

    $("#total-sacola").textContent = money(cartData.total);
    $$("[dadosResposta-alterar-quantidade]").forEach(button => button.addEventListener("click", () => {
        const row = items.find(item => Number(item.produtoId) === Number(button.dataset.produtoId));
        if (row) changeQuantity(Number(row.produtoId), Number(row.quantidade) + Number(button.dataset.alterarQuantidade));
    }));
    $$("[dadosResposta-remover-itemSacola]").forEach(button => button.addEventListener("click", () => removeFromCart(Number(button.dataset.removerItem))));
}

async function changeQuantity(productId, quantity) {
    try {
        if (quantity <= 0) return removeFromCart(productId);
        await apiRequest("/carrinho/" + currentUser.id + "/itens/" + productId, {
            method: "PUT", body: { quantidade: quantity }
        });
        await loadCart();
    } catch (error) { showToast(error.message); }
}

async function removeFromCart(productId) {
    try {
        await apiRequest("/carrinho/" + currentUser.id + "/itens/" + productId, { method: "DELETE" });
        await loadCart();
        showToast("Item removido da sacola.");
    } catch (error) { showToast(error.message); }
}

function openOverlay() {
    overlay.classList.add("visivel");
    document.body.classList.add("sem-rolagem");
}

function closePanels() {
    cartDrawer.classList.remove("aberto");
    accountModal.classList.remove("aberto");
    overlay.classList.remove("visivel");
    cartDrawer.setAttribute("aria-hidden", "true");
    accountModal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("sem-rolagem");
}

function openCart() {
    closePanels();
    openOverlay();
    cartDrawer.classList.add("aberto");
    cartDrawer.setAttribute("aria-hidden", "false");
    if (currentUser?.tipoConta === "Cliente") loadCart().catch(error => showToast(error.message));
}

function openAccount() {
    closePanels();
    openOverlay();
    accountModal.classList.add("aberto");
    accountModal.setAttribute("aria-hidden", "false");
    if (currentUser) renderAccountHome();
    else showAuthForms();
}

function showAuthMessage(message, type = "") {
    authMessage.textContent = message;
    authMessage.className = "feedback " + type;
}

function showAuthForms(tab = "login") {
    $("#titulo-janela-conta").textContent = tab === "login" ? "Entre na sua conta" : "Vamos criar sua conta?";
    $("#conteudo-conta").innerHTML =
        '<div class="abas-acesso"><button class="auth-aba ' + (tab === "login" ? "ativo" : "") + '" data-aba-acesso="login" type="botao">Entrar</button>' +
        '<button class="auth-aba ' + (tab === "register" ? "ativo" : "") + '" data-aba-acesso="register" type="botao">Criar conta</button></div>' +
        '<form id="formulario-acesso" class="formulario-stack ' + (tab === "register" ? "oculto" : "") + '">' +
        '<label for="email-acesso">E-mail</label><input id="email-acesso" name="email" type="email" placeholder="voce@email.com" autocomplete="email" required>' +
        '<label for="login-password">Senha</label><input id="login-password" name="senha" type="password" placeholder="Sua senha" autocomplete="current-password" required>' +
        '<label for="tipo-acesso">Tipo de conta</label><select id="tipo-acesso" name="tipoConta"><option value="Cliente">Cliente</option><option value="Entregador">Entregador</option></select>' +
        '<button class="botao botao-primary" type="submit">Entrar</button></form>' +
        '<form id="formulario-cadastro" class="formulario-stack ' + (tab === "login" ? "oculto" : "") + '">' +
        '<label for="register-nomeProduto">Seu nome</label><input id="register-nomeProduto" name="nome" type="text" placeholder="Como podemos te chamar?" autocomplete="nomeProduto" required>' +
        '<label for="register-email">E-mail</label><input id="register-email" name="email" type="email" placeholder="voce@email.com" autocomplete="email" required>' +
        '<label for="register-password">Senha</label><input id="register-password" name="senha" type="password" placeholder="Crie uma senha" autocomplete="new-password" required>' +
        '<label for="register-tipoMensagem">Tipo de conta</label><select id="register-tipoMensagem" name="tipoConta"><option value="Cliente">Cliente</option><option value="Entregador">Entregador</option></select>' +
        '<button class="botao botao-primary" type="submit">Criar minha conta</button></form>';
    showAuthMessage("");
    $("#conteudo-conta").addEventListener("click", event => {
        const tabButton = event.target.closest("[dadosResposta-aba-acesso]");
        if (tabButton) showAuthForms(tabButton.dataset.abaAcesso);
    });
    $("#formulario-acesso").addEventListener("submit", handleLogin);
    $("#formulario-cadastro").addEventListener("submit", handleRegister);
}

async function handleLogin(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload = {
        email: String(form.get("email")).trim(),
        senha: form.get("senha"),
        tipoConta: form.get("tipoConta")
    };
    try {
        const result = await apiRequest("/usuario/login", { method: "POST", body: payload });
        startSession(result.usuario);
        showToast("Que bom ter você por aqui, " + result.usuario.nome.split(" ")[0] + "!");
    } catch (error) { showAuthMessage(error.message, "erro"); }
}

async function handleRegister(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload = {
        nome: String(form.get("nome")).trim(),
        email: String(form.get("email")).trim(),
        senha: form.get("senha"),
        tipoConta: form.get("tipoConta")
    };
    try {
        await apiRequest("/usuario", { method: "POST", body: payload });
        showAuthForms("login");
        $("#email-acesso").value = payload.email;
        $("#tipo-acesso").value = payload.tipoConta;
        showAuthMessage("Conta criada! Agora entre com seu e-mail e senha.", "sucesso");
    } catch (error) { showAuthMessage(error.message, "erro"); }
}

function startSession(user) {
    currentUser = user;
    $("#nome-conta").textContent = user.nome.split(" ")[0];
    closePanels();
    if (user.tipoConta === "Cliente") loadCart().catch(error => showToast(error.message));
}

function endSession() {
    currentUser = null;
    cartData = { itens: [], total: 0 };
    $("#nome-conta").textContent = "Entrar";
    updateCartBadge();
    showToast("Você saiu da sua conta.");
    closePanels();
}

function renderAccountHome() {
    const isCliente = currentUser.tipoConta === "Cliente";
    $("#titulo-janela-conta").textContent = "Olá, " + currentUser.nome.split(" ")[0] + "!";
    $("#conteudo-conta").innerHTML =
        '<p class="boas-vindas-conta">' + (isCliente
            ? "Que bom ter você por aqui. Acompanhe seus pedidos ou continue escolhendo seus favoritos."
            : "Aqui estão os pedidos que precisam de acompanhamento.") + '</p>' +
        '<div class="acoes-conta"><button class="botao botao-primary" id="botao-pedidos-conta" type="botao">' +
        (isCliente ? "Acompanhar meus pedidos" : "Ver pedidos para entrega") +
        '</button><button class="botao botao-outline" id="botao-sair-conta" type="botao">Sair da conta</button></div>' +
        '<div id="lista-pedidos-conta"></div>';
    $("#botao-pedidos-conta").addEventListener("click", loadAccountOrders);
    $("#botao-sair-conta").addEventListener("click", endSession);
}

async function loadAccountOrders() {
    const target = $("#lista-pedidos-conta");
    target.innerHTML = '<p class="mensagem-retorno">Buscando seus pedidos...</p>';
    try {
        const path = currentUser.tipoConta === "Cliente"
            ? "/pedido/cliente/" + currentUser.id
            : "/pedido/entregador/" + currentUser.id;
        const orders = await apiRequest(path);
        target.innerHTML = orders.length ? '<div class="lista-pedidos">' + orders.map(order => {
            const items = (order.itens || []).map(item => item.quantidade + "x " + escapeHtml(item.nomeProduto)).join(", ");
            const nextStatus = { Recebido: "EmPreparacao", EmPreparacao: "SaiuParaEntrega", SaiuParaEntrega: "Entregue" }[order.status];
            const statusLabels = { EmPreparacao: "Iniciar preparação", SaiuParaEntrega: "Saiu para entrega", Entregue: "Marcar como entregue" };
            const updateButton = currentUser.tipoConta === "Entregador" && nextStatus
                ? '<button class="botao botao-outline pedido-update-botao" data-pedido-id="' + order.id + '" data-proxima-etapa="' + nextStatus + '" type="botao">' + statusLabels[nextStatus] + '</button>'
                : "";
            return '<article class="itemSacola-pedido"><div class="topo-itemSacola-pedido"><span>Pedido #' + order.id + '</span><span class="situacao-pedido">' + formatStatus(order.status) + '</span></div>' +
                '<p>' + items + '<br>Total: <strong>' + money(order.total) + '</strong></p>' + updateButton + '</article>';
        }).join("") + '</div>' : '<p class="mensagem-retorno">Nenhum pedido encontrado por enquanto.</p>';

        $$(".order-update-botao", target).forEach(button => button.addEventListener("click", async () => {
            try {
                await apiRequest("/pedido/" + button.dataset.pedidoId + "/etapaPedido", {
                    method: "PUT",
                    body: { entregadorId: currentUser.id, status: button.dataset.proximaEtapa }
                });
                showToast("Etapa do pedido atualizada.");
                loadAccountOrders();
            } catch (error) { showToast(error.message); }
        }));
    } catch (error) {
        target.innerHTML = '<p class="feedback erro">' + escapeHtml(error.message) + '</p>';
    }
}

function formatStatus(status) {
    return ({
        Recebido: "Recebido",
        EmPreparacao: "Em preparação",
        SaiuParaEntrega: "Saiu para entrega",
        Entregue: "Entregue"
    })[status] || status;
}

async function checkout() {
    if (!currentUser || currentUser.tipoConta !== "Cliente") {
        closePanels();
        openAccount();
        showAuthMessage("Entre como cliente para finalizar seu pedido.");
        return;
    }
    if (!(cartData.itens || []).length) {
        showToast("Sua sacola ainda está vazia.");
        return;
    }
    const button = $("#botao-finalizar-pedido");
    button.disabled = true;
    button.textContent = "Enviando pedido...";
    try {
        const order = await apiRequest("/pedido/" + currentUser.id, { method: "POST" });
        await loadCart();
        showToast("Pedido #" + order.id + " recebido! Obrigado pela preferência.");
        closePanels();
        openAccount();
        loadAccountOrders();
    } catch (error) {
        showToast(error.message);
    } finally {
        button.disabled = false;
        button.textContent = "Finalizar pedido";
    }
}

function setupRevealAnimations() {
    const elements = $$(".reveal");
    if (!("IntersectionObserver" in window)) {
        elements.forEach(element => element.classList.add("esta-visivel"));
        return;
    }
    const observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add("esta-visivel");
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.12 });
    elements.forEach(element => observer.observe(element));
}

function setupEvents() {
    $("#botao-conta").addEventListener("click", openAccount);
    $("#botao-sacola").addEventListener("click", openCart);
    $("#fechar-sacola").addEventListener("click", closePanels);
    $("#fechar-conta").addEventListener("click", closePanels);
    overlay.addEventListener("click", closePanels);
    $("#botao-finalizar-pedido").addEventListener("click", checkout);
    $("#botao-menu-celular").addEventListener("click", () => {
        const button = $("#botao-menu-celular");
        const open = button.getAttribute("aria-expanded") !== "true";
        button.setAttribute("aria-expanded", String(open));
        button.setAttribute("aria-label", open ? "Fechar menu" : "Abrir menu");
        $("#navegacao-principal").classList.toggle("aberto", open);
    });
    $$("#navegacao-principal a").forEach(link => link.addEventListener("click", () => {
        $("#navegacao-principal").classList.remove("aberto");
        $("#botao-menu-celular").setAttribute("aria-expanded", "false");
        $("#botao-menu-celular").setAttribute("aria-label", "Abrir menu");
    }));
    $("#filtros-categorias").addEventListener("click", event => {
        const button = event.target.closest("[dadosResposta-categoria]");
        if (!button) return;
        selectedCategory = button.dataset.categoria;
        $$(".category-aba").forEach(tab => tab.classList.toggle("ativo", tab === button));
        renderProducts();
    });
    document.addEventListener("keydown", event => {
        if (event.key === "Escape") closePanels();
    });
}

$("#ano-atual").textContent = new Date().getFullYear();
setupEvents();
setupRevealAnimations();
loadProducts();