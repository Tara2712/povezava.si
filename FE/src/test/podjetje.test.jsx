import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import Podjetje from '../pages/Podjetje'

const mockData = {
  id: 1,
  popolno_ime: 'Firma d.o.o.',
  pravna_oblika: 'd.o.o.',
  posta: '1000 Ljubljana',
  maticna: '12345678',
  osebe: [
    {
      oseba_id: 10,
      ime: 'Janez',
      priimek: 'Novak',
      vloga: 'Direktor',
      datum_od: '2020-01-01',
      vir: 'https://example.com',
    },
  ],
}

beforeEach(() => {
  vi.clearAllMocks()

  global.fetch = vi.fn(() =>
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve(mockData),
    })
  )
})

vi.mock('../components/Layout', () => ({
  default: ({ children }) => <div>{children}</div>,
}))

vi.mock('../components/Avatar', () => ({
  default: ({ name }) => <div>{name}</div>,
}))

vi.mock('../utils/generatePodjetjePdf', () => ({
  generatePodjetjePdf: vi.fn(),
}))

vi.mock('../api', () => ({
  API: 'http://test-api',
}))

function renderPage(id = 1) {
  return render(
    <MemoryRouter initialEntries={[`/podjetje/${id}`]}>
      <Routes>
        <Route path="/podjetje/:id" element={<Podjetje />} />
      </Routes>
    </MemoryRouter>
  )
}

describe('Podjetje page', () => {
  it('prikaže loading state', () => {
    renderPage()
    expect(screen.getByText(/nalagam/i)).toBeInTheDocument()
  })

    it('prikaže osnovne podatke podjetja', async () => {
    renderPage()

    expect(
        await screen.findByRole('heading', { name: /Firma d\.o\.o\./i })
    ).toBeInTheDocument()

    const sub = await screen.findByText('d.o.o.')
    expect(sub).toBeInTheDocument()

    const posta = screen.getByText(/1000 Ljubljana/i)
    expect(posta).toBeInTheDocument()
    })

    it('prikaže povezane osebe', async () => {
    renderPage()

    const card = await screen.findByRole('link', {
        name: /Janez Novak/i,
    })

    expect(card).toBeInTheDocument()

    const utils = within(card)

    expect(utils.getByText(/Direktor/i)).toBeInTheDocument()

    expect(card.querySelector('.conn-name'))
        .toHaveTextContent('Janez Novak')
    })

  it('prikaže empty state', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            ...mockData,
            osebe: [],
          }),
      })
    )

    renderPage()

    expect(
      await screen.findByText(/ni znanih oseb/i)
    ).toBeInTheDocument()
  })

  it('fetch se pokliče za podjetje', async () => {
    renderPage()

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/podjetja/1')
      )
    })
  })

  it('PDF gumb je prisoten', async () => {
    renderPage()

    expect(
      await screen.findByRole('button', { name: /prenesi pdf/i })
    ).toBeInTheDocument()
  })
})