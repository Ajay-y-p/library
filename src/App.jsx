import { useEffect, useState } from 'react'
import {
  ArrowDownToLine, ArrowLeftRight, BookOpen, Check, Clock3,
  LayoutDashboard, LogOut, Menu, Plus, RotateCcw, Search,
  ShieldCheck, Users, X,
} from 'lucide-react'
import './App.css'

const navItems = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'books', label: 'Book catalog', icon: BookOpen },
  { id: 'members', label: 'Members', icon: Users, librarian: true },
  { id: 'loans', label: 'Borrowing', icon: ArrowLeftRight },
]

async function request(path, options = {}) {
  const token = localStorage.getItem('shelfwise-token')
  const response = await fetch(`/api${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.message || 'Something went wrong.')
  return data
}

function formatDate(value) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value))
}

function initials(name = '') {
  return name.split(' ').filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase()
}

function App() {
  const [user, setUser] = useState(null)
  const [authReady, setAuthReady] = useState(false)
  const [activeView, setActiveView] = useState('overview')
  const [books, setBooks] = useState([])
  const [members, setMembers] = useState([])
  const [loans, setLoans] = useState([])
  const [stats, setStats] = useState(null)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [modal, setModal] = useState(null)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [mobileNav, setMobileNav] = useState(false)

  useEffect(() => {
    const token = localStorage.getItem('shelfwise-token')
    if (!token) {
      setAuthReady(true)
      return
    }
    request('/auth/me')
      .then((data) => setUser(data.user))
      .catch(() => localStorage.removeItem('shelfwise-token'))
      .finally(() => setAuthReady(true))
  }, [])

  useEffect(() => {
    if (!user) return
    let cancelled = false
    setLoading(true)
    const calls = [request('/books'), request('/loans')]
    if (user.role === 'librarian') calls.push(request('/members'), request('/dashboard'))
    Promise.all(calls)
      .then(([bookData, loanData, memberData, dashboardData]) => {
        if (cancelled) return
        setBooks(bookData.books)
        setLoans(loanData.loans)
        if (memberData) setMembers(memberData.members)
        if (dashboardData) setStats(dashboardData.stats)
        setError('')
      })
      .catch((err) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoading(false))
    return () => { cancelled = true }
  }, [user, notice])

  async function signIn(credentials) {
    const data = credentials.mode === 'register'
      ? await request('/auth/register', { method: 'POST', body: JSON.stringify(credentials) })
      : await request('/auth/login', { method: 'POST', body: JSON.stringify(credentials) })
    localStorage.setItem('shelfwise-token', data.token)
    setUser(data.user)
    setActiveView('overview')
  }

  function signOut() {
    localStorage.removeItem('shelfwise-token')
    setUser(null)
    setBooks([])
    setLoans([])
    setMembers([])
  }

  async function performAction(path, method, payload, successMessage) {
    try {
      await request(path, { method, body: JSON.stringify(payload) })
      setModal(null)
      setNotice(`${successMessage} ${Date.now()}`)
      setError('')
    } catch (err) {
      setError(err.message)
    }
  }

  if (!authReady) return <div className="boot-screen"><BookOpen size={24} /><span>Shelfwise</span></div>
  if (!user) return <AuthScreen onSubmit={signIn} />

  const librarian = user.role === 'librarian'
  const currentNav = navItems.filter((item) => !item.librarian || librarian)
  const visibleBooks = books.filter((book) => {
    const haystack = `${book.title} ${book.author} ${book.isbn} ${book.category}`.toLowerCase()
    return haystack.includes(search.toLowerCase()) && (filter === 'all' || (filter === 'available' ? book.availableCopies > 0 : book.availableCopies === 0))
  })
  const activeLoans = loans.filter((loan) => loan.status === 'active')
  const overdueLoans = activeLoans.filter((loan) => new Date(loan.dueDate) < new Date())

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileNav ? 'sidebar-open' : ''}`}>
        <a className="brand" href="#overview" onClick={(event) => { event.preventDefault(); setActiveView('overview') }}>
          <span className="brand-mark"><BookOpen size={19} strokeWidth={1.8} /></span>
          <span className="brand-name">shelfwise<span>.</span></span>
        </a>
        <div className="workspace-label">LIBRARY WORKSPACE</div>
        <div className="library-switcher"><span className="library-avatar">A</span><span className="library-name">Ashwood Library<small>Central branch</small></span><span className="switcher-dot" /></div>
        <div className="nav-label">YOUR DESK</div>
        <nav className="primary-nav" aria-label="Main navigation">
          {currentNav.map(({ id, label, icon: Icon }) => (
            <button key={id} className={`nav-link ${activeView === id ? 'selected' : ''}`} onClick={() => { setActiveView(id); setMobileNav(false) }}>
              <Icon size={17} strokeWidth={1.8} /><span>{label}</span>
              {id === 'loans' && overdueLoans.length > 0 && <span className="nav-count">{overdueLoans.length}</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="help-note"><span className="help-icon"><ShieldCheck size={16} /></span><span><strong>{librarian ? 'Librarian access' : 'Member access'}</strong><small>{librarian ? 'You manage this collection' : 'Your personal library card'}</small></span></div>
          <button className="profile-row" onClick={signOut} title="Sign out"><span className="profile-avatar">{initials(user.name)}</span><span className="profile-copy"><strong>{user.name}</strong><small>{user.role}</small></span><LogOut size={16} /></button>
        </div>
      </aside>
      {mobileNav && <button className="scrim" aria-label="Close navigation" onClick={() => setMobileNav(false)} />}
      <main className="main-area">
        <header className="topbar">
          <button className="icon-button mobile-menu" aria-label="Open menu" onClick={() => setMobileNav(true)}><Menu size={19} /></button>
          <div className="breadcrumb"><span>Workspace</span><span className="crumb-slash">/</span><strong>{navItems.find((item) => item.id === activeView)?.label ?? 'Overview'}</strong></div>
          <div className="topbar-right"><span className="today-label">{new Intl.DateTimeFormat('en', { weekday: 'short', month: 'short', day: 'numeric' }).format(new Date())}</span><span className="topbar-avatar">{initials(user.name)}</span></div>
        </header>
        <div className="page-content">
          {error && <div className="alert alert-error"><span>{error}</span><button className="icon-button" aria-label="Dismiss" onClick={() => setError('')}><X size={16} /></button></div>}
          {loading && <div className="loading-line"><span /> Syncing library records</div>}
          {activeView === 'overview' && <Overview user={user} books={books} loans={loans} stats={stats} onNavigate={setActiveView} onNewLoan={() => setModal({ type: 'loan' })} />}
          {activeView === 'books' && <BooksView books={visibleBooks} search={search} setSearch={setSearch} filter={filter} setFilter={setFilter} librarian={librarian} onNewBook={() => setModal({ type: 'book' })} onEdit={(book) => setModal({ type: 'book', book })} />}
          {activeView === 'members' && <MembersView members={members} />}
          {activeView === 'loans' && <LoansView loans={loans} librarian={librarian} onNewLoan={() => setModal({ type: 'loan' })} onReturn={(loan) => setModal({ type: 'return', loan })} />}
        </div>
      </main>
      {modal && <Modal onClose={() => setModal(null)}>{modal.type === 'book' ? <BookForm book={modal.book} onCancel={() => setModal(null)} onSave={(data) => performAction(modal.book ? `/books/${modal.book._id}` : '/books', modal.book ? 'PUT' : 'POST', data, modal.book ? 'Book updated.' : 'Book added.')} /> : modal.type === 'loan' ? <LoanForm books={books} members={members} librarian={librarian} onCancel={() => setModal(null)} onSave={(data) => performAction('/loans', 'POST', data, 'Borrowing record created.')} /> : <ReturnForm loan={modal.loan} onCancel={() => setModal(null)} onSave={() => performAction(`/loans/${modal.loan._id}/return`, 'POST', {}, 'Book returned.')} />}</Modal>}
      {notice && <div className="toast"><Check size={16} />{notice.replace(/\s\d+$/, '')}<button aria-label="Dismiss notice" onClick={() => setNotice('')}><X size={14} /></button></div>}
    </div>
  )
}

function AuthScreen({ onSubmit }) {
  const [mode, setMode] = useState('login')
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  async function submit(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try { await onSubmit({ ...form, mode }) } catch (err) { setError(err.message) } finally { setBusy(false) }
  }
  return (
    <main className="auth-page">
      <section className="auth-visual"><div className="auth-brand"><span className="brand-mark"><BookOpen size={19} /></span><span className="brand-name">shelfwise<span>.</span></span></div><div className="auth-quote"><div className="quote-rule" /><p>“A library is not a luxury but one of the necessities of life.”</p><span>— Henry Ward Beecher</span></div><div className="book-stack" aria-hidden="true"><i /><i /><i /><i /><i /></div><span className="visual-caption">A QUIETER WAY TO KEEP THE COLLECTION MOVING</span></section>
      <section className="auth-panel"><div className="auth-form-wrap"><span className="eyebrow">ASHWOOD LIBRARY · CENTRAL BRANCH</span><h1>{mode === 'login' ? 'Welcome back.' : 'Join the library.'}</h1><p className="auth-intro">{mode === 'login' ? 'Sign in to your library workspace.' : 'Create a member account to explore the collection.'}</p>
        <form onSubmit={submit} className="form-stack">
          {mode === 'register' && <label>Full name<input required autoComplete="name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Morgan Reed" /></label>}
          <label>Email address<input required type="email" autoComplete="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="you@example.com" /></label>
          <label>Password<input required type="password" minLength="8" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} placeholder="At least 8 characters" /></label>
          {error && <div className="form-error">{error}</div>}
          <button className="button button-dark button-wide" disabled={busy}>{busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create member account'}<span aria-hidden="true">↗</span></button>
        </form>
        <p className="auth-switch">{mode === 'login' ? 'New to the library?' : 'Already have an account?'} <button onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError('') }}>{mode === 'login' ? 'Register as a member' : 'Sign in'}</button></p>
        <div className="demo-login"><span className="demo-line" /><p>Demo librarian account</p><code>librarian@ashwood.test <span>·</span> library123</code></div>
      </div></section>
    </main>
  )
}

function Overview({ user, books, loans, stats, onNavigate, onNewLoan }) {
  const librarian = user.role === 'librarian'
  const active = loans.filter((loan) => loan.status === 'active')
  const overdue = active.filter((loan) => new Date(loan.dueDate) < new Date())
  const rows = loans.slice(0, librarian ? 5 : 4)
  return <>
    <div className="page-heading"><div><span className="eyebrow">{new Intl.DateTimeFormat('en', { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date()).toUpperCase()}</span><h1>{librarian ? 'Good morning, ' : 'Good to see you, '}{user.name.split(' ')[0]}<span className="heading-period">.</span></h1><p>{librarian ? 'Here is what is happening in your library today.' : 'Here is the latest from your library card.'}</p></div>{librarian ? <button className="button button-dark" onClick={onNewLoan}><Plus size={16} /> Issue a book</button> : <button className="button button-outline" onClick={() => onNavigate('books')}><BookOpen size={16} /> Browse catalog</button>}</div>
    <section className="stat-grid" aria-label="Library statistics"><StatCard label={librarian ? 'Titles in catalog' : 'Titles to explore'} value={stats?.totalTitles ?? books.length} note={librarian ? 'Across all categories' : `${books.filter((book) => book.availableCopies > 0).length} currently available`} icon={<BookOpen size={17} />} tone="sage" /><StatCard label={librarian ? 'Books on loan' : 'Your active loans'} value={librarian ? (stats?.activeLoans ?? active.length) : active.length} note={librarian ? 'Currently with members' : 'Keep an eye on due dates'} icon={<ArrowLeftRight size={17} />} tone="blue" /><StatCard label={librarian ? 'Overdue returns' : 'Overdue items'} value={librarian ? (stats?.overdueLoans ?? overdue.length) : overdue.length} note={overdue.length ? 'Please follow up today' : 'You are all caught up'} icon={<Clock3 size={17} />} tone={overdue.length ? 'coral' : 'gold'} /><StatCard label={librarian ? 'Registered members' : 'Returned books'} value={librarian ? (stats?.memberCount ?? '—') : loans.filter((loan) => loan.status === 'returned').length} note={librarian ? 'Active library accounts' : 'In your borrowing history'} icon={<Users size={17} />} tone="lavender" /></section>
    <section className="content-section overview-table-section"><div className="section-heading"><div><span className="eyebrow">{librarian ? 'COLLECTION ACTIVITY' : 'YOUR ACCOUNT'}</span><h2>{librarian ? 'Recent borrowing' : 'Your borrowing'}</h2></div><button className="text-link" onClick={() => onNavigate('loans')}>View all <span>↗</span></button></div><LoanTable loans={rows} librarian={librarian} compact />{rows.length === 0 && <EmptyState title="A fresh page" text={librarian ? 'No books have been issued yet.' : 'Your borrowing history will appear here.'} />}</section>
    <section className="bottom-note"><span className="note-glyph">✳</span><div><strong>Good collections keep moving.</strong><p>{librarian ? 'A quick look at availability helps your members find their next read.' : 'Browse the catalog to find something for your next reading hour.'}</p></div><button className="text-link" onClick={() => onNavigate('books')}>Open catalog <span>↗</span></button></section>
  </>
}

function StatCard({ label, value, note, icon, tone }) { return <article className="stat-card"><div className={`stat-icon tone-${tone}`}>{icon}</div><span className="stat-label">{label}</span><div className="stat-value">{value}</div><span className="stat-note">{note}</span></article> }

function BooksView({ books, search, setSearch, filter, setFilter, librarian, onNewBook, onEdit }) {
  return <><div className="page-heading"><div><span className="eyebrow">THE COLLECTION</span><h1>Book catalog<span className="heading-period">.</span></h1><p>Find a story, return to an old favorite, or see what is ready to borrow.</p></div>{librarian && <button className="button button-dark" onClick={onNewBook}><Plus size={16} /> Add a book</button>}</div>
    <section className="content-section"><div className="toolbar"><div className="search-field"><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search title, author, ISBN…" aria-label="Search books" />{search && <button aria-label="Clear search" className="search-clear" onClick={() => setSearch('')}><X size={14} /></button>}</div><div className="segmented" aria-label="Filter books">{[['all', 'All books'], ['available', 'Available'], ['out', 'On loan']].map(([id, label]) => <button key={id} className={filter === id ? 'active' : ''} onClick={() => setFilter(id)}>{label}</button>)}</div></div>
      <div className="table-wrap"><table><thead><tr><th>Book</th><th>Category</th><th>ISBN</th><th>Availability</th>{librarian && <th />}</tr></thead><tbody>{books.map((book) => <tr key={book._id}><td><div className="book-cell"><span className="book-cover" style={{ '--cover': book.coverColor || '#d6e3d2' }}><BookOpen size={17} /></span><span><strong>{book.title}</strong><small>by {book.author}</small></span></div></td><td><span className="category-label">{book.category}</span></td><td className="muted-cell">{book.isbn || '—'}</td><td><Availability available={book.availableCopies} total={book.totalCopies} /></td>{librarian && <td><button className="small-action" onClick={() => onEdit(book)}>Edit</button></td>}</tr>)}</tbody></table>{books.length === 0 && <EmptyState title="No books found" text="Try another search or adjust the availability filter." />}</div>
    </section></>
}

function Availability({ available, total }) { return <span className={`availability ${available === 0 ? 'unavailable' : available < total ? 'limited' : ''}`}><i />{available === 0 ? 'All on loan' : `${available} of ${total} available`}</span> }

function MembersView({ members }) {
  return <><div className="page-heading"><div><span className="eyebrow">YOUR READING COMMUNITY</span><h1>Members<span className="heading-period">.</span></h1><p>Library cardholders and their current borrowing activity.</p></div><div className="member-total"><strong>{members.length}</strong><span>registered readers</span></div></div>
    <section className="content-section"><div className="table-wrap"><table><thead><tr><th>Member</th><th>Joined</th><th>Currently borrowed</th><th>Account</th></tr></thead><tbody>{members.map((member) => <tr key={member._id}><td><div className="member-cell"><span className="member-avatar">{initials(member.name)}</span><span><strong>{member.name}</strong><small>{member.email}</small></span></div></td><td className="muted-cell">{formatDate(member.createdAt)}</td><td>{member.activeLoans || 0} {member.activeLoans === 1 ? 'book' : 'books'}</td><td><span className="member-status"><i /> Active</span></td></tr>)}</tbody></table>{members.length === 0 && <EmptyState title="No members yet" text="Member accounts will appear here after registration." />}</div></section></>
}

function LoansView({ loans, librarian, onNewLoan, onReturn }) {
  const [filter, setFilter] = useState('all')
  const filtered = loans.filter((loan) => filter === 'all' || (filter === 'overdue' ? loan.status === 'active' && new Date(loan.dueDate) < new Date() : loan.status === filter))
  return <><div className="page-heading"><div><span className="eyebrow">LENDING DESK</span><h1>{librarian ? 'Borrowing records' : 'My borrowing'}<span className="heading-period">.</span></h1><p>{librarian ? 'Issue books, track due dates, and close out returns.' : 'Your current checkouts and reading history.'}</p></div>{librarian && <button className="button button-dark" onClick={onNewLoan}><Plus size={16} /> Issue a book</button>}</div>
    <section className="content-section"><div className="toolbar"><div className="segmented">{[['all', 'All records'], ['active', 'On loan'], ['overdue', 'Overdue'], ['returned', 'Returned']].map(([id, label]) => <button key={id} className={filter === id ? 'active' : ''} onClick={() => setFilter(id)}>{label}</button>)}</div><span className="record-count">{filtered.length} records</span></div><LoanTable loans={filtered} librarian={librarian} onReturn={onReturn} />{filtered.length === 0 && <EmptyState title="Nothing in this view" text="Borrowing records will show here when books are issued." />}</section></>
}

function LoanTable({ loans, librarian, onReturn, compact = false }) {
  return <div className="table-wrap"><table><thead><tr><th>Book</th>{librarian && <th>Member</th>}<th>Issued</th><th>Due date</th><th>Status</th>{librarian && !compact && <th />}</tr></thead><tbody>{loans.map((loan) => {
    const overdue = loan.status === 'active' && new Date(loan.dueDate) < new Date()
    return <tr key={loan._id}><td><div className="loan-book"><strong>{loan.book?.title || 'Deleted book'}</strong><small>{loan.book?.author || ''}</small></div></td>{librarian && <td><div className="table-member">{loan.member?.name || 'Member'}</div></td>}<td className="muted-cell">{formatDate(loan.issueDate)}</td><td className={overdue ? 'overdue-date' : 'muted-cell'}>{formatDate(loan.dueDate)}</td><td><span className={`status-pill ${loan.status === 'returned' ? 'status-returned' : overdue ? 'status-overdue' : 'status-active'}`}><i />{loan.status === 'returned' ? 'Returned' : overdue ? 'Overdue' : 'On loan'}</span>{loan.fine > 0 && <small className="fine-label">Fine ${loan.fine.toFixed(2)}</small>}</td>{librarian && !compact && <td>{loan.status === 'active' && <button className="small-action return-action" onClick={() => onReturn(loan)}><RotateCcw size={13} /> Return</button>}</td>}</tr>
  })}</tbody></table></div>
}

function EmptyState({ title, text }) { return <div className="empty-state"><BookOpen size={21} /><strong>{title}</strong><span>{text}</span></div> }

function Modal({ onClose, children }) {
  useEffect(() => {
    function onKey(event) { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section className="modal-panel" role="dialog" aria-modal="true">{children}</section></div>
}

function BookForm({ book, onCancel, onSave }) {
  const [form, setForm] = useState({ title: book?.title || '', author: book?.author || '', isbn: book?.isbn || '', category: book?.category || 'Fiction', totalCopies: book?.totalCopies ?? 1 })
  return <form className="modal-form" onSubmit={(event) => { event.preventDefault(); onSave({ ...form, totalCopies: Number(form.totalCopies) }) }}><div className="modal-heading"><span className="eyebrow">COLLECTION MANAGEMENT</span><button type="button" className="icon-button" onClick={onCancel} aria-label="Close"><X size={18} /></button></div><h2>{book ? 'Edit book' : 'Add a book'}</h2><p className="modal-intro">Keep the catalog details up to date.</p><label>Title<input required value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="The book title" /></label><div className="form-row"><label>Author<input required value={form.author} onChange={(event) => setForm({ ...form, author: event.target.value })} placeholder="Author name" /></label><label>Category<select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}>{['Fiction', 'Non-fiction', 'Mystery', 'Science', 'History', 'Poetry', 'Biography', 'Children', 'Other'].map((category) => <option key={category}>{category}</option>)}</select></label></div><div className="form-row"><label>ISBN<input value={form.isbn} onChange={(event) => setForm({ ...form, isbn: event.target.value })} placeholder="978-..." /></label><label>Total copies<input required type="number" min="1" value={form.totalCopies} onChange={(event) => setForm({ ...form, totalCopies: event.target.value })} /></label></div><div className="modal-actions"><button type="button" className="button button-outline" onClick={onCancel}>Cancel</button><button className="button button-dark">{book ? 'Save changes' : 'Add to catalog'}</button></div></form>
}

function LoanForm({ books, members, librarian, onCancel, onSave }) {
  const [form, setForm] = useState({ bookId: books.find((book) => book.availableCopies > 0)?._id || '', memberId: librarian ? members[0]?._id || '' : '', dueDate: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10) })
  const availableBooks = books.filter((book) => book.availableCopies > 0)
  return <form className="modal-form" onSubmit={(event) => { event.preventDefault(); onSave(form) }}><div className="modal-heading"><span className="eyebrow">LENDING DESK</span><button type="button" className="icon-button" onClick={onCancel} aria-label="Close"><X size={18} /></button></div><h2>Issue a book</h2><p className="modal-intro">Create a checkout and set its return date.</p>{librarian && <label>Member<select required value={form.memberId} onChange={(event) => setForm({ ...form, memberId: event.target.value })}><option value="">Choose a member</option>{members.map((member) => <option key={member._id} value={member._id}>{member.name} · {member.email}</option>)}</select></label>}<label>Book<select required value={form.bookId} onChange={(event) => setForm({ ...form, bookId: event.target.value })}><option value="">Choose an available book</option>{availableBooks.map((book) => <option key={book._id} value={book._id}>{book.title} · {book.availableCopies} available</option>)}</select></label><label>Due date<input required type="date" value={form.dueDate} min={new Date().toISOString().slice(0, 10)} onChange={(event) => setForm({ ...form, dueDate: event.target.value })} /></label>{availableBooks.length === 0 && <div className="form-error">No books are currently available to issue.</div>}<div className="modal-actions"><button type="button" className="button button-outline" onClick={onCancel}>Cancel</button><button className="button button-dark" disabled={!availableBooks.length}>Confirm issue <ArrowDownToLine size={15} /></button></div></form>
}

function ReturnForm({ loan, onCancel, onSave }) {
  const daysLate = Math.max(0, Math.ceil((Date.now() - new Date(loan.dueDate).getTime()) / 86400000))
  const fine = daysLate * Number(import.meta.env.VITE_FINE_PER_DAY || 1)
  return <div className="modal-form"><div className="modal-heading"><span className="eyebrow">LENDING DESK</span><button className="icon-button" onClick={onCancel} aria-label="Close"><X size={18} /></button></div><h2>Record a return</h2><p className="modal-intro">Mark this copy as returned to the collection.</p><div className="return-summary"><span className="return-icon"><RotateCcw size={18} /></span><span><strong>{loan.book?.title}</strong><small>Borrowed by {loan.member?.name} · due {formatDate(loan.dueDate)}</small></span></div><div className="fine-summary"><span>Overdue fine <small>{daysLate} {daysLate === 1 ? 'day' : 'days'} × ${Number(import.meta.env.VITE_FINE_PER_DAY || 1).toFixed(2)} / day</small></span><strong>${fine.toFixed(2)}</strong></div><div className="modal-actions"><button className="button button-outline" onClick={onCancel}>Cancel</button><button className="button button-dark" onClick={onSave}>Confirm return <Check size={15} /></button></div></div>
}

export default App
