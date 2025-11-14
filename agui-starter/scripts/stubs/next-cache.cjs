module.exports = {
  revalidateTag: async () => {},
  unstable_cache: (fn) => {
    return (...args) => fn(...args);
  },
};
