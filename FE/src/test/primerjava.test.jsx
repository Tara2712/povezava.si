import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Primerjava from '../pages/Primerjava'
import { vi } from 'vitest'

vi.mock('../components/Layout', () => ({
  default: ({ children }) => <>{children}</>
}))

vi.mock('../components/Avatar', () => ({
  default: ({ name }) => <div>{name}</div>
}))

vi.mock('../api', () => ({
  API: 'http://test-api'
}))

global.fetch = vi.fn()

beforeEach(() => {
  fetch.mockReset()
})

function renderWithParams(url) {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <Primerjava />
    </MemoryRouter>
  )
}

const mockData = {
  oseba_a: {
    id: 1,
    ime: 'Janez',
    priimek: 'Novak',
    stevilo_povezav: 5,
    institucija: 'ABC d.o.o.',
    fotografija_url: ''
  },
  oseba_b: {
    id: 2,
    ime: 'Marija',
    priimek: 'Kovač',
    stevilo_povezav: 3,
    institucija: 'XYZ d.o.o.',
    fotografija_url: ''
  },
  skupna_podjetja: [
    {
      id: 10,
      popolno_ime: 'Podjetje A',
      pravna_oblika: 'd.o.o.',
      vloga_a: 'Direktor',
      vloga_b: 'Član',
      od_a: '2020-01-01',
      do_a: null,
      od_b: '2019-01-01',
      do_b: '2021-01-01'
    }
  ]
}

describe('Primerjava page', () => {

  test('prikaže loading state', () => {
    fetch.mockImplementation(() => new Promise(() => {}))

    renderWithParams('/primerjava?a=1&b=2')

    expect(
      screen.getByText(/nalagam primerjavo/i)
    ).toBeInTheDocument()
  })

  test('prikaže error, če manjkata parametra', async () => {
    renderWithParams('/primerjava')

    expect(
      await screen.findByText(/manjkata osebi/i)
    ).toBeInTheDocument()

    expect(fetch).not.toHaveBeenCalled()
  })

  test('uspešno pokliče API s pravilnima parametroma a in b', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockData
    })

    renderWithParams('/primerjava?a=1&b=2')

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        'http://test-api/osebe/primerjaj?a=1&b=2'
      )
    })
  })

  test('prikaže imeni obeh oseb v glavi primerjave', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockData
    })

    renderWithParams('/primerjava?a=1&b=2')

    await waitFor(() => {
      expect(screen.getAllByText('Janez Novak')).toHaveLength(2)
      expect(screen.getAllByText('Marija Kovač')).toHaveLength(2)
    })
  })

  test('prikaže število povezav za obe osebi', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockData
    })

    renderWithParams('/primerjava?a=1&b=2')

    await waitFor(() => {
      expect(screen.getByText('5')).toBeInTheDocument()
      expect(screen.getByText('3')).toBeInTheDocument()
      expect(screen.getByText('Število povezav')).toBeInTheDocument()
    })
  })

  test('osebo z več povezavami označi kot zmagovalca', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockData
    })

    renderWithParams('/primerjava?a=1&b=2')

    await waitFor(() => {
      const winners = document.querySelectorAll('.prj-winner')

      expect(winners).toHaveLength(1)
      expect(winners[0]).toHaveTextContent('5')
    })
  })

  test('prikaže število skupnih podjetij', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockData
    })

    renderWithParams('/primerjava?a=1&b=2')

    await waitFor(() => {
      expect(screen.getByText('Skupnih podjetij')).toBeInTheDocument()
      expect(screen.getByText('Skupna podjetja (1)')).toBeInTheDocument()
    })

    const sharedCount = screen.getAllByText('1')
    expect(sharedCount.length).toBeGreaterThanOrEqual(1)
  })

  test('prikaže podatke skupnega podjetja', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockData
    })

    renderWithParams('/primerjava?a=1&b=2')

    await waitFor(() => {
      expect(screen.getByText('Podjetje A')).toBeInTheDocument()
      expect(screen.getByText('d.o.o.')).toBeInTheDocument()
      expect(screen.getByText('Direktor')).toBeInTheDocument()
      expect(screen.getByText('Član')).toBeInTheDocument()
    })
  })

  test('prikaže obdobje povezave pri skupnem podjetju', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockData
    })

    renderWithParams('/primerjava?a=1&b=2')

    await waitFor(() => {
      expect(
        screen.getByText(/2020/i)
      ).toBeInTheDocument()

      expect(
        screen.getByText(/2019/i)
      ).toBeInTheDocument()

      expect(
        screen.getByText(/danes/i)
      ).toBeInTheDocument()

      expect(
        screen.getByText(/2021/i)
      ).toBeInTheDocument()
    })
  })

  test('pravilno prikaže obdobje, če datum manjka', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ...mockData,
        skupna_podjetja: [
          {
            ...mockData.skupna_podjetja[0],
            od_a: null,
            do_a: null,
            od_b: null,
            do_b: null
          }
        ]
      })
    })

    renderWithParams('/primerjava?a=1&b=2')

    await waitFor(() => {
      const dashes = screen.getAllByText('—')
      expect(dashes).toHaveLength(2)
    })
  })

  test('navigacija na profil prve osebe uporablja pravilen link', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockData
    })

    renderWithParams('/primerjava?a=1&b=2')

    await waitFor(() => {
      const links = screen.getAllByRole('link')

      const personLink = links.find(
        link => link.getAttribute('href') === '/oseba/1'
      )

      expect(personLink).toBeInTheDocument()
      expect(personLink).toHaveTextContent('Janez Novak')
    })
  })

  test('navigacija na profil druge osebe uporablja pravilen link', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockData
    })

    renderWithParams('/primerjava?a=1&b=2')

    await waitFor(() => {
      const links = screen.getAllByRole('link')

      const personLink = links.find(
        link => link.getAttribute('href') === '/oseba/2'
      )

      expect(personLink).toBeInTheDocument()
      expect(personLink).toHaveTextContent('Marija Kovač')
    })
  })

  test('navigacija na profil podjetja uporablja pravilen link', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockData
    })

    renderWithParams('/primerjava?a=1&b=2')

    await waitFor(() => {
      const companyLink = screen.getByRole('link', {
        name: 'Podjetje A'
      })

      expect(companyLink).toHaveAttribute(
        'href',
        '/podjetje/10'
      )
    })
  })

  test('prikaže napako, če API vrne napako', async () => {
    fetch.mockResolvedValueOnce({
      ok: false
    })

    renderWithParams('/primerjava?a=1&b=2')

    expect(
      await screen.findByText('Napaka pri nalaganju')
    ).toBeInTheDocument()
  })

  test('prikaže napako, če fetch zavrne zahtevo', async () => {
    fetch.mockRejectedValueOnce(
      new Error('Napaka omrežja')
    )

    renderWithParams('/primerjava?a=1&b=2')

    expect(
      await screen.findByText('Napaka omrežja')
    ).toBeInTheDocument()
  })

  test('ob neveljavnem praznem odgovoru ne poskuša prikazati primerjave', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({})
    })

    renderWithParams('/primerjava?a=1&b=2')

    await waitFor(() => {
      expect(fetch).toHaveBeenCalled()
    })

    expect(
      screen.queryByText('Janez Novak')
    ).not.toBeInTheDocument()
  })

  test('prikaže napako pri neveljavnem praznem odgovoru', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({})
    })

    renderWithParams('/primerjava?a=1&b=2')

    expect(
      await screen.findByText('Neveljaven odgovor strežnika')
    ).toBeInTheDocument()
  })

  test('prikaže napako pri null odgovoru API-ja', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => null
    })

    renderWithParams('/primerjava?a=1&b=2')

    expect(
      await screen.findByText('Neveljaven odgovor strežnika')
    ).toBeInTheDocument()
  })


  test('prikaže empty state, če ni skupnih podjetij', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        oseba_a: {
          id: 1,
          ime: 'Janez',
          priimek: 'Novak',
          stevilo_povezav: 1
        },
        oseba_b: {
          id: 2,
          ime: 'Marija',
          priimek: 'Kovač',
          stevilo_povezav: 1
        },
        skupna_podjetja: []
      })
    })

    renderWithParams('/primerjava?a=1&b=2')

    expect(
      await screen.findByText(
        /nimata skupnih podjetij/i
      )
    ).toBeInTheDocument()
  })

  test('pri enakem številu povezav sta obe osebi zmagovalki', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ...mockData,
        oseba_a: {
          ...mockData.oseba_a,
          stevilo_povezav: 5
        },
        oseba_b: {
          ...mockData.oseba_b,
          stevilo_povezav: 5
        }
      })
    })

    renderWithParams('/primerjava?a=1&b=2')

    await waitFor(() => {
      const winners = document.querySelectorAll('.prj-winner')

      expect(winners).toHaveLength(2)
      expect(winners[0]).toHaveTextContent('5')
      expect(winners[1]).toHaveTextContent('5')
    })
  })
})