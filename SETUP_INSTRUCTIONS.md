# School Manager - Instruções de Setup

## 📋 Descrição do Projeto

Sistema de gerenciamento escolar com autenticação JWT, integração frontend-backend e interface moderna com Tailwind CSS.

## ✨ Modificações Implementadas

1. **✅ Autenticação Conectada**: Formulário de login conectado ao backend via API REST
2. **✅ Proteção de Rotas**: Apenas usuários autenticados acessam o dashboard
3. **✅ Categoria "Exemplo"**: Todas as páginas do template agrupadas na sidebar
4. **✅ Categoria "VIP"**: Nova categoria com recursos especiais (badges "new")
5. **✅ UserDropdown Integrado**: Mostra dados do usuário e permite logout

## 🚀 Como Executar

### Pré-requisitos
- Node.js v18+
- MySQL 8.0+
- npm ou yarn

### 1. Configurar o Banco de Dados

```bash
# Criar banco de dados
mysql -u root -p'Joecal300422@@' -e "CREATE DATABASE IF NOT EXISTS school_manager CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

# Criar tabelas (veja arquivo SQL abaixo)
```

### 2. Iniciar o Backend

```bash
cd backend
npm install
npm start
# Servidor em http://localhost:3333
```

### 3. Iniciar o Frontend

```bash
cd frontend
npm install
npm run dev
# Site em http://localhost:5173
```

## 🔐 Credenciais de Teste

**Email:** admin@school.com  
**Senha:** admin123

## 📁 Arquivos Modificados

### Frontend
- `src/App.tsx` - Proteção de rotas com ProtectedRoute
- `src/components/auth/ProtectedRoute.tsx` - Novo componente
- `src/components/header/UserDropdown.tsx` - Integração com AuthContext
- `src/layout/AppSidebar.tsx` - Categorias Exemplo e VIP
- `vite.config.ts` - Configuração de proxy e allowedHosts

### Backend
- Sem modificações (já estava funcional)

## 🔗 Endpoints da API

- `POST /auth/login` - Login
- `GET /auth/profile` - Perfil do usuário
- `GET /students` - Listar alunos
- `GET /users` - Listar usuários
- `GET /classes` - Listar turmas
- `GET /assignments` - Listar tarefas
- `GET /responsibles` - Listar responsáveis

## 📝 SQL para Criar Tabelas

```sql
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

-- Inserir usuário de teste
INSERT INTO users (full_name, email, password_hash, role, is_active) 
VALUES ('Administrador', 'admin@school.com', '$2b$10$4OBy/JxQ44kKYJvrM93HsulZUpwFGOfSu0AgNUak/s7DAXYTAkYJe', 'admin', 1)
ON DUPLICATE KEY UPDATE full_name = full_name;
```

## 🎨 Estrutura da Sidebar

**Menu**
- Dashboard → Ecommerce
- Calendário
- Perfil do Usuário
- Formulários → Elementos de Formulário
- Tabelas → Tabelas Básicas
- Páginas → Página em Branco, Erro 404

**Exemplo**
- Gráficos → Gráfico de Linha, Gráfico de Barras
- Elementos UI → Alertas, Avatar, Badge, Botões, Imagens, Vídeos
- Autenticação → Sign In
- Formulários → Elementos de Formulário
- Tabelas → Tabelas Básicas
- Calendário
- Perfil
- Páginas → Página em Branco

**VIP** (com ícone ⭐ em amarelo)
- Área VIP → Dashboard VIP, Relatórios VIP (badges: new)
- Tarefas VIP → Minhas Tarefas, Calendário VIP (badges: new)
- Recursos VIP → Gráficos Avançados, Análises (badges: new)

## 🔑 Variáveis de Ambiente

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

## ✅ Checklist de Implementação

- [x] Backend configurado e rodando
- [x] MySQL com tabelas criadas
- [x] Usuário admin inserido
- [x] Frontend com autenticação conectada
- [x] Proteção de rotas implementada
- [x] Categoria "Exemplo" criada
- [x] Categoria "VIP" criada
- [x] UserDropdown integrado com AuthContext
- [x] Logout funcional
- [x] Proxy do Vite configurado

## 📞 Troubleshooting

**Erro: "Cannot find module"**
```bash
cd frontend
rm -rf node_modules package-lock.json
npm install
```

**Erro: "Access denied for user 'root'"**
```bash
# Verificar credenciais no .env do backend
# Padrão: root / Joecal300422@@
```

**Frontend não conecta ao backend**
```bash
# Verificar se backend está rodando em localhost:3333
curl http://localhost:3333/ping
```

---

**Status:** ✅ Completo e Funcional  
**Data:** 28/02/2026  
**Versão:** 1.0.0
