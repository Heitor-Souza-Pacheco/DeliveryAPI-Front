const API_URL = "http://localhost:5295/api";

const authView = document.querySelector("#auth-view");
const appView = document.querySelector("#app-view");
const content = document.querySelector("#content");
const appMessage = document.querySelector("#app-message");
const authMessage = document.querySelector("#auth-message");
const loginForm = document.querySelector("#login-form");
const registerForm = document.querySelector("#register-form");
const logoutButton = document.querySelector("#logout-button");
const mainNav = document.querySelector("#main-nav");

let currentUser = null;
let currentSection = "catalog";

function showMessage(element, message, type = "") {
  element.textContent = message;
  element.className = `feedback ${type}`;
}

async function apiRequest(path, options = {}) {
  const config = {
    method: options.method || "GET",
    headers: { "Content-Type": "application/json", ...(options.headers || {}) }
  };
  if (options.body !== undefined) config.body = JSON.stringify(options.body);

  const response = await fetch(`${API_URL}${path}`, config);
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }

  if (!response.ok) {
    const message = typeof data === "string" ? data : data?.mensagem || data?.title || data?.message || "Não foi possível concluir a operação.";
    throw new Error(message);
  }
  return data;
}

function setAuthTab(tab) {
  document.querySelectorAll("[data-auth-tab]").forEach(button => {
    button.classList.toggle("active", button.dataset.authTab === tab);
  });
  loginForm.classList.toggle("hidden", tab !== "login");
  registerForm.classList.toggle("hidden", tab !== "register");
  showMessage(authMessage, "");
}

document.querySelectorAll("[data-auth-tab]").forEach(button => {
  button.addEventListener("click", () => setAuthTab(button.dataset.authTab));
});

loginForm.addEventListener("submit", async event => {
  event.preventDefault();
  const form = new FormData(loginForm);
  const payload = {
    email: form.get("email").trim(),
    senha: form.get("senha"),
    tipoConta: form.get("tipoConta")
  };

  try {
    const result = await apiRequest("/usuario/login", { method: "POST", body: payload });
    startSession(result.usuario);
  } catch (error) {
    showMessage(authMessage, error.message, "error");
  }
});

registerForm.addEventListener("submit", async event => {
  event.preventDefault();
  const form = new FormData(registerForm);
  const payload = {
    nome: form.get("nome").trim(),
    email: form.get("email").trim(),
    senha: form.get("senha"),
    tipoConta: form.get("tipoConta")
  };

  try {
    await apiRequest("/usuario", { method: "POST", body: payload });
    showMessage(authMessage, "Conta criada! Agora entre usando seu e-mail e senha.", "success");
    loginForm.elements.email.value = payload.email;
    loginForm.elements.senha.value = "";
    loginForm.elements.tipoConta.value = payload.tipoConta;
    setAuthTab("login");
    showMessage(authMessage, "Conta criada! Faça login para continuar.", "success");
  } catch (error) {
    showMessage(authMessage, error.message, "error");
  }
});

function startSession(user) {
  currentUser = user;
  authView.classList.add("hidden");
  appView.classList.remove("hidden");
  logoutButton.classList.remove("hidden");
  document.querySelector("#user-label").textContent = user.nome;
  document.querySelector("#welcome-title").textContent = `Olá, ${user.nome.split(" ")[0]}!`;
  const isCustomer = user.tipoConta === "Cliente";
  document.querySelector("#role-eyebrow").textContent = isCustomer ? "ÁREA DO CLIENTE" : "PAINEL DO ENTREGADOR";
  document.querySelector("#welcome-subtitle").textContent = isCustomer ? "O que vamos pedir hoje?" : "Acompanhe os pedidos disponíveis.";
  document.querySelector("#role-pill").textContent = user.tipoConta;
  buildNavigation();
  navigate(isCustomer ? "catalog" : "deliveries");
}

function endSession() {
  currentUser = null;
  appView.classList.add("hidden");
  authView.classList.remove("hidden");
  logoutButton.classList.add("hidden");
  document.querySelector("#user-label").textContent = "";
  content.innerHTML = "";
  loginForm.reset();
  setAuthTab("login");
}
logoutButton.addEventListener("click", endSession);

function buildNavigation() {
  const links = currentUser.tipoConta === "Cliente"
    ? [{ id: "catalog", label: "Produtos" }, { id: "cart", label: "Meu carrinho" }, { id: "orders", label: "Meus pedidos" }]
    : [{ id: "deliveries", label: "Pedidos disponíveis" }];
  mainNav.innerHTML = links.map(link => `<button class="nav-button" data-section="${link.id}" type="button">${link.label}</button>`).join("");
  mainNav.querySelectorAll("button").forEach(button => button.addEventListener("click", () => navigate(button.dataset.section)));
}

async function navigate(section) {
  currentSection = section;
  mainNav.querySelectorAll("button").forEach(button => button.classList.toggle("active", button.dataset.section === section));
  showMessage(appMessage, "");
  content.innerHTML = '<div class="empty-state">Carregando...</div>';
  try {
    if (section === "catalog") await renderCatalog();
    if (section === "cart") await renderCart();
    if (section === "orders") await renderCustomerOrders();
    if (section === "deliveries") await renderDeliveries();
  } catch (error) {
    content.innerHTML = '<div class="empty-state"><strong>Não foi possível carregar os dados.</strong>Verifique se a API está em execução e tente novamente.</div>';
    showMessage(appMessage, error.message, "error");
  }
}

function money(value) {
  return Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

async function renderCatalog() {
  const products = await apiRequest("/produto");
  content.innerHTML = `
    <div class="section-heading"><div><h2>Nosso catálogo</h2><p>Escolha seus produtos e adicione ao carrinho.</p></div></div>
    <div class="product-grid">${products.map(product => `
      <article class="product-card">
        <div class="product-icon">✦</div>
        <h3>${escapeHtml(product.nome)}</h3>
        <p>Produto disponível para pedido.</p>
        <div class="product-bottom"><span class="price">${money(product.preco)}</span>
          <button class="button button-primary button-small" data-add-product="${product.id}" type="button">Adicionar</button>
        </div>
      </article>`).join("")}</div>`;
  content.querySelectorAll("[data-add-product]").forEach(button => {
    button.addEventListener("click", async () => {
      try {
        await apiRequest(`/carrinho/${currentUser.id}/itens`, {
          method: "POST",
          body: { produtoId: Number(button.dataset.addProduct), quantidade: 1 }
        });
        showMessage(appMessage, "Produto adicionado ao carrinho.", "success");
      } catch (error) { showMessage(appMessage, error.message, "error"); }
    });
  });
}

async function renderCart() {
  const cart = await apiRequest(`/carrinho/${currentUser.id}`);
  const rows = (cart.itens || []).map(item => `
    <div class="cart-row">
      <div><h3>${escapeHtml(item.nome)}</h3><p>${money(item.precoUnitario)} por unidade</p></div>
      <div class="quantity-control">
        <input aria-label="Quantidade" type="number" min="1" max="99" value="${item.quantidade}" data-quantity="${item.produtoId}">
        <button class="button button-ghost button-small" data-update="${item.produtoId}" type="button">Atualizar</button>
        <button class="button button-danger button-small" data-remove="${item.produtoId}" type="button">Remover</button>
      </div>
    </div>`).join("");

  content.innerHTML = `
    <div class="section-heading"><div><h2>Meu carrinho</h2><p>Confira seus itens antes de finalizar.</p></div></div>
    ${rows || '<div class="empty-state"><strong>Seu carrinho está vazio.</strong>Explore os produtos para adicionar itens.</div>'}
    <div class="cart-summary"><span>Total do pedido</span><strong>${money(cart.total)}</strong></div>
    ${rows ? '<button id="checkout-button" class="button button-primary" style="margin-top:16px">Finalizar pedido</button>' : ''}
  `;

  content.querySelectorAll("[data-update]").forEach(button => button.addEventListener("click", async () => {
    const id = button.dataset.update;
    const quantity = Number(content.querySelector(`[data-quantity="${id}"]`).value);
    try {
      await apiRequest(`/carrinho/${currentUser.id}/itens/${id}`, { method: "PUT", body: { quantidade: quantity } });
      await renderCart();
      showMessage(appMessage, "Quantidade atualizada.", "success");
    } catch (error) { showMessage(appMessage, error.message, "error"); }
  }));

  content.querySelectorAll("[data-remove]").forEach(button => button.addEventListener("click", async () => {
    try {
      await apiRequest(`/carrinho/${currentUser.id}/itens/${button.dataset.remove}`, { method: "DELETE" });
      await renderCart();
      showMessage(appMessage, "Produto removido do carrinho.", "success");
    } catch (error) { showMessage(appMessage, error.message, "error"); }
  }));

  document.querySelector("#checkout-button")?.addEventListener("click", async () => {
    try {
      const order = await apiRequest(`/pedido/${currentUser.id}`, { method: "POST" });
      showMessage(appMessage, `Pedido #${order.id} realizado com sucesso!`, "success");
      await renderCart();
    } catch (error) { showMessage(appMessage, error.message, "error"); }
  });
}

async function renderCustomerOrders() {
  const orders = await apiRequest(`/pedido/cliente/${currentUser.id}`);
  renderOrderCards(orders, "Seus pedidos", "Acompanhe o andamento das suas compras.");
}

async function renderDeliveries() {
  const orders = await apiRequest(`/pedido/entregador/${currentUser.id}`);
  renderOrderCards(orders, "Pedidos disponíveis", "Atualize o status conforme cada etapa da entrega.", true);
}

function renderOrderCards(orders, title, subtitle, canUpdate = false) {
  content.innerHTML = `
    <div class="section-heading"><div><h2>${title}</h2><p>${subtitle}</p></div>
      <button id="refresh-orders" class="button button-ghost button-small" type="button">Atualizar</button>
    </div>
    ${orders.length ? `<div class="order-grid">${orders.map(order => `
      <article class="order-card">
        <div class="order-top"><span class="order-id">PEDIDO #${order.id}</span><span class="status">${formatStatus(order.status)}</span></div>
        <h3>${money(order.total)}</h3>
        <p>Cliente #${order.clienteId} · ${new Date(order.dataCriacao).toLocaleString("pt-BR")}</p>
        <div class="order-items">${order.itens.map(item => `${item.quantidade}x ${escapeHtml(item.nomeProduto)} — ${money(item.subtotal)}`).join("<br>")}</div>
        ${canUpdate ? renderStatusActions(order) : ""}
      </article>`).join("")}</div>` : '<div class="empty-state"><strong>Nenhum pedido por aqui.</strong>Quando houver pedidos, eles aparecerão nesta área.</div>'}`;
  document.querySelector("#refresh-orders").addEventListener("click", () => navigate(currentSection));
  if (canUpdate) {
    content.querySelectorAll("[data-next-status]").forEach(button => button.addEventListener("click", async () => {
      try {
        await apiRequest(`/pedido/${button.dataset.orderId}/status`, {
          method: "PUT",
          body: { entregadorId: currentUser.id, status: button.dataset.nextStatus }
        });
        showMessage(appMessage, "Status do pedido atualizado.", "success");
        await renderDeliveries();
      } catch (error) { showMessage(appMessage, error.message, "error"); }
    }));
  }
}

function renderStatusActions(order) {
  const next = { Recebido: "EmPreparacao", EmPreparacao: "SaiuParaEntrega", SaiuParaEntrega: "Entregue" }[order.status];
  if (!next) return "";
  const labels = { EmPreparacao: "Iniciar preparação", SaiuParaEntrega: "Saiu para entrega", Entregue: "Marcar como entregue" };
  return `<div class="status-actions"><button class="button button-primary button-small" data-order-id="${order.id}" data-next-status="${next}" type="button">${labels[next]}</button></div>`;
}

function formatStatus(status) {
  return ({ Recebido: "Recebido", EmPreparacao: "Em preparação", SaiuParaEntrega: "Saiu para entrega", Entregue: "Entregue" })[status] || status;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char]);
}

setAuthTab("login");