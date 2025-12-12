import Cookies from 'js-cookie'

const TOKEN_KEY = 'bac_token'

export const getToken = () => {
  return Cookies.get(TOKEN_KEY)
}

export const setToken = (token) => {
  return Cookies.set(TOKEN_KEY, token)
}

export const removeToken = () => {
  return Cookies.remove(TOKEN_KEY)
}

