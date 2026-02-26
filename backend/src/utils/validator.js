// ==============================
// Helpers básicos
// ==============================
export const isRequired = value =>
value !== undefined &&
value !== null &&
String(value).trim() !== ''

// ==============================
// CPF
// ==============================
export function isValidCPF(cpf) {
if (!cpf) return false

cpf = cpf.replace(/\D/g, '')
if (cpf.length !== 11) return false
if (/^(\d)\1+$/.test(cpf)) return false

const calcDigit = length => {
    let sum = 0
    for (let i = 0; i < length; i++) {
      sum += Number(cpf[i]) * (length + 1 - i)
    }
    let result = (sum * 10) % 11
    return result === 10 ? 0 : result
}

return (
    calcDigit(9) === Number(cpf[9]) &&
    calcDigit(10) === Number(cpf[10])
)
}

// ==============================
// Email
// ==============================
export const isValidEmail = email =>
!!email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)

// ==============================
// Senha forte (mínimo 8 caracteres, pelo menos uma letra e um número)
// ==============================
export const isStrongPassword = password =>
/^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{8,}$/.test(password)

// ==============================
// Data (YYYY-MM-DD)
// ==============================
export function isValidDate(dateString) {
if (!dateString) return false

const date = new Date(dateString)
if (isNaN(date.getTime())) return false

const [y, m, d] = dateString.split('-').map(Number)
return (
    date.getUTCFullYear() === y &&
    date.getUTCMonth() + 1 === m &&
    date.getUTCDate() === d
)
}

// ==============================
// Menor de idade
// ==============================
export function isMinor(birthDate) {
if (!isValidDate(birthDate)) return false

const today = new Date()
const birth = new Date(birthDate)

let age = today.getFullYear() - birth.getFullYear()
if (
    today.getMonth() < birth.getMonth() ||
    (today.getMonth() === birth.getMonth() &&
    today.getDate() < birth.getDate())
) {
    age--
}

return age < 18
}

// ==============================
// Helpers de validação
// ==============================
function validateRequired(errors, value, message) {
if (!isRequired(value)) errors.push(message)
}

function validateWithRule(errors, value, rule, message) {
if (isRequired(value) && !rule(value)) errors.push(message)
}

// ==============================
// Validação completa do aluno
// ==============================
export function validateStudentPayload(data) {
const errors = []

  // Aluno
validateRequired(errors, data.fullName, 'Nome completo é obrigatório')

validateRequired(errors, data.cpf, 'CPF é obrigatório')
validateWithRule(errors, data.cpf, isValidCPF, 'CPF inválido')

validateRequired(errors, data.rg, 'RG é obrigatório')

validateRequired(errors, data.birthDate, 'Data de nascimento é obrigatória')
validateWithRule(
    errors,
    data.birthDate,
    isValidDate,
    'Data de nascimento inválida'
)

validateRequired(errors, data.address, 'Endereço é obrigatório')

validateRequired(errors, data.email, 'Email é obrigatório')
validateWithRule(errors, data.email, isValidEmail, 'Email inválido')

  // Vencimento
if (!isRequired(data.dueDay)) {
    errors.push('Data de vencimento do boleto é obrigatória')
} else {
    const day = Number(data.dueDay)
    if (!Number.isInteger(day) || day < 1 || day > 31) {
    errors.push('Dia de vencimento do boleto deve estar entre 1 e 31')
    }
}

  // Responsável (se menor)
if (isMinor(data.birthDate)) {
    const r = data.responsible
    if (!r) {
    errors.push('Responsável financeiro é obrigatório para menor de idade')
    return errors
    }

    validateRequired(errors, r.fullName, 'Nome do responsável é obrigatório')

    validateRequired(errors, r.cpf, 'CPF do responsável é obrigatório')
    validateWithRule(errors, r.cpf, isValidCPF, 'CPF do responsável inválido')

    validateRequired(errors, r.rg, 'RG do responsável é obrigatório')

    validateRequired(errors, r.email, 'Email do responsável é obrigatório')
    validateWithRule(
    errors,
    r.email,
    isValidEmail,
    'Email do responsável inválido'
    )

    validateRequired(errors, r.address, 'Endereço do responsável é obrigatório')

    if (r.cpf === data.cpf) {
    errors.push('CPF do responsável não pode ser igual ao do aluno')
    }
}

return errors
}

// validação simples para contas de usuário (não inclui campos de aluno)
// validação simples para contas de usuário (não inclui campos de aluno)
// OBS: "students" são uma tabela separada; não criamos usuários com role STUDENT
export function validateUserPayload(data) {
  const errors = []
  validateRequired(errors, data.fullName, 'Nome completo é obrigatório')
  validateRequired(errors, data.email, 'Email é obrigatório')
  validateWithRule(errors, data.email, isValidEmail, 'Email inválido')
  validateRequired(errors, data.password, 'Senha é obrigatória')
  validateRequired(errors, data.role, 'Role é obrigatório')
  if (data.role && !['ADMIN','SECRETARY','TEACHER'].includes(data.role)) {
    errors.push('Role inválido')
  }
  return errors
}
// validação usada apenas para atualizações: campos são opcionais
export function validateUserUpdatePayload(data) {
  const errors = []
  if (data.fullName !== undefined && !isRequired(data.fullName)) {
    errors.push('Nome completo é obrigatório quando enviado')
  }
  if (data.email !== undefined) {
    if (!isRequired(data.email)) {
      errors.push('Email é obrigatório quando enviado')
    } else if (!isValidEmail(data.email)) {
      errors.push('Email inválido')
    }
  }
  if (data.password !== undefined && !isRequired(data.password)) {
    errors.push('Senha é obrigatória quando enviada')
  }
  if (data.role !== undefined && !['ADMIN','SECRETARY','TEACHER'].includes(data.role)) {
    errors.push('Role inválido')
  }
  return errors
}


// Validação de campos da turma (classe)
export function validateClassPayload(data) {
  const errors = []
  validateRequired(errors, data.name, 'Nome da turma é obrigatório')
  validateRequired(errors, data.teacherId, 'Professor da turma é obrigatório')
  validateRequired(errors, data.schedule, 'Horário da turma é obrigatório')
  if (!Array.isArray(data.students) || data.students.length === 0) {
    errors.push('Ao menos um aluno na turma é obrigatório')
  }
  return errors
}