// Importa a aplicação Express que foi configurada no arquivo app.js
import app from './app.js'

// Define a porta do servidor - usa a variável de ambiente PORT ou 3333 como padrão
const PORT = process.env.PORT || 3333

// Inicia o servidor e faz ele "escutar" requisições na porta definida
app.listen(PORT, () => {
    // Exibe uma mensagem no console quando o servidor iniciar com sucesso
    console.log(`Server running on port ${PORT}`)
})
