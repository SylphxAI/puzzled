data "external_schema" "drizzle" {
  program = [
    "npx",
    "drizzle-kit",
    "export",
  ]
}

env "local" {
  dev = "docker://pgvector/pgvector/pg18/dev?search_path=public"

  schema {
    src = data.external_schema.drizzle.url
  }

  migration {
    dir = "file://atlas/migrations"
  }

  exclude = ["drizzle"]
}

env "ci" {
  dev = "docker://pgvector/pgvector/pg18/dev?search_path=public"

  schema {
    src = data.external_schema.drizzle.url
  }

  migration {
    dir = "file://atlas/migrations"
  }

  exclude = ["drizzle"]
}

env "production" {
  url = getenv("DATABASE_URL")

  migration {
    dir = "file://atlas/migrations"
  }
}