import { NavLink } from 'react-router'
import { SIDEBAR_ROUTES } from '@/config/routes'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { NavIcon } from './nav-icons'
import { cn } from '@/lib/utils'

/** Grouped navigation list, shared by the desktop sidebar and the mobile drawer. */
export function SidebarNav({
  collapsed = false,
  onNavigate,
}: {
  collapsed?: boolean
  onNavigate?: () => void
}) {
  return (
    <nav aria-label="Main" className="flex flex-col gap-5">
      {SIDEBAR_ROUTES.map(({ group, label, routes }) => (
        <div key={group} className="flex flex-col gap-0.5">
          {collapsed ? (
            <span className="mx-auto mb-1 h-px w-5 bg-sidebar-border" aria-hidden />
          ) : (
            <p className="px-3 pb-1 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
              {label}
            </p>
          )}
          <ul className="flex flex-col gap-0.5">
            {routes.map((r) => {
              const link = (
                <NavLink
                  to={r.path}
                  onClick={onNavigate}
                  aria-label={collapsed ? r.label : undefined}
                  className={({ isActive }) =>
                    cn(
                      'group relative flex h-9 items-center gap-3 rounded-lg px-3 text-[13.5px] font-medium text-sidebar-foreground transition-colors outline-none hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-[3px] focus-visible:ring-ring/40',
                      collapsed && 'justify-center px-0',
                      isActive && 'bg-sidebar-accent text-sidebar-accent-foreground',
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      {isActive && (
                        <span
                          aria-hidden
                          className="absolute top-1.5 bottom-1.5 left-0 w-[3px] rounded-r-full bg-primary"
                        />
                      )}
                      <NavIcon
                        name={r.icon}
                        aria-hidden
                        className={cn(
                          'size-[18px] shrink-0',
                          isActive
                            ? 'text-primary'
                            : 'text-subtle-foreground group-hover:text-current',
                        )}
                      />
                      {!collapsed && <span className="truncate">{r.label}</span>}
                    </>
                  )}
                </NavLink>
              )
              return (
                <li key={r.id}>
                  {collapsed ? (
                    <Tooltip>
                      <TooltipTrigger asChild>{link}</TooltipTrigger>
                      <TooltipContent side="right">{r.label}</TooltipContent>
                    </Tooltip>
                  ) : (
                    link
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </nav>
  )
}
