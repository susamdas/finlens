import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { PAGES, routes } from '@/app/router'
import { TooltipProvider } from '@/components/ui/tooltip'
import { ROUTES, SIDEBAR_ROUTES } from '@/config/routes'
import { useUIStore } from '@/store/ui'

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  render(
    <TooltipProvider>
      <RouterProvider router={router} />
    </TooltipProvider>,
  )
  return router
}

describe('application shell', () => {
  beforeEach(() =>
    useUIStore.setState({ commandOpen: false, mobileNavOpen: false, settingsOpen: false }),
  )

  it('renders every sidebar section', async () => {
    renderAt('/overview')
    const nav = await screen.findByRole('navigation', { name: 'Main' }, { timeout: 5000 })
    for (const { routes: group } of SIDEBAR_ROUTES) {
      for (const r of group)
        expect(within(nav).getByRole('link', { name: r.label })).toBeInTheDocument()
    }
  })

  it('has a page for every route in the registry', () => {
    for (const r of ROUTES) expect(PAGES[r.id as keyof typeof PAGES], r.id).toBeTypeOf('function')
  })

  it('marks the active route', async () => {
    renderAt('/gaps')
    const nav = await screen.findByRole('navigation', { name: 'Main' }, { timeout: 5000 })
    expect(within(nav).getByRole('link', { name: 'Inclusion Gaps' })).toHaveAttribute(
      'aria-current',
      'page',
    )
  })

  it('renders a 404 for unknown paths', async () => {
    renderAt('/nowhere')
    expect(await screen.findByText(/isn’t on the map/, {}, { timeout: 5000 })).toBeInTheDocument()
  })

  it('opens global search with Ctrl+K and lists pages', async () => {
    renderAt('/overview')
    await screen.findByRole('navigation', { name: 'Main' }, { timeout: 5000 })
    await userEvent.keyboard('{Control>}k{/Control}')
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('Correlation Explorer')).toBeInTheDocument()
  })

  it('keeps filters in the URL', async () => {
    const router = renderAt('/compare?year=2021&metric=accountOwnership')
    await screen.findByRole('heading', { level: 1 }, { timeout: 5000 })
    expect(router.state.location.search).toBe('?year=2021&metric=accountOwnership')
  })
})
