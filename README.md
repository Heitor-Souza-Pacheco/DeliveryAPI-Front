# Donut Show - Loja de Donuts

Interface de uma loja artesanal de donuts, desenvolvida com **HTML, CSS e JavaScript puro** e integrada a uma API feita com ASP.NET Core.

## Identidade visual

A página utiliza o banner e as fotografias da pasta `images/`. A paleta de cores combina tons de creme, chocolate e caramelo. O visual foi pensado para transmitir o cuidado de uma loja artesanal.

## Tecnologias utilizadas

- HTML5
- CSS3
- JavaScript
- API REST com ASP.NET Core

O projeto não utiliza React, Tailwind, TypeScript ou bibliotecas de interface.

## Estrutura de pastas

```text
DeliveryAPI-Front/
|-- index.html
|-- css/
|   |-- style.css
|-- js/
|   |-- app.js
|-- images/
|   |-- banner.jpg
|   |-- donut1.jpg
|   |-- donut2.jpg
|   |-- donut3.jpg
|   |-- donut4.jpg
|   |-- donut5.jpg
|-- README.md
```

## Como executar no computador

1. Inicie a API na porta `http://localhost:5295`.
2. Abra a pasta do projeto no Visual Studio Code.
3. Abra o arquivo `index.html) com a extensão Live Server.
4. Acesse o endereço local mostrado pela extensao.

A constante `API_URL`, no inicio de `js/app.js`, aponta para `http://localhost:5295/api`. Altere esse endereco caso a API esteja usando outra porta.

## Configuração de acesso entre a pagina e a API

A API precisa permitir o acesso a partir do endereco usado pela extensao Live Server. No arquivo `Program.cs`, configure uma política de CORS antes de `builder.Build()`:

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

Se a extensao usar outra porta, inclua o novo endereco em `WithOrigins`.

## Recursos do projeto

### Loja
- Banner principal da marca.
- Produtos em destaque e cardápio completo.
- Filtros por categoria.
- Apresentação da loja e explicacao de como fazer um pedido.
- Pagina adaptada para celulares, tablets e computadores.

### Area do cliente
- Cadastro e acesso a conta.
- Consulta dos produtos pela API.
- Adição, alteracao de quantidade e remocao de produtos da sacola.
- Finalizacao de pedidos.
- Consulta dos pedidos e de suas etapas.

### Area do entregador
- Acesso com uma conta de entregador.
- Consulta dos pedidos.
- Atualização das etapas: Recebido, Em preparação, Saiu para entrega e Entregue.

## Rotas utilizadas

| Método | Rota | Finalidade |
|---|---|---|
| POST | `/api/usuario` | Cadastro |
| POST | `/api/usuario/login` | Acesso a conta |
| GET | `/api/produto` | Listagem de produtos |
| GET | `/api/carrinho/{usuarioId}` | Consulta da sacola |
| POST | `/api/carrinho/{usuarioId}/itens` | Adição de produto |
| PUT | `/api/carrinho/{usuarioId}/itens/{produtoId}` | Alteracao de quantidade |
| DELETE | `/api/carrinho/{usuarioId}/itens/{produtoId}` | Remocao de produto |
| POST | `/api/pedido/{clienteId}` | Criacao de pedido |
| GET | `/api/pedido/cliente/{clienteId}` | Consulta dos pedidos do cliente |
| GET | `/api/pedido/entregador/{entregadorId}` | Consulta dos pedidos do entregador |
| PUT | `/api/pedido/{pedidoId}/status` | Atualizacao da etapa do pedido |

## Observações

- Os nomes e os precos dos produtos são carregados pela API. As fotografias locais sao associadas aos identificadores dos produtos.
- O acesso a conta fica guardado apenas enquanto a pagina esta aberta. Ao atualizar a pagina, será necessário entrar novamente.
- O servidor atual utiliza armazenamento temporario em memoria. Ao reiniciar a API, os dados podem ser apagados.
- O projeto ainda não possui pagamento pela internet, calculo de taxa de entrega ou autenticacao por token.
- O depoimento apresentado é apenas um exemplo e deve ser substituido por uma avaliação real.
- Os dados de contato e os horários apresentados sao exemplos e devem ser atualizados pela loja.
