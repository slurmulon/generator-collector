export const nanoid = (size = 5) => (Math.random() + 1).toString(36).substring(2, size + 2)

export default { nanoid }
