import { allTeamMembers } from "content-collections"
import MaxWidthWrapper from "@/components/blog/max-width-wrapper"
import { Metadata } from "next"
import { constructMetadata } from "@/lib/constructMetadata"
import BlurImage from "@/lib/blog/blur-image"
import { Twitter, Linkedin, Github, Mail } from "lucide-react"
import Link from "next/link"

export const metadata: Metadata = constructMetadata({
  title: "Our Team - Meet the People Behind HagenKit",
  description:
    "Meet the talented individuals building the future of collaboration at HagenKit.",
})

const departmentConfig = {
  executive: {
    title: "Leadership",
    description: "The executive team setting our vision and strategy",
  },
  engineering: {
    title: "Engineering",
    description: "Building robust and scalable solutions",
  },
  design: {
    title: "Design",
    description: "Creating beautiful and intuitive experiences",
  },
  marketing: {
    title: "Marketing",
    description: "Spreading the word and building our community",
  },
  sales: {
    title: "Sales",
    description: "Helping customers succeed with our platform",
  },
  operations: {
    title: "Operations",
    description: "Keeping everything running smoothly",
  },
}

export default function TeamPage() {
  // Group team members by department and sort by order
  const teamByDepartment = allTeamMembers
    .sort((a, b) => a.order - b.order)
    .reduce(
      (acc, member) => {
        if (!acc[member.department]) {
          acc[member.department] = []
        }
        acc[member.department].push(member)
        return acc
      },
      {} as Record<string, typeof allTeamMembers>
    )

  // Order departments: executive first, then others alphabetically
  const orderedDepartments = Object.keys(teamByDepartment).sort((a, b) => {
    if (a === "executive") return -1
    if (b === "executive") return 1
    return a.localeCompare(b)
  })

  return (
    <MaxWidthWrapper className="py-28">
      <div className="mx-auto max-w-6xl">
        {/* Page Header */}
        <div className="mb-16 text-center">
          <h1 className="font-display mb-4 text-4xl font-bold text-gray-900 sm:text-5xl">
            Meet Our Team
          </h1>
          <p className="mx-auto max-w-2xl text-xl text-gray-600">
            We're a passionate group of individuals dedicated to building the
            best collaboration platform for modern teams.
          </p>
        </div>

        {/* Team Members by Department */}
        {orderedDepartments.map((department) => {
          const config =
            departmentConfig[department as keyof typeof departmentConfig]
          const members = teamByDepartment[department]

          return (
            <div key={department} className="mb-16">
              <div className="mb-8 text-center">
                <h2 className="font-display mb-2 text-3xl font-bold text-gray-900">
                  {config.title}
                </h2>
                <p className="text-gray-600">{config.description}</p>
              </div>

              <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
                {members.map((member) => (
                  <div
                    key={member.slug}
                    className="group overflow-hidden rounded-lg border border-gray-200 bg-white transition-shadow hover:shadow-lg"
                  >
                    <div className="aspect-square overflow-hidden bg-gray-100">
                      <BlurImage
                        src={member.avatar}
                        alt={member.name}
                        width={400}
                        height={400}
                        className="h-full w-full object-cover transition-transform group-hover:scale-105"
                      />
                    </div>
                    <div className="p-6">
                      <h3 className="font-display mb-1 text-xl font-bold text-gray-900">
                        {member.name}
                      </h3>
                      <p className="mb-3 text-sm font-medium text-blue-600">
                        {member.role}
                      </p>
                      <p className="mb-4 line-clamp-3 text-sm leading-relaxed text-gray-600">
                        {member.bio}
                      </p>

                      {/* Social Links */}
                      <div className="flex items-center gap-3">
                        {member.twitter && (
                          <a
                            href={member.twitter}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-gray-400 transition-colors hover:text-blue-500"
                            aria-label={`${member.name} on Twitter`}
                          >
                            <Twitter className="h-4 w-4" />
                          </a>
                        )}
                        {member.linkedin && (
                          <a
                            href={member.linkedin}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-gray-400 transition-colors hover:text-blue-700"
                            aria-label={`${member.name} on LinkedIn`}
                          >
                            <Linkedin className="h-4 w-4" />
                          </a>
                        )}
                        {member.github && (
                          <a
                            href={member.github}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-gray-400 transition-colors hover:text-gray-900"
                            aria-label={`${member.name} on GitHub`}
                          >
                            <Github className="h-4 w-4" />
                          </a>
                        )}
                        {member.email && (
                          <a
                            href={`mailto:${member.email}`}
                            className="text-gray-400 transition-colors hover:text-gray-900"
                            aria-label={`Email ${member.name}`}
                          >
                            <Mail className="h-4 w-4" />
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        })}

        {/* Join Us CTA */}
        <div className="mt-16 rounded-xl border border-gray-200 bg-gradient-to-br from-blue-50 to-indigo-50 p-12 text-center">
          <h2 className="font-display mb-4 text-3xl font-bold text-gray-900">
            Want to Join Us?
          </h2>
          <p className="mx-auto mb-8 max-w-2xl text-lg text-gray-600">
            We're always looking for talented individuals to join our growing
            team. Check out our open positions and apply today.
          </p>
          <Link
            href="/careers"
            className="inline-flex items-center justify-center rounded-full bg-blue-600 px-8 py-3 font-medium text-white transition-colors hover:bg-blue-700"
          >
            View Open Positions
          </Link>
        </div>
      </div>
    </MaxWidthWrapper>
  )
}
