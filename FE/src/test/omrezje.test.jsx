import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import Omrezje from '../pages/Omrezje'
import { exportNetworkPdf } from '../utils/generateGrafPdf'

const mockNavigate = vi.fn()

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

vi.mock('../components/Layout', () => ({
  default: ({ children }) => <div>{children}</div>,
}))

vi.mock('../utils/generateGrafPdf', () => ({
  exportNetworkPdf: vi.fn(),
}))

vi.mock('vis-network', () => {
  return {
    Network: class {
      constructor(container, data, options) {
        this.container = container
        this.data = data
        this.options = options
      }
      on() {}
      once(_, cb) {
        setTimeout(() => cb(), 0)
      }
      fit() {}
      destroy() {}
    },
  }
})

vi.mock('../api', () => ({
  API: 'http://test-api',
}))

const mockData = {
  center: { id: 1, name: 'Janez Novak' },
  nodes: [
    { key: 1, name: 'Janez Novak', type: 'oseba', depth: 0, id: 1 },
    { key: 2, name: 'Firma d.o.o.', type: 'podjetje', depth: 1, id: 2 },
  ],
  edges: [{ from: 1, to: 2 }],
}

beforeEach(() => {
  vi.clearAllMocks()

  global.fetch = vi.fn(() =>
    Promise.resolve({
      json: () => Promise.resolve(mockData),
    })
  )
})

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/omrezje/1']}>
      <Routes>
        <Route path="/omrezje/:id" element={<Omrezje />} />
      </Routes>
    </MemoryRouter>
  )
}

describe('Omrezje page', () => {
  it('prikaže loading state', () => {
    renderPage()
    expect(screen.getByText(/nalagam omrežje/i)).toBeInTheDocument()
  })

  it('prikaže naslov in statistiko', async () => {
    renderPage()

    expect(await screen.findByText('Janez Novak')).toBeInTheDocument()
    expect(
      screen.getByText(/2 vozlišč · 1 povezav/i)
    ).toBeInTheDocument()
  })

  it('prikaže depth gumbe', async () => {
    renderPage()

    expect(await screen.findByText('Stopnje:')).toBeInTheDocument()
    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
  })

  it('klik na depth spremeni active state (UI)', async () => {
    const user = userEvent.setup()
    renderPage()

    const btn = await screen.findByText('3')
    await user.click(btn)

    expect(btn.className).toContain('active')
  })

  it('prikaže filter gumbe', async () => {
    renderPage()

    expect(await screen.findByText('Osebe')).toBeInTheDocument()
    expect(screen.getByText('Podjetja')).toBeInTheDocument()
  })

  it('klik na filter resetira selection UI', async () => {
    const user = userEvent.setup()
    renderPage()

    const btn = await screen.findByText('Osebe')
    await user.click(btn)

    expect(btn.className).toContain('active')
  })

  it('PDF gumb kliče export funkcijo', async () => {
    const user = userEvent.setup()
    renderPage()

    const btn = await screen.findByText(/prenesi pdf/i)
    await user.click(btn)

    expect(exportNetworkPdf).toHaveBeenCalled()
  })

  it('fetch se pokliče in rendera center ime', async () => {
    renderPage()

    expect(await screen.findByText('Janez Novak')).toBeInTheDocument()
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/omrezje/1')
    )
  })

  it('klik na Profil navigira', async () => {
    const user = userEvent.setup()
    renderPage()

    const back = await screen.findByText(/profil/i)
    await user.click(back)

    expect(mockNavigate).toHaveBeenCalledWith('/oseba/1')
  })
})