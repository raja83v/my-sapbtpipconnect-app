"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { IconCirclePlusFilled, IconMail, type Icon } from "@tabler/icons-react"

import { Button } from "@/components/ui/button"
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

type NavItem = {
  title: string
  url: string
  icon?: Icon
  match?: "exact" | "startsWith"
}

const normalizePath = (path: string) => {
  if (!path) return "/"
  return path === "/" ? path : path.replace(/\/+$/, "")
}

const getMatchScore = (item: NavItem, currentPath: string) => {
  const target = normalizePath(item.url)
  const path = normalizePath(currentPath)
  const match = item.match ?? "startsWith"

  if (target === "/") {
    return path === "/" ? Number.MAX_SAFE_INTEGER : -1
  }

  if (match === "exact") {
    return path === target ? target.length + 100 : -1
  }

  if (path === target) {
    return target.length + 100
  }

  if (path.startsWith(`${target}/`)) {
    return target.length
  }

  return -1
}

const findActiveItem = (items: NavItem[], pathname: string) => {
  let active: { item: NavItem; score: number } | null = null

  for (const item of items) {
    if (!item.url || item.url === "#") continue
    const score = getMatchScore(item, pathname)
    if (score < 0) continue
    if (!active || score > active.score) {
      active = { item, score }
    }
  }

  return active?.item
}

export function NavMain({ items }: { items: NavItem[] }) {
  const pathname = usePathname()
  const activeItem = findActiveItem(items, pathname)

  return (
    <SidebarGroup>
      <SidebarGroupContent className="flex flex-col gap-2">
        <SidebarMenu>
          <SidebarMenuItem className="flex items-center gap-2">
            <SidebarMenuButton
              tooltip="Quick Create"
              className="bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground active:bg-primary/90 active:text-primary-foreground min-w-8 duration-200 ease-linear"
            >
              <IconCirclePlusFilled />
              <span>Quick Create</span>
            </SidebarMenuButton>
            <Button
              size="icon"
              className="size-8 group-data-[collapsible=icon]:opacity-0"
              variant="outline"
            >
              <IconMail />
              <span className="sr-only">Inbox</span>
            </Button>
          </SidebarMenuItem>
        </SidebarMenu>
        <SidebarMenu>
          {items.map((item) => {
            const active = activeItem?.url === item.url

            return (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton
                  asChild
                  tooltip={item.title}
                  isActive={active}
                  aria-current={active ? "page" : undefined}
                >
                  <Link href={item.url} prefetch>
                    {item.icon && <item.icon />}
                    <span>{item.title}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
