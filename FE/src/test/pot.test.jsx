import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Pot from '../pages/Pot'
import { vi } from 'vitest'

global.fetch = vi.fn()

vi.mock('../components/Layout', () => ({
  default: ({ children }) => children
}))

vi.mock('../hooks/useWatchlist', () => ({
  useWatchlist: () => ({
    notifications: [],
    dismissNotification: vi.fn(),
    dismissAll: vi.fn()
  })
}))

vi.mock('../firebase', () => ({
  db: {},
  auth: {}
}))

function mockSearch() {
  fetch.mockImplementation((url) => {
    if (url.includes('/search')) {
      return Promise.resolve({
        json: () =>
          Promise.resolve([
            {
              id: 1,
              ime: 'Janez',
              priimek: 'Novak',
              tip: 'oseba'
            },
            {
              id: 2,
              ime: 'Marija',
              priimek: 'Kovač',
              tip: 'oseba'
            }
          ])
      })
    }

    if (url.includes('/pot')) {
      return Promise.resolve({
        json: () =>
          Promise.resolve({
            stopnje: 2,
            path: [
              {
                type: 'oseba',
                id: 1,
                name: 'Janez Novak',
                vloga: 'Direktor'
              },
              {
                type: 'podjetje',
                id: 10,
                name: 'Test d.o.o.',
                vloga: 'Direktor'
              },
              {
                type: 'oseba',
                id: 2,
                name: 'Marija Kovač',
                vloga: 'Članica uprave'
              }
            ]
          })
      })
    }

    return Promise.reject(new Error('Neznan endpoint'))
  })
}

function renderPot() {
  return render(
    <MemoryRouter>
      <Pot />
    </MemoryRouter>
  )
}

async function selectPerson(input, personName) {
  fireEvent.change(input, {
    target: { value: personName }
  })

  const option = await screen.findByRole('button', {
    name: new RegExp(personName, 'i')
  })

  fireEvent.mouseDown(option)

  await waitFor(() => {
    expect(input).not.toBeInTheDocument()
  })
}

beforeEach(() => {
  fetch.mockReset()
})

describe('Pot page', () => {
  test('ne dovoli iskanja brez obeh oseb', async () => {
    renderPot()

    const gumb = screen.getByRole('button', {
      name: /poišči pot/i
    })

    expect(gumb).toBeDisabled()

    fireEvent.click(gumb)

    expect(fetch).not.toHaveBeenCalled()
  })

  test('prikaže začetno stanje strani brez rezultata (intro vsebina)', () => {
    renderPot()

    expect(
      screen.getByText(/Izberi dve osebi/i)
    ).toBeInTheDocument()

    expect(
      screen.getByText(/Algoritem najde pot/i)
    ).toBeInTheDocument()

    expect(
      screen.getByText(/Vidi povezanost/i)
    ).toBeInTheDocument()

    expect(
      screen.getByText(/Poisci osebi v iskalni vrstici/i)
    ).toBeInTheDocument()

    expect(
      screen.getByText(/BFS skozi poslovne mreže/i)
    ).toBeInTheDocument()

    expect(
      screen.getByText(/Pot skozi skupna podjetja/i)
    ).toBeInTheDocument()
  })


  test('prikaže autocomplete predloge po vnosu znakov', async () => {
    mockSearch()
    renderPot()

    const inputs = screen.getAllByRole('textbox')

    fireEvent.change(inputs[0], {
      target: { value: 'Jan' }
    })

    await waitFor(() => {
      expect(
        screen.getByRole('button', {
          name: /Janez Novak/i
        })
      ).toBeInTheDocument()
    })

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/search?q=Jan')
    )
  })

  test('omogoči izbiro osebe iz autocomplete seznama', async () => {
    mockSearch()
    renderPot()

    const inputs = screen.getAllByRole('textbox')

    fireEvent.change(inputs[0], {
      target: { value: 'Jan' }
    })

    const option = await screen.findByRole('button', {
      name: /Janez Novak/i
    })

    fireEvent.mouseDown(option)

    await waitFor(() => {
      expect(
        screen.getByText('Janez Novak')
      ).toBeInTheDocument()
    })

    expect(
      screen.queryByPlaceholderText(/Npr. Janez Novak/i)
    ).not.toBeInTheDocument()
  })

  test('gumb za zamenjavo oseb zamenja izbrani osebi', async () => {
    mockSearch()
    renderPot()

    let inputs = screen.getAllByRole('textbox')

    await selectPerson(inputs[0], 'Jan')
    
    inputs = screen.getAllByRole('textbox')

    await selectPerson(inputs[0], 'Mar')

    // Po izbiri oseb sta prikazani imeni kot izbrani osebi
    expect(screen.getByText('Janez Novak')).toBeInTheDocument()
    expect(screen.getByText('Marija Kovač')).toBeInTheDocument()

    const swapButton = screen.getByRole('button', {
      name: /zamenjaj osebi/i
    })

    fireEvent.click(swapButton)

    await waitFor(() => {
      expect(screen.getByText('Janez Novak')).toBeInTheDocument()
      expect(screen.getByText('Marija Kovač')).toBeInTheDocument()
    })

    // Preverimo dejansko zamenjavo prek /pot endpointa.
    fireEvent.click(
      screen.getByRole('button', {
        name: /poišči pot/i
      })
    )

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/pot?od=2&do=1')
      )
    })
  })

  test('pravilno pokliče API endpoint /pot z izbranima osebama', async () => {
    mockSearch()
    renderPot()

    let inputs = screen.getAllByRole('textbox')

    fireEvent.change(inputs[0], {
      target: { value: 'Jan' }
    })

    let option = await screen.findByRole('button', {
      name: /Janez Novak/i
    })

    fireEvent.mouseDown(option)

    inputs = screen.getAllByRole('textbox')

    fireEvent.change(inputs[0], {
      target: { value: 'Mar' }
    })

    option = await screen.findByRole('button', {
      name: /Marija Kovač/i
    })

    fireEvent.mouseDown(option)

    const gumb = screen.getByRole('button', {
      name: /poišči pot/i
    })

    await waitFor(() => {
      expect(gumb).not.toBeDisabled()
    })

    fireEvent.click(gumb)

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/pot?od=1&do=2')
      )
    })
  })

  test('prikaže pot, ki vsebuje povezane osebe in podjetja', async () => {
    mockSearch()
    renderPot()

    let inputs = screen.getAllByRole('textbox')

    await selectPerson(inputs[0], 'Jan')

    inputs = screen.getAllByRole('textbox')

    await selectPerson(inputs[0], 'Mar')

    fireEvent.click(
      screen.getByRole('button', {
        name: /poišči pot/i
      })
    )

    await waitFor(() => {
      expect(
        screen.getAllByText('Janez Novak').length
      ).toBeGreaterThanOrEqual(2)

      expect(
        screen.getByText('Test d.o.o.')
      ).toBeInTheDocument()

      expect(
        screen.getAllByText('Marija Kovač').length
      ).toBeGreaterThanOrEqual(2)
    })

    expect(
      screen.getAllByText('Direktor').length
    ).toBeGreaterThanOrEqual(1)

    expect(
      screen.getByText('Članica uprave')
    ).toBeInTheDocument()
  })


  test('prikaže sporočilo, ko pot ni najdena', async () => {
    fetch.mockImplementation((url) => {
      if (url.includes('/search')) {
        return Promise.resolve({
          json: () =>
            Promise.resolve([
              {
                id: 1,
                ime: 'Janez',
                priimek: 'Novak',
                tip: 'oseba'
              },
              {
                id: 2,
                ime: 'Marija',
                priimek: 'Kovač',
                tip: 'oseba'
              }
            ])
        })
      }

      if (url.includes('/pot')) {
        return Promise.resolve({
          json: () =>
            Promise.resolve({
              sporocilo: 'Pot med osebama ni bila najdena.'
            })
        })
      }
    })

    renderPot()

    let inputs = screen.getAllByRole('textbox')

    await selectPerson(inputs[0], 'Jan')

    inputs = screen.getAllByRole('textbox')

    await selectPerson(inputs[0], 'Mar')

    fireEvent.click(
      screen.getByRole('button', {
        name: /poišči pot/i
      })
    )

    await waitFor(() => {
      expect(
        screen.getByText(/Pot med osebama ni bila najdena/i)
      ).toBeInTheDocument()
    })
  })

  test('prikaže obvestilo ob napaki API klica', async () => {
    fetch.mockImplementation((url) => {
      if (url.includes('/search')) {
        return Promise.resolve({
          json: () =>
            Promise.resolve([
              {
                id: 1,
                ime: 'Janez',
                priimek: 'Novak',
                tip: 'oseba'
              },
              {
                id: 2,
                ime: 'Marija',
                priimek: 'Kovač',
                tip: 'oseba'
              }
            ])
        })
      }

      if (url.includes('/pot')) {
        return Promise.reject(new Error('API napaka'))
      }

      return Promise.reject(new Error('Neznan endpoint'))
    })

    renderPot()

    let inputs = screen.getAllByRole('textbox')

    await selectPerson(inputs[0], 'Jan')

    inputs = screen.getAllByRole('textbox')

    await selectPerson(inputs[0], 'Mar')

    fireEvent.click(
      screen.getByRole('button', {
        name: /poišči pot/i
      })
    )

    await waitFor(() => {
      expect(
        screen.getByText(/Napaka pri iskanju poti/i)
      ).toBeInTheDocument()
    })
  })

  test('prikaže loading stanje med iskanjem poti', async () => {
    let resolvePot

    fetch.mockImplementation((url) => {
      if (url.includes('/search')) {
        return Promise.resolve({
          json: () =>
            Promise.resolve([
              {
                id: 1,
                ime: 'Janez',
                priimek: 'Novak',
                tip: 'oseba'
              },
              {
                id: 2,
                ime: 'Marija',
                priimek: 'Kovač',
                tip: 'oseba'
              }
            ])
        })
      }

      if (url.includes('/pot')) {
        return new Promise((resolve) => {
          resolvePot = resolve
        })
      }

      return Promise.reject(new Error('Neznan endpoint'))
    })

    renderPot()

    let inputs = screen.getAllByRole('textbox')

    await selectPerson(inputs[0], 'Jan')

    inputs = screen.getAllByRole('textbox')

    await selectPerson(inputs[0], 'Mar')

    const gumb = screen.getByRole('button', {
      name: /poišči pot/i
    })

    fireEvent.click(gumb)

    await waitFor(() => {
      expect(
        document.querySelector('.pot-spinner')
      ).toBeInTheDocument()
    })

    expect(gumb).toBeDisabled()

    expect(
      screen.queryByText(/Izberi dve osebi/i)
    ).not.toBeInTheDocument()

    await act(async () => {
      resolvePot({
        json: () =>
          Promise.resolve({
            stopnje: 1,
            path: [
              {
                type: 'oseba',
                id: 1,
                name: 'Janez Novak'
              }
            ]
          })
      })
    })

    await waitFor(() => {
      expect(
        document.querySelector('.pot-spinner')
      ).not.toBeInTheDocument()
    })
  })
})