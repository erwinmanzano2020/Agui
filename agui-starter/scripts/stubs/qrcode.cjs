module.exports = {
  toDataURL: async (text) => {
    const payload = Buffer.from(String(text)).toString("base64");
    return `data:image/png;base64,${payload}`;
  },
};
