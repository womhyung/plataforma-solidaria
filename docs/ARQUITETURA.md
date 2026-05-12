# Arquitetura da Plataforma Solidária

## 📋 Visão Geral

A **Plataforma Solidária** é um sistema web inteligente desenvolvido com:
- **Backend**: Node.js + Express.js + MongoDB (NoSQL)
- **Frontend**: React + Vite + Tailwind CSS
- **Banco de Dados**: MongoDB com Mongoose ODM

---

## 🗄️ Modelos de Dados (MongoDB)

### 1. **Usuario**
Usuário base do sistema com autenticação JWT.

**Campos principais:**
- `nome`: String (obrigatório)
- `email`: String (único, obrigatório)
- `senha`: String (hasheada com bcryptjs)
- `tipo`: Enum ['doador', 'instituicao', 'admin']
- `telefone`: String
- `cpfOuCnpj`: String (único)
- `ativo`: Boolean
- `criadoEm`, `atualizadoEm`: Timestamps

**Relacionamentos:**
- Pode ter 1 Doador OU 1 Instituição (através de referência)

---

### 2. **Doador**
Supermercados, restaurantes, feiras, produtores rurais.

**Campos principais:**
- `usuario`: ObjectId (ref Usuario)
- `tipo`: Enum ['supermercado', 'restaurante', 'feira', 'produtor']
- `nomeEmpreza`: String
- `endereco`: Embedded Object com rua, número, bairro, cidade, estado, CEP
- `localizacao`: GeoJSON (2dsphere index) para queries geoespaciais
- `horarioFuncionamento`: Object com dias da semana
- `telefoneComercial`, `website`, `redes_sociais`
- `avaliacaoMedia`: Number (0-5)
- `totalAvaliacoes`: Number
- `ativo`: Boolean

**Índices:**
- `2dsphere` em `localizacao` para buscas por proximidade

**Relacionamentos:**
- 1:1 com Usuario
- 1:N com Alimento
- 1:N com Entrega

---

### 3. **Instituicao**
ONGs, abrigos, creches, asilos, comunidades, escolas, hospitais.

**Campos principais:**
- `usuario`: ObjectId (ref Usuario)
- `tipo`: Enum ['ong', 'abrigo', 'creche', 'asilo', 'comunidade', 'escola', 'hospital']
- `nomeOrgao`: String
- `endereco`: Embedded Object
- `localizacao`: GeoJSON (2dsphere index)
- `capacidadeBeneficiarios`: Number
- `beneficiarioAtual`: Number
- `cnpj`: String (único)
- `certificacoes`: Array
- `documentacoes`: Object com URLs de arquivos
- `avaliacaoMedia`: Number (0-5)

**Índices:**
- `2dsphere` em `localizacao`

**Relacionamentos:**
- 1:1 com Usuario
- 1:N com Entrega

---

### 4. **Alimento**
Produtos disponíveis para doação.

**Campos principais:**
- `doador`: ObjectId (ref Doador)
- `nome`: String
- `categoria`: Enum ['frutas', 'legumes', 'laticinios', 'pao', 'proteina', 'bebida', 'congelado', 'enlatado', 'outro']
- `quantidade`: Number
- `unidade`: Enum ['kg', 'litro', 'unidade', 'caixa', 'maco', 'pote']
- `dataValidade`: Date (validada automaticamente)
- `condicao`: Enum ['excelente', 'bom', 'aceitavel']
- `status`: Enum ['disponivel', 'comprometido', 'entregue', 'descartado', 'expirado']
- `localizacao`: GeoJSON (2dsphere index)
- `fotos`: Array de URLs
- `observacoes`: String

**Validações:**
- Middleware pre-save verifica validade e atualiza status para 'expirado'

**Índices:**
- `2dsphere` em `localizacao`

**Relacionamentos:**
- N:1 com Doador
- 1:1 com Entrega

---

### 5. **Entrega**
Histórico e rastreamento de entregas.

**Campos principais:**
- `alimento`: ObjectId (ref Alimento)
- `doador`: ObjectId (ref Doador)
- `instituicao`: ObjectId (ref Instituicao)
- `status`: Enum ['pendente', 'confirmada', 'em_transito', 'entregue', 'cancelada', 'rejeitada']
- `dataAgendada`: Date
- `dataColeta`: Date
- `dataEntrega`: Date
- `motorista`: Object com nome, telefone, veículo, placa, RG
- `assinatura`: Object com responsável, data, URL
- `fotosEntrega`: Array de URLs
- `motivoCancelamento`: String
- `motivoRejeicao`: String
- `quantidadeRecebida`: Number

**Relacionamentos:**
- N:1 com Alimento
- N:1 com Doador
- N:1 com Instituicao
- 1:N com Avaliacao

---

### 6. **Avaliacao**
Ratings e feedbacks do sistema.

**Campos principais:**
- `usuario`: ObjectId (ref Usuario)
- `doador`: ObjectId (ref Doador) - opcional
- `instituicao`: ObjectId (ref Instituicao) - opcional
- `entrega`: ObjectId (ref Entrega) - opcional
- `nota`: Number (1-5, obrigatório)
- `titulo`: String
- `comentario`: String (máx 500 caracteres)
- `aspectosAvaliados`: Object com qualidade, pontualidade, profissionalismo
- `recomenda`: Boolean
- `resposta`: Object com texto, data, usuarioResposta

**Validação:**
- Middleware garante que pelo menos `doador` ou `instituicao` estejam preenchidos

**Índices:**
- `doador`, `instituicao`, `usuario`, `criadoEm`

**Relacionamentos:**
- N:1 com Usuario
- N:1 com Doador
- N:1 com Instituicao
- N:1 com Entrega

---

## 📊 Fluxo de Dados

### Caso de Uso: Doação de Alimento

```
1. Doador cria conta (Usuario)
2. Doador cadastra empresa (Doador)
3. Doador publica alimento (Alimento)
   ├─ Sistema valida data de validade
   ├─ Sistema indexa localização (2dsphere)
   └─ Alimento fica visível no mapa
4. Instituição vê alimento disponível
5. Instituição confirma interesse (Entrega criada com status='pendente')
6. Doador confirma entrega (status='confirmada')
7. Entrega agendada (dataAgendada preenchida)
8. Motorista realiza coleta (dataColeta preenchida)
9. Motorista realiza entrega (dataEntrega preenchida, status='entregue')
10. Usuários avaliam entrega (Avaliacao criada)
11. Avaliação atualiza avaliacaoMedia e totalAvaliacoes
```

---

## 🗺️ Geolocalização (2dsphere)

MongoDB suporta queries geoespaciais com índices 2dsphere.

**Exemplo - Buscar alimentos a 5km de distância:**
```javascript
db.alimentos.find({
  localizacao: {
    $near: {
      $geometry: {
        type: "Point",
        coordinates: [-46.6333, -23.5505] // São Paulo
      },
      $maxDistance: 5000 // 5km em metros
    }
  }
})
```

---

## 🔐 Segurança

### Autenticação
- **JWT (JSON Web Tokens)** para autenticação stateless
- **bcryptjs** para hashing de senhas (10 rounds de salt)
- Token incluído em headers: `Authorization: Bearer <token>`

### Validação
- **express-validator** para validação de inputs
- Sanitização automática de dados
- Validações no schema Mongoose

---

## ⚖️ MongoDB vs Relacional

### Vantagens do MongoDB (Nosso projeto)

| Aspecto | MongoDB | Relacional |
|--------|---------|-----------|
| **Flexibilidade** | Schemas dinâmicos | Schemas rígidos |
| **Escalabilidade** | Horizontal (sharding) | Vertical |
| **Geolocalização** | 2dsphere integrado | Requer extensões |
| **Documentos** | JSON-like, aninhados | Tabelas separadas, joins |
| **Performance (leitura)** | Rápido em leitura | Lento com muitos joins |
| **Desenvolvimento** | Rápido, iterativo | Mais planejamento |

### Desvantagens do MongoDB

| Aspecto | Impacto |
|--------|---------|
| **Transações** | Suporta (v4.0+), mas limitadas |
| **ACID** | Pode ter inconsistências |
| **Espaço** | Usa mais disco (redundância) |
| **Normalização** | Requer cuidado |

---

## 📁 Estrutura do Projeto

```
plataforma-solidaria/
├── backend/
│   ├── src/
│   │   ├── models/          # Mongoose schemas
│   │   │   ├── Usuario.js
│   │   │   ├── Doador.js
│   │   │   ├── Instituicao.js
│   │   │   ├── Alimento.js
│   │   │   ├── Entrega.js
│   │   │   └── Avaliacao.js
│   │   ├── controllers/     # Lógica de negócio (próxima fase)
│   │   ├── services/        # Serviços reutilizáveis (próxima fase)
│   │   ├── routes/          # Endpoints da API (próxima fase)
│   │   ├── middleware/      # Auth, validação (próxima fase)
│   │   ├── config/          # Configurações (próxima fase)
│   │   └── server.js        # Arquivo principal
│   ├── package.json
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── components/      # Componentes React (próxima fase)
│   │   ├── pages/           # Páginas (próxima fase)
│   │   ├── services/        # Requisições HTTP (próxima fase)
│   │   └── App.jsx
│   ├── package.json
│   └── .env.example
├── docs/
│   └── ARQUITETURA.md       # Este arquivo
└── README.md
```

---

## 🚀 Próximas Fases

### Fase 3: Backend API REST
- Controllers para CRUD de cada modelo
- Services com lógica de negócio
- Routes com validações
- Middleware de autenticação JWT
- Endpoints geoespaciais para buscas

### Fase 4: Frontend
- Páginas de cadastro e login
- Dashboard doador
- Dashboard instituição
- Mapa interativo
- Sistema de avaliações

---

## 📞 Contato & Suporte

Para dúvidas sobre a arquitetura, consulte este documento.
