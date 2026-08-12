import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // GitHub Pages serves this project below /molecularmotion/.
  // Local development keeps the normal root URL.
  output: "export",
  basePath: process.env.GITHUB_ACTIONS === "true" ? "/molecularmotion" : "",
};

export default nextConfig;
