# School Manager - Setup Completo

## 📋 Descrição do Projeto

Este é um sistema de gerenciamento escolar com autenticação JWT, integração frontend-backend e interface moderna com Tailwind CSS.

### ✨ Modificações Implementadas

1. **✅ Autenticação Conectada**: O formulário de login agora se conecta ao backend via API REST
2. **✅ Proteção de Rotas**: Apenas usuários autenticados podem acessar o dashboard
3. **✅ Categoria "Exemplo"**: Todas as páginas do template foram agrupadas em uma nova categoria na sidebar
4. **✅ Categoria "VIP"**: Nova categoria com recursos especiais marcados como "new"
5. **✅ UserDropdown Atualizado**: Mostra dados do usuário logado e permite logout

## 🚀 Como Executar

### Pré-requisitos
- Node.js v18+
- MySQL 8.0+
- npm ou yarn

### 1. Configurar o Banco de Dados

```bash
# Criar banco de dados
mysql -u root -p'Joecal300422@@' <<'SQL'
CREATE DATABASE IF NOT EXISTS school_manager CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
SQL

# Criar tabelas
mysql -u root -p'Joecal300422@@' school_manager <<'SQL'
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  full_name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('admin', 'teacher', 'student') DEFAULT 'teacher',
  is_active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS students (
  id INT AUTO_INCREMENT PRIMARY KEY,
  full_name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  birth_date DATE,
  class_id INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS classes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  year INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS assignments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  due_date DATE,
  class_id INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS responsibles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  full_name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(20),
  student_id INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
SQL

# Inserir usuário de teste (senha: admin123)
mysql -u root -p'Joecal300422@@' school_manager -e "
INSERT INTO users (full_name, email, password_hash, role, is_active) 
VALUES ('Administrador', 'admin@school.com', '\$2b\$10\$4OBy/JxQ44kKYJvrM93HsulZUpwFGOfSu0AgNUak/s7DAXYTAkYJe', 'admin', 1)
ON DUPLICATE KEY UPDATE full_name = full_name;
"
```

### 2. Iniciar o Backend

```bash
cd backend
npm install
npm start
# O servidor rodará em http://localhost:3333
```

### 3. Iniciar o Frontend

```bash
cd frontend
npm install
npm run dev
# O site estará disponível em http://localhost:5173
```

## 🔐 Credenciais de Teste

**Email:** admin@school.com  
**Senha:** admin123

## 📁 Estrutura do Projeto

```
school-manager/
├── backend/
│   ├── src/
│   │   ├── app.js                 # Configuração Express
│   │   ├── server.js              # Inicialização do servidor
│   │   ├── controllers/           # Lógica de negócio
│   │   ├── routes/                # Definição de rotas
│   │   ├── middlewares/           # Autenticação JWT
│   │   └── database/              # Conexão MySQL
│   ├── .env                       # Variáveis de ambiente
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── pages/                 # Páginas da aplicação
│   │   ├── components/            # Componentes React
│   │   ├── layout/                # Layout principal
│   │   ├── context/               # Context API (Auth, Theme, Sidebar)
│   │   ├── hooks/                 # Custom hooks
│   │   ├── App.tsx                # Roteamento principal
│   │   └── main.tsx               # Entrada da aplicação
│   ├── vite.config.ts             # Configuração Vite + Proxy
│   └── package.json
│
└── README_SETUP.md                # Este arquivo
```

## 🔑 Principais Mudanças Implementadas

### 1. **Autenticação (AuthProvider.tsx)**
- Login conectado ao endpoint `/auth/login` do backend
- Token JWT armazenado em localStorage
- Redirecionamento automático para login se não autenticado

### 2. **Proteção de Rotas (ProtectedRoute.tsx)**
- Componente que verifica se o usuário tem token
- Redireciona para `/signin` se não autenticado

### 3. **Sidebar Atualizada (AppSidebar.tsx)**
- **Menu**: Dashboard, Calendário, Perfil, Formulários, Tabelas, Páginas
- **Exemplo**: Gráficos, Elementos UI, Autenticação, Formulários, Tabelas, Calendário, Perfil, Páginas
- **VIP**: Área VIP, Tarefas VIP, Recursos VIP (com badge "new")

### 4. **UserDropdown Integrado (UserDropdown.tsx)**
- Mostra nome e email do usuário logado
- Exibe o role (admin, teacher, student)
- Botão de logout funcional

## 🔗 Endpoints da API

### Autenticação
- `POST /auth/login` - Login (email, password)
- `GET /auth/profile` - Perfil do usuário (requer token)

### Dados (requerem autenticação)
- `GET /students` - Listar alunos
- `GET /users` - Listar usuários
- `GET /classes` - Listar turmas
- `GET /assignments` - Listar tarefas
- `GET /responsibles` - Listar responsáveis

## 🛠️ Variáveis de Ambiente

### Backend (.env)
```
PORT=3333
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=Joecal300422@@
DB_NAME=school_manager
DB_PORT=3306
JWT_SECRET=school_manager_jwt_secret_2026
```

## 📝 Notas Importantes

1. **Proxy do Vite**: O frontend redireciona requisições para `/auth`, `/students`, etc. ao backend em `localhost:3333`
2. **CORS**: O backend tem CORS habilitado para aceitar requisições do frontend
3. **JWT**: Token válido por 10 horas
4. **Senha do Admin**: `admin123` (hash bcrypt já inserido no banco)

## 🎨 Personalizações Disponíveis

- **Tema**: Toggle entre light/dark mode no header
- **Sidebar**: Pode ser expandida/recolhida
- **Responsivo**: Funciona em mobile, tablet e desktop

## 📞 Suporte

Para adicionar novos usuários, execute:

```bash
mysql -u root -p'Joecal300422@@' school_manager -e "
INSERT INTO users (full_name, email, password_hash, role, is_active) 
VALUES ('Nome do Usuário', 'email@example.com', 'HASH_BCRYPT', 'teacher', 1);
"
```

Para gerar um hash bcrypt da senha, use:
```bash
node -e "const bcrypt = require('bcryptjs'); console.log(bcrypt.hashSync('sua_senha', 10));"
```

---

**Versão:** 1.0.0  
**Data:** 28/02/2026  
**Status:** ✅ Completo e Funcional
