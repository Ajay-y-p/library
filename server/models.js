import mongoose from 'mongoose'

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 80 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, enum: ['librarian', 'member'], default: 'member' },
}, { timestamps: true })

const bookSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 180 },
  author: { type: String, required: true, trim: true, maxlength: 120 },
  isbn: { type: String, trim: true, default: '' },
  category: { type: String, trim: true, default: 'Other' },
  totalCopies: { type: Number, min: 1, required: true },
  availableCopies: { type: Number, min: 0, required: true },
  coverColor: { type: String, default: '#d6e3d2' },
}, { timestamps: true })

const loanSchema = new mongoose.Schema({
  book: { type: mongoose.Schema.Types.ObjectId, ref: 'Book', required: true },
  member: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  issuedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  issueDate: { type: Date, default: Date.now },
  dueDate: { type: Date, required: true },
  returnDate: { type: Date, default: null },
  status: { type: String, enum: ['active', 'returned'], default: 'active' },
  fine: { type: Number, default: 0, min: 0 },
}, { timestamps: true })

loanSchema.index({ member: 1, status: 1 })
loanSchema.index({ dueDate: 1, status: 1 })

export const User = mongoose.model('User', userSchema)
export const Book = mongoose.model('Book', bookSchema)
export const Loan = mongoose.model('Loan', loanSchema)
