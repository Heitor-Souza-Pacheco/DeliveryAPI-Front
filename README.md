# DeliveryAPI-Front

Frontend do projeto Delivery App, desenvolvido com **HTML, CSS e JavaScript puro**, integrado à API ASP.NET Core do repositório [DeliveryAPI](https://github.com/Heitor-Souza-Pacheco/DeliveryAPI).

## Tecnologias

- HTML5
- CSS3
- JavaScript (Fetch API)
- API REST em ASP.NET Core

Não utiliza React, TypeScript, frameworks CSS ou bibliotecas externas de interface.

## Estrutura

```text
DeliveryAPI-Front/
├── index.html
├── css/
│   └── style.css
├── js/
│   └── app.js
└── README.md
```

## Executar

1. Clone o repositório.
2. Inicie a API DeliveryAPI na porta `http://localhost:5295`.
3. Abra o frontend com uma extensão de servidor local, como Live Server (VS Code).
4. Acesse o endereço local exibido pela extensão.

O frontend está configurado para consumir `http://localhost:5295/api`. Se a API estiver em outra porta, altere a constante `API_URL` no início de `js/app.js`.

## CORS

Como o frontend e a API são executados em origens diferentes, habilite CORS no projeto ASP.NET Core.

No `Program.cs`, antes de `var app = builder.Build();`, adicione:

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

Depois de `var app = builder.Build();` e antes de `app.MapControllers();`, adicione:

```csharp
app.UseCors("FrontendPolicy");
```

Se o Live Server usar outra porta, inclua a origem correspondente em `WithOrigins`.

## Funcionalidades

### Cliente
- Cadastro e login com seleção do tipo de conta.
- Visualização do catálogo.
- Adição, alteração e remoção de itens do carrinho.
- Finalização de pedido.
- Consulta dos próprios pedidos e status.

### Entregador
- Login como entregador.
- Visualização dos pedidos disponíveis.
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

- O projeto utiliza os endpoints e os formatos de dados definidos pela API atual.
- A sessão fica apenas em memória no navegador e é encerrada ao atualizar a página.
- O backend escolar atual utiliza armazenamento temporário em memória; reiniciar a API pode apagar os dados cadastrados.
- Este projeto é acadêmico e não implementa autenticação por token ou armazenamento seguro de credenciais no navegador.
