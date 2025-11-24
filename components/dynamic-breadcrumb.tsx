"use client"

import { Fragment, useMemo } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Slash } from "lucide-react"

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"

type BreadcrumbEntry = {
  label: string
  href?: string
}


const SEGMENT_NAME_MAP: Record<string, string> = {
  dashboard: "Dashboard",
  admin: "Admin",
  "sign-in": "Sign In",
  "sign-up": "Sign Up",
}

const formatSegment = (segment: string) => {
  const decoded = decodeURIComponent(segment)
  if (decoded in SEGMENT_NAME_MAP) {
    return SEGMENT_NAME_MAP[decoded]
  }

  return decoded
    .replace(/[-_]/g, " ")
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")
}

export function DynamicBreadcrumb() {
  const pathname = usePathname()

  const breadcrumbs = useMemo((): BreadcrumbEntry[] => {
    if (!pathname) {
      return []
    }

    if (pathname === "/") {
      return [{ label: "Home" }]
    }

    const pathSegments = pathname.split("/").filter(Boolean)

    return pathSegments.map((segment, index) => {
      const href = `/${pathSegments.slice(0, index + 1).join("/")}`
      const label = formatSegment(segment)
      const isLast = index === pathSegments.length - 1

      return {
        label,
        href: isLast ? undefined : href,
      }
    })
  }, [pathname])

  if (breadcrumbs.length === 0) {
    return null
  }

  return (
    <Breadcrumb>
      <BreadcrumbList>
        {breadcrumbs.map((crumb, index) => {
          const isLast = index === breadcrumbs.length - 1

          return (
            <Fragment key={`${crumb.href ?? crumb.label}-${index}`}>
              <BreadcrumbItem>
                {isLast || !crumb.href ? (
                  <BreadcrumbPage className="text-base font-medium">
                    {crumb.label}
                  </BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild className="text-base font-medium">
                    <Link href={crumb.href}>{crumb.label}</Link>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
              {!isLast ? (
                <BreadcrumbSeparator>
                  <Slash />
                </BreadcrumbSeparator>
              ) : null}
            </Fragment>
          )
        })}
      </BreadcrumbList>
    </Breadcrumb>
  )
}
