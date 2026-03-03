export const authFetch = (url, options = {}) => {
  const token = localStorage.getItem('auth_token');
  return fetch(url, {
    ...options,
    headers: {
      'x-auth-token': token,
      ...options.headers,
    },
  });
};
