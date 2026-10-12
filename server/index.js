import 'dotenv/config'
import express from 'express'
import mongoose from 'mongoose'
import cors from 'cors'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { Book, Loan, User } from './models.js'

const app = express()
const port = process.env.PORT || 5000
const finePerDay = Number(process.env.FINE_PER_DAY || 1)

app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173' }))
app.use(express.json({ limit: '20kb' }))

function createToken(user) {
  return jwt.sign({ sub: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' })
}

function safeUser(user) {
  return { id: user.id, name: user.name, email: user.email, role: user.role }
}

async function authenticate(req, res, next) {
  const token = req.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) return res.status(401).json({ message: 'Please sign in to continue.' })
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET)
    const user = await User.findById(payload.sub)
    if (!user) return res.status(401).json({ message: 'This account no longer exists.' })
    req.user = user
    next()
  } catch {
    return res.status(401).json({ message: 'Your session has expired. Please sign in again.' })
  }
}

function librarianOnly(req, res, next) {
  if (req.user.role !== 'librarian') return res.status(403).json({ message: 'Librarian access is required for this action.' })
  next()
}

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }))

app.post('/api/auth/register', async (req, res) => {
  const name = String(req.body.name || '').trim()
  const email = String(req.body.email || '').trim().toLowerCase()
  const password = String(req.body.password || '')
  if (!name || !email || password.length < 8) return res.status(400).json({ message: 'Enter your name, a valid email, and a password of at least 8 characters.' })
  if (!/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ message: 'Enter a valid email address.' })
  try {
    const user = await User.create({ name, email, passwordHash: await bcrypt.hash(password, 12), role: 'member' })
    return res.status(201).json({ token: createToken(user), user: safeUser(user) })
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: 'An account with this email already exists.' })
    throw error
  }
})

app.post('/api/auth/login', async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase()
  const password = String(req.body.password || '')
  const user = await User.findOne({ email }).select('+passwordHash')
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) return res.status(401).json({ message: 'Email or password is incorrect.' })
  res.json({ token: createToken(user), user: safeUser(user) })
})

app.get('/api/auth/me', authenticate, (req, res) => res.json({ user: safeUser(req.user) }))

app.get('/api/dashboard', authenticate, librarianOnly, async (_req, res) => {
  const [totalTitles, memberCount, activeLoans, overdueLoans] = await Promise.all([
    Book.countDocuments(),
    User.countDocuments({ role: 'member' }),
    Loan.countDocuments({ status: 'active' }),
    Loan.countDocuments({ status: 'active', dueDate: { $lt: new Date() } }),
  ])
  res.json({ stats: { totalTitles, memberCount, activeLoans, overdueLoans } })
})

app.get('/api/books', authenticate, async (req, res) => {
  const search = String(req.query.search || '').trim()
  const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const filter = search ? { $or: ['title', 'author', 'isbn', 'category'].map((field) => ({ [field]: { $regex: escapedSearch, $options: 'i' } })) } : {}
  const books = await Book.find(filter).sort({ title: 1 }).limit(500).lean()
  res.json({ books })
})

app.post('/api/books', authenticate, librarianOnly, async (req, res) => {
  const { title, author, isbn = '', category = 'Other', totalCopies, coverColor } = req.body
  const copies = Number(totalCopies)
  if (!title?.trim() || !author?.trim() || !Number.isInteger(copies) || copies < 1) return res.status(400).json({ message: 'Title, author, and at least one copy are required.' })
  const book = await Book.create({ title, author, isbn, category, totalCopies: copies, availableCopies: copies, coverColor })
  res.status(201).json({ book })
})

app.put('/api/books/:id', authenticate, librarianOnly, async (req, res) => {
  const book = await Book.findById(req.params.id)
  if (!book) return res.status(404).json({ message: 'Book not found.' })
  const totalCopies = Number(req.body.totalCopies)
  if (!req.body.title?.trim() || !req.body.author?.trim() || !Number.isInteger(totalCopies) || totalCopies < 1) return res.status(400).json({ message: 'Title, author, and at least one copy are required.' })
  const checkedOut = book.totalCopies - book.availableCopies
  if (totalCopies < checkedOut) return res.status(409).json({ message: `There are ${checkedOut} copies checked out. Total copies cannot be lower than that.` })
  book.title = req.body.title.trim()
  book.author = req.body.author.trim()
  book.isbn = req.body.isbn || ''
  book.category = req.body.category || 'Other'
  book.totalCopies = totalCopies
  book.availableCopies = totalCopies - checkedOut
  await book.save()
  res.json({ book })
})

app.get('/api/members', authenticate, librarianOnly, async (_req, res) => {
  const members = await User.find({ role: 'member' }).sort({ name: 1 }).lean()
  const counts = await Loan.aggregate([{ $match: { status: 'active' } }, { $group: { _id: '$member', activeLoans: { $sum: 1 } } }])
  const countByMember = new Map(counts.map((item) => [String(item._id), item.activeLoans]))
  res.json({ members: members.map(({ passwordHash, ...member }) => ({ ...member, activeLoans: countByMember.get(String(member._id)) || 0 })) })
})

app.get('/api/loans', authenticate, async (req, res) => {
  const filter = req.user.role === 'librarian' ? {} : { member: req.user._id }
  const loans = await Loan.find(filter).populate('book', 'title author isbn').populate('member', 'name email').sort({ createdAt: -1 }).limit(500).lean()
  res.json({ loans })
})

app.post('/api/loans', authenticate, librarianOnly, async (req, res) => {
  const { bookId, memberId, dueDate } = req.body
  const due = new Date(`${dueDate}T23:59:59.999Z`)
  if (!mongoose.isValidObjectId(bookId) || !mongoose.isValidObjectId(memberId) || Number.isNaN(due.getTime()) || due <= new Date()) return res.status(400).json({ message: 'Choose a book, a member, and a future due date.' })
  const member = await User.findOne({ _id: memberId, role: 'member' })
  if (!member) return res.status(404).json({ message: 'Member account not found.' })
  const book = await Book.findOneAndUpdate({ _id: bookId, availableCopies: { $gt: 0 } }, { $inc: { availableCopies: -1 } }, { returnDocument: 'after' })
  if (!book) return res.status(409).json({ message: 'That book is no longer available.' })
  try {
    const loan = await Loan.create({ book: book._id, member: member._id, issuedBy: req.user._id, dueDate: due })
    await loan.populate([{ path: 'book', select: 'title author' }, { path: 'member', select: 'name email' }])
    res.status(201).json({ loan })
  } catch (error) {
    await Book.updateOne({ _id: book._id }, { $inc: { availableCopies: 1 } })
    throw error
  }
})

app.post('/api/loans/:id/return', authenticate, librarianOnly, async (req, res) => {
  const returnDate = new Date()
  const overdueDaysFor = (dueDate) => Math.max(0, Math.ceil((returnDate - dueDate) / 86400000))
  const loan = await Loan.findOne({ _id: req.params.id, status: 'active' })
  if (!loan) return res.status(404).json({ message: 'Active borrowing record not found.' })
  loan.status = 'returned'
  loan.returnDate = returnDate
  loan.fine = overdueDaysFor(loan.dueDate) * finePerDay
  const updated = await Loan.findOneAndUpdate(
    { _id: loan._id, status: 'active' },
    { $set: { status: 'returned', returnDate, fine: loan.fine } },
    { returnDocument: 'after' },
  )
  if (!updated) return res.status(409).json({ message: 'This book has already been returned.' })
  await Book.updateOne({ _id: loan.book }, { $inc: { availableCopies: 1 } })
  await updated.populate([{ path: 'book', select: 'title author' }, { path: 'member', select: 'name email' }])
  res.json({ loan: updated, finePerDay })
})

app.use((error, _req, res, _next) => {
  console.error(error)
  if (error.name === 'CastError') return res.status(400).json({ message: 'The requested record is not valid.' })
  if (error.name === 'ValidationError') return res.status(400).json({ message: error.message })
  res.status(500).json({ message: 'The server could not complete that request.' })
})

mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/shelfwise')
  .then(() => app.listen(port, () => console.log(`Shelfwise API listening on http://localhost:${port}`)))
  .catch((error) => {
    console.error('Could not connect to MongoDB:', error.message)
    process.exit(1)
  })
