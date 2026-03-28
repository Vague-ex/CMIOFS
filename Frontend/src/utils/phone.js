export function normalizePhone(value = '') {
    return String(value).replace(/[\s-]/g, '')
}

export function clampPhilippinePhoneInput(value = '') {
    const raw = String(value)
    if (!raw) return ''

    // Allow only digits and a single leading plus.
    if (raw.startsWith('+')) {
        const digits = raw.replace(/\D/g, '')
        return `+${digits.slice(0, 12)}`
    }

    const digitsOnly = raw.replace(/\D/g, '')
    return digitsOnly.slice(0, 11)
}

export function isValidPhilippinePhone(value = '') {
    if (!value) return true
    const normalized = normalizePhone(value)
    return /^(09\d{9}|\+639\d{9})$/.test(normalized)
}

export const PH_PHONE_HINT = 'Use 09XXXXXXXXX or +639XXXXXXXXX'
export const PH_PHONE_MAX_LENGTH = 13
