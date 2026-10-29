const config = {
  async rewrites() {
    return ['performance', 'expenses', 'monthly-detail'].map(section => ({ source:`/${section}`, destination:'/' }));
  },
};
export default config;
