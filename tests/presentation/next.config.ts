// Serve the actual production asset through the primary test server.
const config = {
  async rewrites() {
    return [{source:'/district.svg',destination:'http://localhost:3000/district.svg'}];
  },
};
export default config;
