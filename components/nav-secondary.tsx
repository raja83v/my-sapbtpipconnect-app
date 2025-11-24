"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import * as React from "react"
import { type Icon } from "@tabler/icons-react"

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

type SecondaryNavItem = {
  title: string
  url: string
  icon: Icon
}

const isActiveSecondaryPath = (currentPath: string, itemPath: string) => {
  if (!itemPath || itemPath === "#") return false
  return currentPath === itemPath
}

export function NavSecondary({
  items,
  ...props
}: {
  items: SecondaryNavItem[]
} & React.ComponentPropsWithoutRef<typeof SidebarGroup>) {
  const pathname = usePathname()

  return (
    <SidebarGroup {...props}>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => {
            const active = isActiveSecondaryPath(pathname, item.url)

            return (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton
                  asChild
                  isActive={active}
                  tooltip={item.title}
                  aria-current={active ? "page" : undefined}
                >
                  <Link href={item.url}>
                    <item.icon />
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
