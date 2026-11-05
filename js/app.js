const API_URL = "http://localhost:5295/api";
const IMAGE_BY_ID = { 1: "donut1.jpg", 2: "donut2.jpg", 3: "donut3.jpg", 4: "donut4.jpg", 5: "donut5.jpg" };
const DESCRIPTION_BY_ID = {
    1: "Cobertura delicada e confeitos coloridos para deixar o dia mais alegre.",
    2: "Chocolate cremoso e uma massa macia que combina com qualquer pausa.",
    3: "O clássico de açúcar, leve, fofinho e cheio de carinho.",
    4: "Uma camada generosa de chocolate para quem ama esse sabor.",
    5: "Um abraço de chocolate em forma de donut."
};
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const featuredProducts = $("#featured-products");
const menuProducts = $("#menu-products");
const cartDrawer = $("#cart-drawer");
const accountModal = $("#account-modal");
const overlay = $("#overlay");
const toast = $("#toast");
const authMessage = $("#auth-message");

let products = [];
let currentUser = null;
let selectedCategory = "Todos";
let cartData = { itens: [], total: 0 };
let toastTimer;

function money(value) {
    return Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
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
    return '<article class="product-card">' +
        '<div class="product-image-wrap"><img src="' + imageFor(product) + '" alt="' + escapeHtml(product.nome) + '" loading="lazy">' +
        '<span class="product-tag">' + (featured ? "QUERIDINHO DA CASA" : escapeHtml(category.toUpperCase())) + '</span></div>' +
        '<div class="product-info"><h3>' + escapeHtml(product.nome) + '</h3><p>' + escapeHtml(descriptionFor(product)) + '</p>' +
        '<div class="product-bottom"><span class="product-price">' + money(product.preco) + '</span>' +
        '<button class="add-button" type="button" data-add-product="' + Number(product.id) + '" aria-label="Adicionar produto à sacola">Adicionar</button></div></div></article>';
}

function renderProducts() {
    if (!products.length) {
        const empty = '<div class="catalog-error">Nosso cardápio está sendo preparado. Tente novamente em instantes.</div>';
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
        : '<div class="catalog-error">Ainda não temos donuts nesta categoria. Experimente outra seleção.</div>';

    $$("[data-add-product]").forEach(button => {
        button.addEventListener("click", () => addToCart(Number(button.dataset.addProduct)));
    });
}

async function loadProducts() {
    try {
        products = await apiRequest("/produto");
        renderProducts();
    } catch (error) {
        featuredProducts.innerHTML = '<div class="catalog-error">' + escapeHtml(error.message) + '</div>';
        menuProducts.innerHTML = '<div class="catalog-error">' + escapeHtml(error.message) + '</div>';
    }
}

function showToast(message) {
    toast.textContent = message;
    toast.classList.add("visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("visible"), 2600);
}

function updateCartBadge(cart = cartData) {
    const count = (cart.itens || []).reduce((sum, item) => sum + Number(item.quantidade || 0), 0);
    $("#cart-count").textContent = count;
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
        const button = document.querySelector('[data-add-product="' + productId + '"]');
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
    $("#cart-items").innerHTML = items.length ? items.map(item => {
        const product = products.find(entry => Number(entry.id) === Number(item.produtoId));
        const image = product ? imageFor(product) : "images/donut3.jpg";
        return '<article class="cart-row"><img src="' + image + '" alt="" loading="lazy"><div>' +
            '<h3>' + escapeHtml(item.nome) + '</h3><p>' + money(item.precoUnitario) + ' por unidade</p>' +
            '<div class="cart-row-bottom"><div class="quantity-control">' +
            '<button type="button" data-quantity-change="-1" data-product-id="' + item.produtoId + '" aria-label="Diminuir quantidade">Menos</button>' +
            '<span>' + Number(item.quantidade) + '</span>' +
            '<button type="button" data-quantity-change="1" data-product-id="' + item.produtoId + '" aria-label="Aumentar quantidade">Mais</button>' +
            '</div><strong>' + money(Number(item.precoUnitario) * Number(item.quantidade)) + '</strong></div>' +
            '<button class="remove-item" type="button" data-remove-item="' + item.produtoId + '">Remover</button></div></article>';
    }).join("") : '<div class="empty-cart">Sua sacola está esperando por coisas gostosas.<br>Escolha seus donuts favoritos no cardápio!</div>';

    $("#cart-total").textContent = money(cartData.total);
    $$("[data-quantity-change]").forEach(button => button.addEventListener("click", () => {
        const row = items.find(item => Number(item.produtoId) === Number(button.dataset.productId));
        if (row) changeQuantity(Number(row.produtoId), Number(row.quantidade) + Number(button.dataset.quantityChange));
    }));
    $$("[data-remove-item]").forEach(button => button.addEventListener("click", () => removeFromCart(Number(button.dataset.removeItem))));
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
    overlay.classList.add("visible");
    document.body.classList.add("no-scroll");
}

function closePanels() {
    cartDrawer.classList.remove("open");
    accountModal.classList.remove("open");
    overlay.classList.remove("visible");
    cartDrawer.setAttribute("aria-hidden", "true");
    accountModal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("no-scroll");
}

function openCart() {
    closePanels();
    openOverlay();
    cartDrawer.classList.add("open");
    cartDrawer.setAttribute("aria-hidden", "false");
    if (currentUser?.tipoConta === "Cliente") loadCart().catch(error => showToast(error.message));
}

function openAccount() {
    closePanels();
    openOverlay();
    accountModal.classList.add("open");
    accountModal.setAttribute("aria-hidden", "false");
    if (currentUser) renderAccountHome();
    else showAuthForms();
}

function showAuthMessage(message, type = "") {
    authMessage.textContent = message;
    authMessage.className = "feedback " + type;
}

function showAuthForms(tab = "login") {
    $("#account-modal-title").textContent = tab === "login" ? "Entre na sua conta" : "Vamos criar sua conta?";
    $("#account-content").innerHTML =
        '<div class="auth-tabs"><button class="auth-tab ' + (tab === "login" ? "active" : "") + '" data-auth-tab="login" type="button">Entrar</button>' +
        '<button class="auth-tab ' + (tab === "register" ? "active" : "") + '" data-auth-tab="register" type="button">Criar conta</button></div>' +
        '<form id="login-form" class="form-stack ' + (tab === "register" ? "hidden" : "") + '">' +
        '<label for="login-email">E-mail</label><input id="login-email" name="email" type="email" placeholder="voce@email.com" autocomplete="email" required>' +
        '<label for="login-password">Senha</label><input id="login-password" name="senha" type="password" placeholder="Sua senha" autocomplete="current-password" required>' +
        '<label for="login-type">Tipo de conta</label><select id="login-type" name="tipoConta"><option value="Cliente">Cliente</option><option value="Entregador">Entregador</option></select>' +
        '<button class="button button-primary" type="submit">Entrar</button></form>' +
        '<form id="register-form" class="form-stack ' + (tab === "login" ? "hidden" : "") + '">' +
        '<label for="register-name">Seu nome</label><input id="register-name" name="nome" type="text" placeholder="Como podemos te chamar?" autocomplete="name" required>' +
        '<label for="register-email">E-mail</label><input id="register-email" name="email" type="email" placeholder="voce@email.com" autocomplete="email" required>' +
        '<label for="register-password">Senha</label><input id="register-password" name="senha" type="password" placeholder="Crie uma senha" autocomplete="new-password" required>' +
        '<label for="register-type">Tipo de conta</label><select id="register-type" name="tipoConta"><option value="Cliente">Cliente</option><option value="Entregador">Entregador</option></select>' +
        '<button class="button button-primary" type="submit">Criar minha conta</button></form>';
    showAuthMessage("");
    $("#account-content").addEventListener("click", event => {
        const tabButton = event.target.closest("[data-auth-tab]");
        if (tabButton) showAuthForms(tabButton.dataset.authTab);
    });
    $("#login-form").addEventListener("submit", handleLogin);
    $("#register-form").addEventListener("submit", handleRegister);
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
    } catch (error) { showAuthMessage(error.message, "error"); }
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
        $("#login-email").value = payload.email;
        $("#login-type").value = payload.tipoConta;
        showAuthMessage("Conta criada! Agora entre com seu e-mail e senha.", "success");
    } catch (error) { showAuthMessage(error.message, "error"); }
}

function startSession(user) {
    currentUser = user;
    $("#account-label").textContent = user.nome.split(" ")[0];
    closePanels();
    if (user.tipoConta === "Cliente") loadCart().catch(error => showToast(error.message));
}

function endSession() {
    currentUser = null;
    cartData = { itens: [], total: 0 };
    $("#account-label").textContent = "Entrar";
    updateCartBadge();
    showToast("Você saiu da sua conta.");
    closePanels();
}

function renderAccountHome() {
    const isCliente = currentUser.tipoConta === "Cliente";
    $("#account-modal-title").textContent = "Olá, " + currentUser.nome.split(" ")[0] + "!";
    $("#account-content").innerHTML =
        '<p class="account-welcome">' + (isCliente
            ? "Que bom ter você por aqui. Acompanhe seus pedidos ou continue escolhendo seus favoritos."
            : "Aqui estão os pedidos que precisam de acompanhamento.") + '</p>' +
        '<div class="account-actions"><button class="button button-primary" id="account-orders" type="button">' +
        (isCliente ? "Acompanhar meus pedidos" : "Ver pedidos para entrega") +
        '</button><button class="button button-outline" id="logout-button" type="button">Sair da conta</button></div>' +
        '<div id="account-orders-list"></div>';
    $("#account-orders").addEventListener("click", loadAccountOrders);
    $("#logout-button").addEventListener("click", endSession);
}

async function loadAccountOrders() {
    const target = $("#account-orders-list");
    target.innerHTML = '<p class="feedback">Buscando seus pedidos...</p>';
    try {
        const path = currentUser.tipoConta === "Cliente"
            ? "/pedido/cliente/" + currentUser.id
            : "/pedido/entregador/" + currentUser.id;
        const orders = await apiRequest(path);
        target.innerHTML = orders.length ? '<div class="order-list">' + orders.map(order => {
            const items = (order.itens || []).map(item => item.quantidade + "x " + escapeHtml(item.nomeProduto)).join(", ");
            const nextStatus = { Recebido: "EmPreparacao", EmPreparacao: "SaiuParaEntrega", SaiuParaEntrega: "Entregue" }[order.status];
            const statusLabels = { EmPreparacao: "Iniciar preparação", SaiuParaEntrega: "Saiu para entrega", Entregue: "Marcar como entregue" };
            const updateButton = currentUser.tipoConta === "Entregador" && nextStatus
                ? '<button class="button button-outline order-update-button" data-order-id="' + order.id + '" data-next-status="' + nextStatus + '" type="button">' + statusLabels[nextStatus] + '</button>'
                : "";
            return '<article class="order-item"><div class="order-item-top"><span>Pedido #' + order.id + '</span><span class="order-status">' + formatStatus(order.status) + '</span></div>' +
                '<p>' + items + '<br>Total: <strong>' + money(order.total) + '</strong></p>' + updateButton + '</article>';
        }).join("") + '</div>' : '<p class="feedback">Nenhum pedido encontrado por enquanto.</p>';

        $$(".order-update-button", target).forEach(button => button.addEventListener("click", async () => {
            try {
                await apiRequest("/pedido/" + button.dataset.orderId + "/status", {
                    method: "PUT",
                    body: { entregadorId: currentUser.id, status: button.dataset.nextStatus }
                });
                showToast("Etapa do pedido atualizada.");
                loadAccountOrders();
            } catch (error) { showToast(error.message); }
        }));
    } catch (error) {
        target.innerHTML = '<p class="feedback error">' + escapeHtml(error.message) + '</p>';
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
    const button = $("#checkout-button");
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
        elements.forEach(element => element.classList.add("is-visible"));
        return;
    }
    const observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add("is-visible");
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.12 });
    elements.forEach(element => observer.observe(element));
}

function setupEvents() {
    $("#account-button").addEventListener("click", openAccount);
    $("#cart-button").addEventListener("click", openCart);
    $("#close-cart").addEventListener("click", closePanels);
    $("#close-account").addEventListener("click", closePanels);
    overlay.addEventListener("click", closePanels);
    $("#checkout-button").addEventListener("click", checkout);
    $("#mobile-menu-button").addEventListener("click", () => {
        const button = $("#mobile-menu-button");
        const open = button.getAttribute("aria-expanded") !== "true";
        button.setAttribute("aria-expanded", String(open));
        button.setAttribute("aria-label", open ? "Fechar menu" : "Abrir menu");
        $("#main-navigation").classList.toggle("open", open);
    });
    $$("#main-navigation a").forEach(link => link.addEventListener("click", () => {
        $("#main-navigation").classList.remove("open");
        $("#mobile-menu-button").setAttribute("aria-expanded", "false");
        $("#mobile-menu-button").setAttribute("aria-label", "Abrir menu");
    }));
    $("#category-tabs").addEventListener("click", event => {
        const button = event.target.closest("[data-category]");
        if (!button) return;
        selectedCategory = button.dataset.category;
        $$(".category-tab").forEach(tab => tab.classList.toggle("active", tab === button));
        renderProducts();
    });
    document.addEventListener("keydown", event => {
        if (event.key === "Escape") closePanels();
    });
}

$("#current-year").textContent = new Date().getFullYear();
setupEvents();
setupRevealAnimations();
loadProducts();