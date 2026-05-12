const mongoose = require('mongoose');
const bcryptjs = require('bcryptjs');

const usuarioSchema = new mongoose.Schema(
  {
    nome: {
      type: String,
      required: [true, 'Nome é obrigatório'],
      trim: true,
      minlength: [3, 'Nome deve ter pelo menos 3 caracteres'],
      maxlength: [100, 'Nome não pode exceder 100 caracteres']
    },
    email: {
      type: String,
      required: [true, 'Email é obrigatório'],
      unique: true,
      lowercase: true,
      match: [
        /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
        'Por favor, forneça um email válido'
      ]
    },
    senha: {
      type: String,
      required: [true, 'Senha é obrigatória'],
      minlength: [6, 'Senha deve ter pelo menos 6 caracteres'],
      select: false // Não retorna a senha por padrão
    },
    tipo: {
      type: String,
      enum: ['doador', 'instituicao', 'admin'],
      default: 'doador',
      required: true
    },
    telefone: {
      type: String,
      required: [true, 'Telefone é obrigatório'],
      match: [/^\(\d{2}\)\s?\d{4,5}-\d{4}$/, 'Formato de telefone inválido']
    },
    cpfOuCnpj: {
      type: String,
      required: [true, 'CPF ou CNPJ é obrigatório'],
      unique: true
    },
    ativo: {
      type: Boolean,
      default: true
    },
    criadoEm: {
      type: Date,
      default: Date.now
    },
    atualizadoEm: {
      type: Date,
      default: Date.now
    }
  },
  { timestamps: { createdAt: 'criadoEm', updatedAt: 'atualizadoEm' } }
);

// Middleware para hashear a senha antes de salvar
usuarioSchema.pre('save', async function (next) {
  if (!this.isModified('senha')) {
    next();
  }

  const salt = await bcryptjs.genSalt(10);
  this.senha = await bcryptjs.hash(this.senha, salt);
});

// Middleware para atualizar atualizadoEm
usuarioSchema.pre('save', function (next) {
  if (!this.isNew) {
    this.atualizadoEm = Date.now();
  }
  next();
});

// Método para comparar senha
usuarioSchema.methods.compararSenha = async function (senhaInformada) {
  return await bcryptjs.compare(senhaInformada, this.senha);
};

// Índice para email único
usuarioSchema.index({ email: 1 });
usuarioSchema.index({ cpfOuCnpj: 1 });

module.exports = mongoose.model('Usuario', usuarioSchema);
