"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"

interface Tab {
  label: string
  value: string
  content: React.ReactNode
}

interface TabsProps {
  tabs: Tab[]
  defaultValue?: string
  className?: string
}

export function Tabs({ tabs, defaultValue, className }: TabsProps) {
  const [activeTab, setActiveTab] = useState(defaultValue || tabs[0]?.value)

  return (
    <div className={cn("my-6 w-full", className)}>
      <div className="flex gap-1 border-b border-gray-200 dark:border-gray-700">
        {tabs.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setActiveTab(tab.value)}
            className={cn(
              "rounded-t-lg px-4 py-2 text-sm font-medium transition-colors",
              activeTab === tab.value
                ? "border-b-2 border-blue-500 bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400"
                : "text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="rounded-b-lg border border-t-0 border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
        {tabs.map((tab) => (
          <div
            key={tab.value}
            className={cn(activeTab === tab.value ? "block" : "hidden")}
          >
            {tab.content}
          </div>
        ))}
      </div>
    </div>
  )
}

// Simple wrapper for code tabs
interface CodeTabsProps {
  children: React.ReactNode
  defaultValue?: string
}

export function CodeTabs({ children, defaultValue }: CodeTabsProps) {
  const tabs: Tab[] = []

  // Parse children to extract tab content
  const childArray = Array.isArray(children) ? children : [children]

  childArray.forEach((child: any) => {
    if (child?.props?.["data-language"]) {
      tabs.push({
        label: child.props["data-language"],
        value: child.props["data-language"].toLowerCase(),
        content: child,
      })
    }
  })

  if (tabs.length === 0) {
    return <div>{children}</div>
  }

  return <Tabs tabs={tabs} defaultValue={defaultValue} />
}
