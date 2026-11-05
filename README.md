# Donut Show — Delivery de Donuts

Frontend de uma loja artesanal de donuts, desenvolvido com **HTML, CSS e JavaScript puro**, integrado à API ASP.NET Core do projeto [DeliveryAPI](https://github.com/Heitor-Souza-Pacheco/DeliveryAPI).

## Identidade visual

A interface usa como referência o banner e as fotografias presentes em `images/`, com uma paleta de creme, chocolate, caramelo e tons quentes. O layout é responsivo e prioriza uma apresentação acolhedora de loja artesanal.

## Tecnologias

- HTML5 semântico
- CSS3 (responsivo, animações leves e respeito a `prefers-reduced-motion`)
- JavaScript moderno e Fetch API
- API REST em ASP.NET Core

Não utiliza React, Tailwind, TypeScript ou bibliotecas de interface.

## Estrutura

```text
DeliveryAPI-Front/
├── index.html
├── css/
│   └── style.css
├── js/
│   └── app.js
├── images/
│   ├── banner.jpg
│   ├── donut1.jpg
│   ├── donut2.jpg
│   ├── donut3.jpg
│   ├── donut4.jpg
│   └── donut5.jpg
└── README.md
```

## Executar localmente

1. Inicie a API DeliveryAPI na porta `http://localhost:5295`.
2. Abra a pasta do frontend no VS Code.
3. Inicie o `index.html` com Live Server.
4. Acesse o endereço local exibido pela extensão.

A constante `API_URL` no início de `js/app.js` aponta para `http://localhost:5295/api`. Altere-a caso a API esteja em outra porta.

## CORS

A API precisa permitir a origem usada pelo Live Server. No `Program.cs`, configure uma política CORS antes de `builder.Build()`:

```csharp
builder.Services.AddCors(options =>
{
    options.AddPolicy("FrontendPolicy", policy =>
    {
        policy
            .WithOrigins("http://127.0.0.1:5500", "http://localhost:5500")
            .AllowAnyHeader()
            .AllowAnyMethod();
    });
});
```

Depois de `var app = builder.Build();` e antes de `app.MapControllers();`:

```csharp
app.UseCors("FrontendPolicy");
```

Se o Live Server usar outra porta, adicione a origem correspondente em `WithOrigins`.

## Funcionalidades

### Loja
- Hero com o banner da marca.
- Seção de produtos em destaque e cardápio completo.
- Filtros por categoria.
- Apresentação institucional, etapas de compra e área de depoimento.
- Layout adaptado para celular, tablet e desktop.

### Cliente
- Cadastro e login.
- Catálogo carregado pela API.
- Adição, alteração de quantidade e remoção de itens do carrinho.
- Finalização do pedido.
- Consulta do histórico e status dos pedidos.

### Entregador
- Login com tipo de conta Entregador.
- Consulta dos pedidos disponíveis.
- Atualização do status: Recebido → Em preparação → Saiu para entrega → Entregue.

## Endpoints utilizados

| Método | Endpoint | Uso |
|---|---|---|
| POST | `/api/usuario` | Cadastro |
| POST | `/api/usuario/login` | Login |
| GET | `/api/produto` | Catálogo |
| GET | `/api/carrinho/{usuarioId}` | Consultar carrinho |
| POST | `/api/carrinho/{usuarioId}/itens` | Adicionar item |
| PUT | `/api/carrinho/{usuarioId}/itens/{produtoId}` | Alterar quantidade |
| DELETE | `/api/carrinho/{usuarioId}/itens/{produtoId}` | Remover item |
| POST | `/api/pedido/{clienteId}` | Criar pedido |
| GET | `/api/pedido/cliente/{clienteId}` | Pedidos do cliente |
| GET | `/api/pedido/entregador/{entregadorId}` | Pedidos do entregador |
| PUT | `/api/pedido/{pedidoId}/status` | Atualizar status |

## Observações

- O catálogo e os preços exibidos vêm da API. As imagens locais são associadas aos IDs dos produtos para apresentação visual.
- A sessão fica em memória no navegador e termina ao atualizar a página.
- O backend acadêmico atual utiliza armazenamento temporário em memória; reiniciar a API pode apagar os dados.
- O projeto ainda não implementa pagamento online, cálculo de frete ou autenticação por token.
- O texto de depoimento é demonstrativo e deve ser substituído por avaliações reais antes de uso comercial.
- Os dados de contato e horários no rodapé são exemplos e devem ser atualizados pela loja.
