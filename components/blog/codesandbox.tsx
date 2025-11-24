"use client"

interface CodeSandboxProps {
  id: string
  title?: string
  height?: string | number
  view?: "editor" | "preview" | "split"
  module?: string
  hideNavigation?: boolean
  hideDevTools?: boolean
  theme?: "light" | "dark"
}

export function CodeSandbox({
  id,
  title = "CodeSandbox",
  height = 500,
  view = "split",
  module,
  hideNavigation = false,
  hideDevTools = false,
  theme = "dark",
}: CodeSandboxProps) {
  // Build the embed URL with query parameters
  const params = new URLSearchParams({
    view: view,
    hidenavigation: hideNavigation ? "1" : "0",
    hidedevtools: hideDevTools ? "1" : "0",
    theme: theme,
  })

  if (module) {
    params.append("module", module)
  }

  const embedUrl = `https://codesandbox.io/embed/${id}?${params.toString()}`

  return (
    <div className="my-8">
      <iframe
        src={embedUrl}
        style={{
          width: "100%",
          height: typeof height === "number" ? `${height}px` : height,
          border: 0,
          borderRadius: "8px",
          overflow: "hidden",
        }}
        title={title}
        allow="accelerometer; ambient-light-sensor; camera; encrypted-media; geolocation; gyroscope; hid; microphone; midi; payment; usb; vr; xr-spatial-tracking"
        sandbox="allow-forms allow-modals allow-popups allow-presentation allow-same-origin allow-scripts"
        className="border border-gray-200 dark:border-gray-700"
      />
    </div>
  )
}

// StackBlitz component for alternative code playground
interface StackBlitzProps {
  id: string
  title?: string
  height?: string | number
  view?: "editor" | "preview"
  file?: string
  hideNavigation?: boolean
  theme?: "light" | "dark"
}

export function StackBlitz({
  id,
  title = "StackBlitz",
  height = 500,
  view = "editor",
  file,
  hideNavigation = false,
  theme = "dark",
}: StackBlitzProps) {
  // Build the embed URL
  let embedUrl = `https://stackblitz.com/edit/${id}?embed=1&view=${view}`

  if (file) {
    embedUrl += `&file=${file}`
  }

  if (hideNavigation) {
    embedUrl += "&hideNavigation=1"
  }

  if (theme) {
    embedUrl += `&theme=${theme}`
  }

  return (
    <div className="my-8">
      <iframe
        src={embedUrl}
        style={{
          width: "100%",
          height: typeof height === "number" ? `${height}px` : height,
          border: 0,
          borderRadius: "8px",
          overflow: "hidden",
        }}
        title={title}
        allow="accelerometer; ambient-light-sensor; camera; encrypted-media; geolocation; gyroscope; hid; microphone; midi; payment; usb; vr; xr-spatial-tracking"
        sandbox="allow-forms allow-modals allow-popups allow-presentation allow-same-origin allow-scripts"
        className="border border-gray-200 dark:border-gray-700"
      />
    </div>
  )
}
