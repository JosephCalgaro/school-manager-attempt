// Importa o driver mysql2 usando a versão com Promises
// Isso permite usar async/await nas queries
import mysql from 'mysql2/promise'
import dotenv from 'dotenv'

// Lê e carrega as variáveis de ambiente do arquivo .env
dotenv.config()

// Cria um POOL de conexões com o MySQL
const pool = mysql.createPool({
     // Endereço do servidor MySQL (normalmente localhost)
    host: process.env.DB_HOST,
    // Usuario do banco de dados
    user: process.env.DB_USER,
    // Senha do banco de dados
    password: process.env.DB_PASSWORD,
    // Porta padrão do mysql(3306)
    port: process.env.DB_PORT,
    // Nome do banco de dados
    database: process.env.DB_NAME,
    // Faz node esperar conexão ficar livre se todas estiverem ocupadas
    waitForConnections: true,
    // Numero maximo de conexões simultaneas
    connectionLimit: Number(process.env.DB_POOL_LIMIT) || 10,
    // Fila de requisições (0 = sem limites)
    queueLimit: 0,
    // Retorna DATE/DATETIME como strings (evita conversão para Date JS + timezone bugs)
    dateStrings: true,
    // Charset UTF-8 para evitar acentos corrompidos (ç, ã, é, etc.)
    charset: 'utf8mb4',
})

// exporta pool para ser usado em qualquer parte do projeto
export default pool