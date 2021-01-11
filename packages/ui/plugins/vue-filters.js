import Vue from 'vue'

const dateOptions = {
  year: `numeric`,
  month: `2-digit`,
  day: `2-digit`,
  hour12: false,
  timeZone: `Europe/Paris`,
}

Vue.filter(`userStatus`, (value, locale = `fr`) => {
  if (typeof value.status !== `string`) return `–`
  return value.status.replace(/-/g, ` `)
})

Vue.filter(`dateTime`, (value, locale = `fr`) => {
  if (typeof value !== `string`) return `–`
  const date = new Date(value)
  const dateFormatter = new Intl.DateTimeFormat(locale, dateOptions).format
  return dateFormatter(date)
})

const preciseDateOptions = {
  year: `numeric`,
  month: `2-digit`,
  day: `2-digit`,
  hour: `2-digit`,
  minute: `2-digit`,
  hour12: false,
  timeZone: `Europe/Paris`,
}

Vue.filter(`preciseDateTime`, (value, locale = `fr`) => {
  if (typeof value !== `string`) return `–`
  const date = new Date(value)
  const dateFormatter = new Intl.DateTimeFormat(locale, preciseDateOptions)
    .format
  return dateFormatter(date)
})

Vue.filter(`capitalize`, value => {
  if (!value) return ``
  value = String(value)
  return value.charAt(0).toUpperCase() + value.slice(1)
})

Vue.filter(`capitalizeEach`, value => {
  if (!value) return ``
  value = String(value)
  return value.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
  // return value.charAt(0).toUpperCase() + value.slice(1)
})
