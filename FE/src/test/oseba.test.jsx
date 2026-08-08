import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import Oseba from '../pages/Oseba'
import { generateOsebaPdf } from '../utils/generateOsebaPdf'

const mockPerson = {
id: 10,
ime: 'Janez',
priimek: 'Novak',
tip: 'klasicen',
zadnja_posodobitev: '2024-01-01',
fotografija_url: null,
povezave: [
{
podjetje_id: 99,
popolno_ime: 'Firma d.o.o.',
vloga: 'Direktor',
pravna_oblika: 'd.o.o.',
datum_od: '2020-01-01',
datum_do: null,
},
],
}

const mockClanki = [
{
id: 1,
vir: 'RTV',
naslov: 'Primer članka',
datum: '2024-01-10',
url: 'https://example.com',
},
]

const mockTveganje = {
score: 12,
indikatorji: {
st_funkcij: 1,
st_aktivnih_funkcij: 1,
st_podjetij: 1,
st_neaktivnih_podjetij: 0,
},
}

const mockFollow = vi.fn()
const mockUnfollow = vi.fn()
const mockToggle = vi.fn()
const mockSelectForCompare = vi.fn()
const mockClearCompare = vi.fn()
const mockTrack = vi.fn()

let mockIsFollowing = vi.fn(() => false)
let mockIsSaved = vi.fn(() => false)
let mockCandidate = null

beforeEach(() => {
vi.clearAllMocks()

mockIsFollowing = vi.fn(() => false)
mockIsSaved = vi.fn(() => false)
mockCandidate = null

global.fetch = vi.fn((url) => {
if (url.includes('/tveganje')) {
return Promise.resolve({
ok: true,
json: () => Promise.resolve(mockTveganje),
})
}

if (url.includes('/clanki')) {
  return Promise.resolve({
    ok: true,
    json: () => Promise.resolve(mockClanki),
  })
}

return Promise.resolve({
  ok: true,
  json: () => Promise.resolve(mockPerson),
})

})
})

vi.mock('react-router-dom', async () => {
const actual = await vi.importActual('react-router-dom')

return {
...actual,
useNavigate: () => mockNavigate,
}
})

const mockNavigate = vi.fn()

vi.mock('../components/Layout', () => ({
default: ({ children }) => <>{children}</>,
}))

vi.mock('../components/Avatar', () => ({
default: ({ name }) => <div data-testid="avatar">{name}</div>,
}))

vi.mock('../components/ShareBtn', () => ({
default: (props) => ( <div
   data-testid="share-btn"
   data-url={props.url}
   data-name={props.name}
 >
Share </div>
),
}))

vi.mock('../components/RiskScoreCard', () => ({
default: ({ data, loading }) => ( <div data-testid="risk-score-card">
{loading && <span>Loading risk</span>}

```
  {data && (
    <>
      <span>RiskScoreCard</span>
      <span data-testid="risk-score">{data.score}</span>
      <span data-testid="risk-functions">
        {data.indikatorji.st_funkcij}
      </span>
      <span data-testid="risk-companies">
        {data.indikatorji.st_podjetij}
      </span>
    </>
  )}

  {!loading && !data && <span>No risk data</span>}
</div>

),
}))

vi.mock('../hooks/usePersonStorage', () => ({
useSavedPersons: () => ({
toggle: mockToggle,
isSaved: mockIsSaved,
}),

useRecentlyViewed: () => ({
track: mockTrack,
}),

useComparison: () => ({
candidate: mockCandidate,
select: mockSelectForCompare,
clear: mockClearCompare,
}),
}))

vi.mock('../hooks/useWatchlist', () => ({
useWatchlist: () => ({
isFollowing: mockIsFollowing,
follow: mockFollow,
unfollow: mockUnfollow,
loading: false,
}),
}))

vi.mock('../api', () => ({
API: 'http://test-api',
}))

vi.mock('../utils/generateOsebaPdf', () => ({
generateOsebaPdf: vi.fn(),
}))

function renderPage(id = 10) {
return render(
<MemoryRouter initialEntries={[`/oseba/${id}`]}> <Routes>
<Route path="/oseba/:id" element={<Oseba />} />
<Route path="*" element={<div>Other page</div>} /> </Routes> </MemoryRouter>
)
}

describe('Oseba page', () => {
it('prikaže loading state', () => {
renderPage()

expect(screen.getByText(/nalagam/i)).toBeInTheDocument()
})

it('prikaže osnovne podatke osebe', async () => {
renderPage()

expect(
  await screen.findByRole('heading', {
    name: /Janez Novak/i,
  })
).toBeInTheDocument()

expect(
  screen.getByText(/Direktor.*Firma d\.o\.o\./i)
).toBeInTheDocument()

})

it('prikaže povezave', async () => {
renderPage()

const connCard = await screen.findByRole('link', {
  name: /Firma d\.o\.o\./i,
})

expect(connCard).toBeInTheDocument()

const utils = within(connCard)

expect(utils.getByText('Direktor')).toBeInTheDocument()
expect(utils.getByText('d.o.o.')).toBeInTheDocument()
})

it('prikaže članke (omembe v medijih)', async () => {
renderPage()

expect(
  await screen.findByText(/Primer članka/i)
).toBeInTheDocument()

expect(screen.getByText(/RTV/i)).toBeInTheDocument()

})

it('člankov ne prikaže, če je seznam prazen', async () => {
global.fetch = vi.fn((url) => {
if (url.includes('/tveganje')) {
return Promise.resolve({
ok: true,
json: () => Promise.resolve(mockTveganje),
})
}

  if (url.includes('/clanki')) {
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve([]),
    })
  }

  return Promise.resolve({
    ok: true,
    json: () => Promise.resolve(mockPerson),
  })
})

renderPage()

await screen.findByRole('heading', {
  name: /Janez Novak/i,
})

expect(screen.queryByText(/Omembe v medijih/i)).not.toBeInTheDocument()
expect(screen.queryByText(/Primer članka/i)).not.toBeInTheDocument()

})

it('fetch se pokliče za osebo, članke in tveganje', async () => {
renderPage()
await waitFor(() => {
  expect(global.fetch).toHaveBeenCalledWith(
    expect.stringContaining('/osebe/10'),
    expect.any(Object)
  )

  expect(global.fetch).toHaveBeenCalledWith(
    expect.stringContaining('/clanki'),
    expect.any(Object)
  )

  expect(global.fetch).toHaveBeenCalledWith(
    expect.stringContaining('/tveganje'),
    expect.any(Object)
  )
})

})

it('RiskScoreCard dobi mockTveganje podatke', async () => {
renderPage()

expect(await screen.findByTestId('risk-score-card')).toBeInTheDocument()

expect(screen.getByTestId('risk-score')).toHaveTextContent('12')
expect(screen.getByTestId('risk-functions')).toHaveTextContent('1')
expect(screen.getByTestId('risk-companies')).toHaveTextContent('1')
})

it('gumb Sledi pokliče follow(data)', async () => {
const user = userEvent.setup()

renderPage()

const button = await screen.findByRole('button', {
  name: /Sledi$/i,
})

await user.click(button)

expect(mockFollow).toHaveBeenCalledWith(mockPerson)
})

it('prikaže stanje Slediš in klik pokliče unfollow(id)', async () => {
mockIsFollowing = vi.fn(() => true)

const user = userEvent.setup()

renderPage()

const button = await screen.findByRole('button', {
  name: /Slediš/i,
})

expect(button).toBeInTheDocument()
expect(button.className).toContain('active')

await user.click(button)

expect(mockUnfollow).toHaveBeenCalledWith(mockPerson.id)
})

it('gumb Shrani pokliče toggle(data)', async () => {
const user = userEvent.setup()

renderPage()

const button = await screen.findByRole('button', {
  name: /Shrani/i,
})

await user.click(button)

expect(mockToggle).toHaveBeenCalledWith(mockPerson)
})

it('prikaže stanje Shranjeno', async () => {
mockIsSaved = vi.fn(() => true)

renderPage()

const button = await screen.findByRole('button', {
  name: /Shranjeno/i,
})

expect(button).toBeInTheDocument()
expect(button.className).toContain('saved')
})

it('PDF gumb kliče generateOsebaPdf z osebo in članki', async () => {
const user = userEvent.setup()

renderPage()

const button = await screen.findByRole('button', {
  name: /Prenesi PDF/i,
})

await user.click(button)

expect(generateOsebaPdf).toHaveBeenCalledWith(
  mockPerson,
  mockClanki
)

})

it('Odpri v omrežju vodi na /omrezje/10', async () => {
renderPage()

const link = await screen.findByRole('link', {
  name: /Odpri v omrežju/i,
})

expect(link).toHaveAttribute('href', '/omrezje/10')
})

it('Vprašaj AI vsebuje pravilen URL', async () => {
renderPage()

const link = await screen.findByRole('link', {
  name: /Vprašaj AI/i,
})

expect(link).toHaveAttribute(
  'href',
  '/asistent?q=Janez%20Novak'
)

})

it('gumb Nazaj pokliče navigate(-1)', async () => {
const user = userEvent.setup()

renderPage()

const button = await screen.findByRole('button', {
  name: /← Nazaj/i,
})

await user.click(button)

expect(mockNavigate).toHaveBeenCalledWith(-1)

})

it('prikaže ShareBtn s pravilnimi podatki', async () => {
renderPage()

const share = await screen.findByTestId('share-btn')

expect(share).toHaveAttribute('data-url', '/oseba/10')
expect(share).toHaveAttribute('data-name', 'Janez Novak')
})

it('prikaže datum zadnje posodobitve', async () => {
renderPage()

expect(
  await screen.findByText(/Zadnja posodobitev: 1\. 1\. 2024/i)
).toBeInTheDocument()
})

it('prikaže obdobje povezave z datumom od in danes', async () => {
renderPage()

expect(await screen.findByText(/1\. 1\. 2020\s*–\s*danes/i))
  .toBeInTheDocument()

})

it('prikaže akademski profil', async () => {
  const academicPerson = {
  ...mockPerson,
  tip: 'akademik',
  opis: 'Profesor in raziskovalec',
  podrocja: 'Umetna inteligenca · Strojno učenje',
  profil_url: 'https://ii.feri.um.si/profil/janez',
  }

  global.fetch = vi.fn((url) => {
    if (url.includes('/tveganje')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockTveganje),
      })
    }

    if (url.includes('/clanki')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockClanki),
      })
    }

    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve(academicPerson),
    })
  })

  renderPage()

  expect(
    await screen.findByText('Profesor in raziskovalec')
  ).toBeInTheDocument()

expect(
  screen.getByText('Področja raziskovanja')
).toBeInTheDocument()

expect(
  screen.getByText('Umetna inteligenca')
).toBeInTheDocument()

expect(
  screen.getByText('Strojno učenje')
).toBeInTheDocument()

const profileLink = screen.getByRole('link', {
  name: /Odpri profil na ii\.feri\.um\.si/i,
})

expect(profileLink).toHaveAttribute(
  'href',
  academicPerson.profil_url
)

})

it('prikaže možnost primerjave z drugo osebo', async () => {
mockCandidate = {
id: 20,
ime: 'Ana',
priimek: 'Kovač',
}

renderPage()

const compareLink = await screen.findByRole('link', {
  name: /Primerjaj z Ana Kovač/i,
})

expect(compareLink).toBeInTheDocument()
expect(compareLink).toHaveAttribute(
  'href',
  '/primerjava?a=20&b=10'
)

})

it('ko ni candidate, klik Primerjaj pokliče selectForCompare(data)', async () => {
const user = userEvent.setup()

mockCandidate = null

renderPage()

const button = await screen.findByRole('button', {
  name: /Primerjaj$/i,
})

await user.click(button)

expect(mockSelectForCompare).toHaveBeenCalledWith(mockPerson)

})

it('ko je oseba izbrana, klik Prekliči primerjavo pokliče clearCompare()', async () => {
const user = userEvent.setup()

mockCandidate = {
  id: 10,
  ime: 'Janez',
  priimek: 'Novak',
}

renderPage()

const button = await screen.findByRole('button', {
  name: /Prekliči primerjavo/i,
})

await user.click(button)

expect(mockClearCompare).toHaveBeenCalled()

})

it('napaka pri nalaganju osebe prikaže Oseba ni najdena', async () => {
global.fetch = vi.fn((url) => {
if (url.includes('/osebe/10') && !url.includes('/clanki') && !url.includes('/tveganje')) {
return Promise.resolve({
ok: false,
json: () => Promise.resolve({}),
})
}
  if (url.includes('/tveganje')) {
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve(mockTveganje),
    })
  }

  return Promise.resolve({
    ok: true,
    json: () => Promise.resolve([]),
  })
})

renderPage()

expect(
  await screen.findByText('Oseba ni najdena')
).toBeInTheDocument()

})

it('napaka pri tveganju ne podre strani in RiskScoreCard dobi null', async () => {
global.fetch = vi.fn((url) => {
if (url.includes('/tveganje')) {
return Promise.resolve({
ok: false,
json: () => Promise.resolve({}),
})
}

  if (url.includes('/clanki')) {
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve(mockClanki),
    })
  }

  return Promise.resolve({
    ok: true,
    json: () => Promise.resolve(mockPerson),
  })
})

renderPage()

expect(
  await screen.findByRole('heading', {
    name: /Janez Novak/i,
  })
).toBeInTheDocument()

expect(screen.getByText('No risk data')).toBeInTheDocument()

})

it('profil se izriše tudi brez povezav oziroma first podatka', async () => {
const personWithoutConnections = {
...mockPerson,
povezave: [],
}

global.fetch = vi.fn((url) => {
  if (url.includes('/tveganje')) {
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve(mockTveganje),
    })
  }

  if (url.includes('/clanki')) {
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve([]),
    })
  }

  return Promise.resolve({
    ok: true,
    json: () => Promise.resolve(personWithoutConnections),
  })
})

renderPage()

expect(
  await screen.findByRole('heading', {
    name: /Janez Novak/i,
  })
).toBeInTheDocument()

expect(
  screen.queryByText('Vloga')
).not.toBeInTheDocument()

expect(
  screen.getByText('Ni znanih povezav')
).toBeInTheDocument()

})

it('useEffect cleanup uporablja AbortController pri unmountu', async () => {
const abortSpy = vi.spyOn(AbortController.prototype, 'abort')

const { unmount } = renderPage()

await waitFor(() => {
  expect(global.fetch).toHaveBeenCalled()
})

unmount()

expect(abortSpy).toHaveBeenCalled()

abortSpy.mockRestore()

})

it('prazne povezave prikaže kot Ni znanih povezav', async () => {
global.fetch = vi.fn((url) => {
if (url.includes('/tveganje')) {
return Promise.resolve({
ok: true,
json: () => Promise.resolve(mockTveganje),
})
}
  if (url.includes('/clanki')) {
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve([]),
    })
  }

  return Promise.resolve({
    ok: true,
    json: () =>
      Promise.resolve({
        ...mockPerson,
        povezave: [],
      }),
  })
})

renderPage()

expect(
  await screen.findByText('Ni znanih povezav')
).toBeInTheDocument()

})
})
