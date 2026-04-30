"use client"

import { Fragment, useMemo, useEffect, useState } from "react"
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
import { getIFlowDetails } from "@/app/actions/iflows"

type BreadcrumbEntry = {
  label: string
  href?: string
  isLoading?: boolean
}


const SEGMENT_NAME_MAP: Record<string, string> = {
  dashboard: "Dashboard",
  admin: "Admin",
  "sign-in": "Sign In",
  "sign-up": "Sign Up",
  iflows: "iFlows",
  apis: "APIs",
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
  const [iflowName, setIFlowName] = useState<string | null>(null)
  // For API Product detail pages, decode the name from the URL (no extra fetch needed)
  const [apiProductName, setApiProductName] = useState<string | null>(null)

  // Check if we're on an iFlow detail page and fetch the name
  useEffect(() => {
    const iflowMatch = pathname?.match(/^\/dashboard\/iflows\/([^/]+)$/)
    if (iflowMatch) {
      const iflowId = iflowMatch[1]
      getIFlowDetails(iflowId).then((result) => {
        if (result.success && result.data) {
          setIFlowName(result.data.name)
        }
      })
      setApiProductName(null)
      return
    }

    // Check if we're on an API Product detail page — decode name from URL
    const apiMatch = pathname?.match(/^\/dashboard\/apis\/([^/]+)$/)
    if (apiMatch) {
      setApiProductName(decodeURIComponent(apiMatch[1]))
      setIFlowName(null)
      return
    }

    setIFlowName(null)
    setApiProductName(null)
  }, [pathname])

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
      let label = formatSegment(segment)
      const isLast = index === pathSegments.length - 1

      // Special handling for iFlow detail pages — show iFlow name instead of ID
      const isIFlowDetailPage =
        pathSegments[0] === "dashboard" &&
        pathSegments[1] === "iflows" &&
        index === 2

      if (isIFlowDetailPage) {
        label = iflowName || "Loading…"
      }

      // Special handling for API Product detail pages — show decoded product name
      const isAPIProductDetailPage =
        pathSegments[0] === "dashboard" &&
        pathSegments[1] === "apis" &&
        index === 2

      if (isAPIProductDetailPage) {
        label = apiProductName || decodeURIComponent(segment)
      }

      return {
        label,
        href: isLast ? undefined : href,
        isLoading: isIFlowDetailPage && !iflowName,
      }
    })
  }, [pathname, iflowName, apiProductName])

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
