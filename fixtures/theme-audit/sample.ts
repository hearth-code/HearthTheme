// Hearth fixture: TypeScript semantic coverage
type ID = string | number

enum BuildMode {
  Dev = 'dev',
  Prod = 'prod'
}

interface UserProfile {
  readonly id: ID
  name: string
  createdAt: Date
}

class Repository<T extends UserProfile> {
  constructor(private readonly records: Map<ID, T>) {}

  findById(id: ID): T | undefined {
    return this.records.get(id)
  }
}

const baseUrl = 'https://api.hearthcode.dev'
const timeoutMs = 5_000
const strict = true
const idPattern = /^[a-z0-9_-]+$/i
