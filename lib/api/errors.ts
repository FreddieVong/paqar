export class ApiError extends Error {
  constructor(
    message: string,
    public status: number = 500
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export function handleApiError(error: unknown): {
  status: number
  body: { error: string; message?: string }
} {
  if (error instanceof ApiError) {
    return {
      status: error.status,
      body: { error: error.message },
    }
  }

  if (error instanceof Error) {
    // Don't leak internal error details in 5xx responses
    return {
      status: 500,
      body: { error: 'Internal server error', message: process.env.NODE_ENV === 'development' ? error.message : undefined },
    }
  }

  return {
    status: 500,
    body: { error: 'Internal server error' },
  }
}
