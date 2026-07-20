import { ApiError, handleApiError } from '@/lib/api/errors'

describe('ApiError', () => {
  it('creates error with status and message', () => {
    const err = new ApiError('Not found', 404)
    expect(err.message).toBe('Not found')
    expect(err.status).toBe(404)
  })
})

describe('handleApiError', () => {
  it('handles ApiError', () => {
    const err = new ApiError('Invalid plate', 400)
    const result = handleApiError(err)
    expect(result.status).toBe(400)
    expect(result.body.error).toBe('Invalid plate')
  })

  it('handles generic errors', () => {
    const err = new Error('Database connection failed')
    const result = handleApiError(err)
    expect(result.status).toBe(500)
    expect(result.body.error).toContain('Internal server error')
  })

  it('handles unknown errors', () => {
    const result = handleApiError('some string')
    expect(result.status).toBe(500)
  })
})
