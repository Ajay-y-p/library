import 'dotenv/config'
import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'
import { Book, Loan, User } from './models.js'

const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/shelfwise'
await mongoose.connect(mongoUri)

const passwordHash = await bcrypt.hash('library123', 12)
const librarian = await User.findOneAndUpdate(
  { email: 'librarian@ashwood.test' },
  { $set: { name: 'Alex Morgan', passwordHash, role: 'librarian' } },
  { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
)

const sampleMembers = [
  { name: 'Maya Bennett', email: 'maya@example.com' },
  { name: 'Elliot Park', email: 'elliot@example.com' },
  { name: 'Nina Patel', email: 'nina@example.com' },
]
const members = []
for (const details of sampleMembers) {
  members.push(await User.findOneAndUpdate(
    { email: details.email },
    { $setOnInsert: { ...details, passwordHash, role: 'member' } },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
  ))
}

const sampleBooks = [
  { title: 'The Secret Garden', author: 'Frances Hodgson Burnett', isbn: '978-0141321068', category: 'Fiction', totalCopies: 4, coverColor: '#d8e5d1' },
  { title: 'Braiding Sweetgrass', author: 'Robin Wall Kimmerer', isbn: '978-1571313560', category: 'Non-fiction', totalCopies: 3, coverColor: '#d8e4d9' },
  { title: 'The Thursday Murder Club', author: 'Richard Osman', isbn: '978-0241425442', category: 'Mystery', totalCopies: 2, coverColor: '#efddd0' },
  { title: 'A Brief History of Time', author: 'Stephen Hawking', isbn: '978-0553380163', category: 'Science', totalCopies: 2, coverColor: '#dce4eb' },
  { title: 'The Book of Delights', author: 'Ross Gay', isbn: '978-1616207922', category: 'Poetry', totalCopies: 3, coverColor: '#eee3c9' },
  { title: 'Pachinko', author: 'Min Jin Lee', isbn: '978-1455563937', category: 'Fiction', totalCopies: 3, coverColor: '#e8d7d7' },
  { title: 'The Boy, the Mole, the Fox and the Horse', author: 'Charlie Mackesy', isbn: '978-0062976581', category: 'Children', totalCopies: 2, coverColor: '#e6e4d5' },
  { title: 'A Short History of Nearly Everything', author: 'Bill Bryson', isbn: '978-0767908184', category: 'Science', totalCopies: 2, coverColor: '#d5e4e1' },
]

const books = []
for (const details of sampleBooks) {
  books.push(await Book.findOneAndUpdate(
    { isbn: details.isbn },
    { $setOnInsert: { ...details, availableCopies: details.totalCopies } },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
  ))
}

if (await Loan.countDocuments() === 0) {
  const findBook = (isbn) => books.find((book) => book.isbn === isbn)
  const activeBorrowings = [
    { book: findBook('978-0141321068'), member: members[0], dueInDays: 5 },
    { book: findBook('978-0241425442'), member: members[1], dueInDays: -3 },
    { book: findBook('978-1571313560'), member: members[2], dueInDays: 8 },
  ]
  for (const borrowing of activeBorrowings) {
    await Loan.create({
      book: borrowing.book._id,
      member: borrowing.member._id,
      issuedBy: librarian._id,
      issueDate: new Date(Date.now() - 9 * 86400000),
      dueDate: new Date(Date.now() + borrowing.dueInDays * 86400000),
    })
    await Book.updateOne({ _id: borrowing.book._id }, { $inc: { availableCopies: -1 } })
  }
}

console.log('Sample library data is ready.')
console.log('Librarian: librarian@ashwood.test / library123')
console.log('Member: maya@example.com / library123')
await mongoose.disconnect()
