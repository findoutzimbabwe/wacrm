import { describe, it, expect } from 'vitest'
import { matchesPrivateNumber, normalizePrivatePhone } from './private-contacts'

describe('normalizePrivatePhone', () => {
  it('converts local Zimbabwe numbers to international', () => {
    expect(normalizePrivatePhone('0779236937', '263')).toBe('263779236937')
    expect(normalizePrivatePhone('077 923 6937', '263')).toBe('263779236937')
  })
  it('keeps international formats', () => {
    expect(normalizePrivatePhone('+263 77 923 6937')).toBe('263779236937')
    expect(normalizePrivatePhone('00263779236937')).toBe('263779236937')
    expect(normalizePrivatePhone('+44 7700 900123')).toBe('447700900123')
  })
  it('rejects junk', () => {
    expect(normalizePrivatePhone('mom')).toBeNull()
    expect(normalizePrivatePhone('123')).toBeNull()
  })
})

describe('matchesPrivateNumber', () => {
  it('matches the WhatsApp sender id against the list', () => {
    expect(matchesPrivateNumber('263779236937', ['263779236937'])).toBe(true)
    expect(matchesPrivateNumber('263779236938', ['263779236937'])).toBe(false)
  })
  it('tolerates a stray trunk zero', () => {
    expect(matchesPrivateNumber('2630779236937', ['263779236937'])).toBe(true)
  })
  it('never matches an empty sender', () => {
    expect(matchesPrivateNumber('', ['263779236937'])).toBe(false)
  })
})
