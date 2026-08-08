import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
} from 'vitest'

import {
  render,
  screen,
  waitFor,
  cleanup,
  within,
} from '@testing-library/react'

import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import Podjetja from '../pages/Podjetja'

const mockNavigate = vi.fn()

const mockPodjetja = [
  {
    id: 1,
    popolno_ime: 'Firma d.o.o.',
    pravna_oblika: 'd.o.o.',
    posta: '1000 Ljubljana',
    stevilo_povezav: 5,
  },
]

vi.mock('../components/Layout', () => ({
  default: ({ children }) => <>{children}</>,
}))

vi.mock('../components/Avatar', () => ({
  default: ({ name }) => <div>{name}</div>,
}))

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')

  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

vi.mock('../api', () => ({
  API: 'http://test-api',
}))

function createResponse(data) {
  return {
    ok: true,
    json: () => Promise.resolve(data),
  }
}

function defaultResponse() {
  return createResponse({
    podjetja: mockPodjetja,
    skupaj: 1,
  })
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/podjetja']}>
      <Podjetja />
    </MemoryRouter>
  )
}

beforeEach(() => {
  cleanup()
  vi.clearAllMocks()

  global.fetch = vi.fn(() =>
    Promise.resolve(defaultResponse())
  )
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('Podjetja page', () => {
  it('prikaže loading state', () => {
    renderPage()

    expect(
      screen.getByText(/nalagam podatke/i)
    ).toBeInTheDocument()
  })



  it('prikaže pravno obliko podjetja', async () => {
    renderPage()

    const card = await screen.findByRole('button', {
      name: /Firma d\.o\.o\./i,
    })

    expect(
      within(card).getByText('d.o.o.')
    ).toBeInTheDocument()
  })

  it('prikaže pošto podjetja', async () => {
    renderPage()

    const card = await screen.findByRole('button', {
      name: /Firma d\.o\.o\./i,
    })

    expect(
      within(card).getByText('1000 Ljubljana')
    ).toBeInTheDocument()
  })

  it('prikaže število povezanih oseb', async () => {
    renderPage()

    const card = await screen.findByRole('button', {
      name: /Firma d\.o\.o\./i,
    })

    expect(
      within(card).getByText('5 oseb')
    ).toBeInTheDocument()
  })

  it('pravilno prikaže "1 oseba"', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve(
        createResponse({
          podjetja: [
            {
              ...mockPodjetja[0],
              stevilo_povezav: 1,
            },
          ],
          skupaj: 1,
        })
      )
    )

    renderPage()

    const card = await screen.findByRole('button', {
      name: /Firma d\.o\.o\./i,
    })

    expect(
      within(card).getByText('1 oseba')
    ).toBeInTheDocument()
  })

  it('pravilno prikaže "5 oseb"', async () => {
    renderPage()

    const card = await screen.findByRole('button', {
      name: /Firma d\.o\.o\./i,
    })

    expect(
      within(card).getByText('5 oseb')
    ).toBeInTheDocument()
  })


  it('klik na podjetje navigira na pravilen profil', async () => {
    const user = userEvent.setup()

    renderPage()

    const card = await screen.findByRole('button', {
      name: /Firma d\.o\.o\./i,
    })

    await user.click(card)

    expect(mockNavigate).toHaveBeenCalledWith(
      '/podjetje/1'
    )
  })


  it('prikaže prazen seznam podjetij', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve(
        createResponse({
          podjetja: [],
          skupaj: 0,
        })
      )
    )

    renderPage()

    expect(
      await screen.findByText('0 podjetij')
    ).toBeInTheDocument()

    expect(
      screen.queryByText('Firma d.o.o.')
    ).not.toBeInTheDocument()
  })

  it('prikaže število podjetij iz API odgovora', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve(
        createResponse({
          podjetja: mockPodjetja,
          skupaj: 123,
        })
      )
    )

    renderPage()

    expect(
      await screen.findByText('123 podjetij')
    ).toBeInTheDocument()
  })

  it('omogoča vnos iskalnega niza', async () => {
    const user = userEvent.setup()

    renderPage()

    const input = screen.getByPlaceholderText(
      'Ime podjetja ali organizacije…'
    )

    await user.type(input, 'Firma')

    expect(input).toHaveValue('Firma')
  })

  it('sprememba sortiranja sproži nov fetch', async () => {
    const user = userEvent.setup()

    renderPage()

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled()
    })

    const initialCalls = global.fetch.mock.calls.length

    const select = screen.getByRole('combobox')

    await user.selectOptions(select, 'az')

    await waitFor(() => {
      expect(global.fetch.mock.calls.length).toBeGreaterThan(
        initialCalls
      )
    })

    expect(select).toHaveValue('az')
  })


  it('omogoča sortiranje po Največ oseb', async () => {
    const user = userEvent.setup()

    renderPage()

    const select = screen.getByRole('combobox')

    await user.selectOptions(select, 'povezave')

    expect(select).toHaveValue('povezave')

    await waitFor(() => {
      expect(
        global.fetch.mock.calls.some(([url]) =>
          String(url).includes('sort=povezave')
        )
      ).toBe(true)
    })
  })

  it('omogoča sortiranje A → Ž', async () => {
    const user = userEvent.setup()

    renderPage()

    const select = screen.getByRole('combobox')

    await user.selectOptions(select, 'az')

    expect(select).toHaveValue('az')

    await waitFor(() => {
      expect(
        global.fetch.mock.calls.some(([url]) =>
          String(url).includes('sort=az')
        )
      ).toBe(true)
    })
  })

  it('omogoča sortiranje Ž → A', async () => {
    const user = userEvent.setup()

    renderPage()

    const select = screen.getByRole('combobox')

    await user.selectOptions(select, 'za')

    expect(select).toHaveValue('za')

    await waitFor(() => {
      expect(
        global.fetch.mock.calls.some(([url]) =>
          String(url).includes('sort=za')
        )
      ).toBe(true)
    })
  })


  it('gumb Ponastavi filtre počisti iskanje', async () => {
    const user = userEvent.setup()

    renderPage()

    const input = screen.getByPlaceholderText(
      'Ime podjetja ali organizacije…'
    )

    await user.type(input, 'Firma')

    expect(input).toHaveValue('Firma')

    const resetButton = screen.getByRole('button', {
      name: 'Ponastavi filtre',
    })

    await user.click(resetButton)

    expect(input).toHaveValue('')
  })

  it('ponastavitev filtrov vrne sortiranje na privzeto vrednost', async () => {
    const user = userEvent.setup()

    renderPage()

    const select = screen.getByRole('combobox')

    await user.selectOptions(select, 'az')

    expect(select).toHaveValue('az')

    const resetButton = screen.getByRole('button', {
      name: 'Ponastavi filtre',
    })

    await user.click(resetButton)

    expect(select).toHaveValue('povezave')
  })

  it('prikaže paginacijo, ko je več kot 40 podjetij', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve(
        createResponse({
          podjetja: mockPodjetja,
          skupaj: 85,
        })
      )
    )

    renderPage()

    expect(
      await screen.findByText('Stran 1 / 3')
    ).toBeInTheDocument()

    expect(
      screen.getByRole('button', {
        name: '← Prej',
      })
    ).toBeInTheDocument()

    expect(
      screen.getByRole('button', {
        name: 'Naprej →',
      })
    ).toBeInTheDocument()
  })

  it('gumb Naprej spremeni stran', async () => {
    const user = userEvent.setup()

    global.fetch = vi.fn(() =>
      Promise.resolve(
        createResponse({
          podjetja: mockPodjetja,
          skupaj: 85,
        })
      )
    )

    renderPage()

    await screen.findByText('Stran 1 / 3')

    const nextButton = screen.getByRole('button', {
      name: 'Naprej →',
    })

    await user.click(nextButton)

    expect(
      await screen.findByText('Stran 2 / 3')
    ).toBeInTheDocument()
  })

  it('gumb Prej spremeni stran nazaj', async () => {
    const user = userEvent.setup()

    global.fetch = vi.fn(() =>
      Promise.resolve(
        createResponse({
          podjetja: mockPodjetja,
          skupaj: 85,
        })
      )
    )

    renderPage()

    await screen.findByText('Stran 1 / 3')

    const nextButton = screen.getByRole('button', {
      name: 'Naprej →',
    })

    await user.click(nextButton)

    await screen.findByText('Stran 2 / 3')

    const prevButton = screen.getByRole('button', {
      name: '← Prej',
    })

    await user.click(prevButton)

    expect(
      await screen.findByText('Stran 1 / 3')
    ).toBeInTheDocument()
  })

  it('gumb Prej je onemogočen na prvi strani', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve(
        createResponse({
          podjetja: mockPodjetja,
          skupaj: 85,
        })
      )
    )

    renderPage()

    await screen.findByText('Stran 1 / 3')

    const prevButton = screen.getByRole('button', {
      name: '← Prej',
    })

    expect(prevButton).toBeDisabled()
  })

  it('gumb Naprej je onemogočen na zadnji strani', async () => {
    const user = userEvent.setup()

    global.fetch = vi.fn(() =>
      Promise.resolve(
        createResponse({
          podjetja: mockPodjetja,
          skupaj: 41,
        })
      )
    )

    renderPage()

    await screen.findByText('Stran 1 / 2')

    const nextButton = screen.getByRole('button', {
      name: 'Naprej →',
    })

    await user.click(nextButton)

    await screen.findByText('Stran 2 / 2')

    expect(
      screen.getByRole('button', {
        name: 'Naprej →',
      })
    ).toBeDisabled()
  })

  it('uporabi pravilen API URL z limit in offset parametri', async () => {
    renderPage()

    await waitFor(() => {
      expect(
        global.fetch.mock.calls.some(([url]) =>
          String(url).includes(
            '/api/podjetja?limit=40&offset=0'
          )
        )
      ).toBe(true)
    })
  })

  it('na drugi strani uporabi pravilen offset', async () => {
    const user = userEvent.setup()

    global.fetch = vi.fn(() =>
      Promise.resolve(
        createResponse({
          podjetja: mockPodjetja,
          skupaj: 85,
        })
      )
    )

    renderPage()

    await screen.findByText('Stran 1 / 3')

    const nextButton = screen.getByRole('button', {
      name: 'Naprej →',
    })

    await user.click(nextButton)

    await waitFor(() => {
      expect(
        global.fetch.mock.calls.some(([url]) =>
          String(url).includes(
            '/api/podjetja?limit=40&offset=40'
          )
        )
      ).toBe(true)
    })
  })


  it('ob API napaki stran ne pade', async () => {
    global.fetch = vi.fn(() =>
      Promise.reject(new Error('API error'))
    )

    renderPage()

    await waitFor(() => {
      expect(
        screen.getByRole('combobox')
      ).toBeInTheDocument()
    })

    expect(
      screen.getByPlaceholderText(
        'Ime podjetja ali organizacije…'
      )
    ).toBeInTheDocument()
  })

  it('uporabi AbortController pri menjavi strani', async () => {
    const abortSpy = vi.spyOn(
      AbortController.prototype,
      'abort'
    )

    const user = userEvent.setup()

    global.fetch = vi.fn(() =>
      Promise.resolve(
        createResponse({
          podjetja: mockPodjetja,
          skupaj: 85,
        })
      )
    )

    renderPage()

    await screen.findByText('Stran 1 / 3')

    const nextButton = screen.getByRole('button', {
      name: 'Naprej →',
    })

    await user.click(nextButton)

    await waitFor(() => {
      expect(abortSpy).toHaveBeenCalled()
    })

    abortSpy.mockRestore()
  })


  it('podjetje brez pravna_oblika se normalno izriše', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve(
        createResponse({
          podjetja: [
            {
              id: 2,
              popolno_ime: 'Brez oblike d.o.o.',
              posta: '2000 Maribor',
              stevilo_povezav: 2,
            },
          ],
          skupaj: 1,
        })
      )
    )

    renderPage()

    const card = await screen.findByRole('button', {
      name: /Brez oblike d\.o\.o\./i,
    })

    expect(card).toBeInTheDocument()

    expect(
      within(card).getByText('2000 Maribor')
    ).toBeInTheDocument()

    expect(
      within(card).queryByText('d.o.o.')
    ).not.toBeInTheDocument()
  })

  it('podjetje brez posta se normalno izriše', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve(
        createResponse({
          podjetja: [
            {
              id: 3,
              popolno_ime: 'Brez pošte d.o.o.',
              pravna_oblika: 'd.o.o.',
              stevilo_povezav: 3,
            },
          ],
          skupaj: 1,
        })
      )
    )

    renderPage()

    const card = await screen.findByRole('button', {
      name: /Brez pošte d\.o\.o\./i,
    })

    expect(card).toBeInTheDocument()

    expect(
      within(card).getByText('d.o.o.')
    ).toBeInTheDocument()

    expect(
      within(card).queryByText('1000 Ljubljana')
    ).not.toBeInTheDocument()
  })
})